"use strict";

const semver = require("semver");
const miio = require("./miio");
const util = require("util");
const callbackifyLib = require("./lib/callbackify");
const safeCall = require("./lib/safeCall");

const noop = () => {};

let homebrideAPI, Service, Characteristic;

const PLUGIN_NAME = "homebridge-xiaomi-roborock-vacuum";
const ACCESSORY_NAME = "XiaomiRoborockVacuum";

const MODELS = require("./models");
const GET_STATE_INTERVAL_MS = 30000; // 30s

module.exports = function (homebridge) {
  // Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebrideAPI = homebridge;
  // UUIDGen = homebridge.hap.uuid;

  homebridge.registerAccessory(
    PLUGIN_NAME,
    ACCESSORY_NAME,
    XiaomiRoborockVacuum
  );
};

class XiaomiRoborockVacuum {
  // From https://github.com/aholstenson/miio/blob/master/lib/devices/vacuum.js#L128
  static get cleaningStatuses() {
    return ["cleaning", "spot-cleaning", "zone-cleaning", "room-cleaning"];
  }

  static get errors() {
    return {
      id1: {
        description:
          "Try turning the orange laserhead to make sure it isnt blocked.",
      },
      id2: { description: "Clean and tap the bumpers lightly." },
      id3: { description: "Try moving the vacuum to a different place." },
      id4: {
        description:
          "Wipe the cliff sensor clean and move the vacuum to a different place.",
      },
      id5: { description: "Remove and clean the main brush." },
      id6: { description: "Remove and clean the sidebrushes." },
      id7: {
        description:
          "Make sure the wheels arent blocked. Move the vacuum to a different place and try again.",
      },
      id8: {
        description: "Make sure there are no obstacles around the vacuum.",
      },
      id9: { description: "Install the dustbin and the filter." },
      id10: {
        description: "Make sure the filter has been tried or clean the filter.",
      },
      id11: {
        description:
          "Strong magnetic field detected. Move the device away from the virtual wall and try again",
      },
      id12: { description: "Battery is low, charge your vacuum." },
      id13: {
        description:
          "Couldnt charge properly. Make sure the charging surfaces are clean.",
      },
      id14: { description: "Battery malfunctioned." },
      id15: { description: "Wipe the wall sensor clean." },
      id16: { description: "Use the vacuum on a flat horizontal surface." },
      id17: { description: "Sidebrushes malfunctioned. Reboot the system." },
      id18: { description: "Fan malfunctioned. Reboot the system." },
      id19: { description: "The docking station is not connected to power." },
      id20: { description: "unkown" },
      id21: {
        description:
          "Please make sure that the top cover of the laser distance sensor is not pinned.",
      },
      id22: { description: "Please wipe the dock sensor." },
      id23: {
        description: "Make sure the signal emission area of dock is clean.",
      },
      id24: {
        description:
          "Robot stuck in a blocked area. Manually move it and resume the cleaning.",
      },
    };
  }

  constructor(log, config) {
    this.log = {
      debug: (...args) => (config.silent ? noop() : log.debug(...args)),
      info: (...args) => (config.silent ? noop() : log.info(...args)),
      warn: (...args) => log.warn(...args),
      error: (...args) => log.error(...args),
    };
    this.config = config;
    this.config.name = config.name || "Roborock vacuum cleaner";
    this.config.cleanword = config.cleanword || "cleaning";
    this.config.pause = config.pause || false;
    this.config.pauseWord = config.pauseWord || "Pause";
    this.config.findMe = config.findMe || false;
    this.config.findMeWord = config.findMeWord || "where are you";
    this.config.roomTimeout =
      config.roomTimeout == undefined ? 0 : config.roomTimeout;
    this.services = {};

    // Used to store the latest state to reduce logging
    this.cachedState = new Map();

    this.device = null;
    this.connectingPromise = null;
    this.connectRetry = setTimeout(() => void 0, 100); // Noop timeout only to initialise the property
    this.getStateInterval = setInterval(() => void 0, GET_STATE_INTERVAL_MS); // Noop timeout only to initialise the property

    this.roomIdsToClean = new Set();

    if (!this.config.ip) {
      throw new Error("You must provide an ip address of the vacuum cleaner.");
    }

    if (!this.config.token) {
      throw new Error("You must provide a token of the vacuum cleaner.");
    }

    if (this.config.rooms && this.config.autoroom) {
      throw new Error(`Both "autoroom" and "rooms" config options can't be used at the same time.\n
      Please, use "autoroom" to retrieve the "rooms" config and remove it when not needed.`);
    }

    // HOMEKIT SERVICES
    this.initialiseServices();

    // Initialize device
    this.connect().catch(() => {
      // Do nothing in the catch because this function already logs the error internally and retries after 2 minutes.
    });
  }

