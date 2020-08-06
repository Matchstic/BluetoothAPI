var pty = null;
try {
    pty = require('ptyw.js/lib/pty.js');
} catch (e) {
    console.log('Failed to load pty: ' + e);
    pty = null;
}
const ransi = require('strip-ansi');
var os = require('os');

export const bluetoothEvents = {
    Device: 'DeviceEvent',
    Controller: 'ControllerEvent',
    DeviceSignalLevel: 'DeviceSignalLevel',
    Connected: 'Connected',
    Paired: 'Paired',
    AlreadyScanning: 'AlreadyScanning',
    PassKey: 'PassKey'
}

export class Bluetoothctl {
    public devices = [];
    public controllers = [];
    public isBluetoothControlExists = false;
    public isBluetoothReady = false;
    public isScanning = false;
    public isConfirmingPassKey = false;
    
    private callback = null;
    private term = null;
    
    constructor(callback) {
        this.callback = callback;
        this.configureTerminal();
    }
    
    private configureTerminal() {
        if (pty === null) {
            this.term = {
                write: () => {}
            };
            
            return;
        }
        
        this.term = pty.spawn('bash', [], {
            name: 'xterm-color',
            cols: 100,
            rows: 40,
            cwd: process.env.HOME,
            env: process.env
        });
        
        if (this.term === null) {
            console.log('ERROR: term is null!');
            return;
        }
        
        if (os.platform() == 'linux') {
            this.term.write('type bluetoothctl\r');
        }
        
        let _this: Bluetoothctl = this;
        this.term.on('data', function (data) {
            
            data = ransi(data).replace('[bluetooth]#', '');
            data = data.replace('[Echo Plus-3VH]#', '');
            data = data.replace('[I-WAVE]#', '');
                
            let index = data.indexOf(']#');
            if (index != -1) {
                // Strip extra?
                data = data.substring(index + 2);
            }
            
            if (data.indexOf('bluetoothctl is ') !== -1 && data.indexOf('/usr/bin/bluetoothctl') !== -1) {
                _this.isBluetoothControlExists = true
                _this.isBluetoothReady = true;
                console.log('bluetooth controller exists')
                _this.term.write('bluetoothctl\r');
                _this.term.write('power on\r');
                _this.term.write('agent on\r');
                setInterval(_this.checkInfo, 5000, _this)
            }
            
            //console.log("mydata:" + data)
            var regexdevice = /(\[[A-Z]{3,5}\])?\s?Device\s([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\s(?!RSSI)(?!Class)(?!Icon)(?!not available)(?!UUIDs:)(?!Connected)(?!Paired)(?![0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})(?!\s)(.+)/gm;
            var regexcontroller = /\[[A-Z]{3,5}\]?\s?Controller\s([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\s(?!Discovering)(.+) /gm;
            var regexsignal = /\[[A-Z]{3,5}\]?\s?Device\s([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\sRSSI:\s-(.+)/gm;
            var regexinfo = /Device ([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\r?\n?\t?Name: (.+)\r?\n?\t?Alias: (.+)\r?\n?\t?Class: (.+)\r?\n?\t?Icon: (.+)\r?\n?\t?Paired: (.+)\r?\n?\t?Trusted: (.+)\r?\n?\t?Blocked: (.+)\r?\n?\t?Connected: (.+)\r?\n?\t?/gmi;

            var regexconnected = /\[[A-Z]{3,5}\]?\s?Device\s([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\sConnected:\s([a-z]{2,3})/gm;
            var regexpaired = /\[[A-Z]{3,5}\]?\s?Device\s([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\sPaired:\s([a-z]{2,3})/gm;
            var regextrusted = /\[[A-Z]{3,5}\]?\s?Device\s([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\sTrusted:\s([a-z]{2,3})/gm;
            var regexblocked = /\[[A-Z]{3,5}\]?\s?Device\s([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\sBlocked:\s([a-z]{2,3})/gm;
    	    var regexpasskeyconfirmation = /\[agent\] Confirm passkey\s([0-9A-F]+)\s[^:]+:/gm;

            var regexscanon1 = 'Discovery started';
            var regexscanon2 = 'Failed to start discovery: org.bluez.Error.InProgress';
            var regexscanon3 = 'Discovering: yes';
            var regexscanoff1 = 'Discovery stopped'
            var regexscanoff2 = 'Discovering: no';

            _this.checkDevice(regexdevice, data);
            _this.checkinfo(data);
            _this.checkSignal(regexsignal, data);
            _this.checkController(regexcontroller, data);
            _this.checkConnected(regexconnected, data);
            _this.checkPaired(regexpaired, data);
            _this.checkTrusted(regextrusted, data);
            _this.checkBlocked(regexblocked, data);
            _this.checkPasskeyConfirmation(regexpasskeyconfirmation, data);

            if (data.indexOf(regexscanoff1) !== -1 || data.indexOf(regexscanoff2) !== -1) _this.isScanning = false;
            if (data.indexOf(regexscanon1) !== -1 || data.indexOf(regexscanon2) !== -1 || data.indexOf(regexscanon3) !== -1) _this.isScanning = true;
        })
    }
    
    private checkInfo(obj) {
        if (! obj.isConfirmingPassKey && obj.devices.length > 0) {
            for (let i = 0; i < obj.devices.length; i++) {
                if (obj.devices[i].paired == '' && obj.devices[i].trycount < 4) {
                    obj.devices[i].trycount += 1;
                    obj.info(obj.devices[i].mac);
                    console.log('checking info of ' + obj.devices[i].mac)
                }
            }
        }
    }
    
    private checkBlocked(regstr, data) {
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - macid
            //m[2] - yes or no
            if (this.devices.length > 0) {
                for (let j = 0; j < this.devices.length; j++) {
                    if (this.devices[j].mac == m[1]) {
                        this.devices[j].blocked = m[2];
                        console.log(m[1] + " blocked " + m[2])
                        this.callback(bluetoothEvents.Device, this.devices)
                    }
                }
            }
        }
    }

    private checkPaired(regstr, data) {
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - macid
            //m[2] - yes or no
            if (this.devices.length > 0) {
                for (let j = 0; j < this.devices.length; j++) {
                    if (this.devices[j].mac == m[1]) {
                        this.devices[j].paired = m[2];
                        console.log(m[1] + " paired " + m[2])
                        this.callback(bluetoothEvents.Device, this.devices)
                    }
                }
            }
        }
    }

    private checkPasskeyConfirmation(regstr, data) {
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - passkey
	    //console.log("Confirm passkey : " + m[1]);
            this.callback(bluetoothEvents.PassKey, m[1])
	    // confirmPasskey(true);

	    this.isConfirmingPassKey = true;
        }
    }

    private checkTrusted(regstr, data) {
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - macid
            //m[2] - yes or no
            if (this.devices.length > 0) {
                for (let j = 0; j < this.devices.length; j++) {
                    if (this.devices[j].mac == m[1]) {
                        this.devices[j].trusted = m[2];
                        console.log(m[1] + " trusted " + m[2])
                        this.callback(bluetoothEvents.Device, this.devices)

                    }
                }
            }
        }
    }

    private checkConnected(regstr, data) {
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - macid
            //m[2] - yes or no
            if (this.devices.length > 0) {
                for (let j = 0; j < this.devices.length; j++) {
                    if (this.devices[j].mac == m[1]) {
                        this.devices[j].connected = m[2];
                        console.log(m[1] + " connected " + m[2])
                        this.callback(bluetoothEvents.Device, this.devices)
                    }
                }
            }
        }
    }

    private checkinfo(data) {

        var regstr = /Device ([0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2}[\.:-][0-9A-F]{1,2})\r?\n?\t?Name: (.+)\r?\n?\t?Alias: (.+)\r?\n?\t?Class: (.+)\r?\n?\t?Icon: (.+)\r?\n?\t?Paired: (.+)\r?\n?\t?Trusted: (.+)\r?\n?\t?Blocked: (.+)\r?\n?\t?Connected: (.+)\r?\n?\t?/gmi;
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - macid
            //m[2] - device name
            //m[3] - alias
            //m[4] - Class
            //m[5] - Icon
            //m[6] - paired
            //m[7] - trusted
            //m[8] - blocked
            //m[9] - connected
            if (this.devices.length > 0) {
                for (let j = 0; j < this.devices.length; j++) {
                    if (this.devices[j].mac == m[1]) {
                        this.devices[j].name = m[3]
                        this.devices[j].class = m[4]
                        this.devices[j].icon = m[5]
                        this.devices[j].paired = m[6]
                        this.devices[j].trusted = m[7]
                        this.devices[j].blocked = m[8]
                        this.devices[j].connected = m[9]
                        this.callback(bluetoothEvents.Device, this.devices)
                        //console.log ('info received:' + JSON.stringify(devices[j]))
                    }
                }
            }
        }
    }

    private checkSignal(regstr, data) {
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - macid
            //m[2] - signal Level
            if (this.devices.length > 0) {
                for (let j = 0; j < this.devices.length; j++) {
                    if (this.devices[j].mac == m[1]) {
                        this.devices[j].signal = parseInt(m[2])
                        //console.log('signal level of:' + m[1] + ' is ' + m[2])
                        this.callback(bluetoothEvents.Device, this.devices)
                        this.callback(bluetoothEvents.DeviceSignalLevel, this.devices, m[1], m[2]);
                    }
                }
            }
        }
    }

    private checkController(regstr, data) {
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - macid
            //m[2] - controllername
            this.controllers = [];
            this.controllers.push({mac: m[1], name: m[2]});
            this.callback(bluetoothEvents.Controller, this.controllers);
            //console.log('controller found:' + m[1])
            this.term.write('power on\r');
            this.term.write('agent on\r');

        }
    }

    private checkDevice(regstr, data) {
        var m;
        while ((m = regstr.exec(data)) !== null) {
            if (m.index === regstr.lastIndex) {
                regstr.lastIndex++;
            }
            //m[1] - [NEW] or [DEL] etc..
            //m[2] - macid
            //m[3] - devicename
            if (m[1] == "[DEL]") {
                //remove from list
                if (this.devices.length > 0) {
                    for (let j = 0; j < this.devices.length; j++) {
                        if (this.devices[j].mac == m[2]) {
                            this.devices.splice(j, 1);
                            console.log('deleting device ' + m[2])
                        }
                    }
                }
            } else {
                var found = false;
                if (this.devices.length > 0) {
                    for (let j = 0; j < this.devices.length; j++) {
                        if (this.devices[j].mac == m[2])found = true;
                        if (this.devices[j].mac == m[2] && m[1] == "[NEW]")found = false;
                    }
                }
                if (!found) {
                    console.log('adding device ' + m[2])
                    this.devices.push({
                        mac: m[2],
                        name: m[3],
                        signal: 0,
                        paired: '',
                        trusted: '',
                        icon: '',
                        class: '',
                        blocked: '',
                        connected: '',
                        trycount: 0
                    });
                }
            }
        }
        if ((regstr.exec(data)) !== null) this.callback(bluetoothEvents.Device, this.devices)
    }
    
    agent(start) {
        this.term.write('agent ' + (start ? 'on' : 'off') + '\r');
    }

    power(start) {
        this.term.write('power ' + (start ? 'on' : 'off') + '\r');
    }

    scan(startScan) {
        this.term.write('scan ' + (startScan ? 'on' : 'off') + '\r');
    }
    pairable(canpairable) {
        this.term.write('pairable ' + (canpairable ? 'on' : 'off') + '\r');
    }
    discoverable(candiscoverable) {
        this.term.write('discoverable ' + (candiscoverable ? 'on' : 'off') + '\r');
    }


    pair(macID) {
        this.term.write('pair ' + macID + '\r');
    }
    confirmPassKey(confirm) {
        this.isConfirmingPassKey = false;
        this.term.write(confirm ? 'yes\r' : 'no\r');
    }

    trust(macID) {
        this.term.write('trust ' + macID + '\r');
    }

    untrust(macID) {
        this.term.write('untrust ' + macID + '\r');
    }


    block(macID) {
        this.term.write('block ' + macID + '\r');
    }
    
    unblock(macID) {
        this.term.write('unblock ' + macID + '\r');
    }


    connect(macID) {
        this.term.write('connect ' + macID + '\r');
    }

    disconnect(macID) {
        this.term.write('disconnect ' + macID + '\r');
    }

    remove(macID) {
        this.term.write('remove ' + macID + '\r');
    }

    info(macID) {
        this.term.write('info ' + macID + '\r');
    }


    getPairedDevices() {
        this.devices = [];
        this.term.write('paired-devices\r');
    }

    getDevicesFromController() {
        this.devices = [];
        this.term.write('devices\r');
    }

    checkBluetoothController() {
        try {
            var execSync = require("child_process").execSync;
            return !!execSync("type bluetoothctl", {encoding: "utf8"});
        } catch(e) {
            return false;
        }
    }
}

export default new Bluetoothctl((type: any, data: any) => {});