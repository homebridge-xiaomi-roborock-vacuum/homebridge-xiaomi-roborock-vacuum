"use strict";

import { catchError, concatMap, distinct } from "rxjs";
import {
  AccessoryPlugin,
  API,
  HAP,
  Service as HomeBridgeService,
} from "homebridge";

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
  ZonesService,
  CareService,
} from "./services";
import { errors } from "./utils/constants";
import { ErrorChangedEvent } from "./services/device_manager";

let hap: HAP;

export default (api: API) => {
  hap = api.hap;
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
  careServices?: CareService;
}

class XiaomiRoborockVacuum implements AccessoryPlugin {
  private readonly log: Logger;
  private readonly config: Config;
  private readonly pluginServices: PluginServices;
  private readonly deviceManager: DeviceManager;

  constructor(log, config) {
    this.log = getLogger(log, config);
    this.config = applyConfigDefaults(config);

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

  private initialiseServices(): PluginServices {
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
      // ADDITIONAL HOMEKIT SERVICES
      careServices: !config.disableCareServices
        ? new CareService(hap, log, config, deviceManager, fan)
        : undefined,
    };
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
  public identify() {
    this.pluginServices.findMe
      .identify(true)
      .catch((err) => this.log.error("Failed to identify the device", err));
  }

  /**
   * HomeBridge calls this method during initialization to fetch all the services exposed by this Accessory.
   * @returns {Service[]} The list of services (Switches, Fans, Occupancy Detectors, ...) set up by this accessory.
   */
  public getServices() {
    this.log.debug(`DEB getServices`);

    const mainService = this.pluginServices.fan.services[0];

    return Object.entries(this.pluginServices).reduce(
      (acc, [serviceName, service]) => {
        if (serviceName !== "fan" && mainService.addLinkedService) {
          service.services.forEach((srv) => mainService.addLinkedService(srv));
        }
        return [...acc, ...service.services];
      },
      [] as HomeBridgeService[]
    );
  }
}
