import * as path from 'path';
import * as express from 'express';
import * as logger from 'morgan';
import * as bodyParser from 'body-parser';

import { Bluetoothctl, bluetoothEvents } from './bluetoothctl';

const fs = require('fs');

interface Device {
    name: string;
    macAddress: string;
    visible: boolean;
}

// Creates and configures an ExpressJS web server.
class App {

  // ref to Express instance
  public express: express.Application;
  
  // Inner state
  private blue: Bluetoothctl = null;
  private devices: Array<Device> = [];
  private currentDevice: Device = { name: '', macAddress: '', visible: false };
  private hasBluetooth: boolean = false;
  private isScanning: boolean = false;
  private currentMacAddress: string = '';

  //Run configuration methods on the Express instance.
  constructor() {
    this.express = express();
    this.middleware();
    this.routes();
    
    this.setupBluetoothctl();
  }

  // Configure Express middleware.
  private middleware(): void {
    this.express.use(logger('dev'));
    this.express.use(bodyParser.json());
    this.express.use(bodyParser.urlencoded({ extended: false }));
  }

  // Configure API endpoints.
  private routes(): void {
    let router = express.Router();
    // super basic route handler
    router.get('/getState', (req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.json({
            devices: this.devices,
            currentDevice: this.currentDevice,
            hasBluetooth: this.hasBluetooth,
            isScanning: this.isScanning
        });
    });
    router.get('/connect/:macaddress', (req, res, next) => {
        // Handle this!
        this.connectToDevice(req.params.macaddress);
        
        res.header("Access-Control-Allow-Origin", "*");
        res.json({
            success: 1
        });
    });
    router.get('/startScan', (req, res, next) => {
        this.startScan();
        
        res.header("Access-Control-Allow-Origin", "*");
        res.json({
            success: 1
        });
    });
    this.express.use('/', router);
  }

  private setupBluetoothctl() {
    let _this: App = this;
            
      const fs = require('fs');
      fs.readFile('/home/pi/user_speaker.json', 'utf8', function readFileCallback(err, data){
          if (err) {
              return;
          } else {
              _this.currentMacAddress = JSON.parse(data).macAddress;
          }
      });
      
      this.blue = new Bluetoothctl((type: string, data: any) => {
          if (type === bluetoothEvents.Device) {
              
              // Parse out non-audio devices
              let _devices = new Array<Device>();
          
              data.forEach((device: any) => {
                  if (device.icon === 'audio-card') {
                      
                      _devices.push({ 'name': device.name, 'macAddress': device.mac, 'visible': device.signal != 0 });
                  
                      // Set currently connected device if needed
                      if (device.mac === _this.currentMacAddress) {
                          _this.currentDevice = { 'name': device.name, 'macAddress': device.mac, 'visible': device.signal != 0 };
                      }
                  }
              });
          
              _this.devices = _devices;
          
              console.log('all devices:' + JSON.stringify(data, null, 2));
              console.log('filtered devices:' + JSON.stringify(_this.devices, null, 2));
              
          } else if (type === bluetoothEvents.PassKey) {
              
              // Auto-accept passkey if needed
              console.log('Confirm passkey:' + data);
              _this.blue.confirmPassKey(true);
              
          } else if (type === bluetoothEvents.Controller) {
              // CHECKME: Controllers? Does this handle hardware state?
              console.log('Controllers:' + JSON.stringify(data, null, 2));
              _this.hasBluetooth = _this.blue.checkBluetoothController();
          }
      });
      
      this.hasBluetooth = this.blue.checkBluetoothController();
      console.log('system has bluetooth controller:' + this.hasBluetooth);
      
      // Fetch current devices
      this.blue.getDevicesFromController();
      
      // Start scanning if possible
      if (this.hasBluetooth) {
          console.log('isBluetooth Ready:' + this.blue.isBluetoothReady);
          this.startScan();
      }
  }
  
  private connectToDevice(macAddress: string) {
      this.doConnect(macAddress);
  }
  
  private startScan() {
      console.log('starting scan');
      this.blue.scan(true);
      this.isScanning = true;
      
      let _this: App = this;
      setTimeout(function(){
          console.log('stopping scan');
          _this.blue.scan(false);
          _this.isScanning = false;
          
          /*setTimeout(function() {
              // Restarting scan
              _this.startScan();
          }, 10000);*/
      }, 20000);
  }
  
  private doConnect(macAddress: string) {
      if (!this.isPaired(macAddress)) {
          this.doPair(macAddress);
      }
      
      if (!this.isTrusted(macAddress)) {
          this.doTrust(macAddress);
      }
      
      // Disconnect from current device
      console.log('Disconnecting from ' + this.currentMacAddress);
      let previousMacAddress = this.currentMacAddress;
      this.blue.disconnect(previousMacAddress);
      
      let _this: App = this;
      setTimeout(function() {
          console.log('connecting to: ' + macAddress);
          _this.blue.connect(macAddress);
      
          _this.persistMacAddress(macAddress);
      
          _this.trySwitchSink(macAddress);
          
          // refresh device list
          _this.blue.getDevicesFromController();
      }, 1000);
  }
  
  private trySwitchSink(macAddress: string) {
      let _this: App = this;
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
              _this.trySwitchSink(macAddress);
          }
      }, 3000);
  }
  
  private doPair(macAddress: string) {
      this.blue.pair(macAddress);
  }
  
  private doTrust(macAddress: string) {
      this.blue.trust(macAddress);
  }
  
  private persistMacAddress(macAddress: string) {
      this.currentMacAddress = macAddress;
      
      // Store to disk as json.
      var json = JSON.stringify({ macAddress: macAddress });
      fs.writeFile('/home/pi/user_speaker.json', json, 'utf8', function(err) {
          if (err) throw err;
          console.log('complete');
      }
);
  }
  
  private isPaired(macAddress: string) {
      return false;
  }
  
  private isTrusted(macAddress: string) {
      return false;
  }
}

export default new App().express;

