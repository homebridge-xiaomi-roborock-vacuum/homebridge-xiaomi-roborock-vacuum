"use strict";

import util from "util";
import { catchError, concatMap, distinct } from "rxjs";
import { Service as HomeBridgeService } from "homebridge";
import { callbackify as callbackifyLib } from "./utils/callbackify";

import { getLogger, Logger } from "./utils/logger";
import {
  applyConfigDefaults,
  DeviceManager,
  RoomsService,
  ProductInfo,
  BatteryInfo,
  FanService,
  WaterBoxService,
  DustCollection,
  PauseSwitch,
  FindMeService,
  GoToService,
  DockService,
  Config,
  PluginService,
  ZonesService,
} from "./services";
import { errors } from "./utils/constants";
import { ErrorChangedEvent } from "./services/device_manager";

let homebrideAPI, hap, Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebrideAPI = homebridge;
  hap = homebridge.hap;

  return XiaomiRoborockVacuum;
};

interface PluginServices {
  productInfo: ProductInfo;
  rooms: RoomsService;
  fan: FanService;
  pause?: PauseSwitch;
  waterBox?: WaterBoxService;
  dustCollection?: DustCollection;
  battery: BatteryInfo;
  findMe: FindMeService;
  goTo?: GoToService;
  dock?: DockService;
  zones?: ZonesService;
}

class XiaomiRoborockVacuum {
  private readonly log: Logger;
  private readonly config: Config;
  private readonly pluginServices: PluginServices;
  /** @deprecated */
  private readonly legacyServices: Record<string, HomeBridgeService>;
  private readonly deviceManager: DeviceManager;

  constructor(log, config) {
    this.log = getLogger(log, config);
    this.config = applyConfigDefaults(config);

    this.legacyServices = {};

    this.deviceManager = new DeviceManager(hap, this.log, config);

    this.deviceManager.errorChanged$
      .pipe(
        distinct((robotError) => robotError.id),
        concatMap((err) => this.changedError(err)),
        catchError(async (err) =>
          this.log.error(
            `Error processing the error reported by the robot`,
            err
          )
        )
      )
      .subscribe();
    this.deviceManager.stateChanged$.subscribe(({ key, value }) => {
      this.log.debug(`stateChanged | stateChanged event: ${key}:${value}`);
    });

    // HOMEKIT SERVICES
    this.pluginServices = this.initialiseServices();

    // Run the init method of all the services, once they are all registered.
    Object.values(this.pluginServices).map((service) => service.init());
  }

  initialiseServices(): PluginServices {
    const { log, config, deviceManager } = this;

    const productInfo = new ProductInfo(hap, log, deviceManager);
    const rooms = new RoomsService(hap, log, config, deviceManager, (clean) =>
      this.pluginServices.fan.setCleaning(clean)
    );
    const fan = new FanService(
      hap,
      log,
      config,
      deviceManager,
      productInfo,
      rooms,
      async (mode) => {
        await this.pluginServices.waterBox?.setWaterSpeed(mode);
      },
      (isCleaning) => this.pluginServices.pause?.changedPause(isCleaning)
    );

    return {
      fan,
      productInfo,
      rooms,
      battery: new BatteryInfo(hap, log, config, deviceManager),
      findMe: new FindMeService(hap, log, config, deviceManager),
      pause: config.pause
        ? new PauseSwitch(hap, log, config, deviceManager, rooms)
        : undefined,
      waterBox: config.waterBox
        ? new WaterBoxService(hap, log, config, deviceManager, productInfo, fan)
        : undefined,
      dustCollection: config.dustCollection
        ? new DustCollection(hap, log, config, deviceManager)
        : undefined,
      goTo: config.goTo
        ? new GoToService(hap, log, config, deviceManager)
        : undefined,
      dock: config.dock
        ? new DockService(hap, log, config, deviceManager)
        : undefined,
      zones: config.zones
        ? new ZonesService(hap, log, config, deviceManager, fan, (isCleaning) =>
            this.pluginServices.pause?.changedPause(isCleaning)
          )
        : undefined,
    };

    // ADDITIONAL HOMEKIT SERVICES
    if (!this.config.disableCareServices) {
      this.initialiseCareServices();
    }
  }

