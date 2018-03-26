var miio = require('miio');
var Accessory, Service, Characteristic, UUIDGen;


module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerAccessory('homebridge-xiaomi-roborock-vacuum', 'XiaomiRoborockVacuum', XiaomiRoborockVacuum);
}


function XiaomiRoborockVacuum(log, config) {
    var that = this;

    that.services = [];
    that.log = log;
    that.name = config.name || 'Roborock vacuum cleaner';
    that.ip = config.ip;
    that.token = config.token;
    that.pause = config.pause;
    that.dock = config.dock;
    that.device = null;
    that.startup = true;

    if(!that.ip)
        throw new Error('You must provide an ip address of the vacuum cleaner.');

    if(!that.token)
        throw new Error('You must provide a token of the vacuum cleaner.');

    that.serviceInfo = new Service.AccessoryInformation();
        that.serviceInfo
            .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
            .setCharacteristic(Characteristic.Model, 'Roborock')
        that.services.push(that.serviceInfo);

    that.fanService = new Service.Fan(that.name);
        that.fanService
            .getCharacteristic(Characteristic.On)
            .on('get', that.getState.bind(that))
            .on('set', that.setState.bind(that));
        that.fanService
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', that.getSpeed.bind(that))
            .on('set', that.setSpeed.bind(that));
        that.services.push(that.fanService);

    that.batteryService = new Service.BatteryService(that.name + ' Battery');
        that.batteryService
            .getCharacteristic(Characteristic.BatteryLevel)
            .on('get', that.getBState.bind(that));
        that.batteryService
            .getCharacteristic(Characteristic.ChargingState)
            .on('get', that.getCState.bind(that));
        that.batteryService
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', that.getBStateLow.bind(that));
        that.services.push(that.batteryService);

    if(that.pause){
        that.pauseService = new Service.Switch(that.name + ' Pause');
            that.pauseService
                .getCharacteristic(Characteristic.On)
                .on('get', that.getPState.bind(that))
                .on('set', that.setPState.bind(that));
            that.services.push(that.pauseService);
    }

    if(that.dock){
        that.dockService = new Service.OccupancySensor(that.name + ' Dock');
            that.dockService
                .getCharacteristic(Characteristic.OccupancyDetected)
                .on('get', that.getDState.bind(that));
            that.services.push(that.dockService);
    }

    that.getDevice();
    that.watch();
}


