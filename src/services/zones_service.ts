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
  /**
   * When above 0: turning zones on selects them, and they're cleaned together this many seconds after the last change
   * (like `roomTimeout`). 0: a zone is cleaned as soon as it's turned on.
   */
  zoneTimeout?: number;
}

export class ZonesService extends PluginServiceClass {
  private readonly zones: Record<string, Service> = {};
  /** The zones selected to be cleaned together, in order (with `zoneTimeout`) */
  private readonly selected = new Map<string, ZoneDefinition>();
  /** The zones being cleaned: only their switches are ON */
  private readonly active = new Set<string>();
  private zoneTimer?: NodeJS.Timeout;

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
        if (!isCleaning && this.active.size > 0) {
          this.active.clear();
          this.refreshSwitches();
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
      .onGet(() => this.isOn(zoneName))
      .onSet((newState) => this.setCleaningZone(newState, definition))
      .on("change", ({ newValue }) => {
        this.changedPause(newValue === true);
      });
  }

  private isOn(zoneName: string) {
    return this.active.has(zoneName) || this.selected.has(zoneName);
  }

  private refreshSwitches() {
    for (const [zoneName, zone] of Object.entries(this.zones)) {
      zone
        .getCharacteristic(this.hap.Characteristic.On)
        .updateValue(this.isOn(zoneName));
    }
  }

  private async setCleaningZone(state, definition: ZoneDefinition) {
    await this.deviceManager.ensureDevice("setCleaningZone");

    try {
      if (state && !this.deviceManager.isCleaning) {
        if ((this.config.zoneTimeout ?? 0) > 0) {
          // Select it, and clean the selected zones together once the timeout expires
          this.selected.delete(definition.name);
          this.selected.set(definition.name, definition);
          this.log.info(
            `ACT setCleaningZone | Zone ${definition.name} selected: cleaning ${[...this.selected.keys()].join(", ")} in ${this.config.zoneTimeout}s.`
          );
          this.restartZoneTimer();
        } else {
          await this.cleanZones([definition]);
        }
      } else if (!state && this.selected.has(definition.name)) {
        // Not started yet: unselect it
        this.selected.delete(definition.name);
        this.log.info(
          `ACT setCleaningZone | Zone ${definition.name} unselected.`
        );
        this.restartZoneTimer();
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

  private restartZoneTimer() {
    clearTimeout(this.zoneTimer);
    if (this.selected.size === 0) return;
    this.zoneTimer = setTimeout(() => {
      const definitions = [...this.selected.values()];
      this.selected.clear();
      this.cleanZones(definitions).catch((err) => {
        this.log.error(`setCleaningZone | Failed to clean the zones`, err);
        this.refreshSwitches();
      });
    }, this.config.zoneTimeout! * 1000);
  }

  /**
   * Cleans the zones in one run. The robot takes one fan speed and water level per run: the first zone's.
   */
  private async cleanZones(definitions: ZoneDefinition[]) {
    const names = definitions.map(({ name }) => name);
    this.log.info(
      `ACT setCleaning | Start cleaning Zone ${names.join(", ")}, not charging.`
    );

    const zoneParams: number[][] = [];
    for (const { zone } of definitions) {
      for (const zon of zone) {
        if (zon.length === 4) {
          zoneParams.push(zon.concat(1));
        } else if (zon.length === 5) {
          zoneParams.push(zon);
        }
      }
    }
    const { device } = this.deviceManager;
    if (!supports(device, "cleanZones")) {
      this.log.warn(
        `setCleaningZone | ${this.deviceManager.model} doesn't support zone cleaning.`
      );
      this.refreshSwitches();
      return;
    }
    const [first, ...others] = definitions;
    if (
      others.some(
        ({ speed, waterSpeed }) =>
          speed !== first.speed || waterSpeed !== first.waterSpeed
      )
    ) {
      this.log.warn(
        `setCleaningZone | The robot takes one fan speed and water level per run: using the ones of ${first.name}.`
      );
    }
    await this.applyModes(first);
    for (const name of names) this.active.add(name);
    try {
      await device.cleanZones(zoneParams);
    } catch (err) {
      this.active.clear();
      throw err;
    } finally {
      this.refreshSwitches();
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
