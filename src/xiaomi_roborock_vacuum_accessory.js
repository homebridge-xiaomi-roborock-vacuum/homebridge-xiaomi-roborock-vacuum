"use strict";

const util = require("util");
const { callbackify: callbackifyLib } = require("./utils/callbackify");

const { getLogger } = require("./utils/logger");
const {
  applyConfigDefaults,
  DeviceManager,
  RoomsService,
  ProductInfo,
  BatteryInfo,
  FanService,
  WaterBoxService,
  DustCollection,
  PauseSwitch,
} = require("./services");
const { cleaningStatuses, errors } = require("./utils/constants");

let homebrideAPI, hap, Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebrideAPI = homebridge;
  hap = homebridge.hap;

  return XiaomiRoborockVacuum;
};

class XiaomiRoborockVacuum {
  static get cleaningStatuses() {
    return cleaningStatuses;
  }

  static get errors() {
    return errors;
  }

  constructor(log, config) {
    this.log = getLogger(log, config);
    this.config = applyConfigDefaults(config);

    this.pluginServices = {};
    this.legacyServices = {};

    // Used to store the latest state to reduce logging
    this.cachedState = new Map();

    this.roomIdsToClean = new Set();

    this.deviceManager = new DeviceManager(hap, this.log, config);

    this.deviceManager.errorChanged$.subscribe((err) => this.changedError(err));
    this.deviceManager.stateChanged$.subscribe(({ key, value }) => {
      this.log.debug(`stateChanged | stateChanged event: ${key}:${value}`);
      if (key === "cleaning") {
        this.changedPause(value);
      } else if (key === "charging") {
        this.changedCharging(value);
      }
    });

    // HOMEKIT SERVICES
    this.initialiseServices();
  }

  initialiseServices() {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify = (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.pluginServices.productInfo = new ProductInfo(
      hap,
      this.log,
      this.deviceManager
    );

    this.pluginServices.rooms = new RoomsService(
      hap,
      this.log,
      this.config,
      this.deviceManager,
      (clean) => this.setCleaning(clean)
    );

    if (this.config.pause) {
      this.pluginServices.pause = new PauseSwitch(
        hap,
        this.log,
        this.config,
        this.deviceManager,
        this.pluginServices.rooms
      );
    }

    this.pluginServices.fan = new FanService(
      hap,
      this.log,
      this.config,
      this.deviceManager,
      this.cachedState,
      this.pluginServices.productInfo,
      this.pluginServices.rooms,
      (mode) => this.pluginServices.waterBox?.setWaterSpeed(mode),
      (isCleaning) => this.pluginServices.pause?.changedPause(isCleaning)
    );

    if (this.config.waterBox) {
      this.pluginServices.waterBox = new WaterBoxService(
        hap,
        this.log,
        this.config,
        this.deviceManager,
        this.cachedState,
        this.pluginServices.productInfo,
        this.pluginServices.fan
      );
    }

    if (this.config.dustCollection) {
      this.pluginServices.dustCollection = new DustCollection(
        hap,
        this.log,
        this.config,
        this.deviceManager
      );
    }

    this.pluginServices.battery = new BatteryInfo(
      hap,
      this.log,
      this.config,
      this.deviceManager
    );

    if (this.config.findMe) {
      this.legacyServices.findMe = new Service.Switch(
        `${this.config.name} ${this.config.findMeWord}`,
        "FindMe Switch"
      );
      this.legacyServices.findMe
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) => callbackify(() => false, cb))
        .on("set", (newState, cb) => this.identify(cb));
    }

