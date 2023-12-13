import type {
  DynamicPlatformPlugin,
  API,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from "homebridge";
import { type Config, applyConfigDefaults } from "../services";
import { ACCESSORY_NAME, PLUGIN_NAME } from "../constants";
import { XiaomiRoborockVacuumPlatformAccessoryInitializer } from "./platform_accessory";
import { first } from "rxjs";

interface XiaomiRoborockVacuumPlatformConfig extends PlatformConfig {
  devices: Partial<Config>[];
}

interface PlatformAccessoryContext {
  name: string;
}

export type XiaomiRoborockVacuumPlatformAccessory =
  PlatformAccessory<PlatformAccessoryContext>;

export class XiaomiRoborockVacuumPlatform implements DynamicPlatformPlugin {
  private readonly config: XiaomiRoborockVacuumPlatformConfig;
  // List of the cached accessories
  private readonly accessories =
    new Set<XiaomiRoborockVacuumPlatformAccessory>();

  constructor(
    private readonly log: Logging,
    config: PlatformConfig,
    private readonly api: API
  ) {
    this.config = {
      devices: [], // Make sure it exists
      ...config,
    };

    // This event indicates all cached accessories have been loaded
    this.api.on("didFinishLaunching", () => {
      // 1. Unregister all the accessories that have been removed from the config
      this.unregisterRemovedAccessories();
      // 2. Initialize the connections and new accessories
      this.initializeDevices();
    });
  }

  /**
   * Required by Homebridge - Called for each cached accessory.
   * @param accessory
   */
  public configureAccessory(
    accessory: XiaomiRoborockVacuumPlatformAccessory
  ): void {
    this.accessories.add(accessory);
  }

  /**
   * Removes all cached accessories that no longer exist in the configuration
   */
  private unregisterRemovedAccessories() {
    const accessoriesToDelete = [...this.accessories].filter(
      (accessory) =>
        !this.config.devices.find(({ name }) => name === accessory.context.name)
    );

    if (accessoriesToDelete.length > 0) {
      const names = accessoriesToDelete.map((accessory) => {
        this.accessories.delete(accessory);
        return accessory.context.name;
      });
      this.log.info(`Unregistering the devices [${names.join(", ")}]`);
      this.api.unregisterPlatformAccessories(
        PLUGIN_NAME,
        ACCESSORY_NAME,
        accessoriesToDelete
      );
    }
  }

  /**
   * Initializes the connections of all the devices
   * and appends new accessories if not previously cached.
   */
  private initializeDevices() {
    this.config.devices.forEach((config) => {
      let isCached = true;
      const uuid = this.api.hap.uuid.generate(
        `${PLUGIN_NAME}-accessory-${config.name}`
      );
      let accessory = [...this.accessories].find(({ UUID }) => UUID === uuid);

      if (!accessory) {
        isCached = false;
        const name = applyConfigDefaults(config).name;
        accessory = new this.api.platformAccessory(name, uuid);
        accessory.context.name = name;
        this.accessories.add(accessory);
      }

      const platformInitializer =
        new XiaomiRoborockVacuumPlatformAccessoryInitializer(
          this.log,
          config,
          this.api,
          accessory
        );

      // Finally, register the accessory if not cached
      if (!isCached) {
        platformInitializer.initialized$.pipe(first()).subscribe(() => {
          this.api.registerPlatformAccessories(PLUGIN_NAME, ACCESSORY_NAME, [
            accessory!,
          ]);
        });
      }
    });
  }
}