XiaomiRoborockVacuum.prototype = {

    watch: function() {
        var that = this;
        var log = that.log;

        setInterval(function() {
            that.device = null; // Clear cache
            
            that.getDevice()
            .then(result => {

                ///////////
                /* State */
                log.debug('WATCH | State: ' + result.property("state"));
                switch(result.property("state")){
                    case 'cleaning':
                    //case 'returning':
                    case 'paused':
                    case 'waiting':
                    case 'spot-cleaning':
                        that.fanService.getCharacteristic(Characteristic.On).updateValue(true);
                        break;
                    default:
                        that.fanService.getCharacteristic(Characteristic.On).updateValue(false);
                }

                ////////////////////
                /* Rotation speed */
                log.debug('WATCH | FanSpeed: ' + result.property("fanSpeed"));
                that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(result.property("fanSpeed"));

                ///////////////////
                /* Battery level */
                log.debug('WATCH | BatteryLevel: ' + result.property("batteryLevel"));
                that.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(result.property("batteryLevel"))

                ///////////////////////
                /* Status low battery*/
                log.debug('WATCH | LowBatteryLevel: ' + result.property("batteryLevel"));
                that.batteryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue((result.property("batteryLevel") < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);

                ////////////////////
                /* Charging state */
                log.debug('WATCH | ChargingState: ' + result.property("state"));
                switch(result.property("state")){
                    case 'charging':
                        that.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING);
                        break;
                    case 'charger-offline':
                        that.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGEABLE);
                        break;
                    default:
                        that.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING);
                }

                /////////////////
                /* Pause state */
                if(that.pause){
                    log.debug('WATCH | PauseState: ' + result.property("state"));
                    switch(result.property("state")){
                        case 'paused':
                        case 'waiting':
                        //case 'charger-offline':
                            that.pauseService.getCharacteristic(Characteristic.On).updateValue(true);
                            break;
                        default:
                            that.pauseService.getCharacteristic(Characteristic.On).updateValue(false);
                    }
                }

                ////////////////
                /* Dock state */
                if(that.dock){
                    log.debug('WATCH | DockState: ' + result.property("state"));
                    that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue((result.property("state") == 'charging') ? 1 : 0);
                }

            })
            .catch(err => {
                log.info('ERROR, Watch | ' + err);
            });
        }, 30000);
    },


    getDevice: function(){
        var that = this;
        var log = that.log;

        if (that.startup) {
            log.debug('Discovering vacuum cleaner');
        }

        return new Promise((resolve, reject) => {
            if (that.device != null) {
                resolve(that.device);
                return;
            }

            miio.device({
                address: that.ip,
                token: that.token
            })
            .then(result => {
                if (result.matches('type:vaccuum')) {
                    if (that.startup) {

                        that.infomodel = result.miioModel;
                        log.info('Connected to: %s', that.ip);
                        log.info('Model: ' + that.infomodel);
                        log.info('State: ' + result.property("state"));
                        log.info('BatteryLevel: ' + result.property("batteryLevel"));
                        log.info('FanSpeed: ' + result.property("fanSpeed"));

                        ///////////////////
                        /* Serial number */
                        that.getDevice()
                        .then(serial => {
                            return result.call("get_serial_number");
                        })
                        .then(serial => {
                            //console.log(serial)
                            serialvalid = JSON.stringify(serial); // Convert in valid JSON
                            serialvalidparse = JSON.parse(serialvalid);
                            log.info('Serialnumber: ' + serialvalidparse[0].serial_number);
                            that.infoserial = serialvalidparse[0].serial_number;
                        })
                        .catch(err => {
                            log.info('ERORR, GetDevice, Serialnumber | ' + err);
                        });

                        //////////////////////
                        /* Firmware version */
                        that.getDevice()
                        .then(firmware => {
                            return result.call("miIO.info");
                        })
                        .then(firmware => {
                            //console.log(firmware)
                            firmwarevalid = JSON.stringify(firmware); // Convert in valid JSON
                            firmwarevalidparse = JSON.parse(firmwarevalid);
                            log.info('Firmwareversion: ' + firmwarevalidparse.fw_ver);
                            that.infofirmware = firmwarevalidparse.fw_ver;
                        })
                        .catch(err => {
                            log.info('ERORR, GetDevice, Firmware | ' + err);
                        });

                        //////////////////////////////////////////
                        /* Number of state (Debug? 100 = Full?) */
                        that.getDevice()
                        .then(numberofstate => {
                            return result.call("get_status");
                        })
                        .then(numberofstate => {
                            //console.log(numberofstate)
                            numberofstatevalid = JSON.stringify(numberofstate); // Convert in valid JSON
                            numberofstatevalidparse = JSON.parse(numberofstatevalid);
                            log.info('Number of state: ' + numberofstatevalidparse[0].state);
                            that.infonumbstate = numberofstatevalidparse[0].state;
                        })
                        .catch(err => {
                            log.info('ERORR, GetDevice, Statenumber | ' + err);
                        });

                        /////////////////
                        /* Consumables */
                        that.getDevice()
                        .then(consumables => {
                            return result.call("get_consumable");
                        })
                        .then(consumables => {
                            //console.log(consumables)
                        })
                        .catch(err => {
                            log.info('ERORR, GetDevice, Consumables | ' + err);
                        });

                        that.startup = false;
                    }

                    that.device = result;
                    resolve(that.device);

                } else {
                    //log.debug(result);
                    log.info('ERORR, GetDevice | Is not a vacuum cleaner!');
                    reject();
                }
            })
            .catch(err => {
                // Double
                //log.info('ERORR, GetDevice | ' + err);
                reject();
            });
        });
    },


    getState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.debug('getState | State: ' + result.property("state"));
            log.info('Current state: ' + result.property("state"));
            switch(result.property("state")){
                case 'cleaning':
                //case 'returning':
                case 'paused':
                case 'waiting':
                case 'spot-cleaning':
                    callback(null, true);
                    break;
                default:
                    callback(null, false);
            }
        })
        .catch(err => {
            log.info('ERROR, getState | ' + err);
            callback(new Error('ERROR, getState | ' + err));
        });
    },


    setState: function(state, callback) {
        var that = this;
        var log = that.log;

        if(!that.device){
            log.info('ERROR, setState | ' + err);
            callback(new Error('ERROR, setState | ' + err));
            return;
        }

        if(state){
            log.info('ACTION | Start cleaning.');
            that.device.activateCleaning();
            that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue(0); // Cleaning => leaves dock
        } else {
            log.info('ACTION | Stop cleaning and go to charge.');
            that.device.activateCharging(); // Charging works for 1st, not for 2nd
        }
        callback();
    },


    getSpeed: function(callback){
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.debug('getSpeed | FanSpeed: ' + result.property("fanSpeed"));
            log.info('Current fanspeed: ' + result.property("fanSpeed") + '%')
            callback(null, result.property("fanSpeed"));
        })
        .catch(err => {
            log.info('ERROR, getSpeed | ' + err);
            callback(new Error('ERROR, getSpeed | ' + err));
        });
    },


    setSpeed: function(speed, callback){
        var that = this;
        var log = that.log;

        if(!that.device){
            log.info('ERROR, setSpeed | ' + err);
            callback(new Error('ERROR, setSpeed | ' + err));
            return;
        }

        var cleanupmodes = [
            0,  // 00%      = Off
            38, // 01-38%   = Quiet
            60, // 39-60%   = Balanced
            77, // 61-77%   = Turbo
            90  // 78-100%  = Max Speed
        ];

        log.debug('ACTION | FanSpeed %s% over HomeKit > cleanup.', speed);
        for(var cleanupmode of cleanupmodes) {
            if(speed <= cleanupmode){
                speed = cleanupmode;
                log.info('ACTION | FanSpeed set to "%s"%.', speed);
                that.device.changeFanSpeed(parseInt(speed));
                that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(speed); // Speed cleaned => set it in HomeKit
                break;
            } 
            if(speed > 90){
                speed = 90;
                log.info('ACTION | FanSpeed set to "%s"%.', speed);
                that.device.changeFanSpeed(parseInt(speed));
                that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(speed); // Speed cleaned => set it in HomeKit
                break;
            }
        }
        callback(null, speed);
    },


    getPState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.debug('getPState | State: ' + result.property("state"));
            switch(result.property("state")){
                case 'paused':
                case 'waiting':
                //case 'charger-offline':
                    callback(null, true);
                    break;
                default:
                    callback(null, false);
            }
        })
        .catch(err => {
            log.info('ERROR, getPState | ' + err);
            callback(new Error('ERROR, getPState | ' + err));
        });
    },


    setPState: function(state, callback) {
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.debug('setPState | State: ' + result.property("state"));

            if(state){
                switch(result.property("state")){
                    case 'cleaning':
                    case 'returning':
                    case 'spot-cleaning':
                        log.info('ACTION | Pause.');
                        that.device.pause();
                        that.device = null; // Clear cache, refreshDelay in miio
                    break;
                }
            } else {
                switch(result.property("state")){
                    case 'paused':
                    case 'waiting':
                        log.info('ACTION | Resume cleaning.');
                        that.device.activateCleaning();
                    break;
                }
            }
            callback();
        })
        .catch(err => {
            log.info('ERROR, setPState | ' + err);
            callback(new Error('ERROR, setPState | ' + err));
        });
    },


    getBState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.info('getBState | BatteryLevel: ' + result.property("batteryLevel"));

            callback(null, result.property("batteryLevel"));
        })
        .catch(err => {
            log.info('ERROR, getBState | ' + err);
            callback(new Error('ERROR, getBState | ' + err));
        });
    },


    getBStateLow: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.debug('getBStateLow | BatteryLevel: ' + result.property("batteryLevel"));

            callback(null, (result.property("batteryLevel") < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
        })
        .catch(err => {
            log.info('ERROR, getBStateLow | ' + err);
            callback(new Error('ERROR, getBStateLow | ' + err));
        });
    },


    getCState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.debug('getCState | State: ' + result.property("state"));

            switch(result.property("state")){
                case 'charging':
                    callback(null, Characteristic.ChargingState.CHARGING);
                    break;
                case 'charger-offline':
                    callback(null, Characteristic.ChargingState.NOT_CHARGEABLE);
                    break;
                default:
                    callback(null, Characteristic.ChargingState.NOT_CHARGING);
            }
        })
        .catch(err => {
            log.info('ERROR, getCState | ' + err);
            callback(new Error('ERROR, getCState | ' + err));
        });
    },


    getDState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.debug('getDState | State: ' + result.property("state"));

            callback(null, (result.property("state") == 'charging') ? 1 : 0);
        })
        .catch(err => {
            log.info('ERROR, getDState | ' + err);
            callback(new Error('ERROR, getDState | ' + err));
        });
    },


    identify: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice()
        .then(result => {
            log.info('ACTION | Find me - Hello!');
            that.device.find();
        })
        .catch(err => {
            log.info('ERROR, identify | ' + err);
            callback(new Error('ERROR, identify | ' + err));
        });
        callback();
    },


    getServices: function() {
        var that = this;
        var log = that.log;

        return that.services;
    }

};