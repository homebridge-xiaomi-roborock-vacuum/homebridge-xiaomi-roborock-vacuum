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

    this.services = [];
    this.log = log;
    this.name = config.name || 'Roborock vacuum cleaner';
    this.ip = config.ip;
    this.token = config.token;
    this.pause = config.pause;
    this.dock = config.dock;
    this.device = null;
    this.startup = true;

    if(!this.ip)
        throw new Error('You must provide an ip address of the vacuum cleaner.');

    if(!this.token)
        throw new Error('You must provide a token of the vacuum cleaner.');

    this.serviceInfo = new Service.AccessoryInformation();
        this.serviceInfo
            .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
            .setCharacteristic(Characteristic.Model, 'Roborock')
            .setCharacteristic(Characteristic.SerialNumber, 'Undefined')
            .setCharacteristic(Characteristic.FirmwareRevision, 'Undefined')
        this.services.push(this.serviceInfo);

    this.fanService = new Service.Fan(this.name);
        this.fanService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getState.bind(this))
            .on('set', this.setState.bind(this));
        this.fanService
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', this.getSpeed.bind(this))
            .on('set', this.setSpeed.bind(this));
        this.services.push(this.fanService);

    this.batteryService = new Service.BatteryService(this.name + ' Battery');
        this.batteryService
            .getCharacteristic(Characteristic.BatteryLevel)
            .on('get', this.getBState.bind(this));
        this.batteryService
            .getCharacteristic(Characteristic.ChargingState)
            .on('get', this.getCState.bind(this));
        this.batteryService
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getBStateLow.bind(this));
        this.services.push(this.batteryService);

    if(this.pause){
        this.pauseService = new Service.Switch(this.name + ' Pause');
            this.pauseService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getPState.bind(this))
                .on('set', this.setPState.bind(this));
            this.services.push(this.pauseService);
    }

    if(this.dock){
        this.dockService = new Service.OccupancySensor(this.name + ' Dock');
            this.dockService
                .getCharacteristic(Characteristic.OccupancyDetected)
                .on('get', this.getDState.bind(this));
            this.services.push(this.dockService);
    }

    this.getDevice();
    this.watch();

}