  initialiseServices() {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify = (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.services.info = new Service.AccessoryInformation();
    this.services.info
      .setCharacteristic(Characteristic.Manufacturer, "Xiaomi")
      .setCharacteristic(Characteristic.Model, "Roborock");
    this.services.info
      .getCharacteristic(Characteristic.FirmwareRevision)
      .on("get", (cb) => callbackify(() => this.getFirmware(), cb));
    this.services.info
      .getCharacteristic(Characteristic.Model)
      .on("get", (cb) => callbackify(() => this.device.miioModel, cb));
    this.services.info
      .getCharacteristic(Characteristic.SerialNumber)
      .on("get", (cb) => callbackify(() => this.getSerialNumber(), cb));

    this.services.fan = new Service.Fan(this.config.name, "Speed");
    if (this.services.fan.setPrimaryService) {
      this.services.fan.setPrimaryService(true);
    }
    this.services.fan
      .getCharacteristic(Characteristic.On)
      .on("get", (cb) => callbackify(() => this.getCleaning(), cb))
      .on("set", (newState, cb) =>
        callbackify(() => this.setCleaning(newState), cb)
      )
      .on("change", (oldState, newState) => {
        this.changedPause(newState);
      });
    this.services.fan
      .getCharacteristic(Characteristic.RotationSpeed)
      .on("get", (cb) => callbackify(() => this.getSpeed(), cb))
      .on("set", (newState, cb) =>
        callbackify(() => this.setSpeed(newState), cb)
      );

    if (this.config.waterBox) {
      this.services.waterBox = new Service.Fan(
        `${this.config.name} Water Box`,
        "Water Box"
      );
      this.services.waterBox
        .getCharacteristic(Characteristic.RotationSpeed)
        .on("get", (cb) => callbackify(() => this.getWaterSpeed(), cb))
        .on("set", (newState, cb) =>
          callbackify(() => this.setWaterSpeed(newState), cb)
        );
      // We need to handle the ON/OFF characteristic (https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/284)
      this.services.waterBox
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) =>
          // If the speed is over 0%, assume it's ON
          callbackify(async () => (await this.getWaterSpeed()) > 0, cb)
        )
        .on("set", (newState, cb) =>
          callbackify(() => {
            // Set to 0% (Off) when receiving an OFF request, do nothing otherwise.
            if (!newState) {
              return this.setCleaning(0);
            }
          }, cb)
        );
    }

    this.services.battery = new Service.BatteryService(
      `${this.config.name} Battery`
    );
    this.services.battery
      .getCharacteristic(Characteristic.BatteryLevel)
      .on("get", (cb) => callbackify(() => this.getBattery(), cb));
    this.services.battery
      .getCharacteristic(Characteristic.ChargingState)
      .on("get", (cb) => callbackify(() => this.getCharging(), cb));
    this.services.battery
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on("get", (cb) => callbackify(() => this.getBatteryLow(), cb));