  initialiseCareServices() {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify = (fn, cb) =>
      this.deviceManager.device
        ? callbackifyLib(fn, cb)
        : cb(new Error("Not connected yet"));

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
   * Reacts to the error emitter from the robot and tries to translate the error code to a human-readable error
   * @param robotError The robot error that is thrown.
   * @private
   */
  private async changedError(robotError: ErrorChangedEvent) {
    if (!robotError) return;
    this.log.debug(
      `DEB changedError | ErrorID: ${robotError.id}, ErrorDescription: ${robotError.description}`
    );
    let robotErrorTxt = errors[`id${robotError.id}`]
      ? errors[`id${robotError.id}`].description
      : `Unknown ERR | error id can't be mapped. (${robotError.id})`;
    if (!`${robotError.description}`.toLowerCase().startsWith("unknown")) {
      robotErrorTxt = robotError.description;
    }
    this.log.warn(
      `WAR changedError | Robot has an ERROR - ${robotError.id}, ${robotErrorTxt}`
    );
    // Clear the error_code property
    await this.deviceManager.device.setRawProperty("error_code", 0);
  }

  /**
   * HomeBridge requires this method for the "identify" calls
   * when setting up the accessory in the Home app.
   * @param callback The "done" callback.
   */
  public identify(callback) {
    this.pluginServices.findMe.identify(true).then(
      () => callback(),
      (err) => callback(err)
    );
  }

  /**
   * HomeBridge calls this method during initialization to fetch all the services exposed by this Accessory.
   * @returns {Service[]} The list of services (Switches, Fans, Occupancy Detectors, ...) set up by this accessory.
   */
  public getServices() {
    this.log.debug(`DEB getServices`);

    const mainService = this.pluginServices.fan.services[0];

    const fromPluginServices = Object.entries(this.pluginServices).reduce(
      (acc, [serviceName, service]) => {
        if (serviceName !== "fan" && mainService.addLinkedService) {
          service.services.forEach((srv) => mainService.addLinkedService(srv));
        }
        return [...acc, ...service.services];
      },
      [] as HomeBridgeService[]
    );

    return Object.keys(this.legacyServices).reduce((services, key) => {
      let currentServices = [] as HomeBridgeService[];

      if (key === "rooms") {
        currentServices = Object.values(this.legacyServices[key]);
      } else {
        currentServices = [this.legacyServices[key]];
      }

      if (key !== "fan" && mainService.addLinkedService) {
        currentServices.forEach((currentService) =>
          mainService.addLinkedService(currentService)
        );
      }

      services = services.concat(currentServices);
      return services;
    }, fromPluginServices);
  }

  // CONSUMABLE / CARE
  async getCareSensors() {
    // 30h = sensor_dirty_time
    const lifetime = 108000;
    const sensorDirtyTime =
      this.deviceManager.property<number>("sensorDirtyTime")!;
    const lifetimePercent = (sensorDirtyTime / lifetime) * 100;
    this.log.info(
      `getCareSensors | Sensors dirtyTime is ${sensorDirtyTime} seconds / ${lifetimePercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimePercent);
  }

  async getCareFilter() {
    // 150h = filter_work_time
    const lifetime = 540000;
    const filterWorkTime =
      this.deviceManager.property<number>("filterWorkTime")!;
    const lifetimePercent = (filterWorkTime / lifetime) * 100;
    this.log.info(
      `getCareFilter | Filter workTime is ${filterWorkTime} seconds / ${lifetimePercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimePercent);
  }

  async getCareSideBrush() {
    // 200h = side_brush_work_time
    const lifetime = 720000;
    const sideBrushWorkTime =
      this.deviceManager.property<number>("sideBrushWorkTime")!;
    const lifetimePercent = (sideBrushWorkTime / lifetime) * 100;
    this.log.info(
      `getCareSideBrush | SideBrush workTime is ${sideBrushWorkTime} seconds / ${lifetimePercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimePercent);
  }

  async getCareMainBrush() {
    // 300h = main_brush_work_time
    const lifetime = 1080000;
    const mainBrushWorkTime =
      this.deviceManager.property<number>("mainBrushWorkTime")!;
    const lifetimepercent = (mainBrushWorkTime / lifetime) * 100;
    this.log.info(
      `getCareMainBrush | MainBrush workTime is ${mainBrushWorkTime} seconds / ${lifetimepercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimepercent);
  }
}
