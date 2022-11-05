var noble = require('@abandonware/noble')

var Service;
var Characteristic;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerPlatform('homebridge-platform-eq3btsmart', 'eq3BTSmart', eq3BTSmartPlatform);
}

function eq3BTSmartPlatform(log, config) {
	this.log = log;
	this.config = config;
}

eq3BTSmartPlatform.prototype = {
    accessories: function(callback) {
        var that = this;

        var myAccessories = [];
        var myBTDevices = [];

        noble.on('stateChange', function (state) {
            if (state === 'poweredOn') {
                that.log('EQ3 - Discovering devices...');
                noble.startScanning();
                setTimeout(function() {
                    that.log('EQ3 - Found ' + myBTDevices.length + ' devices.');
                    noble.stopScanning();
                    for (var i = 0; i < myBTDevices.length; i++) {
                        var accessory = new eq3BTSmartAccessory(that.log, myBTDevices[i]);
                        myAccessories.push(accessory);
                    }
                    callback(myAccessories);
                }, 15000);
            } else {
                noble.stopScanning();
            }
        });
        
        noble.on('discover', function(peripheral) {
            if (peripheral.advertisement.localName=="CC-RT-BLE") {
                myBTDevices.push(peripheral);
            }
        });

        noble.on('warning', function(message) {
            console.log("BLE warning: ")
        });
    }
}


function eq3BTSmartAccessory(log, device) {
    this.log = log;
    this.device = device;
    this.name = device.address;
    this.temperature = 18;
    this.targetTemperature = 18;
    this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
    this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
    this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.command = Buffer.from([0x03]);
    this.refreshing = 0;
    this.isConnected = false;

    this.initDevice();
}

eq3BTSmartAccessory.prototype = {
    initDevice: function() {
        var that = this;
        this.device.on('connect', function() {
            this.isConnected = true;
            console.log(that.device.address + " connected")
            that.device.writeHandle(0x411, that.command, false, function(error){
                if (error) this.log(error);
            });
        });
        this.device.on('disconnect', function() {
            this.isConnected = false;
            console.log(that.device.address + " disconnected")
        });
        this.device.on('handleNotify', that.readValues.bind(this));
        this.device.connect();
    },
    readValues: function(handle,value) {
        var that = this;
        if (value[2] == 8 && value[5] != 9) // automatic
        {
            that.targetTemperature = value[5]/2;
            that.temperature = value[5]/2;
            that.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO; 
            that.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT; 
        }
        if (value[2] == 9) // manual
        {
            that.targetTemperature = value[5]/2;
            that.temperature = value[5]/2;
            that.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
            that.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT; 
        }
        if (value[5] == 9) // off
        { 
            that.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
            that.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
        }

        console.log(value);  //debug notify bytes
        that.device.disconnect();
        that.refreshing = 0;
    },
    refreshDevice: function() {
        setTimeout(function() {
            if (this.refreshing == 0) {
                console.log("attempting to refresh EQ3 values")
                this.refreshing = 1;
                //only connect again if not already connected, prevents race condition
                if (this.isConnected) { return; }

                console.log("refreshing EQ3 values")
                this.command = Buffer.from([0x03]);
                this.device.connect();
            }
        }, 1000);
    },
    getCurrentHeatingCoolingState: function(callback) {
        this.refreshDevice();
        //TODO: the callback should only be called when readValues has been called,
        //will currently return the previous value
        callback(null, this.heatingCoolingState);
    },
    getTargetHeatingCoolingState: function(callback) {
        this.refreshDevice();
        callback(null, this.targetHeatingCoolingState);
    },
    setTargetHeatingCoolingState: function(value, callback) {
        var that = this;
        if (value == 0) {
            this.log('EQ3 - '+this.name+' - Off');
            if (this.isConnected) { return; }
            this.command = Buffer.from([0x41, 0x09]);
            this.device.connect();
            this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
            this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
        }
        else if (value == 1) {
            this.log('EQ3 - '+this.name+' - Day mode');
            //if (this.isConnected) { return; }
            //this.command = Buffer.from([0x43]); // day mode
            //this.device.connect();
            //setTimeout(function() {
                //if (this.isConnected) { return; }
                that.command = Buffer.from([0x40, 0x40]); // manual mode
                that.device.connect();
            //}, 5000);
            this.targetHeatingCoolingState = 1;
        }
        else if (value == 2) {
            this.log('EQ3 - '+this.name+' - Night mode');
            if (this.isConnected) { return; }
            //this.command = Buffer.from([0x44]); // night mode
            //this.device.connect();
            //setTimeout(function() {
                //if (this.isConnected) { return; }
                that.command = Buffer.from([0x40, 0x40]); // manual mode
                that.device.connect();
            //}, 5000);
            this.targetHeatingCoolingState = 2;
        }
        else if(value == 3) {
            this.log('EQ3 - '+this.name+' - Auto mode');
            if (this.isConnected) { return; }
            this.command = Buffer.from([0x40, 0x00]); // auto mode
            this.device.connect();
            this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
            this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
        }
        callback(null, value);
    },
    getCurrentTemperature: function(callback) {
        this.refreshDevice();
        callback(null, this.temperature);
    },
    getTargetTemperature: function(callback) {
        this.refreshDevice();
        callback(null, this.targetTemperature);
    },
    setTargetTemperature: function(value, callback) {
        var that = this;
        this.targetTemperature = value;
        setTimeout(function() {
            if (that.targetTemperature != that.temperature) {
                that.log('EQ3 - '+that.name+' - Setting new temperature '+that.temperature+' -> '+that.targetTemperature);
                that.temperature = that.targetTemperature;

                if (that.isConnected) {
                    that.device.disconnect();
                }
                console.log("Sending command to set temperature")
                that.command = Buffer.from([0x41, that.targetTemperature*2]);
                that.device.connect();
            }
        }, 3000);
        callback(null, this.temperature);
    },
    getTemperatureDisplayUnits: function(callback) {
        var error = null;
        callback(error, this.temperatureDisplayUnits);
    },
    getServices: function() {
        var informationService = new Service.AccessoryInformation();
    	informationService
    		.setCharacteristic(Characteristic.Manufacturer, 'EQ-3')
    		.setCharacteristic(Characteristic.Model, 'CC-RT-BLE')
    		.setCharacteristic(Characteristic.SerialNumber, this.device.address)
        
        var thermostatService = new Service.Thermostat(this.device.address);
        thermostatService
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCurrentHeatingCoolingState.bind(this));

        thermostatService
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('get', this.getTargetHeatingCoolingState.bind(this))
            .on('set', this.setTargetHeatingCoolingState.bind(this));

        thermostatService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getCurrentTemperature.bind(this));

        thermostatService
            .getCharacteristic(Characteristic.TargetTemperature)
            .on('get', this.getTargetTemperature.bind(this))
            .on('set', this.setTargetTemperature.bind(this));

        thermostatService
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getTemperatureDisplayUnits.bind(this));

        return [informationService,thermostatService];
    }
}

