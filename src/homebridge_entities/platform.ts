import type {
  DynamicPlatformPlugin,
  API,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from "homebridge";
import {
  type Config,
  applyConfigDefaults,
  CloudService,
  RoborockService,
} from "../services/index.js";
import type { CloudConfig } from "../services/cloud_service.js";
import type { RoborockConfig } from "../services/roborock_service.js";
import { ACCESSORY_NAME, PLUGIN_NAME } from "../constants.js";
import { XiaomiRoborockVacuumPlatformAccessoryInitializer } from "./platform_accessory.js";
import { first } from "rxjs";
import { networkInterfaces } from "node:os";
import type { ResolvedRoom } from "../services/rooms_service.js";

interface XiaomiRoborockVacuumPlatformConfig extends PlatformConfig {
  devices: Partial<Config>[];
  /** The Xiaomi Cloud, to know which room the robot is cleaning (opt-in) */
  cloud?: CloudConfig;
  /** A Roborock app account, for the robots paired with the Roborock app (opt-in) */
  roborock?: RoborockConfig;
}

interface PlatformAccessoryContext {
  /** The vacuum's name (for a room switch's accessory too: it's removed with its vacuum) */
  name: string;
  /** A room switch's accessory: its switch's subtype (#467) */
  room?: string;
  /** Rooms resolved in a previous run (when using `autoroom`), used as a fallback */
  rooms?: ResolvedRoom[];
}

export type XiaomiRoborockVacuumPlatformAccessory =
  PlatformAccessory<PlatformAccessoryContext>;

/** The accessories of a vacuum's room switches: one per switch, so each one can be put in its room (#467) */
export interface RoomAccessories {
  /**
   * @param room The switch's subtype
   * @param name The switch's name
   * @returns Its accessory: the cached one, or a new one
   */
  accessoryFor(
    room: string,
    name: string
  ): XiaomiRoborockVacuumPlatformAccessory;
  /** Registers the new accessories, and removes the cached ones that aren't used anymore (e.g. a removed room) */
  commit(used: XiaomiRoborockVacuumPlatformAccessory[]): void;
}

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
      // 2. Warn about the bridge settings that break the Matter robot vacuum
      this.checkMatterSetup();
      // 3. Initialize the connections and new accessories
      this.initializeDevices();
    });
  }

  /**
   * Required by Homebridge - Called for each cached accessory.
   * @param accessory
   */
  public configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.add(accessory as XiaomiRoborockVacuumPlatformAccessory);
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
   * Warns about the bridge settings that get in the way of the Matter robot vacuum (`serviceType: "vacuum"`).
   */
  private checkMatterSetup() {
    if (
      !this.config.devices.some(
        ({ serviceType }) => serviceType === "vacuum"
      ) ||
      !this.api.isMatterEnabled?.()
    ) {
      // Without Matter, each vacuum warns that it falls back to "fan"
      return;
    }
    if (!hasIPv6()) {
      this.log.warn(
        "Matter needs IPv6, and this host has none: the Matter robot vacuum won't show up in the Home app. " +
          "Enable IPv6 on the host (e.g. remove `ipv6.disable=1` from the Raspberry Pi's /boot/firmware/cmdline.txt)."
      );
    }
    // The vacuums are external Matter accessories, paired on their own: the bridge's Matter node only shows up in
    // the Home app as an empty "Not Supported" accessory. `externalsOnly` (Homebridge 2.5+) stops publishing it.
    if (
      typeof this.api.isMatterExternalsOnly === "function" &&
      !this.api.isMatterExternalsOnly()
    ) {
      this.log.warn(
        "The Matter robot vacuums are paired on their own (with their own code), so this bridge's Matter bridge is " +
          'empty and shows up in the Home app as a "Not Supported" accessory. If this bridge only runs this plugin, ' +
          'set `"externalsOnly": true` in its Matter settings (`"_bridge": { "matter": { "externalsOnly": true } }`), ' +
          "and remove that accessory from the Home app if you added it."
      );
    }
  }

  /**
   * Initializes the connections of all the devices
   * and appends new accessories if not previously cached.
   */
  private initializeDevices() {
    const cloud = this.config.cloud?.enabled
      ? new CloudService(this.log, this.config.cloud)
      : undefined;
    const roborock = this.config.roborock?.enabled
      ? new RoborockService(this.log, this.config.roborock)
      : undefined;
    this.config.devices.forEach((config) => {
      if (config.duid) {
        if (!roborock) {
          this.log.error(
            `The vacuum "${config.name}" has a \`duid\` (Roborock app): enable the platform's \`roborock\` option.`
          );
          return;
        }
        this.initializeDevice(config, cloud, roborock);
        return;
      }
      // Configured with its `did`, or without a token: its IP and token are in the Xiaomi account
      if (!cloud || !(config.did || (config.ip && !config.token))) {
        this.initializeDevice(config, cloud);
        return;
      }
      cloud
        .locate({ did: config.did, ip: config.ip })
        .then((found) =>
          this.initializeDevice(found ? { ...config, ...found } : config, cloud)
        )
        .catch((error: Error) =>
          this.log.error(
            `Failed to initialize the vacuum "${config.name}": ${error.message}`
          )
        );
    });
  }

  /**
   * @param vacuum The vacuum's name
   * @returns The accessories of its room switches
   */
  private roomAccessories(vacuum: string): RoomAccessories {
    const created = new Set<XiaomiRoborockVacuumPlatformAccessory>();
    return {
      accessoryFor: (room, name) => {
        const uuid = this.api.hap.uuid.generate(
          `${PLUGIN_NAME}-accessory-${vacuum}-${room}`
        );
        let accessory = [...this.accessories].find(({ UUID }) => UUID === uuid);
        if (!accessory) {
          accessory = new this.api.platformAccessory(name, uuid);
          accessory.context.name = vacuum;
          accessory.context.room = room;
          this.accessories.add(accessory);
          created.add(accessory);
        }
        return accessory;
      },
      commit: (used) => {
        const toRegister = used.filter((accessory) => created.has(accessory));
        if (toRegister.length > 0) {
          this.api.registerPlatformAccessories(
            PLUGIN_NAME,
            ACCESSORY_NAME,
            toRegister
          );
        }
        created.clear();
        const stale = [...this.accessories].filter(
          (accessory) =>
            accessory.context.name === vacuum &&
            accessory.context.room !== undefined &&
            !used.includes(accessory)
        );
        if (stale.length > 0) {
          this.log.info(
            `Unregistering the room switches no longer exposed [${stale.map(({ displayName }) => displayName).join(", ")}]`
          );
          stale.forEach((accessory) => this.accessories.delete(accessory));
          this.api.unregisterPlatformAccessories(
            PLUGIN_NAME,
            ACCESSORY_NAME,
            stale
          );
        }
      },
    };
  }

  /**
   * Initializes the connection of a device, and registers its accessory if not previously cached.
   * @param config The device's config
   * @param cloud The Xiaomi Cloud, if enabled
   */
  private initializeDevice(
    config: Partial<Config>,
    cloud?: CloudService,
    roborock?: RoborockService
  ) {
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
        accessory,
        cloud,
        roborock,
        this.roomAccessories(accessory.context.name)
      );

    platformInitializer.initialized$.pipe(first()).subscribe((hasServices) => {
      if (hasServices && !isCached) {
        // Finally, register the accessory if not cached
        this.api.registerPlatformAccessories(PLUGIN_NAME, ACCESSORY_NAME, [
          accessory!,
        ]);
      } else if (!hasServices && isCached) {
        // `serviceType: "vacuum"` without extras: everything is in the Matter vacuum
        this.log.info(
          `Unregistering the HomeKit accessory of "${accessory!.context.name}": it's a Matter robot vacuum now`
        );
        this.accessories.delete(accessory!);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, ACCESSORY_NAME, [
          accessory!,
        ]);
      }
    });
  }
}

/**
 * Whether the host has an IPv6 address (Matter's mDNS binds on IPv6, so it can't start without one).
 */
function hasIPv6(): boolean {
  return Object.values(networkInterfaces()).some((addresses) =>
    addresses?.some(({ family }) => family === "IPv6")
  );
}
