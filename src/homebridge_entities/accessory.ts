"use strict";

import { catchError, concatMap, distinct, filter } from "rxjs";
import { AccessoryPlugin, API, Logging } from "homebridge";

import { getLogger, Logger } from "../utils/logger";
import { fromUiPlatformForm } from "../services/config_service";
import {
  applyConfigDefaults,
  DeviceManager,
  RoomsService,
  ProductInfo,
  BatteryInfo,
  MainService,
  WaterBoxService,
  DustCollection,
  PauseSwitch,
  FindMeService,
  GoToService,
  GoToDockService,
  DockService,
  MopDockService,
  WaterTankService,
  Config,
  ZonesService,
  CareService,
  DustBinService,
} from "../services";
import { errors } from "../utils/constants";
import { ErrorChangedEvent } from "../services/device_manager";
import { CoreContext } from "../services/types";

interface PluginServices {
  productInfo: ProductInfo;
  rooms: RoomsService;
  mainService: MainService;
  pause?: PauseSwitch;
  waterBox?: WaterBoxService;
  dustBin?: DustBinService;
  dustCollection?: DustCollection;
  battery: BatteryInfo;
  findMe: FindMeService;
  goTo?: GoToService;
  goToDock?: GoToDockService;
  dock?: DockService;
  mopDock?: MopDockService;
  waterTank?: WaterTankService;
  zones?: ZonesService;
  careServices?: CareService;
}

export class XiaomiRoborockVacuumAccessory implements AccessoryPlugin {
  private readonly log: Logger;
  private readonly config: Config;
  private readonly pluginServices: PluginServices;
  private readonly deviceManager: DeviceManager;
  /** Resolves once the rooms are known (immediately when not using `autoroom`) */
  public readonly roomsReady: Promise<void>;

  constructor(
    log: Logging | Logger,
    config: Partial<Config>,
    api: API,
    deviceManager?: DeviceManager
  ) {
    // Legacy "accessory" mode only: an `accessories` block edited with the Homebridge UI's platform form (#1248)
    const uiForm = deviceManager ? undefined : fromUiPlatformForm(config);
    if (uiForm) config = uiForm.config;

    this.log = getLogger(log, config);
    this.config = applyConfigDefaults(config);

    if (uiForm) {
      this.log.warn(
        `WARN init | This "accessories" block has a "devices" list, as the Homebridge UI saves the new platform format. ` +
          `Using its first device${uiForm.ignoredDevices > 0 ? ` (the other ${uiForm.ignoredDevices} are ignored)` : ""}. ` +
          `To fix it, edit config.json: move this block from "accessories" to "platforms", and rename ` +
          `"accessory": "XiaomiRoborockVacuum" to "platform": "XiaomiRoborockVacuum".`
      );
    }

    this.deviceManager =
      deviceManager || new DeviceManager(api.hap, this.log, config);

    if (!deviceManager) {
      // Legacy "accessory" mode (the platform always provides its DeviceManager)
      this.log.info(
        `INF init | Configured as an accessory. Consider moving this device to the "platforms" section ` +
          `(see the README): it's the only format supported by the Homebridge UI, and it adds rooms automatically.`
      );
    }

    this.deviceManager.errorChanged$
      .pipe(
        // `null` when the error is cleared: nothing to report
        filter((robotError) => robotError !== null),
        distinct((robotError) => robotError.id),
        // Catch each failure here: a `catchError` after `concatMap` would complete the stream, and no later error
        // would ever be reported
        concatMap(async (err) => {
          try {
            await this.changedError(err);
          } catch (error) {
            this.log.error(
              `Error processing the error reported by the robot`,
              error
            );
          }
        })
      )
      .subscribe();
    this.deviceManager.stateChanged$.subscribe(({ key, value }) => {
      this.log.debug(`stateChanged | stateChanged event: ${key}:${value}`);
    });

    // HOMEKIT SERVICES
    const coreContext: CoreContext = {
      hap: api.hap,
      log: this.log,
      config: this.config,
      deviceManager: this.deviceManager,
    };
    this.pluginServices = this.initializeServices(coreContext);

    // Run the init method of all the services, once they are all registered.
    let roomsReady: Promise<void> = Promise.resolve();
    Object.entries(this.pluginServices).forEach(([name, service]) => {
      const initialized = service?.init();
      if (name === "rooms" && initialized) roomsReady = initialized;
    });
    this.roomsReady = roomsReady.catch((err) =>
      this.log.error(`Failed to resolve the rooms`, err)
    );
  }

  /** The rooms resolved from the device (when using `autoroom`) */
  public get resolvedRooms() {
    return this.pluginServices.rooms.resolvedRooms;
  }

  /**
   * Initializes all the PluginServices based on the config.
   * @private
   */
  private initializeServices(coreContext: CoreContext): PluginServices {
    const { config } = this;

    const productInfo = new ProductInfo(coreContext);
    const rooms = new RoomsService(coreContext, async (clean) => {
      await this.pluginServices.mainService.setCleaning(clean);
    });
    const mainService = new MainService(
      coreContext,
      productInfo,
      rooms,
      async (mode) => {
        await this.pluginServices.waterBox?.setWaterSpeed(mode);
      },
      (isCleaning) => this.pluginServices.pause?.changedPause(isCleaning)
    );

    return {
      mainService,
      productInfo,
      rooms,
      battery: new BatteryInfo(coreContext),
      findMe: new FindMeService(coreContext),
      pause: config.pause ? new PauseSwitch(coreContext, rooms) : undefined,
      waterBox: config.waterBox
        ? new WaterBoxService(coreContext, productInfo, mainService)
        : undefined,
      dustBin: config.dustBin ? new DustBinService(coreContext) : undefined,
      dustCollection: config.dustCollection
        ? new DustCollection(coreContext)
        : undefined,
      goTo: config.goTo ? new GoToService(coreContext) : undefined,
      goToDock: config.goToDock ? new GoToDockService(coreContext) : undefined,
      dock: config.dock ? new DockService(coreContext) : undefined,
      mopDock:
        config.mopWash || config.mopDrying
          ? new MopDockService(coreContext)
          : undefined,
      waterTank: config.waterTankEmpty
        ? new WaterTankService(coreContext)
        : undefined,
      zones: config.zones
        ? new ZonesService(coreContext, mainService, (isCleaning) =>
            this.pluginServices.pause?.changedPause(isCleaning)
          )
        : undefined,
      // ADDITIONAL HOMEKIT SERVICES
      careServices: !config.disableCareServices
        ? new CareService(coreContext, mainService)
        : undefined,
    };
  }

  /**
   * Reacts to the error emitter from the robot and tries to translate the error code to a human-readable error
   * @param robotError The robot error that is thrown.
   * @private
   */
  private async changedError(robotError: NonNullable<ErrorChangedEvent>) {
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

    const { mainService, ...rest } = this.pluginServices;

    const firstService = mainService.services[0];

    return Object.values(rest).reduce(
      (acc, service) => {
        if (!service) return acc;
        service.services.forEach((srv) => {
          // Explicitly declare all other services as non-primary
          if (srv.setPrimaryService) srv.setPrimaryService(false);

          // In case it helps, try to add all services as linked to the main one.
          if (firstService.addLinkedService) firstService.addLinkedService(srv);
        });

        return [...acc, ...service.services];
      },
      [firstService] // Make sure to return the main service first
    );
  }
}
