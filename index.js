'use strict';

const miio = require('miio');
const util = require('util');
const callbackify = require('./lib/callbackify');

let Service, Characteristic;

module.exports = function (homebridge) {
  // Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  // UUIDGen = homebridge.hap.uuid;

  homebridge.registerAccessory('homebridge-xiaomi-roborock-vacuum', 'XiaomiRoborockVacuum', XiaomiRoborockVacuum);
}

class XiaomiRoborockVacuum {
  static get speedmodes_gen1() {
    return [
      0,  // 0%       = Off
      38, // 1-38%    = Mi Home > "Quiet / Leise" > 38
      60, // 39-60%   = Mi Home > "Balanced / Standard" > 60
      77, // 61-77%   = Mi Home > "Turbo / Stark" > 77
      90  // 78-100%   = Mi Home > "Full Speed / Max Speed / MAX" > 90
    ];
  }

  static get speedmodes_gen2() {
    return [
      0,  // 0%       = Off
      15, // 1-15%    = Mi Home > "Mop / Mopping / Nur wischen" > 105
      38, // 16-38%   = Mi Home > "Quiet / Leise" > 38
      60, // 39-60%   = Mi Home > "Balanced / Standard" > 60
      75, // 61-75%   = Mi Home > "Turbo / Stark" > 75
      100 // 76-100%  = Mi Home > "Full Speed / Max Speed / MAX" > 100
    ];
  }

  // From https://github.com/aholstenson/miio/blob/master/lib/devices/vacuum.js#L128
  static get cleaningStatuses() {
    return [
      'cleaning',
      'spot-cleaning',
      'zone-cleaning'
    ];
  }

