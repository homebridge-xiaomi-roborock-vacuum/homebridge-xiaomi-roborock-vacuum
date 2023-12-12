import type { Logging, API, Service } from "homebridge";
import { first } from "rxjs";
import { PLUGIN_NAME, ACCESSORY_NAME } from "./constants";
import { type Config, DeviceManager } from "./services";
import { findSpeedModes } from "./utils/find_speed_modes";
import { type Logger, getLogger } from "./utils/logger";
import { XiaomiRoborockVacuum } from "./xiaomi_roborock_vacuum_accessory";
import type { XiaomiRoborockVacuumPlatformAccessory } from "./xiaomi_roborock_vacuum_platform";

/**
 * Dynamic Device Accessory:
 *
 * It should:
 * 1. Connect first
 * 2. Figure out the model
 * 3. Reuse cached accessory or create a new one
 * 4. Assign the listeners and services to the accessory
 */
export class XiaomiRoborockVacuumPlatformAccessoryInitializer {
  private readonly log: Logger;

  constructor(
    log: Logging,
    config: Partial<Config>,
    api: API,
    private readonly accessory: XiaomiRoborockVacuumPlatformAccessory,
    isCached: boolean
  ) {
    this.log = getLogger(log, config);
    const deviceManager = new DeviceManager(api.hap, this.log, config);
    deviceManager.deviceConnected$.pipe(first()).subscribe(() => {
      // For now, let's simply reuse the accessory class to bootstrap the services.
      // In the future, we can move to smarter logic: calculate the rooms first, then create the services.
      const vacuumService = new XiaomiRoborockVacuum(
        this.log,
        this.applyDefaultsBasedOnModel(config, deviceManager.model),
        api,
        deviceManager
      );

      // Loop through the services in `vacuumService.getServices()`
      // and attach them to the accessory with
      // https://developers.homebridge.io/#/api/platform-plugins#platformaccessoryaddservice
      vacuumService.getServices().forEach((service) => {
        let svc: Service | undefined;

        if (service.subtype) {
          svc = this.accessory.getServiceById(
            service.getServiceId(),
            service.subtype
          );
        }

        if (!svc) {
          // Hack to cover those services that do not declare a subtype
          svc = this.accessory.services.find(
            (cachedSvc) =>
              cachedSvc.UUID === service.UUID &&
              cachedSvc.subtype === service.subtype
          );
        }

        if (svc) {
          // Cached service, we need to copy the listeners
          this.log.info("Copying services...");
          if (svc instanceof api.hap.Service.AccessoryInformation) {
            svc.replaceCharacteristicsFromService(service);
          } else {
            svc.characteristics = service.characteristics;
            svc.optionalCharacteristics = service.optionalCharacteristics;
            svc.setPrimaryService(service.isPrimaryService);
          }
        } else {
          // New service to add to the accessory
          this.log.info("Adding new service...");
          svc = this.accessory.addService(service);
        }
      });

      // Finally, register the accessory if not cached
      if (!isCached) {
        api.registerPlatformAccessories(PLUGIN_NAME, ACCESSORY_NAME, [
          this.accessory,
        ]);
      }
    });
  }

  private applyDefaultsBasedOnModel(
    config: Partial<Config>,
    model: string
  ): Partial<Config> {
    // At this point, we can apply any defaults depending on the model...
    return {
      // like enabling the waterbox mode if the model supports it
      waterBox: !!findSpeedModes(model).waterspeed,
      // or enabling auto-room if the model supports room mapping
      // autoroom: TODO,
      ...config,
    };
  }
}