XiaomiRoborockVacuum.prototype = {

    watch: function() {
        var that = this;
        var log = that.log;

        setInterval(function() {
            that.device = null; // Clear cache
            
            that.getDevice().then(result => {

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

                /////////////////
                /* Pause state */
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

                ////////////////
                /* Dock state */
                log.debug('WATCH | DockState: ' + result.property("state"));
                that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue((result.property("state") == 'charging') ? 1 : 0);


            },
            err => {
                log.debug('No vacuum cleaner is discovered.');
            });
        }, 30000);

    },


    getDevice: function(){
        var that = this;
        var log = that.log;

        if (that.startup) {
            log.debug('Discovering vacuum cleaner at "%s"', that.ip);
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

                        log.info('Connected to: %s', that.ip);
                        log.info('Model: ' + result.miioModel);
                        log.info('State: ' + result.property("state"));
                        log.info('BatteryLevel: ' + result.property("batteryLevel"));
                        log.info('FanSpeed: ' + result.property("fanSpeed"));

                        ///////////////////
                        /* Serial number */
                        that.getDevice().then(serialjson => {
                            return result.call("get_serial_number");
                        })
                        .then(serial => {
                            //console.log(serial)
                            serialvalid = JSON.stringify(serial); // Convert in valid JSON
                            serialvalidparse = JSON.parse(serialvalid);
                            log.info('Serialnumber: ' + serialvalidparse[0].serial_number);
                        });

                        //////////////////////////////////////////
                        /* Number of state (Debug? 100 = Full?) */
                        that.getDevice().then(numberofstate => {
                            return result.call("get_status");
                        })
                        .then(numberofstate => {
                            //console.log(numberofstate)
                            numberofstatevalid = JSON.stringify(numberofstate); // Convert in valid JSON
                            numberofstatevalidparse = JSON.parse(numberofstatevalid);
                            log.info('Number of state: ' + numberofstatevalidparse[0].state);
                        });

                        that.startup = false;
                    }

                    that.device = result;
                    resolve(that.device);

                } else {
                    log.debug(result);
                    log.info('%s is not a vacuum cleaner!', that.ip);
                    reject();
                }
            },
            err => {
                log.debug('No correct API answer from xiaomi/roborock for "%s"', that.ip);
                reject();
            });

        });
    },


    getState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice().then(result => {
            log.debug('getState | State: ' + result.property("state"));
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
        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });
    },


    setState: function(state, callback) {
        var that = this;
        var log = that.log;

        if(!that.device){
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
            return;
        }

        if(state){
            log.info('Start cleaning.');
            that.device.activateCleaning();
            that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue(0); // Cleaning => leaves dock
        } else {
            log.info('Stop cleaning and go to charge.');
            that.device.activateCharging(); // Charging works for 1st, not for 2nd
        }

        callback();
    },


    getSpeed: function(callback){
        var that = this;
        var log = that.log;

        that.getDevice().then(result => {
            log.debug('getSpeed | FanSpeed: ' + result.property("fanSpeed"));
            callback(null, result.property("fanSpeed"));
        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });
    },


    setSpeed: function(speed, callback){
        var that = this;
        var log = that.log;

        if(!that.device){
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
            return;
        }

        var cleanupmodes = [
            0,  // 00%      = Off
            38, // 01-38%   = Quiet
            60, // 39-60%   = Balanced
            77, // 61-77%   = Turbo
            90  // 78-100%  = Max Speed
        ];

        log.info('FanSpeed %s% over HomeKit > cleanup.', speed);
        for(var cleanupmode of cleanupmodes) {
            if(speed <= cleanupmode){
                speed = cleanupmode;
                log.info('FanSpeed set to "%s"%.', speed);
                that.device.changeFanSpeed(parseInt(speed));
                that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(speed); // Speed cleaned => set it in HomeKit
                break;
            } 
            if(speed > 90){
                speed = 90;
                log.info('FanSpeed set to "%s"%.', speed);
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

        that.getDevice().then(result => {
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
        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });
    },


    setPState: function(state, callback) {
        var that = this;
        var log = that.log;

        that.getDevice().then(result => {
            log.debug('setPState | State: ' + result.property("state"));

            if(state){
                switch(result.property("state")){
                    case 'cleaning':
                    case 'returning':
                    case 'spot-cleaning':
                        log.info('Pause.');
                        that.device.pause();
                        that.device = null; // Clear cache, refreshDelay in miio
                    break;
                }
            } else {
                switch(result.property("state")){
                    case 'paused':
                    case 'waiting':
                        log.info('Resume cleaning.');
                        that.device.activateCleaning();
                    break;
                }
            }

            callback();

        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });
    },


    getBState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice().then(result => {
            log.debug('getBState | BatteryLevel: ' + result.property("batteryLevel"));

            callback(null, result.property("batteryLevel"));
        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });
    },


    getBStateLow: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice().then(result => {
            log.debug('getBStateLow | BatteryLevel: ' + result.property("batteryLevel"));

            callback(null, (result.property("batteryLevel") < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });
    },


    getCState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice().then(result => {
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
        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });
    },


    getDState: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice().then(result => {
            log.debug('getDState | State: ' + result.property("state"));

            callback(null, (result.property("state") == 'charging') ? 1 : 0);
        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });
    },


    identify: function(callback) {
        var that = this;
        var log = that.log;

        that.getDevice().then(result => {
            log.debug('identify | say findme');

            log.info('Find me - Hello!');
            that.device.find();
        },
        err => {
            log.debug('No vacuum cleaner is discovered.');
            callback(new Error('No vacuum cleaner is discovered.'));
        });

        callback();
    },


    getServices: function() {
        var that = this;
        var log = that.log;

        return that.services;
    }

};