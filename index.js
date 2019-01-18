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

    that.speedmodes_gen1 = [
        0,  // 0%       = Off
        38, // 1-38%    = Mi Home > "Quiet / Leise" > 38
        60, // 39-60%   = Mi Home > "Balanced / Standard" > 60
        77, // 61-77%   = Mi Home > "Turbo / Stark" > 77
        90  // 78-100%   = Mi Home > "Full Speed / Max Speed / MAX" > 90
    ];

    that.speedmodes_gen2 = [
        0,  // 0%       = Off
        15, // 1-15%    = Mi Home > "Mop / Mopping / Nur wischen" > 105
        38, // 16-38%   = Mi Home > "Quiet / Leise" > 38
        60, // 39-60%   = Mi Home > "Balanced / Standard" > 60
        75, // 61-75%   = Mi Home > "Turbo / Stark" > 75
        100 // 76-100%  = Mi Home > "Full Speed / Max Speed / MAX" > 100
    ];

    that.errors = {
        id1: { description: 'Try turning the orange laserhead to make sure it isnt blocked.' },
        id2: { description: 'Clean and tap the bumpers lightly.' },
        id3: { description: 'Try moving the vacuum to a different place.' },
        id4: { description: 'Wipe the cliff sensor clean and move the vacuum to a different place.' },
        id5: { description: 'Remove and clean the main brush.' },
        id6: { description: 'Remove and clean the sidebrushes.' },
        id7: { description: 'Make sure the wheels arent blocked. Move the vacuum to a different place and try again.' },
        id8: { description: 'Make sure there are no obstacles around the vacuum.' },
        id9: { description: 'Install the dustbin and the filter.' },
        id10: { description: 'Make sure the filter has been tried or clean the filter.' },
        id11: { description: 'Strong magnetic field detected. Move the device away from the virtual wall and try again' },
        id12: { description: 'Battery is low, charge your vacuum.' },
        id13: { description: 'Couldnt charge properly. Make sure the charging surfaces are clean.' },
        id14: { description: 'Battery malfunctioned.' },
        id15: { description: 'Wipe the wall sensor clean.' },
        id16: { description: 'Use the vacuum on a flat horizontal surface.' },
        id17: { description: 'Sidebrushes malfunctioned. Reboot the system.' },
        id18: { description: 'Fan malfunctioned. Reboot the system.' },
        id19: { description: 'The docking station is not connected to power.' },
        id20: { description: 'unkown' },
        id21: { description: 'Please make sure that the top cover of the laser distance sensor is not pinned.' },
        id22: { description: 'Please wipe the dock sensor.' },
        id23: { description: 'Make sure the signal emission area of dock is clean.' }
    };

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


    // (HOMEKIT) SERVICES CHANGES
    this.changedError = function(roboterror) {
        log.debug('DEB changedERR | ' + that.model + ' | ErrorID: ' + roboterror.id + ', ErrorDescription: ' + roboterror.description);
        if (!roboterror.description.toLowerCase().startsWith("unknown")) {
            roboterrortxt = roboterror.description;
        } else {
            if (that.errors.hasOwnProperty('id' + roboterror.id)) {
                roboterrortxt = that.errors['id' + roboterror.id].description; //roboterrortxt = that.errors.id2.description;
            } else {
                roboterrortxt = 'Unkown ERR | errorid cant be mapped. (' + roboterror.id + ')';
            }
        }
        log.warn('WAR changedERR | ' + that.model + ' | Robot has an ERROR - ' + roboterror.id + ', ' + roboterrortxt);
    }

    this.changedCleaning = function(robotcleaning) {
        log.debug('DEB changedCleaning | ' + that.model + ' | CleaningState ' + robotcleaning + ', LastCleaningState' + that.lastrobotcleaning);
        if(robotcleaning !== that.lastrobotcleaning) {
            log.info('MON changedCleaning | ' + that.model + ' | CleaningState has changed, is now ' + robotcleaning);
            that.lastrobotcleaning = robotcleaning;

            if(robotcleaning) {
                log.info('INF changedCleaning | ' + that.model + ' | Cleaning was started.');
                that.cleaning = true;
                that.fanService.getCharacteristic(Characteristic.On).updateValue(that.cleaning);
            } else {
                log.info('INF changedCleaning | ' + that.model + ' | Cleaning was stopped.');
                that.cleaning = false;
                that.fanService.getCharacteristic(Characteristic.On).updateValue(that.cleaning);
            }
        }
    }

    this.changedSpeed = function(speed) {
        log.debug('DEB changedSpeed | ' + that.model + ' | FanSpeed ' + speed + '%' + ', LastFanSpeed' + that.lastspeed);
        if(speed !== that.lastspeed) {
            log.info('MON changedSpeed | ' + that.model + ' | FanSpeed has changed, is now ' + speed + '%');
            that.lastspeed = speed;

            if(speed == 105) { // Mop / Mopping / Nur wischen
                log.info('INF changedSpeed | ' + that.model + ' | Speed was changed to 105% (Mopping), for HomeKit 15%');
                that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(15);
            } else if(speed >= 0 && speed <= 100) {
                log.info('INF changedSpeed | ' + that.model + ' | Speed was changed to ' + speed + '%');
                that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(speed);
            } else {
                log.warn('WAR changedSpeed | ' + that.model + ' | Speed was changed to ' + speed + '%, this speed is not supported');
            }
        }
    }

    this.changedBattery = function(level) {
        log.debug('DEB changedBattery | ' + that.model + ' | BatteryLevel ' + level + '%');
        that.battery = level
        that.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(that.battery);
        that.batteryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue((that.battery < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }

    this.changedCharging = function(robotcharging) {
        log.debug('DEB changedCharging | ' + that.model + ' | ChargingState ' + robotcharging + ', LastChargingState' + that.lastrobotcharging);
        if(robotcharging !== that.lastrobotcharging) {
            log.info('MON changedCharging | ' + that.model + ' | ChargingState has changed, is now ' + robotcharging);
            that.lastrobotcharging = robotcharging;

            if(robotcharging) {
                log.info('INF changedCharging | ' + that.model + ' | Charging is active.');
                that.charging = true;
                that.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING);
                if (that.dock) {
                    log.info('INF changedCharging | ' + that.model + ' | Robot was docked.');
                    that.docked = true;
                    that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue(that.docked);
                }
            } else {
                log.info('INF changedCharging | ' + that.model + ' | Charging was canceled.');
                that.charging = false;
                that.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING);
                if (that.dock) {
                    log.info('INF changedCharging | ' + that.model + ' | Robot not anymore in dock.');
                    that.docked = false;
                    that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue(that.docked);
                }
            }
        }
    }

    this.changedPause = function(robotcleaning) {
        if (that.pause) {
            log.debug('DEB changedPause | ' + that.model + ' | CleaningState ' + robotcleaning + ', LastPauseCleaningState' + that.lastrobotpausecleaning);
            if(robotcleaning !== that.lastrobotpausecleaning) {
                log.info('MON changedPause | ' + that.model + ' | CleaningState has changed, is now ' + robotcleaning);
                that.lastrobotpausecleaning = robotcleaning; // lastrobotcleaning sets before from changedCleaning, now lastrobotpausecleaning

                if(robotcleaning == true) {
                    log.info('INF changedPause | ' + that.model + ' | Paused possible.');
                    that.pausepossible = true;
                    that.pauseService.getCharacteristic(Characteristic.On).updateValue(that.pausepossible);
                } else {
                    log.info('INF changedPause | ' + that.model + ' | Paused not possible, no cleaning');
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
            log.debug('DEB getDevice | Discovering vacuum cleaner');
        }

        miio.device({
            address: that.ip,
            token: that.token
        })
        .then(result => {
            if (result.matches('type:vaccuum')) {

                // INFO AT STARTUP
                if (that.startup) {
                    log.info('STA getDevice | Connected to: %s', that.ip);
                    log.info('STA getDevice | Model: ' + result.miioModel);
                    log.info('STA getDevice | State: ' + result.property("state"));
                    log.info('STA getDevice | FanSpeed: ' + result.property("fanSpeed"));
                    log.info('STA getDevice | BatteryLevel: ' + result.property("batteryLevel"));

                    // Serialnumber
                    result.call("get_serial_number").then(serial => {
                        serial = JSON.parse(JSON.stringify(serial)); // Convert in valid JSON.
                        log.info('STA getDevice | Serialnumber: ' + serial[0].serial_number);
                    })
                    .catch(err => {
                        log.error('ERR getDevice | get_serial_number | ' + err);
                    });

                    // Firmwareversion
                    result.call("miIO.info").then(firmware => {
                        firmware = JSON.parse(JSON.stringify(firmware)); // Convert in valid JSON.
                        log.info('STA getDevice | Firmwareversion: ' + firmware.fw_ver);
                    })
                    .catch(err => {
                        log.error('ERR getDevice | miIO.info | ' + err);
                    });

                    that.model = result.miioModel;
                    that.startup = false;
                }

                // STATE
                result.state().then(state => {
                    state = JSON.parse(JSON.stringify(state)); // Convert in valid JSON

                    if (state.error !== undefined) {
                        //console.log(state.error)
                        that.changedError(state.error);
                    }

                    log.debug('DEB getDevice | Initializing status values to variables');
                        that.cleaning = state.cleaning;
                        that.charging = state.charging;
                        that.docked = state.charging;
                        that.speed = state.fanSpeed;
                        that.battery = state.batteryLevel;
                        if(state.cleaning == true) {
                            that.pausepossible = true;
                        } else {
                            that.pausepossible = false;
                        }
                        that.lastrobotcleaning = undefined;
                        that.lastrobotcharging = undefined;
                        that.lastspeed = undefined;
                        that.lastrobotpausecleaning = undefined;
                        //that.lastrobotpausecharging = undefined;

                    that.changedCleaning(state.cleaning);
                    that.changedCharging(state.charging);
                    that.changedSpeed(state.fanSpeed);
                    that.changedBattery(state.batteryLevel);
                    that.changedPause(state.cleaning);

                    result.on('errorChanged', error => {
                        error = JSON.parse(JSON.stringify(error)); // Convert in valid JSON

                        //console.log(error)
                        that.changedError(error);
                    })

                    result.on('stateChanged', state => {
                        state = JSON.parse(JSON.stringify(state)); // Convert in valid JSON

                        if (state['key'] == "cleaning") {
                            that.changedCleaning(state['value'])
                            that.changedPause(state['value'])
                        }
                        if (state['key'] == "charging") {
                            that.changedCharging(state['value'])
                        }
                        if (state['key'] == "fanSpeed") {
                            that.changedSpeed(state['value'])
                        }
                        if (state['key'] == "batteryLevel") {
                            that.changedBattery(state['value'])
                        }
                    });



                }).catch(err => {
                    log.error('ERR getDevice | result.state | ' + err)
                })

                that.device = result;

            } else {
                log.error('ERR getDevice | Is not a vacuum cleaner!');
                log.debug(result);
                result.destroy();
            }
        })
        .catch(err => {
            log.error('ERR getDevice | miio.device, next try in 2 minutes | ' + err);
            //result.destroy(); // If "destroy" no reconnect - timeout doesn't work.
            setTimeout(function() {that.getDevice() }, 120000); // No response from device over miio, wait 120 seconds for next try.
        });
    },

    getCleaning: function(callback) {
        var that = this;
        var log = that.log;

        if (!that.device) {
            log.error('ERR getCleaning | No vacuum cleaner is discovered.');
            callback(new Error('ERR getCleaning | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('INF getCleaning | ' + that.model + ' | Cleaning is ' + that.lastrobotcleaning + '.')
        callback(null, that.lastrobotcleaning);
    },

    setCleaning: function(state, callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR setCleaning | No vacuum cleaner is discovered.');
            callback(new Error('ERR setCleaning | No vacuum cleaner is discovered.'));
            return;
        }

        log.debug('DEB setCleaning | ' + that.model + ' | Cleaning set it to ' + state + '.');
        if(state) {
            if(!that.cleaning) {
                log.info('ACT setCleaning | ' + that.model + ' | Start cleaning, not charging.');
                that.device.activateCleaning();
                that.cleaning = true
                that.lastrobotcleaning = that.cleaning;
                that.charging = false;
                that.lastrobotcharging = that.charging;
                that.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING);

                // Cleaning => leaves dock
                if (that.dock) {
                    that.docked = false;
                    that.dockService.getCharacteristic(Characteristic.OccupancyDetected).updateValue(that.docked);
                    log.info('ACT setCleaning - dock | ' + that.model + ' | Docked set to %s.', that.docked);
                }

                // Cleaning => pausing possible
                if (that.pause) {
                    that.pausepossible = true;
                    that.lastrobotpausecleaning = that.pausepossible;
                    that.pauseService.getCharacteristic(Characteristic.On).updateValue(that.pausepossible);
                    log.info('ACT setCleaning - pause | ' + that.model + ' | PausePossible set to %s.', that.pausepossible);
                }
            } else {
               log.debug('DEB setCleaning | ' + that.model + ' | Start cleaning not necessary, cleaning already running.');
            }

        } else {
            log.info('ACT setCleaning | ' + that.model + ' | Stop cleaning and go to charge.');
            that.device.activateCharging(); // Charging works for 1st, not for 2nd
            that.cleaning = false
            that.lastrobotcleaning = that.cleaning;

            // Cleaning stoped => pausing not possible
            if (that.pause) {
                that.pausepossible = false
                that.lastrobotpausecleaning = that.pausepossible;
                that.pauseService.getCharacteristic(Characteristic.On).updateValue(that.pausepossible);
            }

        }
        callback();
    },

    getSpeed: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getSpeed | No vacuum cleaner is discovered.');
            callback(new Error('ERR getSpeed | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('INF getSpeed | ' + that.model + ' | Fanspeed is ' + that.speed + '%.')
        callback(null, that.speed);
    },

    setSpeed: function(speed, callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR setSpeed | No vacuum cleaner is discovered.');
            callback(new Error('ERR setSpeed | No vacuum cleaner is discovered.'));
            return;
        }

        log.debug('ACT setSpeed | ' + that.model + ' | Speed got %s% over HomeKit > CLEANUP.', speed);

        if(that.model == "rockrobo.vacuum.v1") { that.speedmodes = that.speedmodes_gen1 };
        if(that.model == "roborock.vacuum.s5") { that.speedmodes = that.speedmodes_gen2 };

        for(var speedmode of that.speedmodes) {
            if(speed <= speedmode) {
                that.speed = speedmode;
                if (that.speed == 15) {
                    that.speedmiio = 105;
                    log.info('ACT setSpeed | ' + that.model + ' | FanSpeed set to %s% over miIO for Mopping.', that.speedmiio);
                    that.device.changeFanSpeed(parseInt(that.speedmiio));
                    that.lastspeed = that.speedmiio;
                } else {
                    log.info('ACT setSpeed | ' + that.model + ' | FanSpeed set to %s% over miIO.', that.speed);
                    that.device.changeFanSpeed(parseInt(that.speed));
                    that.lastspeed = that.speed;
                }
                break;
            }

            // fallback if set an higher percent as highest available speedmode over homekit [gen1 91-100]%
            lastspeedmode = that.speedmodes[that.speedmodes.length-1] // last item of array
            if(lastspeedmode !== 100 && speed > lastspeedmode) {
                that.speed = lastspeedmode;
                log.info('ACT setSpeed | ' + that.model + ' | FanSpeed over HomeKit was higher than available robot-speedmode, FanSpeed set to %s% over miIO.', that.speed);
                that.device.changeFanSpeed(parseInt(that.speed));
                that.lastspeed = that.speed;
                break;
            }
        }

        log.info('ACT setSpeed | ' + that.model + ' | FanSpeed in HomeKit set to %s% after CLEANUP.', that.speed);
        that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(that.speed); // It works very rarely! After a timeout of 5 seconds, you could try it again. But what is displayed in HomeKit is not crucial. After a room change, it is displayed correctly. It's very strange!

        /*
        setTimeout(function(){
            log.info('ACT setCleaning | ' + that.model + ' | FanSpeed in HomeKit set to %s% after CLEANUP.', that.speed);
            that.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(that.speed);
        }, 5000 );
        */

        callback(null, that.speed)

    },

    getCharging: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getCharging | No vacuum cleaner is discovered.');
            callback(new Error('ERR getCharging | No vacuum cleaner is discovered.'));
            return;
        }

        if(that.charging) {
            log.info('INF getCharging | ' + that.model + ' | Charging is true.')
            callback(null, Characteristic.ChargingState.CHARGING)
        };
        if(!that.charging) {
            log.info('INF getCharging | ' + that.model + ' | Charging is false.')
            callback(null, Characteristic.ChargingState.NOT_CHARGEABLE)
        };
    },

    getBattery: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getBattery | No vacuum cleaner is discovered.');
            callback(new Error('ERR getBattery | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('INF getBattery | ' + that.model + ' | Batterylevel is ' + that.battery + '%.')
        callback(null, that.battery);
    },

    getBatteryLow: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getBatteryLow | No vacuum cleaner is discovered.');
            callback(new Error('ERR getBatteryLow | No vacuum cleaner is discovered.'));
            return;
        }

        callback(null, (that.battery < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    },

    getPausestate: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getCleaning | No vacuum cleaner is discovered.');
            callback(new Error('ERR getCleaning | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('INF getPausestate | ' + that.model + ' | Pause possible is ' + that.pausepossible + '.')
        callback(null, that.pausepossible);
    },

    setPausestate: function(state, callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR setPausestate | No vacuum cleaner is discovered.');
            callback(new Error('ERR setPausestate | No vacuum cleaner is discovered.'));
            return;
        }

        log.debug('DEB setPausestate | ' + that.model + ' | Pause set it to ' + state + '.');
        if(state) {
            log.info('ACT setPausestate | ' + that.model + ' | Resume cleaning.');
            that.device.activateCleaning();
            if (that.pause) {
                that.pausepossible = true
                that.lastrobotpausecleaning = that.pausepossible;
            }
        } else {
            log.info('ACT setPausestate | ' + that.model + ' | Pause.');
            that.device.pause();
            if (that.pause) {
                that.pausepossible = false
                that.lastrobotpausecleaning = that.pausepossible;
            }
        }
        callback();
    },

    getDocked: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getDocked | No vacuum cleaner is discovered.');
            callback(new Error('ERR getDocked | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('INF getDocked | ' + that.model + ' | Robot Docked is ' + that.docked + '.')
        callback(null, that.docked);
    },

    identify: function(callback) {
        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR identify | No vacuum cleaner is discovered.');
            callback(new Error('ERR identify | No vacuum cleaner is discovered.'));
            return;
        }

        log.info('ACT identify | ' + that.model + ' Find me - Hello!');
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
            log.error('ERR getCareSensors | No vacuum cleaner is discovered.');
            callback(new Error('ERR getCareSensors | No vacuum cleaner is discovered.'));
            return;
        }

        lifetime = 108000;
        lifetimepercent = that.device.property("sensorDirtyTime") / lifetime * 100;
        log.info('INF getCareSensors | ' + that.model + ' | Sensors dirtytime are ' + that.device.property("sensorDirtyTime") + ' seconds / ' + lifetimepercent.toFixed(2) + '%.')

        callback(null, lifetimepercent);
    },

    getCareFilter: function(callback) {
        // 150h = filter_work_time

        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getCareFilter | No vacuum cleaner is discovered.');
            callback(new Error('ERR getCareFilter | No vacuum cleaner is discovered.'));
            return;
        }

        lifetime = 540000;
        lifetimepercent = that.device.property("filterWorkTime") / lifetime * 100;
        log.info('INF getCareFilter | ' + that.model + ' | Filter worktime is ' + that.device.property("filterWorkTime") + ' seconds / ' + lifetimepercent.toFixed(2) + '%.')

        callback(null, lifetimepercent);
    },

    getCareSideBrush: function(callback) {
        // 200h = side_brush_work_time

        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getCareSideBrush | No vacuum cleaner is discovered.');
            callback(new Error('ERR getCareSideBrush | No vacuum cleaner is discovered.'));
            return;
        }

        lifetime = 720000;
        lifetimepercent = that.device.property("sideBrushWorkTime") / lifetime * 100;
        log.info('INF getCareSideBrush | ' + that.model + ' | Sidebrush worktime is ' + that.device.property("sideBrushWorkTime") + ' seconds / ' + lifetimepercent.toFixed(2) + '%.')

        callback(null, lifetimepercent);
    },

    getCareMainBrush: function(callback) {
        // 300h = main_brush_work_time

        var that = this;
        var log = that.log;

        if(!that.device) {
            log.error('ERR getCareMainBrush | No vacuum cleaner is discovered.');
            callback(new Error('ERR getCareMainBrush | No vacuum cleaner is discovered.'));
            return;
        }

        lifetime = 1080000;
        lifetimepercent = that.device.property("mainBrushWorkTime") / lifetime * 100;
        log.info('INF getCareMainBrush | ' + that.model + ' | Mainbrush worktime is ' + that.device.property("mainBrushWorkTime") + ' seconds / ' + lifetimepercent.toFixed(2) + '%.')

        callback(null, lifetimepercent);
    },
};
