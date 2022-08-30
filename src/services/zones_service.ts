import { HAP, Service } from "homebridge";
import {
  callbackify as callbackifyLib,
  callbackify,
} from "../utils/callbackify";
import { Logger } from "../utils/logger";
import type { DeviceManager } from "./device_manager";
import { PluginService } from "./types";
import { cleaningStatuses } from "../utils/constants";
import { Config } from "./config_service";
import { FanService } from "./fan_service";

interface ZoneDefinition {
  name: string;
  // Coordinates (Bottom-Left X, Bottom-Left Y, Top-Right X, Top-Right Y, # Repeats)
  zone:
    | [number, number, number, number][]
    | [number, number, number, number, number][];
}

export interface ZonesConfig {
  zones?: ZoneDefinition[];
}

export class ZonesService implements PluginService {
  public readonly roomIdsToClean = new Set<string>();
  private readonly zones: Record<string, Service> = {};

  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly config: Config,
    private readonly deviceManager: DeviceManager,
    private readonly fan: FanService,
    private readonly changedPause: (isCleaning: boolean) => void
  ) {
    if (this.config.zones) {
      for (const { name, zone } of this.config.zones) {
        // Index will be overwritten, when robot is available
        this.createZone(name, zone);
      }
    }
  }

  public async init() {}

  public get services(): Service[] {
    return [...Object.values(this.zones)];
  }

  private createZone(zoneName: string, zoneParams: ZoneDefinition["zone"]) {
    this.log.info(`createRoom | Zone ${zoneName} (${zoneParams})`);
    this.zones[zoneName] = new this.hap.Service.Switch(
      `${this.config.cleanword} ${zoneName}`,
      "zoneCleaning" + zoneName
    );
    this.zones[zoneName]
      .getCharacteristic(this.hap.Characteristic.On)
      .on("get", (cb) => callbackify(() => this.fan.getCleaning(), cb))
      .on("set", (newState, cb) =>
        callbackify(() => this.setCleaningZone(newState, zoneParams), cb)
      )
      .on("change", ({ newValue }) => {
        this.changedPause(newValue === true);
      });
  }

  private async setCleaningZone(state, zone: ZoneDefinition["zone"]) {
    await this.deviceManager.ensureDevice("setCleaningZone");

    try {
      if (state && !this.deviceManager.isCleaning) {
        // Start cleaning
        this.log.info(
          `ACT setCleaning | Start cleaning Zone ${zone}, not charging.`
        );

        const zoneParams: number[][] = [];
        for (const zon of zone) {
          if (zon.length === 4) {
            zoneParams.push(zon.concat(1));
          } else if (zon.length === 5) {
            zoneParams.push(zon);
          }
        }
        await this.deviceManager.device.cleanZones(zoneParams);
      } else if (!state) {
        // Stop cleaning
        this.log.info(`ACT setCleaning | Stop cleaning and go to charge.`);
        await this.deviceManager.device.activateCharging();
      }
    } catch (err) {
      this.log.error(`setCleaning | Failed to set cleaning to ${state}`, err);
      throw err;
    }
    return state;
  }
}