  static get errors() {
    return {
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
  }

  constructor(log, config) {
    this.log = log;
    this.config = config;
    this.config.name = config.name || 'Roborock vacuum cleaner';
    this.services = {};

    this.device = null;
    this.startup = true;

    if (!this.config.ip) {
      throw new Error('You must provide an ip address of the vacuum cleaner.');
    }

    if (!this.config.token) {
      throw new Error('You must provide a token of the vacuum cleaner.');
    }

    this.init();
  }

  async init() {
    // Initialize device
    await this.initializeDevice();
  }

  async initialiseServices() {
    this.services.info = new Service.AccessoryInformation();
    this.services.info
      .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
      .setCharacteristic(Characteristic.Model, this.model || 'Roborock')
      .setCharacteristic(Characteristic.SerialNumber, await this.getSerialNumber())
      .setCharacteristic(Characteristic.FirmwareRevision, await this.getFirmware());
    this.services.info
      .getCharacteristic(Characteristic.FirmwareRevision)
      .on('get', (cb) => callbackify(() => this.getFirmware(), cb));
    this.services.info
      .getCharacteristic(Characteristic.Model)
      .on('get', (cb) => callbackify(() => this.device.miioModel, cb));
    this.services.info
      .getCharacteristic(Characteristic.SerialNumber)
      .on('get', (cb) => callbackify(() => this.getSerialNumber(), cb));

    this.services.fan = new Service.Fan(this.config.name);
    this.services.fan
      .getCharacteristic(Characteristic.On)
      .on('get', (cb) => callbackify(() => this.getCleaning(), cb))
      .on('set', (newState, cb) => callbackify(() => this.setCleaning(newState), cb))
      .on('change', (oldState, newState) => {
        this.changedPause(newState);
      });
    this.services.fan
      .getCharacteristic(Characteristic.RotationSpeed)
      .on('get', (cb) => callbackify(() => this.getSpeed(), cb))
      .on('set', (newState, cb) => callbackify(() => this.setSpeed(newState), cb))

    this.services.battery = new Service.BatteryService(`${this.config.name} Battery`);
    this.services.battery
      .getCharacteristic(Characteristic.BatteryLevel)
      .on('get', (cb) => callbackify(() => this.getBattery(), cb));
    this.services.battery
      .getCharacteristic(Characteristic.ChargingState)
      .on('get', (cb) => callbackify(() => this.getCharging(), cb));
    this.services.battery
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on('get', (cb) => callbackify(() => this.getBatteryLow(), cb));

    if (this.config.pause) {
      this.services.pause = new Service.Switch(`${this.config.name} Pause`);
      this.services.pause
        .getCharacteristic(Characteristic.On)
        .on('get', (cb) => callbackify(() => this.getPauseState(), cb))
        .on('set', (newState, cb) => callbackify(() => this.setPauseState(newState), cb));
      // TODO: Add 'change' status?
    }

    if (this.config.dock) {
      this.services.dock = new Service.OccupancySensor(`${this.config.name} Dock`);
      this.services.dock
        .getCharacteristic(Characteristic.OccupancyDetected)
        .on('get', (cb) => callbackify(() => this.getDocked(), cb));
    }

    // ADDITIONAL HOMEKIT SERVICES
    this.initialiseCareServices();
  }

  initialiseCareServices() {
    Characteristic.CareSensors = function () {
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

    Characteristic.CareFilter = function () {
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

    Characteristic.CareSideBrush = function () {
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

    Characteristic.CareMainBrush = function () {
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

    Service.Care = function (displayName, subtype) {
      Service.call(this, displayName, '00000111-0000-0000-0000-000000000000', subtype);
      this.addCharacteristic(Characteristic.CareSensors);
      this.addCharacteristic(Characteristic.CareFilter);
      this.addCharacteristic(Characteristic.CareSideBrush);
      this.addCharacteristic(Characteristic.CareMainBrush);
    };
    util.inherits(Service.Care, Service);
    Service.Care.UUID = '00000111-0000-0000-0000-000000000000';

    this.services.Care = new Service.Care(`${this.config.name} Care`)
    this.services.Care
      .getCharacteristic(Characteristic.CareSensors)
      .on('get', (cb) => callbackify(() => this.getCareSensors(), cb));
    this.services.Care
      .getCharacteristic(Characteristic.CareFilter)
      .on('get', (cb) => callbackify(() => this.getCareFilter(), cb));
    this.services.Care
      .getCharacteristic(Characteristic.CareSideBrush)
      .on('get', (cb) => callbackify(() => this.getCareSideBrush(), cb));
    this.services.Care
      .getCharacteristic(Characteristic.CareMainBrush)
      .on('get', (cb) => callbackify(() => this.getCareMainBrush(), cb));
  }

  changedError(robotError) {
    this.log.debug(`DEB changedError | ${this.model} | ErrorID: ${robotError.id}, ErrorDescription: ${robotError.description}`);
    let robotErrorTxt = XiaomiRoborockVacuum.errors[`id${robotError.id}`] ?
      XiaomiRoborockVacuum.errors[`id${robotError.id}`].description :
      `Unknown ERR | errorid can't be mapped. (${robotError.id})`;
    if (!`${robotError.description}`.toLowerCase().startsWith('unknown')) {
      robotErrorTxt = robotError.description;
    }
    this.log.warn(`WAR changedError | ${this.model} | Robot has an ERROR - ${robotError.id}, ${robotErrorTxt}`);
  }

  changedCleaning(isCleaning) {
    this.log.debug(`MON changedCleaning | ${this.model} | CleaningState is now ${isCleaning}`);

    this.log.info(`INF changedCleaning | ${this.model} | Cleaning is ${isCleaning ? 'ON' : 'OFF'}.`);
    this.services.fan.getCharacteristic(Characteristic.On).updateValue(isCleaning);
  }

  changedPause(isCleaning) {
    if (this.config.pause) {
      this.log.debug(`MON changedPause | ${this.model} | CleaningState is now ${isCleaning}`);
      this.log.info(`INF changedPause | ${this.model} | ${isCleaning ? 'Paused possible' : 'Paused not possible, no cleaning'}`);
      this.services.pause.getCharacteristic(Characteristic.On).updateValue(isCleaning);
    }
  }

  changedCharging(isCharging) {
    this.log.info(`MON changedCharging | ${this.model} | ChargingState is now ${isCharging}`);
    this.log.info(`INF changedCharging | ${this.model} | Charging is ${isCharging ? 'active' : 'cancelled'}`);
    this.services.battery.getCharacteristic(Characteristic.ChargingState).updateValue(isCharging ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGING);
    if (this.config.dock) {
      const msg = isCharging ? 'Robot was docked' : 'Robot not anymore in dock';
      this.log.info(`INF changedCharging | ${this.model} | ${msg}.`);
      this.services.dock.getCharacteristic(Characteristic.OccupancyDetected).updateValue(isCharging);
    }
  }

  changedSpeed(speed) {
    this.log.info(`MON changedSpeed | ${this.model} | FanSpeed is now ${speed}%`);
    if (speed === 105) { // Mop / Mopping / Nur wischen
      this.log.info(`INF changedSpeed | ${this.model} | Speed was changed to 105% (Mopping), for HomeKit 15%`);
      this.services.fan.getCharacteristic(Characteristic.RotationSpeed).updateValue(15);
    } else if (speed >= 0 && speed <= 100) {
      this.log.info(`INF changedSpeed | ${this.model} | Speed was changed to ${speed}%`);
    } else {
      this.log.warn(`WAR changedSpeed | ${this.model} | Speed was changed to ${speed}%, this speed is not supported`);
    }
  }

  changedBattery(level) {
    this.log.debug(`DEB changedBattery | ${this.model} | BatteryLevel ${level}%`);
    this.services.battery.getCharacteristic(Characteristic.BatteryLevel).updateValue(level);
    this.services.battery.getCharacteristic(Characteristic.StatusLowBattery).updateValue((level < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
  }

  async initializeDevice() {
    try {
      if (this.startup) {
        this.log.debug('DEB getDevice | Discovering vacuum cleaner');
      }

      const device = await miio.device({
        address: this.config.ip,
        token: this.config.token,
      });

      if (device.matches('type:vaccuum')) {
        this.device = device;
        this.device.on('errorChanged', (error) => this.changedError(error));
        this.device.on('stateChanged', (state) => {
          if (state.key === 'cleaning') {
            this.changedCleaning(state.value);
            this.changedPause(state.value);
          } else if (state.key === 'charging') {
            this.changedCharging(state.value);
          } else if (state.key === 'fanSpeed') {
            this.changedSpeed(state.value);
          } else if (state.key === 'batteryLevel') {
            this.changedBattery(state.value);
          } else {
            this.log.debug(`DEB stateChanged | ${this.model} | Not supported stateChanged event: ${state.key}:${state.value}`);
          }
        });

        if (this.startup) {
          this.model = this.device.miioModel;

          this.log.info('STA getDevice | Connected to: %s', this.config.ip);
          this.log.info('STA getDevice | Model: ' + this.device.miioModel);
          this.log.info('STA getDevice | State: ' + this.device.property("state"));
          this.log.info('STA getDevice | FanSpeed: ' + this.device.property("fanSpeed"));
          this.log.info('STA getDevice | BatteryLevel: ' + this.device.property("batteryLevel"));

          try {
            const serial = await this.getSerialNumber();
            this.log.info(`STA getDevice | Serialnumber: ${serial}`);
          } catch (err) {
            this.log.error(`ERR getDevice | get_serial_number | ${err}`);
          }

          try {
            const firmware = await this.getFirmware();
            this.log.info(`STA getDevice | Firmwareversion: ${firmware}`);
          } catch (err) {
            this.log.error(`ERR getDevice | miIO.info | ${err}`);
          }

          // HOMEKIT SERVICES
          await this.initialiseServices();

          this.startup = false;
        }

        await this.getState();
      } else {
        this.log.error('ERR getDevice | Is not a vacuum cleaner!');
        this.log.debug(device);
        device.destroy();
      }
    } catch (error) {
      this.log.error(`ERR getDevice | miio.device, next try in 2 minutes | ${error}`);
      // No response from device over miio, wait 120 seconds for next try.
      await new Promise((resolve) => setTimeout(resolve, 120000));
      await this.initializeDevice();
    }
  }

  async ensureDevice(callingMethod) {
    if (!this.device) {
      const errMsg = `ERR ${callingMethod} | No vacuum cleaner is discovered.`;
      this.log.error(errMsg);
      throw new Error(errMsg);
    }

    try {
      // checking if the device has an open socket it will fail retrieving it if not
      // https://github.com/aholstenson/miio/blob/master/lib/network.js#L227
      const socket = this.device.handle.api.parent.socket;
      this.log.debug(`DEB ensureDevice | ${this.model} | Socket ${socket.id} is still on. Reusing it.`);
    } catch (err) {
      if (/destroyed/i.test(err.message)) {
        this.log.info(`INF ensureDevice | ${this.model} | Socket was destroyed, reinitialising the device`);
        await this.initializeDevice();
      } else {
        this.log.error(err);
        throw err;
      }
    }
  }

  async getState() {
    await this.ensureDevice('getState');

    try {
      const state = await this.device.state();
      if (state.error) {
        this.changedError(state.error);
        throw state.error;
      }

      this.log.debug(`DEB getState | ${this.model} | State %j`, state);

      this.changedCleaning(state.cleaning);
      this.changedCharging(state.charging);
      this.changedSpeed(state.fanSpeed);
      this.changedBattery(state.BatteryLevel);
      this.changedPause(state.cleaning);
    } catch (err) {
      this.log.error(`ERR getState | this.device.state | ${err}`);
    }
  }

  async getSerialNumber() {
    await this.ensureDevice('getSerialNumber');

    try {
      const serial = await this.device.call('get_serial_number');
      this.log.info(`INF getSerialNumber | ${this.model} | Serial Number is ${serial[0].serial_number}`);

      return serial[0].serial_number;
    } catch (err) {
      this.log.error(`ERR getSerialNumber | Failed getting the firmware version.`, err);
      throw err;
    }
  }

  async getFirmware() {
    await this.ensureDevice('getFirmware');

    try {
      const firmware = await this.device.call('miIO.info');
      this.log.info(`INF getFirmware | ${this.model} | Firmwareversion is ${firmware.fw_ver}`);

      return firmware.fw_ver;
    } catch (err) {
      this.log.error(`ERR getFirmware | Failed getting the firmware version.`, err);
      throw err;
    }
  }

  get isCleaning() {
    const status = this.device.property('state');
    return XiaomiRoborockVacuum.cleaningStatuses.includes(status);
  }

  async getCleaning() {
    await this.ensureDevice('getCleaning');

    try {
      const isCleaning = this.isCleaning
      this.log.info(`INF getCleaning | ${this.model} | Cleaning is ${isCleaning}`);

      return isCleaning;
    } catch (err) {
      this.log.error(`ERR getCleaning | Failed getting the cleaning status.`, err);
      throw err;
    }
  }

  async setCleaning(state) {
    await this.ensureDevice('setCleaning');

    try {
      if (state && !this.isCleaning) { // Start cleaning
        this.log.info(`ACT setCleaning | ${this.model} | Start cleaning, not charging.`);
        await this.device.activateCleaning();
      } else if (!state) { // Stop cleaning
        this.log.info(`ACT setCleaning | ${this.model} | Stop cleaning and go to charge.`);
        await this.device.activateCharging(); // Charging works for 1st, not for 2nd
      }
    } catch (err) {
      this.log.error(`ERR setCleaning | ${this.model} | Failed to set cleaning to ${state}`, err);
      throw err;
    }
  }

  async getSpeed() {
    await this.ensureDevice('getSpeed');

    this.log.info(`INF getSpeed | ${this.model} | Fanspeed is ${this.device.property('fanSpeed')}`)
    const speed = this.device.property('fanSpeed');

    if (speed === 105) { // Mopping mode
      return 15;
    }

    return this.device.fanSpeed || 0;
  }

  async setSpeed(speed) {
    await this.ensureDevice('setSpeed');

    this.log.debug(`ACT setSpeed | ${this.model} | Speed got ${speed}% over HomeKit > CLEANUP.`);

    const speedModes = (this.model == "rockrobo.vacuum.v1") ? XiaomiRoborockVacuum.speedmodes_gen1 : XiaomiRoborockVacuum.speedmodes_gen2;

    // gen1 has maximum of 91%, so anything over that won't work. Getting safety maximum.
    const safeSpeed = Math.min(parseInt(speed), speedModes[speedModes.length - 1]);

    let miioSpeedMode = speedModes.find((miioSpeed) => safeSpeed <= miioSpeed);

    if (miioSpeedMode === 15) {
      miioSpeedMode = 105;
      this.log.info(`ACT setSpeed | ${this.model} | FanSpeed set to ${miioSpeedMode} over miIO for Mopping.`);
    } else {
      this.log.info(`ACT setSpeed | ${this.model} | FanSpeed set to ${miioSpeedMode} over miIO.`);
    }
    await this.device.changeFanSpeed(miioSpeedMode);
  }

  async getPauseState() {
    await this.ensureDevice('getPauseState');

    try {
      const isCleaning = this.isCleaning
      this.log.info(`INF getPauseState | ${this.model} | Pause possible is ${isCleaning}`);
      return isCleaning;
    } catch (err) {
      this.log.error(`ERR getPauseState | ${this.model} | Failed getting the cleaning status.`, err);
    }
  }

  async setPauseState(state) {
    await this.ensureDevice('setPauseState');

    try {
      if (state && !this.isCleaning) {
        await this.device.activateCleaning();
      } else if (!state) {
        await this.device.pause();
      }
    } catch (err) {
      this.log.error(`ERR setPauseState | ${this.model} | Failed updating pause state ${state}.`, err);
    }
  }

  async getCharging() {
    await this.ensureDevice('getCharging');

    // From https://github.com/aholstenson/miio/blob/master/lib/devices/vacuum.js#L65
    const status = this.device.property('state');
    this.log.info(`INF getCharging | ${this.model} | Charging is ${status === "charging"} (Status is ${status})`);

    return (status === "charging") ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGING;
  }

  async getDocked() {
    await this.ensureDevice('getDocked');

    // From https://github.com/aholstenson/miio/blob/master/lib/devices/vacuum.js#L65
    const status = this.device.property('state');
    this.log.info(`INF getDocked | ${this.model} | Robot Docked is ${status === 'charging'} (Status is ${status})`);

    return status === "charging";
  }

  async getBattery() {
    await this.ensureDevice('getBattery');

    // https://github.com/aholstenson/miio/blob/master/lib/devices/vacuum.js#L90
    this.log.info(`INF getBattery | ${this.model} | Batterylevel is ${this.device.property('batteryLevel')}%`);
    return this.device.property('batteryLevel');
  }

  async getBatteryLow() {
    await this.ensureDevice('getBatteryLow');

    // https://github.com/aholstenson/miio/blob/master/lib/devices/vacuum.js#L90
    this.log.info(`INF getBatteryLow | ${this.model} | Batterylevel is ${this.device.property('batteryLevel')}%`);
    return (this.device.property('batteryLevel') < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  async identify(callback) {
    await this.ensureDevice('identify');

    this.log.info(`ACT identify | ${this.model} | Find me - Hello!`);
    try {
      await this.device.find();
      callback();
    } catch (err) {
      this.log.error(`ERR identify | ${this.model} | `, err);
      callback(err);
    }
  }

  getServices() {
    this.log.debug(`DEB getServices | ${this.model}`);
    return Object.keys(this.services).map((key) => this.services[key]);
  }

  // CONSUMABLE / CARE
  async getCareSensors() {
    await this.ensureDevice('getCareSensors');

    // 30h = sensor_dirty_time
    const lifetime = 108000;
    const lifetimepercent = this.device.property("sensorDirtyTime") / lifetime * 100;
    this.log.info(`INF getCareSensors | ${this.model} | Sensors dirtytime is ${this.device.property("sensorDirtyTime")} seconds / ${lifetimepercent.toFixed(2)}%.`);
    return lifetimepercent;
  }

  async getCareFilter() {
    await this.ensureDevice('getCareFilter');

    // 150h = filter_work_time
    const lifetime = 540000;
    const lifetimepercent = this.device.property("filterWorkTime") / lifetime * 100;
    this.log.info(`INF getCareFilter | ${this.model} | Filter worktime is ${this.device.property("filterWorkTime")} seconds / ${lifetimepercent.toFixed(2)}%.`);
    return lifetimepercent;
  }

  async getCareSideBrush() {
    await this.ensureDevice('getCareSideBrush');

    // 200h = side_brush_work_time
    const lifetime = 720000;
    const lifetimepercent = this.device.property("sideBrushWorkTime") / lifetime * 100;
    this.log.info(`INF getCareSideBrush | ${this.model} | Sidebrush worktime is ${this.device.property("sideBrushWorkTime")} seconds / ${lifetimepercent.toFixed(2)}%.`);
    return lifetimepercent;
  }

  async getCareMainBrush() {
    await this.ensureDevice('getCareMainBrush');

    // 300h = main_brush_work_time
    const lifetime = 1080000;
    const lifetimepercent = this.device.property("mainBrushWorkTime") / lifetime * 100;
    this.log.info(`INF getCareMainBrush | ${this.model} | Mainbrush worktime is ${this.device.property("mainBrushWorkTime")} seconds / ${lifetimepercent.toFixed(2)}%.`);
    return lifetimepercent;
  }
}