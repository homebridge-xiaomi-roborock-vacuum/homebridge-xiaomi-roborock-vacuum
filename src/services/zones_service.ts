import { Service } from "homebridge";
import { filter } from "rxjs";
import { CoreContext } from "./types";
import { MainService } from "./main_service";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";
import { supports } from "../utils/supports";

interface ZoneDefinition {
  name: string;
  // Coordinates (Bottom-Left X, Bottom-Left Y, Top-Right X, Top-Right Y, # Repeats)
  zone:
    | [number, number, number, number][]
    | [number, number, number, number, number][];
  /** Fan speed to set before cleaning the zone (a name of the model's speeds, e.g. "Quiet" or "Mop") */
  speed?: string;
  /** Water level to set before cleaning the zone (a name of the model's water levels, e.g. "Off" or "High") */
  waterSpeed?: string;
}

export interface ZonesConfig {
  zones?: ZoneDefinition[];
}

export class ZonesService extends PluginServiceClass {
  private readonly zones: Record<string, Service> = {};

  constructor(
    coreContext: CoreContext,
    private readonly mainService: MainService,
    private readonly changedPause: (isCleaning: boolean) => void,
    private readonly setWaterSpeed?: (mode: string) => Promise<void>
  ) {
    super(coreContext);
    if (this.config.zones) {
      for (const zone of this.config.zones) {
        this.createZone(zone);
      }
    }
  }

  public async init() {
    this.deviceManager.stateChanged$
      .pipe(filter(({ key }) => key === "cleaning"))
      .subscribe(({ value }) => {
        const isCleaning = value === true;
        if (!isCleaning) {
          this.services.forEach((zone) => {
            zone
              .getCharacteristic(this.hap.Characteristic.On)
              .updateValue(false);
          });
        }
      });
  }

  public get services(): Service[] {
    return [...Object.values(this.zones)];
  }

  private createZone(definition: ZoneDefinition) {
    const { name: zoneName, zone: zoneParams } = definition;
    this.log.info(`createRoom | Zone ${zoneName} (${zoneParams})`);
    const name = `${this.config.cleanword} ${zoneName}`;
    this.zones[zoneName] = new this.hap.Service.Switch(
      name,
      "zoneCleaning" + zoneName
    );
    ensureName(this.hap, this.zones[zoneName], name);
    this.zones[zoneName]
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => this.mainService.getCleaning())
      .onSet((newState) => this.setCleaningZone(newState, definition))
      .on("change", ({ newValue }) => {
        this.changedPause(newValue === true);
      });
  }

  private async setCleaningZone(state, definition: ZoneDefinition) {
    const { zone } = definition;
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
        const { device } = this.deviceManager;
        if (!supports(device, "cleanZones")) {
          this.log.warn(
            `setCleaningZone | ${this.deviceManager.model} doesn't support zone cleaning.`
          );
          return;
        }
        await this.applyModes(definition);
        await device.cleanZones(zoneParams);
      } else if (!state) {
        // Stop cleaning
        this.log.info(`ACT setCleaning | Stop cleaning and go to charge.`);
        await this.deviceManager.device.activateCharging();
      }
    } catch (err) {
      this.log.error(`setCleaning | Failed to set cleaning to ${state}`, err);
      throw err;
    }
  }

  /**
   * Sets the zone's fan speed and water level (when configured) before starting the cleaning.
   * The robot keeps them afterwards, as when they're changed from HomeKit.
   */
  private async applyModes({ name, speed, waterSpeed }: ZoneDefinition) {
    if (speed) {
      if (speed === "Off") {
        // "Off" (-1) is HomeKit's 0%, which stops the cleaning instead of changing the fan speed
        this.log.warn(
          `setCleaningZone | Zone ${name}: "Off" is not a fan speed. Use "Mop" for mop-only cleaning, on the models that support it.`
        );
      } else {
        this.log.info(`setCleaningZone | Zone ${name}: fan speed "${speed}".`);
        await this.mainService.setSpeed(speed);
      }
    }
    if (waterSpeed) {
      if (!this.setWaterSpeed) {
        this.log.warn(
          `setCleaningZone | Zone ${name}: enable "waterBox" to set its water level ("${waterSpeed}").`
        );
      } else {
        this.log.info(
          `setCleaningZone | Zone ${name}: water level "${waterSpeed}".`
        );
        await this.setWaterSpeed(waterSpeed);
      }
    }
  }
}
