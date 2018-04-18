var miio = require('miio');
var util = require('util');
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

    that.cleaning = false;
        that.lastrobotcleaning = false;
    that.speed = 60;
        that.lastspeed = 60;
    that.charging = true;
        that.lastrobotcharging = true;
    that.battery = 100;
    that.pausepossible = false;
        that.lastrobotpausecleaning = false;
        that.lastrobotpausecharging = true;
    that.docked = true;

    that.speedmodes = [
        0,  // 00%      = Off
        38, // 01-38%   = Quiet
        60, // 39-60%   = Balanced
        77, // 61-77%   = Turbo
        90  // 78-100%  = Max Speed
    ];

    if(!that.ip)
        throw new Error('You must provide an ip address of the vacuum cleaner.');

    if(!that.token)
        throw new Error('You must provide a token of the vacuum cleaner.');


    // HOMEKIT SERVICES
    that.serviceInfo = new Service.AccessoryInformation();
        that.serviceInfo
            .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
            .setCharacteristic(Characteristic.Model, 'Roborock')
        that.services.push(that.serviceInfo);

    that.fanService = new Service.Fan(that.name);
        that.fanService
            .getCharacteristic(Characteristic.On)
            .on('get', that.getCleaning.bind(that))
            .on('set', that.setCleaning.bind(that));
        that.fanService
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', that.getSpeed.bind(that))
            .on('set', that.setSpeed.bind(that));
        that.services.push(that.fanService);

    that.batteryService = new Service.BatteryService(that.name + ' Battery');
        that.batteryService
            .getCharacteristic(Characteristic.BatteryLevel)
            .on('get', that.getBattery.bind(that));
        that.batteryService
            .getCharacteristic(Characteristic.ChargingState)
            .on('get', that.getCharging.bind(that));
        that.batteryService
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', that.getBatteryLow.bind(that));
        that.services.push(that.batteryService);

    if(that.pause) {
        that.pauseService = new Service.Switch(that.name + ' Pause');
            that.pauseService
                .getCharacteristic(Characteristic.On)
                .on('get', that.getPausestate.bind(that))
                .on('set', that.setPausestate.bind(that));
            that.services.push(that.pauseService);
    }

    if(that.dock) {
        that.dockService = new Service.OccupancySensor(that.name + ' Dock');
            that.dockService
                .getCharacteristic(Characteristic.OccupancyDetected)
                .on('get', that.getDocked.bind(that));
            that.services.push(that.dockService);
    }


    // ADDITIONAL HOMEKIT SERVICES
    Characteristic.CareSensors = function() {
        Characteristic.call(this, 'Care indicator sensors', '00000101-0000-0000-0000-000000000000');
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: '%',
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    util.inherits(Characteristic.CareSensors, Characteristic);
    Characteristic.CareSensors.UUID = '00000101-0000-0000-0000-000000000000';

    Characteristic.CareFilter = function() {
        Characteristic.call(this, 'Care indicator filter', '00000102-0000-0000-0000-000000000000');
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: '%',
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    util.inherits(Characteristic.CareFilter, Characteristic);
    Characteristic.CareFilter.UUID = '00000102-0000-0000-0000-000000000000';

    Characteristic.CareSideBrush = function() {
        Characteristic.call(this, 'Care indicator side brush', '00000103-0000-0000-0000-000000000000');
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: '%',
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    util.inherits(Characteristic.CareSideBrush, Characteristic);
    Characteristic.CareSideBrush.UUID = '00000103-0000-0000-0000-000000000000';

    Characteristic.CareMainBrush = function() {
        Characteristic.call(this, 'Care indicator main brush', '00000104-0000-0000-0000-000000000000');
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: '%',
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    util.inherits(Characteristic.CareMainBrush, Characteristic);
    Characteristic.CareMainBrush.UUID = '00000104-0000-0000-0000-000000000000';

    Service.Care = function(displayName, subtype) {
        Service.call(this, displayName, '00000111-0000-0000-0000-000000000000', subtype);
        this.addCharacteristic(Characteristic.CareSensors);
        this.addCharacteristic(Characteristic.CareFilter);
        this.addCharacteristic(Characteristic.CareSideBrush);
        this.addCharacteristic(Characteristic.CareMainBrush);
    };
    util.inherits(Service.Care, Service);
    Service.Care.UUID = '00000111-0000-0000-0000-000000000000';

    that.Care = new Service.Care(that.name + ' Care')
        that.Care
            .getCharacteristic(Characteristic.CareSensors)
            .on('get', that.getCareSensors.bind(that));
        that.Care
            .getCharacteristic(Characteristic.CareFilter)
            .on('get', that.getCareFilter.bind(that));
        that.Care
            .getCharacteristic(Characteristic.CareSideBrush)
            .on('get', that.getCareSideBrush.bind(that));
        that.Care
            .getCharacteristic(Characteristic.CareMainBrush)
            .on('get', that.getCareMainBrush.bind(that));
    that.services.push(that.Care);


    // HOMEKIT SERVICES CHANGES
    this.changedCleaning = function(robotcleaning) {
        log.debug('changedCleaning | CleaningState ' + robotcleaning);
        if(robotcleaning !== that.lastrobotcleaning) {
            log.info('MONITOR | CleaningState has changed, is now ' + robotcleaning);
            that.lastrobotcleaning = robotcleaning;

            if(robotcleaning) {
                log.info('INFO | Cleaning was started.');
                that.cleaning = true;
                that.fanService.getCharacteristic(Characteristic.On).updateValue(that.cleaning);
            } else {
                log.info('INFO | Cleaning was stopped.');
                that.cleaning = false;
                that.fanService.getCharacteristic(Characteristic.On).updateValue(that.cleaning);
            }
        }
    }

    this.changedSpeed = function(speed) {
        log.debug('changedSpeed | FanSpeed ' + speed + '%');
        if(speed !== that.lastspeed) {
            log.info('MONITOR | FanSpeed has changed, is now ' + speed + '%');
            that.lastspeed = speed;

            for(var speedmode of that.speedmodes) {
                if(speed <= speedmode) {
                    that.speed = speedmode;
                    log.info('INFO | Speed was changed to ' + that.speed + '%');
                    that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(that.speed);
                    break;
                } 
                if(speed > 90) {
                    that.speed = 90;
                    log.info('INFO | Speed was changed to ' + that.speed + '%');
                    that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(that.speed);
                    break;
                }
            }
        }
    }

    this.changedBattery = function(level) {
        log.debug('changedBattery | BatteryLevel ' + level + '%');
        that.battery = level
        that.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(that.battery);
        that.batteryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue((that.battery < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }

    this.changedCharging = function(robotcharging) {
        log.debug('changedCharging | ChargingState ' + robotcharging);
        if(robotcharging !== that.lastrobotcharging) {
            log.info('MONITOR | ChargingState has changed, is now ' + robotcharging);
            that.lastrobotcharging = robotcharging;

            if(robotcharging) {
                log.info('INFO | Charging is active.');
                that.charging = true;
                that.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING);
                if (that.dock) {
                    log.info('INFO | Robot was docked.');
                    that.docked = true;
                    that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue(that.docked);
                }
            } else {
                log.info('INFO | Charging was canceled.');
                that.charging = false;
                that.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING);
                if (that.dock) {
                    log.info('INFO | Robot not anymore in dock.');
                    that.docked = false;
                    that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue(that.docked);
                }
            }
        }
    }

    this.changedPause = function(robotcleaning, robotcharging) {
        if (that.pause) {
            log.debug('changedPause | CleaningState ' + robotcleaning + ', ChargingState ' + robotcharging);
            if(robotcleaning !== that.lastrobotpausecleaning || robotcharging !== that.lastrobotpausecharging) { // Sets from changedCleaning
                log.info('MONITOR | CleaningState or ChargingState has changed, CleaningState is now ' + robotcleaning + ' and ChargingState is now ' + robotcharging );
                that.lastrobotpausecleaning = robotcleaning; // lastrobotcleaning sets before from changedCleaning, now lastrobotpausecleaning
                that.lastrobotpausecharging = robotcharging; // lastrobotcharging sets before from changedCharging, now lastrobotpausecharging

                if(robotcleaning == true && robotcharging == false) {
                    log.info('INFO | Paused possible.');
                    that.pausepossible = true;
                    that.pauseService.getCharacteristic(Characteristic.On).updateValue(that.pausepossible);
                } else {
                    log.info('INFO | Paused not possible, no cleaning');
                    that.pausepossible = false;
                    that.pauseService.getCharacteristic(Characteristic.On).updateValue(that.pausepossible);
                }
            }
        }
    }

    that.getDevice();
}


XiaomiRoborockVacuum.prototype = {

    getDevice: function() {
        var that = this;
        var log = that.log;

        if (that.startup) {
            log.debug('Discovering vacuum cleaner');
        }

        miio.device({
            address: that.ip,
            token: that.token
        })
        .then(result => {
            if (result.matches('type:vaccuum')) {
                
                // INFO AT STARTUP
                if (that.startup) {
                    log.info('Connected to: %s', that.ip);
                    log.info('Model: ' + result.miioModel);
                    log.info('State: ' + result.property("state"));
                    log.info('FanSpeed: ' + result.property("fanSpeed"));
                    log.info('BatteryLevel: ' + result.property("batteryLevel"));

                    // Serialnumber
                    result.call("get_serial_number").then(serial => {
                        serial = JSON.parse(JSON.stringify(serial)); // Convert in valid JSON.
                        log.info('Serialnumber: ' + serial[0].serial_number);
                    })
                    .catch(err => {
                        log.info('ERORR, get_serial_number | ' + err);
                    });

                    // Firmwareversion
                    result.call("miIO.info").then(firmware => {
                        firmware = JSON.parse(JSON.stringify(firmware)); // Convert in valid JSON.
                        log.info('Firmwareversion: ' + firmware.fw_ver);
                    })
                    .catch(err => {
                        log.info('ERORR, miIO.info | ' + err);
                    });

                    that.startup = false;
                }

                // STATE
                result.state().then(state => {                    
                    state = JSON.parse(JSON.stringify(state)); // Convert in valid JSON

                    if (state.error !== undefined) {
                        // { id: 'charger-offline', description: 'Charger is offline' }
                        // { id: '3', description: 'unkown error' }
                        console.log(state.error)
                        roboterror = state.error.id;
                        roboterrortxt = state.error.description;
                        log.debug('Robot has an ERROR: ' + roboterror + ', ' + roboterrortxt);
                    }

                    that.changedCleaning(state.cleaning);
                    that.changedCharging(state.charging);
                    that.changedSpeed(state.fanSpeed);
                    that.changedBattery(state.batteryLevel);
                    that.changedPause(state.cleaning, state.charging);

                    result.on('errorChanged', error => {
                        console.log(error)
                        roboterror = error.id;
                        roboterrortxt = error.description;
                        log.debug('Robot has an ERROR: ' + roboterror + ', ' + roboterrortxt);
                    })

                    result.on('stateChanged', state => {
                        state = JSON.parse(JSON.stringify(state)); // Convert in valid JSON

                        if (state['key'] == "cleaning") {
                            that.changedCleaning(state['value']) 
                            that.changedPause(state['value'], that.charging)
                        }
                        if (state['key'] == "charging") {
                            that.changedCharging(state['value'])
                            that.changedPause(that.cleaning, state['value'])
                        }
                        if (state['key'] == "fanSpeed") { 
                            that.changedSpeed(state['value']) 
                        }
                        if (state['key'] == "batteryLevel") {
                            that.changedBattery(state['value']) 
                        }
                    });



                }).catch(err => {
                    log.info('ERROR, result.state | ' + err)
                })

                that.device = result;

            } else {
                log.info('Is not a vacuum cleaner!');
                log.debug(result);
                result.destroy();
            }
        })
        .catch(err => {
            log.info('ERROR, miio.device, next try in 2 minutes | ' + err);
            //result.destroy(); // If "destroy" no reconnect - timeout doesn't work.
            setTimeout(function() {that.getDevice() }, 120000); // No response from device over miio, wait 120 seconds for next try.
        });
    },

    getCleaning: function(callback) {
        var that = this;
        var log = that.log;

        if (!that.device) {
            log.info('ERROR, getCleaning | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCleaning | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('Cleaning is ' + that.lastrobotcleaning + '.')
        callback(null, that.lastrobotcleaning);
    },

    setCleaning: function(state, callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, setCleaning | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, setCleaning | No vacuum cleaner is discovered.'));
            return;
        }

        if(state) {
            log.info('ACTION | Start cleaning.');
            that.device.activateCleaning();
            that.cleaning = true
            // Cleaning => leaves dock
            if (that.dock) { 
                that.docked = false;
                that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue(that.docked);
            }
            // Cleaning => pausing possible
            if (that.pause) { 
                that.pausepossible = true;
                that.pauseService.getCharacteristic(Characteristic.On).updateValue(that.pausepossible);
            }
        } else {
            log.info('ACTION | Stop cleaning and go to charge.');
            that.device.activateCharging(); // Charging works for 1st, not for 2nd
            that.cleaning = false
            if (that.pause) { that.pausepossible = false };
        }
        callback();
    },

    getSpeed: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getCleaning | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCleaning | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('Fanspeed is ' + that.speed + '%.')
        callback(null, that.speed);
    },

    setSpeed: function(speed, callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getCleaning | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCleaning | No vacuum cleaner is discovered.'));
            return;
        }

        log.debug('ACTION | Speed got %s% over HomeKit > CLEANUP.', speed);
        for(var speedmode of that.speedmodes) {
            if(speed <= speedmode) {
                that.speed = speedmode;
                log.info('ACTION | FanSpeed set to %s%.', that.speed);
                that.device.changeFanSpeed(parseInt(that.speed));
                that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(that.speed); // Speed cleaned => set it in HomeKit
                callback(null, that.speed);
                break;
            } 
            if(speed > 90) {
                that.speed = 90;
                log.info('ACTION | FanSpeed set to %s%.', that.speed);
                that.device.changeFanSpeed(parseInt(that.speed));
                that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(that.speed); // Speed cleaned => set it in HomeKit
                callback(null, that.speed);
                break;
            }
        }
    },

    getCharging: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getCharging | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCharging | No vacuum cleaner is discovered.'));
            return;
        }

        if(that.charging) { callback(null, Characteristic.ChargingState.CHARGING) };
        if(!that.charging) { callback(null, Characteristic.ChargingState.NOT_CHARGEABLE) };
    },

    getBattery: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getBattery | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getBattery | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('Batterylevel is ' + that.battery + '%.')
        callback(null, that.battery);
    },

    getBatteryLow: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getBatteryLow | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getBatteryLow | No vacuum cleaner is discovered.'));
            return;
        }

        callback(null, (that.battery < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    },

    getPausestate: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getCleaning | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCleaning | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('Pause possible ' + that.pausepossible + '.')
        callback(null, that.pausepossible);
    },

    setPausestate: function(state, callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, setPausestate | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, setPausestate | No vacuum cleaner is discovered.'));
            return;
        }

        if(state) {
            log.info('ACTION | Resume cleaning.');
            that.device.activateCleaning();
            if (that.pause) { that.pausepossible = true }
        } else {
            log.info('ACTION | Pause.');
            that.device.pause();
            if (that.pause) { that.pausepossible = false }
        }
        callback();
    },

    getDocked: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getDocked | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getDocked | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('Docked is ' + that.docked + '.')
        callback(null, that.docked);
    },

    identify: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, identify | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, identify | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('ACTION | Find me - Hello!');
        that.device.find();
        callback();
    },

    getServices: function() {
        var that = this;
        var log = that.log;

        return that.services;
    },


    // CONSUMABLE / CARE
    getCareSensors: function(callback) {
        // 30h = sensor_dirty_time

        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getCareSensors | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCareSensors | No vacuum cleaner is discovered.'));
            return;
        }
        
        lifetime = 108000;
        lifetimepercent = that.device.property("sensorDirtyTime") / lifetime * 100;
        log.info('Sensors dirtytime are ' + that.device.property("sensorDirtyTime") + ' seconds / ' + lifetimepercent.toFixed(2) + '%.')

        callback(null, lifetimepercent);
    },

    getCareFilter: function(callback) {
        // 150h = filter_work_time

        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getCareFilter | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCareFilter | No vacuum cleaner is discovered.'));
            return;
        }

        lifetime = 540000;
        lifetimepercent = that.device.property("filterWorkTime") / lifetime * 100;
        log.info('Filter worktime is ' + that.device.property("filterWorkTime") + ' seconds / ' + lifetimepercent.toFixed(2) + '%.')

        callback(null, lifetimepercent);
    },

    getCareSideBrush: function(callback) {
        // 200h = side_brush_work_time

        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getCareSideBrush | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCareSideBrush | No vacuum cleaner is discovered.'));
            return;
        }

        lifetime = 720000;
        lifetimepercent = that.device.property("sideBrushWorkTime") / lifetime * 100;
        log.info('Sidebrush worktime is ' + that.device.property("sideBrushWorkTime") + ' seconds / ' + lifetimepercent.toFixed(2) + '%.')

        callback(null, lifetimepercent);
    },

    getCareMainBrush: function(callback) {
        // 300h = main_brush_work_time

        var that = this;
        var log = that.log;

        if(!that.device) {
            log.info('ERROR, getCareMainBrush | No vacuum cleaner is discovered.');
            callback(new Error('ERROR, getCareMainBrush | No vacuum cleaner is discovered.'));
            return;
        }

        lifetime = 1080000;
        lifetimepercent = that.device.property("mainBrushWorkTime") / lifetime * 100;
        log.info('Mainbrush worktime is ' + that.device.property("mainBrushWorkTime") + ' seconds / ' + lifetimepercent.toFixed(2) + '%.')

        callback(null, lifetimepercent);
    },
};