    if (this.config.pause) {
      this.services.pause = new Service.Switch(
        `${this.config.name} ${this.config.pauseWord}`,
        "Pause Switch"
      );
      this.services.pause
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) => callbackify(() => this.getPauseState(), cb))
        .on("set", (newState, cb) =>
          callbackify(() => this.setPauseState(newState), cb)
        );
      // TODO: Add 'change' status?
    }

    if (this.config.findMe) {
      this.services.findMe = new Service.Switch(
        `${this.config.name} ${this.config.findMeWord}`,
        "FindMe Switch"
      );
      this.services.findMe
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) => callbackify(() => false, cb))
        .on("set", (newState, cb) => this.identify(cb));
    }

    if (this.config.dock) {
      this.services.dock = new Service.OccupancySensor(
        `${this.config.name} Dock`
      );
      this.services.dock
        .getCharacteristic(Characteristic.OccupancyDetected)
        .on("get", (cb) => callbackify(() => this.getDocked(), cb));
    }

    if (this.config.rooms && !this.config.autoroom) {
      for (var i in this.config.rooms) {
        this.createRoom(this.config.rooms[i].id, this.config.rooms[i].name);
      }
    }

    // Declare services for rooms in advance, so HomeKit can create the switches
    if (this.config.autoroom && Array.isArray(this.config.autoroom)) {
      for (const i in this.config.autoroom) {
        // Index will be overwritten, when robot is available
        this.createRoom(i, this.config.autoroom[i]);
      }
    }

    if (this.config.zones) {
      for (var i in this.config.zones) {
        this.createZone(this.config.zones[i].name, this.config.zones[i].zone);
      }
    }

    // ADDITIONAL HOMEKIT SERVICES
    this.initialiseCareServices();
  }

  initialiseCareServices() {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify = (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    if (this.config.legacyCareSensors) {
      Characteristic.CareSensors = function () {
        Characteristic.call(
          this,
          "Care indicator sensors",
          "00000101-0000-0000-0000-000000000000"
        );
        this.setProps({
          format: Characteristic.Formats.FLOAT,
          unit: "%",
          perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
        });
        this.value = this.getDefaultValue();
      };
      util.inherits(Characteristic.CareSensors, Characteristic);
      Characteristic.CareSensors.UUID = "00000101-0000-0000-0000-000000000000";

      Characteristic.CareFilter = function () {
        Characteristic.call(
          this,
          "Care indicator filter",
          "00000102-0000-0000-0000-000000000000"
        );
        this.setProps({
          format: Characteristic.Formats.FLOAT,
          unit: "%",
          perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
        });
        this.value = this.getDefaultValue();
      };
      util.inherits(Characteristic.CareFilter, Characteristic);
      Characteristic.CareFilter.UUID = "00000102-0000-0000-0000-000000000000";

      Characteristic.CareSideBrush = function () {
        Characteristic.call(
          this,
          "Care indicator side brush",
          "00000103-0000-0000-0000-000000000000"
        );
        this.setProps({
          format: Characteristic.Formats.FLOAT,
          unit: "%",
          perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
        });
        this.value = this.getDefaultValue();
      };
      util.inherits(Characteristic.CareSideBrush, Characteristic);
      Characteristic.CareSideBrush.UUID =
        "00000103-0000-0000-0000-000000000000";

      Characteristic.CareMainBrush = function () {
        Characteristic.call(
          this,
          "Care indicator main brush",
          "00000104-0000-0000-0000-000000000000"
        );
        this.setProps({
          format: Characteristic.Formats.FLOAT,
          unit: "%",
          perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
        });
        this.value = this.getDefaultValue();
      };
      util.inherits(Characteristic.CareMainBrush, Characteristic);
      Characteristic.CareMainBrush.UUID =
        "00000104-0000-0000-0000-000000000000";

      Service.Care = function (displayName, subtype) {
        Service.call(
          this,
          displayName,
          "00000111-0000-0000-0000-000000000000",
          subtype
        );
        this.addCharacteristic(Characteristic.CareSensors);
        this.addCharacteristic(Characteristic.CareFilter);
        this.addCharacteristic(Characteristic.CareSideBrush);
        this.addCharacteristic(Characteristic.CareMainBrush);
      };
      util.inherits(Service.Care, Service);
      Service.Care.UUID = "00000111-0000-0000-0000-000000000000";

      this.services.Care = new Service.Care(`${this.config.name} Care`);
      this.services.Care.getCharacteristic(Characteristic.CareSensors).on(
        "get",
        (cb) => callbackify(() => this.getCareSensors(), cb)
      );
      this.services.Care.getCharacteristic(Characteristic.CareFilter).on(
        "get",
        (cb) => callbackify(() => this.getCareFilter(), cb)
      );
      this.services.Care.getCharacteristic(
        Characteristic.CareSideBrush
      ).on("get", (cb) => callbackify(() => this.getCareSideBrush(), cb));
      this.services.Care.getCharacteristic(
        Characteristic.CareMainBrush
      ).on("get", (cb) => callbackify(() => this.getCareMainBrush(), cb));
    } else {
      this.services.fan
        .getCharacteristic(Characteristic.FilterChangeIndication)
        .on("get", (cb) =>
          callbackify(async () => {
            const carePercentages = await Promise.all([
              this.getCareSensors(),
              this.getCareFilter(),
              this.getCareSideBrush(),
            ]);
            return carePercentages.some((item) => item >= 100);
          }, cb)
        );
      this.services.fan
        .getCharacteristic(Characteristic.FilterLifeLevel)
        .on("get", (cb) =>
          callbackify(async () => {
            const carePercentages = await Promise.all([
              this.getCareSensors(),
              this.getCareFilter(),
              this.getCareSideBrush(),
            ]);
            return 100 - Math.max(...carePercentages);
          }, cb)
        );

      // Use Homekit's native FilterMaintenance Service
      this.services.CareSensors = new Service.FilterMaintenance(
        "Care indicator sensors",
        "sensors"
      );
      this.services.CareSensors.getCharacteristic(
        Characteristic.FilterChangeIndication
      ).on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareSensors()) >= 100;
        }, cb)
      );
      this.services.CareSensors.getCharacteristic(
        Characteristic.FilterLifeLevel
      ).on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareSensors()), cb)
      );

      this.services.CareFilter = new Service.FilterMaintenance(
        "Care indicator filter",
        "filter"
      );
      this.services.CareFilter.getCharacteristic(
        Characteristic.FilterChangeIndication
      ).on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareFilter()) >= 100;
        }, cb)
      );
      this.services.CareFilter.getCharacteristic(
        Characteristic.FilterLifeLevel
      ).on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareFilter()), cb)
      );

      this.services.CareSideBrush = new Service.FilterMaintenance(
        "Care indicator side brush",
        "side brush"
      );
      this.services.CareSideBrush.getCharacteristic(
        Characteristic.FilterChangeIndication
      ).on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareSideBrush()) >= 100;
        }, cb)
      );
      this.services.CareSideBrush.getCharacteristic(
        Characteristic.FilterLifeLevel
      ).on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareSideBrush()), cb)
      );

      this.services.CareMainBrush = new Service.FilterMaintenance(
        "Care indicator main brush",
        "main brush"
      );
      this.services.CareMainBrush.getCharacteristic(
        Characteristic.FilterChangeIndication
      ).on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareMainBrush()) >= 100;
        }, cb)
      );
      this.services.CareMainBrush.getCharacteristic(
        Characteristic.FilterLifeLevel
      ).on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareMainBrush()), cb)
      );
    }
  }

  /**
   * Returns if the newValue is different to the previously cached one
   *
   * @param {string} property
   * @param {any} newValue
   * @returns {boolean} Whether the newValue is not the same as the previously cached one.
   */
  isNewValue(property, newValue) {
    const cachedValue = this.cachedState.get(property);
    this.cachedState.set(property, newValue);
    return cachedValue !== newValue;
  }

  changedError(robotError) {
    if (!robotError) return;
    if (!this.isNewValue("error", robotError.id)) return;
    this.log.debug(
      `DEB changedError | ${this.model} | ErrorID: ${robotError.id}, ErrorDescription: ${robotError.description}`
    );
    let robotErrorTxt = XiaomiRoborockVacuum.errors[`id${robotError.id}`]
      ? XiaomiRoborockVacuum.errors[`id${robotError.id}`].description
      : `Unknown ERR | errorid can't be mapped. (${robotError.id})`;
    if (!`${robotError.description}`.toLowerCase().startsWith("unknown")) {
      robotErrorTxt = robotError.description;
    }
    this.log.warn(
      `WAR changedError | ${this.model} | Robot has an ERROR - ${robotError.id}, ${robotErrorTxt}`
    );
    // Clear the error_code property
    this.device.setRawProperty("error_code", 0);
  }

  changedCleaning(isCleaning) {
    if (this.isNewValue("cleaning", isCleaning)) {
      this.log.debug(
        `MON changedCleaning | ${this.model} | CleaningState is now ${isCleaning}`
      );
      this.log.info(
        `INF changedCleaning | ${this.model} | Cleaning is ${
          isCleaning ? "ON" : "OFF"
        }.`
      );
      if (!isCleaning) {
        this.roomIdsToClean.clear();
      }
    }
    // We still update the value in Homebridge. If we are calling the changed method is because we want to change it.
    this.services.fan
      .getCharacteristic(Characteristic.On)
      .updateValue(isCleaning);

    if (this.config.waterBox) {
      this.services.waterBox
        .getCharacteristic(Characteristic.On)
        .updateValue(isCleaning);
    }
  }

  changedPause(newValue) {
    const isCleaning = newValue === true;
    if (this.config.pause) {
      if (this.isNewValue("pause", isCleaning)) {
        this.log.debug(
          `MON changedPause | ${this.model} | CleaningState is now ${isCleaning}`
        );
        this.log.info(
          `INF changedPause | ${this.model} | ${
            isCleaning ? "Paused possible" : "Paused not possible, no cleaning"
          }`
        );
      }
      // We still update the value in Homebridge. If we are calling the changed method is because we want to change it.
      this.services.pause
        .getCharacteristic(Characteristic.On)
        .updateValue(isCleaning === true);

      if (this.config.waterBox) {
        this.services.waterBox
          .getCharacteristic(Characteristic.On)
          .updateValue(isCleaning === true);
      }
    }
  }

  changedCharging(isCharging) {
    const isNewValue = this.isNewValue("charging", isCharging);
    if (isNewValue) {
      this.log.info(
        `MON changedCharging | ${this.model} | ChargingState is now ${isCharging}`
      );
      this.log.info(
        `INF changedCharging | ${this.model} | Charging is ${
          isCharging ? "active" : "cancelled"
        }`
      );
    }
    // We still update the value in Homebridge. If we are calling the changed method is because we want to change it.
    this.services.battery
      .getCharacteristic(Characteristic.ChargingState)
      .updateValue(
        isCharging
          ? Characteristic.ChargingState.CHARGING
          : Characteristic.ChargingState.NOT_CHARGING
      );
    if (this.config.dock) {
      if (isNewValue) {
        const msg = isCharging
          ? "Robot was docked"
          : "Robot not anymore in dock";
        this.log.info(`INF changedCharging | ${this.model} | ${msg}.`);
      }
      this.services.dock
        .getCharacteristic(Characteristic.OccupancyDetected)
        .updateValue(isCharging);
    }
  }

  changedSpeed(speed) {
    const isNewValue = this.isNewValue("speed", speed);
    if (isNewValue) {
      this.log.info(
        `MON changedSpeed | ${this.model} | FanSpeed is now ${speed}%`
      );
    }

    const speedMode = this.findSpeedModeFromMiio(speed);

    if (typeof speedMode === "undefined") {
      this.log.warn(
        `WAR changedSpeed | ${this.model} | Speed was changed to ${speed}%, this speed is not supported`
      );
    } else {
      const { homekitTopLevel, name } = speedMode;
      if (isNewValue) {
        this.log.info(
          `INF changedSpeed | ${this.model} | Speed was changed to ${speed}% (${name}), for HomeKit ${homekitTopLevel}%`
        );
      }
      this.services.fan
        .getCharacteristic(Characteristic.RotationSpeed)
        .updateValue(homekitTopLevel);
    }
  }

  changedBattery(level) {
    this.log.debug(
      `DEB changedBattery | ${this.model} | BatteryLevel ${level}%`
    );
    this.services.battery
      .getCharacteristic(Characteristic.BatteryLevel)
      .updateValue(level);
    this.services.battery
      .getCharacteristic(Characteristic.StatusLowBattery)
      .updateValue(
        level < 20
          ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
  }

  async initializeDevice() {
    this.log.debug("DEB getDevice | Discovering vacuum cleaner");

    const device = await miio.device({
      address: this.config.ip,
      token: this.config.token,
    });

    if (device.matches("type:vaccuum")) {
      this.device = device;

      this.model = this.device.miioModel;
      this.services.info.setCharacteristic(Characteristic.Model, this.model);

      this.log.info("STA getDevice | Connected to: %s", this.config.ip);
      this.log.info("STA getDevice | Model: " + this.device.miioModel);
      this.log.info("STA getDevice | State: " + this.device.property("state"));
      this.log.info(
        "STA getDevice | FanSpeed: " + this.device.property("fanSpeed")
      );
      this.log.info(
        "STA getDevice | BatteryLevel: " + this.device.property("batteryLevel")
      );

      if (this.config.autoroom) {
        if (Array.isArray(this.config.autoroom)) {
          await this.getRoomList();
        } else {
          await this.getRoomMap();
        }
      }

      try {
        const serial = await this.getSerialNumber();
        this.services.info.setCharacteristic(
          Characteristic.SerialNumber,
          `${serial}`
        );
        this.log.info(`STA getDevice | Serialnumber: ${serial}`);
      } catch (err) {
        this.log.error(`ERR getDevice | get_serial_number | ${err}`);
      }

      try {
        const firmware = await this.getFirmware();
        this.firmware = firmware;
        this.services.info.setCharacteristic(
          Characteristic.FirmwareRevision,
          `${firmware}`
        );
        this.log.info(`STA getDevice | Firmwareversion: ${firmware}`);
      } catch (err) {
        this.log.error(`ERR getDevice | miIO.info | ${err}`);
      }

      this.device.on("errorChanged", (error) => this.changedError(error));
      this.device.on("stateChanged", (state) => {
        if (state.key === "cleaning") {
          this.changedCleaning(state.value);
          this.changedPause(state.value);
        } else if (state.key === "charging") {
          this.changedCharging(state.value);
        } else if (state.key === "fanSpeed") {
          this.changedSpeed(state.value);
        } else if (state.key === "batteryLevel") {
          this.changedBattery(state.value);
        } else {
          this.log.debug(
            `DEB stateChanged | ${this.model} | Not supported stateChanged event: ${state.key}:${state.value}`
          );
        }
      });

      // Now that we know the model, amend the steps in the Rotation speed (for better usability)
      const minStep = 100 / (this.findSpeedModes().speed.length - 1);
      this.services.fan
        .getCharacteristic(Characteristic.RotationSpeed)
        .setProps({ minStep: minStep });

      await this.getState();
      // Refresh the state every 30s so miio maintains a fresh connection (or recovers connection if lost until we fix https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/81)
      clearInterval(this.getStateInterval);
      this.getStateInterval = setInterval(
        () => this.getState(),
        GET_STATE_INTERVAL_MS
      );
    } else {
      const model = (device || {}).miioModel;
      this.log.error(
        `ERR getDevice | Device "${model}" is not registered as a vacuum cleaner! If you think it should be, please open an issue at https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/new and provide this line.`
      );
      this.log.debug(device);
      device.destroy();
    }
  }

  async connect() {
    if (this.connectingPromise === null) {
      // if already trying to connect, don't trigger yet another one
      this.connectingPromise = this.initializeDevice().catch((error) => {
        this.log.error(
          `ERR connect | miio.device, next try in 2 minutes | ${error}`
        );
        clearTimeout(this.connectRetry);
        // Using setTimeout instead of holding the promise. This way we'll keep retrying but not holding the other actions
        this.connectRetry = setTimeout(
          () => this.connect().catch(() => {}),
          120000
        );
        throw error;
      });
    }
    try {
      await this.connectingPromise;
      clearTimeout(this.connectRetry);
    } finally {
      this.connectingPromise = null;
    }
  }

  async ensureDevice(callingMethod) {
    try {
      if (!this.device) {
        const errMsg = `ERR ${callingMethod} | No vacuum cleaner is discovered yet.`;
        this.log.error(errMsg);
        throw new Error(errMsg);
      }

      // checking if the device has an open socket it will fail retrieving it if not
      // https://github.com/aholstenson/miio/blob/master/lib/network.js#L227
      const socket = this.device.handle.api.parent.socket;
      this.log.debug(
        `DEB ensureDevice | ${this.model} | The socket is still on. Reusing it.`
      );
    } catch (err) {
      if (
        /destroyed/i.test(err.message) ||
        /No vacuum cleaner is discovered yet/.test(err.message)
      ) {
        this.log.info(
          `INF ensureDevice | ${this.model} | The socket was destroyed or not initialised, initialising the device`
        );
        await this.connect();
      } else {
        this.log.error(err);
        throw err;
      }
    }
  }

  async getState() {
    try {
      await this.ensureDevice("getState");
      await this.device.poll();
      const state = await this.device.state();
      this.log.debug(
        `DEB getState | ${this.model} | State %j | Props %j`,
        state,
        this.device.properties
      );

      safeCall(state.cleaning, (cleaning) => this.changedCleaning(cleaning));
      safeCall(state.charging, (charging) => this.changedCharging(charging));
      safeCall(state.fanSpeed, (fanSpeed) => this.changedSpeed(fanSpeed));
      safeCall(state.batteryLevel, (batteryLevel) =>
        this.changedBattery(batteryLevel)
      );
      safeCall(state.cleaning, (cleaning) => this.changedPause(cleaning));
      if (this.config.waterBox) {
        safeCall(state["water_box_mode"], (waterBoxMode) =>
          this.changedWaterSpeed(waterBoxMode)
        );
      }

      // No need to throw the error at this point. This are just warnings like (https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/91)
      safeCall(state.error, (error) => this.changedError(error));
    } catch (err) {
      this.log.error(`ERR getState | %j`, err);
    }
  }

  async getSerialNumber() {
    await this.ensureDevice("getSerialNumber");

    try {
      const serialNumber = await this.device.getSerialNumber();
      this.log.info(
        `INF getSerialNumber | ${this.model} | Serial Number is ${serialNumber}`
      );

      return serialNumber;
    } catch (err) {
      this.log.warn(
        `ERR getSerialNumber | Failed getting the serial number.`,
        err
      );
      return `Unknown`;
    }
  }

  async getFirmware() {
    await this.ensureDevice("getFirmware");

    try {
      const firmware = await this.device.getDeviceInfo();
      this.log.info(
        `INF getFirmware | ${this.model} | Firmwareversion is ${firmware.fw_ver}`
      );

      return firmware.fw_ver;
    } catch (err) {
      this.log.error(
        `ERR getFirmware | Failed getting the firmware version.`,
        err
      );
      throw err;
    }
  }

  get isCleaning() {
    const status = this.device.property("state");
    return XiaomiRoborockVacuum.cleaningStatuses.includes(status);
  }

  get isPaused() {
    const isPaused = this.device.property("state") === "paused";
    return isPaused;
  }

  async getCleaning() {
    try {
      const isCleaning = this.isCleaning;
      this.log.info(
        `INF getCleaning | ${this.model} | Cleaning is ${isCleaning}`
      );

      return isCleaning;
    } catch (err) {
      this.log.error(
        `ERR getCleaning | Failed getting the cleaning status.`,
        err
      );
      throw err;
    }
  }

  async getCleaningRoom(roomId) {
    await this.ensureDevice("getCleaningRoom");
    return this.roomIdsToClean.has(roomId);
  }

  async setCleaning(state) {
    await this.ensureDevice("setCleaning");
    this.log.info(
      `ACT setCleaning | ${this.model} | Set cleaning to ${state}}`
    );
    try {
      if (state && !this.isCleaning) {
        // Start cleaning

        if (this.roomIdsToClean.size > 0) {
          await this.device.cleanRooms(Array.from(this.roomIdsToClean));
          this.log.info(
            `ACT setCleaning | ${
              this.model
            } | Start rooms cleaning for rooms ${Array.from(
              this.roomIdsToClean
            )}, device is in state ${this.device.property("state")}.`
          );
        } else {
          await this.device.activateCleaning();
          this.log.info(
            `ACT setCleaning | ${
              this.model
            } | Start full cleaning, device is in state ${this.device.property(
              "state"
            )}.`
          );
        }
      } else if (!state && (this.isCleaning || this.isPaused)) {
        // Stop cleaning
        this.log.info(
          `ACT setCleaning | ${
            this.model
          } | Stop cleaning and go to charge, device is in state ${this.device.property(
            "state"
          )}`
        );
        await this.device.activateCharging();
        this.roomIdsToClean.clear();
      }
    } catch (err) {
      this.log.error(
        `ERR setCleaning | ${this.model} | Failed to set cleaning to ${state}`,
        err
      );
      throw err;
    }
  }

  async setCleaningRoom(state, roomId) {
    await this.ensureDevice("setCleaning");

    try {
      if (state && !this.isCleaning && !this.isPaused) {
        this.log.info(
          `ACT setCleaningRoom | ${this.model} | Enable cleaning Room ID ${roomId}.`
        );
        // Delete then add, to maintain the correct order.
        this.roomIdsToClean.delete(roomId);
        this.roomIdsToClean.add(roomId);
        this.checkRoomTimeout();
      } else if (!state && !this.isCleaning && !this.isPaused) {
        this.log.info(
          `ACT setCleaningRoom | ${this.model} | Disable cleaning Room ID ${roomId}.`
        );
        this.roomIdsToClean.delete(roomId);
        this.checkRoomTimeout();
      }
    } catch (err) {
      this.log.error(
        `ERR setCleaningRoom | ${this.model} | Failed to set cleaning to ${state}`,
        err
      );
      throw err;
    }
  }

  checkRoomTimeout() {
    if (this.config.roomTimeout > 0) {
      this.log.info(
        `ACT setCleaningRoom | ${this.model} | Start timeout to clean rooms`
      );
      clearTimeout(this._roomTimeout);
      if (this.roomIdsToClean.size > 0) {
        this._roomTimeout = setTimeout(
          this.setCleaning.bind(this, true),
          this.config.roomTimeout * 1000
        );
      }
    }
  }

  async setCleaningZone(state, zone) {
    await this.ensureDevice("setCleaning");

    try {
      if (state && !this.isCleaning) {
        // Start cleaning
        this.log.info(
          `ACT setCleaning | ${this.model} | Start cleaning Zone ${zone}, not charging.`
        );

        const zoneParams = [];
        for (const zon of zone) {
          if (zon.length === 4) {
            zoneParams.push(zon.concat(1));
          } else if (zon.length === 5) {
            zoneParams.push(zon);
          }
        }
        await this.device.cleanZones(zoneParams);
      } else if (!state) {
        // Stop cleaning
        this.log.info(
          `ACT setCleaning | ${this.model} | Stop cleaning and go to charge.`
        );
        await this.device.activateCharging();
      }
    } catch (err) {
      this.log.error(
        `ERR setCleaning | ${this.model} | Failed to set cleaning to ${state}`,
        err
      );
      throw err;
    }
  }

  async getRoomList() {
    await this.ensureDevice("getRoomList");

    try {
      const timers = await this.device.getTimer();

      // Find specific timer containing the room order
      // Timer needs to be scheduled for 00:00 and inactive
      let leetTimer = timers.find(
        (x) => x[2][0].startsWith("0 0") && x[1] == "off"
      );
      if (typeof leetTimer === "undefined") {
        this.log.error(
          `ERR getRoomList | ${this.model} | Could not find a timer for autoroom`
        );
        return;
      }

      let roomIds = leetTimer[2][1][1]["segments"].split(`,`).map((x) => +x);
      this.log.debug(
        `DEB getRoomList | ${this.model} | Room IDs are ${roomIds}`
      );

      if (roomIds.length !== this.config.autoroom.length) {
        this.log.error(
          `ERR getRoomList | ${this.model} | Number of rooms in config does not match number of rooms in the timer`
        );
        return;
      }
      let roomMap = [];
      for (const [i, roomId] of roomIds.entries()) {
        this.services.rooms[this.config.autoroom[i]].roomId = roomId;
        roomMap.push({ id: roomId, name: this.config.autoroom[i] });
      }
      this.log.info(
        `INF getRoomList | ${this.model} | Created "rooms": ${JSON.stringify(
          roomMap
        )}`
      );
    } catch (err) {
      this.log.error(`ERR getRoomList | Failed getting the Room List.`, err);
      throw err;
    }
  }

  async getRoomMap() {
    await this.ensureDevice("getRoomMap");

    try {
      const map = await this.device.getRoomMap();
      this.log.info(`INF getRoomMap | ${this.model} | Map is ${map}`);
      for (let val of map) {
        this.createRoom(val[0], val[1]);
      }
    } catch (err) {
      this.log.error(`ERR getRoomMap | Failed getting the Room Map.`, err);
      throw err;
    }
  }

  createRoom(roomId, roomName) {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify = (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.log.info(
      `INF createRoom | ${this.model} | Room ${roomName} (${roomId})`
    );

    this.services.rooms = this.services.rooms || {};
    this.services.rooms[roomName] = new Service.Switch(
      `${this.config.cleanword} ${roomName}`,
      "roomService" + roomId
    );
    this.services.rooms[roomName].roomId = roomId;
    this.services.rooms[roomName]
      .getCharacteristic(Characteristic.On)
      .on("get", (cb) =>
        callbackify(
          () => this.getCleaningRoom(this.services.rooms[roomName].roomId),
          cb
        )
      )
      .on("set", (newState, cb) =>
        callbackify(
          () =>
            this.setCleaningRoom(
              newState,
              this.services.rooms[roomName].roomId
            ),
          cb
        )
      );
  }

  createZone(zoneName, zoneParams) {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify = (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.log.info(
      `INF createRoom | ${this.model} | Zone ${zoneName} (${zoneParams})`
    );
    this.services[zoneName] = new Service.Switch(
      `${this.config.cleanword} ${zoneName}`,
      "zoneCleaning" + zoneName
    );
    this.services[zoneName]
      .getCharacteristic(Characteristic.On)
      .on("get", (cb) => callbackify(() => this.getCleaning(), cb))
      .on("set", (newState, cb) =>
        callbackify(() => this.setCleaningZone(newState, zoneParams), cb)
      )
      .on("change", (oldState, newState) => {
        this.changedPause(newState);
      });
  }

  findSpeedModes() {
    if (this.model.startsWith("viomi.")) {
      return MODELS.viomi;
    }

    return (MODELS[this.model] || []).reduce((acc, option) => {
      if (option.firmware) {
        const [, cleanFirmware] =
          (this.firmware || "").match(/^(\d+\.\d+\.\d+)/) || [];
        return semver.satisfies(cleanFirmware, option.firmware) ? option : acc;
      } else {
        return option;
      }
    }, MODELS.default);
  }

  findSpeedModeFromMiio(speed) {
    // Get the speed modes for this model
    const speedModes = this.findSpeedModes().speed;

    // Find speed mode that matches the miLevel
    return speedModes.find((mode) => mode.miLevel === speed);
  }

  async getSpeed() {
    await this.ensureDevice("getSpeed");

    const speed = await this.device.fanSpeed();
    this.log.info(
      `INF getSpeed | ${this.model} | Fanspeed is ${speed} over miIO. Converting to HomeKit`
    );

    const { homekitTopLevel, name } = this.findSpeedModeFromMiio(speed);

    this.log.info(
      `INF getSpeed | ${this.model} | Fanspeed is ${speed} over miIO "${name}" > HomeKit speed ${homekitTopLevel}%`
    );

    return homekitTopLevel || 0;
  }

  async setSpeed(speed) {
    await this.ensureDevice("setSpeed");

    if (typeof speed === "number") {
      this.log.debug(
        `ACT setSpeed | ${this.model} | Speed got ${speed}% over HomeKit > CLEANUP.`
      );
    }

    // Get the speed modes for this model
    const speedModes = this.findSpeedModes().speed;

    let miLevel = null;
    let name = null;

    if (typeof speed === "number") {
      // Speed set by number
      // gen1 has maximum of 91%, so anything over that won't work. Getting safety maximum.
      const safeSpeed = Math.min(
        parseInt(speed),
        speedModes[speedModes.length - 1].homekitTopLevel
      );

      // Find the minimum homekitTopLevel that matches the desired speed
      const speedMode = speedModes.find(
        (mode) => safeSpeed <= mode.homekitTopLevel
      );
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    } else {
      // Set by mode name
      const speedMode = speedModes.find((mode) => mode.name === speed);

      if (speedMode == null) {
        this.log.info(
          `INF setSpeed | ${this.model} | Mode "${speed}" does not exist.`
        );
        return;
      }
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    }

    this.log.info(
      `ACT setSpeed | ${this.model} | FanSpeed set to ${miLevel} over miIO for "${name}".`
    );

    // Save the latest set speed for handling the "custom" speed later
    this.cachedState.set("FanSpeed", miLevel);
    this.cachedState.set("FanSpeedName", name);

    if (miLevel === -1) {
      this.log.info(
        `INF setSpeed | ${this.model} | FanSpeed is -1 => Calling setCleaning(false) instead of changing the fan speed`
      );
      await this.setCleaning(false);
    } else {
      await this.device.changeFanSpeed(miLevel);

      // If speed is "custom", also set the water speed to "custom" (for Xiaomi App)
      if (
        name === "Custom" &&
        this.config.waterBox &&
        this.cachedState.get("WaterSpeedName") !== "Custom"
      ) {
        this.setWaterSpeed("Custom");
      }
      // If speed is not "custom" remove set the water speed also to a fixed value (for Xiaomi App)
      else if (
        name !== "Custom" &&
        this.config.waterBox &&
        this.cachedState.get("WaterSpeedName") === "Custom"
      ) {
        this.setWaterSpeed("Medium");
      }
    }
  }

  findWaterSpeedModeFromMiio(speed) {
    // Get the speed modes for this model
    const speedModes = this.findSpeedModes().waterspeed || [];

    // Find speed mode that matches the miLevel
    return speedModes.find((mode) => mode.miLevel === speed);
  }

  async getWaterSpeed() {
    await this.ensureDevice("getWaterSpeed");

    const speed = await this.device.getWaterBoxMode();
    this.log.info(
      `INF getWaterSpeed | ${this.model} | WaterBoxMode is ${speed} over miIO. Converting to HomeKit`
    );

    const waterSpeed = this.findWaterSpeedModeFromMiio(speed);

    let homekitValue = 0;
    if (waterSpeed) {
      const { homekitTopLevel, name } = waterSpeed;
      this.log.info(
        `INF getWaterSpeed | ${this.model} | WaterBoxMode is ${speed} over miIO "${name}" > HomeKit speed ${homekitTopLevel}%`
      );
      homekitValue = homekitTopLevel || 0;
    }
    this.services.waterBox
      .getCharacteristic(Characteristic.On)
      .updateValue(homekitValue > 0);
    return homekitValue;
  }

  async setWaterSpeed(speed) {
    await this.ensureDevice("setWaterSpeed");

    if (typeof speed === "number") {
      this.log.debug(
        `ACT setWaterSpeed | ${this.model} | Speed got ${speed}% over HomeKit > CLEANUP.`
      );
    }

    // Get the speed modes for this model
    const speedModes = this.findSpeedModes().waterspeed || [];

    // If the robot does not support water-mode cleaning
    if (speedModes.length === 0) {
      this.log.info(
        `INF setWaterSpeed | ${this.model} | Model does not support the water mode`
      );
      return;
    }

    let miLevel = null;
    let name = null;

    if (typeof speed === "number") {
      // Speed set by number
      // gen1 has maximum of 91%, so anything over that won't work. Getting safety maximum.
      const safeSpeed = Math.min(
        parseInt(speed),
        speedModes[speedModes.length - 1].homekitTopLevel
      );

      // Find the minimum homekitTopLevel that matches the desired speed
      const speedMode = speedModes.find(
        (mode) => safeSpeed <= mode.homekitTopLevel
      );
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    } else {
      // Set by mode name
      const speedMode = speedModes.find((mode) => mode.name === speed);

      if (speedMode == null) {
        this.log.info(
          `INF setWaterSpeed | ${this.model} | Mode "${speed}" does not exist.`
        );
        return;
      }
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    }

    this.log.info(
      `ACT setWaterSpeed | ${this.model} | WaterBoxMode set to ${miLevel} over miIO for "${name}".`
    );

    // Save the latest set speed for handling the "custom" speed later
    this.cachedState.set("WaterSpeed", miLevel);
    this.cachedState.set("WaterSpeedName", name);

    await this.device.setWaterBoxMode(miLevel);

    // If speed is "custom", also set the water speed to "custom" (for Xiaomi App)
    if (
      name === "Custom" &&
      this.cachedState.get("FanSpeedName") !== "Custom"
    ) {
      this.setSpeed("Custom");
    }
    // If speed is not "custom" remove set the water speed also to a fixed value (for Xiaomi App)
    else if (
      name !== "Custom" &&
      this.cachedState.get("FanSpeedName") === "Custom"
    ) {
      this.setSpeed("Balanced");
    }
  }

  changedWaterSpeed(speed) {
    this.log.info(
      `MON changedWaterSpeed | ${this.model} | WaterBoxMode is now ${speed}%`
    );

    const speedMode = this.findWaterSpeedModeFromMiio(speed);

    if (typeof speedMode === "undefined") {
      this.log.warn(
        `WAR changedWaterSpeed | ${this.model} | Speed was changed to ${speed}%, this speed is not supported`
      );
    } else {
      const { homekitTopLevel, name } = speedMode;
      this.log.info(
        `INF changedWaterSpeed | ${this.model} | Speed was changed to ${speed}% (${name}), for HomeKit ${homekitTopLevel}%`
      );
      this.services.waterBox
        .getCharacteristic(Characteristic.RotationSpeed)
        .updateValue(homekitTopLevel);
      this.services.waterBox
        .getCharacteristic(Characteristic.On)
        .updateValue(homekitTopLevel > 0);
    }
  }

  async getPauseState() {
    await this.ensureDevice("getPauseState");

    try {
      const isPaused = this.device.property("state") === "paused";
      const canBePaused = this.isCleaning && !isPaused;
      this.log.info(
        `INF getPauseState | ${this.model} | Pause possible is ${canBePaused}`
      );
      return canBePaused;
    } catch (err) {
      this.log.error(
        `ERR getPauseState | ${this.model} | Failed getting the cleaning status.`,
        err
      );
      throw err;
    }
  }

  async setPauseState(state) {
    await this.ensureDevice("setPauseState");

    try {
      if (state && this.isPaused) {
        if (this.roomIdsToClean.size > 0) {
          await this.device.resumeCleanRooms(Array.from(this.roomIdsToClean));
          this.log.info(
            `INF setPauseState | Resume room cleaning, and the device is in state  ${this.device.property(
              "state"
            )}`
          );
        } else {
          await this.device.activateCleaning();
          this.log.info(
            `INF setPauseState | Resume normal cleaning, and the device is in state ${this.device.property(
              "state"
            )}`
          );
        }
      } else if (!state && this.isCleaning) {
        await this.device.pause();
        this.log.info(
          `INF setPauseState | Pause cleaning, and the device is in state ${this.device.property(
            "state"
          )}`
        );
      }
    } catch (err) {
      this.log.error(
        `ERR setPauseState | ${this.model} | Failed updating pause state ${state}.`,
        err
      );
    }
  }

  async getCharging() {
    const status = this.device.property("state");
    this.log.info(
      `INF getCharging | ${this.model} | Charging is ${
        status === "charging"
      } (Status is ${status})`
    );

    return status === "charging"
      ? Characteristic.ChargingState.CHARGING
      : Characteristic.ChargingState.NOT_CHARGING;
  }

  async getDocked() {
    const status = this.device.property("state");
    this.log.info(
      `INF getDocked | ${this.model} | Robot Docked is ${
        status === "charging"
      } (Status is ${status})`
    );

    return status === "charging";
  }

  async getBattery() {
    const batteryLevel = await this.device.batteryLevel();
    this.log.info(
      `INF getBattery | ${this.model} | Batterylevel is ${batteryLevel}%`
    );
    return batteryLevel;
  }

  async getBatteryLow() {
    const batteryLevel = await this.device.batteryLevel();
    this.log.info(
      `INF getBatteryLow | ${this.model} | Batterylevel is ${batteryLevel}%`
    );
    return batteryLevel < 20
      ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  async identify(callback) {
    await this.ensureDevice("identify");

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
    return Object.keys(this.services).reduce((services, key) => {
      let currentServices = [];

      if (key === "rooms") {
        currentServices = Object.values(this.services[key]);
      } else {
        currentServices = [this.services[key]];
      }

      if (key !== "fan" && this.services.fan.addLinkedService) {
        let fanService = this.services.fan;
        currentServices.forEach((currentService) => {
          fanService.addLinkedService(currentService);
        });
      }

      services = services.concat(currentServices);
      return services;
    }, []);
  }

  // CONSUMABLE / CARE
  async getCareSensors() {
    // 30h = sensor_dirty_time
    const lifetime = 108000;
    const sensorDirtyTime = this.device.property("sensorDirtyTime");
    const lifetimepercent = (sensorDirtyTime / lifetime) * 100;
    this.log.info(
      `INF getCareSensors | ${
        this.model
      } | Sensors dirtytime is ${sensorDirtyTime} seconds / ${lifetimepercent.toFixed(
        2
      )}%.`
    );
    return lifetimepercent;
  }

  async getCareFilter() {
    // 150h = filter_work_time
    const lifetime = 540000;
    const lifetimepercent =
      (this.device.property("filterWorkTime") / lifetime) * 100;
    this.log.info(
      `INF getCareFilter | ${
        this.model
      } | Filter worktime is ${this.device.property(
        "filterWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return lifetimepercent;
  }

  async getCareSideBrush() {
    // 200h = side_brush_work_time
    const lifetime = 720000;
    const lifetimepercent =
      (this.device.property("sideBrushWorkTime") / lifetime) * 100;
    this.log.info(
      `INF getCareSideBrush | ${
        this.model
      } | Sidebrush worktime is ${this.device.property(
        "sideBrushWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return lifetimepercent;
  }

  async getCareMainBrush() {
    // 300h = main_brush_work_time
    const lifetime = 1080000;
    const lifetimepercent =
      (this.device.property("mainBrushWorkTime") / lifetime) * 100;
    this.log.info(
      `INF getCareMainBrush | ${
        this.model
      } | Mainbrush worktime is ${this.device.property(
        "mainBrushWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return lifetimepercent;
  }
}