    if (this.config.goTo) {
      this.legacyServices.goTo = new Service.Switch(
        `${this.config.name} ${this.config.goToWord}`,
        "GoTo Switch"
      );
      this.legacyServices.goTo
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) => callbackify(() => this.getGoToState(), cb))
        .on("set", (newState, cb) => this.goTo(cb));
    }

    if (this.config.dock) {
      this.legacyServices.dock = new Service.OccupancySensor(
        `${this.config.name} Dock`
      );
      this.legacyServices.dock
        .getCharacteristic(Characteristic.OccupancyDetected)
        .on("get", (cb) => callbackify(() => this.getDocked(), cb));
    }

    if (this.config.zones) {
      for (var i in this.config.zones) {
        this.createZone(this.config.zones[i].name, this.config.zones[i].zone);
      }
    }

    // ADDITIONAL HOMEKIT SERVICES
    if (!this.config.disableCareServices) {
      this.initialiseCareServices();
    }

    // Run the init method of all the services, once they are all registered.
    Object.values(this.pluginServices).map((service) => service.init());
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

      this.legacyServices.Care = new Service.Care(`${this.config.name} Care`);
      this.legacyServices.Care.getCharacteristic(Characteristic.CareSensors).on(
        "get",
        (cb) => callbackify(() => this.getCareSensors(), cb)
      );
      this.legacyServices.Care.getCharacteristic(Characteristic.CareFilter).on(
        "get",
        (cb) => callbackify(() => this.getCareFilter(), cb)
      );
      this.legacyServices.Care.getCharacteristic(
        Characteristic.CareSideBrush
      ).on("get", (cb) => callbackify(() => this.getCareSideBrush(), cb));
      this.legacyServices.Care.getCharacteristic(
        Characteristic.CareMainBrush
      ).on("get", (cb) => callbackify(() => this.getCareMainBrush(), cb));
    } else {
      this.legacyServices.fan
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
      this.legacyServices.fan
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
      this.legacyServices.CareSensors = new Service.FilterMaintenance(
        "Care indicator sensors",
        "sensors"
      );
      this.legacyServices.CareSensors.getCharacteristic(
        Characteristic.FilterChangeIndication
      ).on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareSensors()) >= 100;
        }, cb)
      );
      this.legacyServices.CareSensors.getCharacteristic(
        Characteristic.FilterLifeLevel
      ).on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareSensors()), cb)
      );

      this.legacyServices.CareFilter = new Service.FilterMaintenance(
        "Care indicator filter",
        "filter"
      );
      this.legacyServices.CareFilter.getCharacteristic(
        Characteristic.FilterChangeIndication
      ).on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareFilter()) >= 100;
        }, cb)
      );
      this.legacyServices.CareFilter.getCharacteristic(
        Characteristic.FilterLifeLevel
      ).on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareFilter()), cb)
      );

      this.legacyServices.CareSideBrush = new Service.FilterMaintenance(
        "Care indicator side brush",
        "side brush"
      );
      this.legacyServices.CareSideBrush.getCharacteristic(
        Characteristic.FilterChangeIndication
      ).on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareSideBrush()) >= 100;
        }, cb)
      );
      this.legacyServices.CareSideBrush.getCharacteristic(
        Characteristic.FilterLifeLevel
      ).on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareSideBrush()), cb)
      );

      this.legacyServices.CareMainBrush = new Service.FilterMaintenance(
        "Care indicator main brush",
        "main brush"
      );
      this.legacyServices.CareMainBrush.getCharacteristic(
        Characteristic.FilterChangeIndication
      ).on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareMainBrush()) >= 100;
        }, cb)
      );
      this.legacyServices.CareMainBrush.getCharacteristic(
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
      `DEB changedError | ErrorID: ${robotError.id}, ErrorDescription: ${robotError.description}`
    );
    let robotErrorTxt = XiaomiRoborockVacuum.errors[`id${robotError.id}`]
      ? XiaomiRoborockVacuum.errors[`id${robotError.id}`].description
      : `Unknown ERR | errorid can't be mapped. (${robotError.id})`;
    if (!`${robotError.description}`.toLowerCase().startsWith("unknown")) {
      robotErrorTxt = robotError.description;
    }
    this.log.warn(
      `WAR changedError | Robot has an ERROR - ${robotError.id}, ${robotErrorTxt}`
    );
    // Clear the error_code property
    this.device.setRawProperty("error_code", 0);
  }

  async ensureDevice(callingMethod) {
    return this.deviceManager.ensureDevice(callingMethod);
  }

  changedCharging(isCharging) {
    const isNewValue = this.isNewValue("charging", isCharging);
    if (this.config.dock) {
      if (isNewValue) {
        const msg = isCharging
          ? "Robot was docked"
          : "Robot not anymore in dock";
        this.log.info(`changedCharging | ${msg}.`);
      }
      this.legacyServices.dock
        .getCharacteristic(Characteristic.OccupancyDetected)
        .updateValue(isCharging);
    }
  }

  async getCleaning() {
    return this.pluginServices.fan.getCleaning();
  }

  async setCleaning(state) {
    return this.pluginServices.fan.setCleaning(state);
  }

  async setCleaningZone(state, zone) {
    await this.ensureDevice("setCleaning");

    try {
      if (state && !this.isCleaning) {
        // Start cleaning
        this.log.info(
          `ACT setCleaning | Start cleaning Zone ${zone}, not charging.`
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
        this.log.info(`ACT setCleaning | Stop cleaning and go to charge.`);
        await this.device.activateCharging();
      }
    } catch (err) {
      this.log.error(`setCleaning | Failed to set cleaning to ${state}`, err);
      throw err;
    }
  }

  createZone(zoneName, zoneParams) {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify = (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.log.info(`createRoom | Zone ${zoneName} (${zoneParams})`);
    this.legacyServices[zoneName] = new Service.Switch(
      `${this.config.cleanword} ${zoneName}`,
      "zoneCleaning" + zoneName
    );
    this.legacyServices[zoneName]
      .getCharacteristic(Characteristic.On)
      .on("get", (cb) => callbackify(() => this.getCleaning(), cb))
      .on("set", (newState, cb) =>
        callbackify(() => this.setCleaningZone(newState, zoneParams), cb)
      )
      .on("change", (oldState, newState) => {
        this.changedPause(newState);
      });
  }

  async getDocked() {
    const status = this.device.property("state");
    this.log.info(
      `getDocked | Robot Docked is ${
        status === "charging"
      } (Status is ${status})`
    );

    return status === "charging";
  }

  async identify(callback) {
    await this.ensureDevice("identify");

    this.log.info(`ACT identify | Find me - Hello!`);
    try {
      await this.deviceManager.device.find();
      callback();
    } catch (err) {
      this.log.error(`identify | `, err);
      callback(err);
    }
  }

  async goTo(callback) {
    await this.ensureDevice("goTo");

    this.log.info(`ACT goTo | Let's go!`);
    try {
      await this.device.sendToLocation(this.config.goToX, this.config.goToY);
      callback();
    } catch (err) {
      this.log.error(`goTo | `, err);
      callback(err);
    }
  }

  async getGoToState() {
    await this.ensureDevice("goTo");

    try {
      const goingToLocation =
        this.device.property("state") === "going-to-location";
      this.log.info(`getGoToState | Going to location is ${goingToLocation}`);
      return goingToLocation;
    } catch (err) {
      this.log.error(`getGoToState | Failed getting the cleaning status.`, err);
      throw err;
    }
  }

  getServices() {
    this.log.debug(`DEB getServices`);

    const fromPluginServices = Object.values(this.pluginServices).reduce(
      (acc, service) => [...acc, ...service.services],
      []
    );

    return Object.keys(this.legacyServices).reduce((services, key) => {
      let currentServices = [];

      if (key === "rooms") {
        currentServices = Object.values(this.legacyServices[key]);
      } else {
        currentServices = [this.legacyServices[key]];
      }

      if (key !== "fan" && this.legacyServices.fan.addLinkedService) {
        let fanService = this.legacyServices.fan;
        currentServices.forEach((currentService) => {
          fanService.addLinkedService(currentService);
        });
      }

      services = services.concat(currentServices);
      return services;
    }, fromPluginServices);
  }

  // CONSUMABLE / CARE
  async getCareSensors() {
    // 30h = sensor_dirty_time
    const lifetime = 108000;
    const sensorDirtyTime = this.device.property("sensorDirtyTime");
    const lifetimepercent = (sensorDirtyTime / lifetime) * 100;
    this.log.info(
      `getCareSensors | ${
        this.model
      } | Sensors dirtytime is ${sensorDirtyTime} seconds / ${lifetimepercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimepercent);
  }

  async getCareFilter() {
    // 150h = filter_work_time
    const lifetime = 540000;
    const lifetimepercent =
      (this.device.property("filterWorkTime") / lifetime) * 100;
    this.log.info(
      `getCareFilter | ${
        this.model
      } | Filter worktime is ${this.device.property(
        "filterWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return Math.min(100, lifetimepercent);
  }

  async getCareSideBrush() {
    // 200h = side_brush_work_time
    const lifetime = 720000;
    const lifetimepercent =
      (this.device.property("sideBrushWorkTime") / lifetime) * 100;
    this.log.info(
      `getCareSideBrush | ${
        this.model
      } | Sidebrush worktime is ${this.device.property(
        "sideBrushWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return Math.min(100, lifetimepercent);
  }

  async getCareMainBrush() {
    // 300h = main_brush_work_time
    const lifetime = 1080000;
    const lifetimepercent =
      (this.device.property("mainBrushWorkTime") / lifetime) * 100;
    this.log.info(
      `getCareMainBrush | ${
        this.model
      } | Mainbrush worktime is ${this.device.property(
        "mainBrushWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return Math.min(100, lifetimepercent);
  }
}
