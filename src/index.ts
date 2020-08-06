import * as http from 'http';

import App from './App';
import { Bluetoothctl, bluetoothEvents } from './bluetoothctl';

const port = normalizePort(process.env.PORT || 3000);
App.set('port', port);

const server = http.createServer(App);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

doLaunchSetup();

function normalizePort(val: number|string): number|string|boolean {
  let port: number = (typeof val === 'string') ? parseInt(val, 10) : val;
  if (isNaN(port)) return val;
  else if (port >= 0) return port;
  else return false;
}

function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') throw error;
  let bind = (typeof port === 'string') ? 'Pipe ' + port : 'Port ' + port;
  switch(error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening(): void {
  let addr = server.address();
  let bind = (typeof addr === 'string') ? `pipe ${addr}` : `port ${addr.port}`;
  console.log(`Listening on ${bind}`);
}

function doLaunchSetup() {
    // Setup loopback sink/source
    var shell = require('shelljs');

    const { stdout, stderr, code } = shell.exec('pactl list | grep loopback', { silent: true });
    if (stdout === '') {
        console.log('setting up loopback and unloading alsa');
        shell.exec('pactl load-module module-loopback latency_msec=1');
    } else {
        console.log('DEBUG: not setting up loopback');
    }
    
    // Get last known device, and connect to it.
    const fs = require('fs');
    fs.readFile('/home/pi/user_speaker.json', 'utf8', function readFileCallback(err, data){
        if (err) {
            console.log(err);
        } else {
            let bluetoothCtl = new Bluetoothctl((type: string, data: any) => {});
            
            setTimeout(function() {
            
                let macAddress = JSON.parse(data).macAddress;
                console.log('connecting to: ' + macAddress);
            
                bluetoothCtl.connect(macAddress);
            
                trySwitchSink(macAddress);
            }, 3000);
        }
    });
}

function trySwitchSink(macAddress: string): void {
    setTimeout(function() {
        // Now, revise pactl stuff to output to this sink instead!
        // Need to find: sink (eg. bluez_sink.FC_A8_9A_2C_EB_0B) and stream index (e.g. 5)
        // pacmd set-default-sink <sink> & pacmd move-sink-input 5 <sink>
    
        let sinkName: string = 'bluez_sink.' + macAddress.replace(/:/g, "_") + '.a2dp_sink';
        let command: string = 'pactl set-default-sink ' + sinkName + ' && pactl move-sink-input 0 ' + sinkName;
        console.log('switching to sink: ' + sinkName + ', with command: \n' + command);
    
        var shell = require('shelljs');
        const { stdout, stderr, code } = shell.exec(command);
        
        if (stdout === 'Failure: No such entity' || stderr === 'Failure: No such entity') {
            // Try again
            console.log('trying sink again...');
            trySwitchSink(macAddress);
        }
    }, 3000);
}