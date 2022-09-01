import { Service } from "homebridge";
import { callbackify } from "../utils/callbackify";
import { CoreContext } from "./types";
import { MainService } from "./main_service";
import { PluginServiceClass } from "./plugin_service_class";

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

export class ZonesService extends PluginServiceClass {
  private readonly zones: Record<string, Service> = {};

  constructor(
    coreContext: CoreContext,
    private readonly mainService: MainService,
    private readonly changedPause: (isCleaning: boolean) => void
  ) {
    super(coreContext);
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
      .on("get", (cb) => callbackify(() => this.mainService.getCleaning(), cb))
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
    return null;
  }
}
