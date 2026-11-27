import { Service } from "homebridge";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";
import { supports } from "../utils/supports";

/** A map to switch to: a floor (multi-floor maps) or a backup (e.g. S5). Pick them in the plugin's settings. */
export interface SavedMap {
  name: string;
  /** A floor of the multi-floor maps: its id on the robot */
  id?: number;
  /**
   * A map backup: when it was saved (ISO 8601). The robot's slot for a backup changes once a newer one is saved, the
   * date doesn't.
   */
  savedAt?: string;
}

export interface MapsConfig {
  /** A switch per map: on loads it */
  maps?: SavedMap[];
  /** The first word(s) of the maps' switches: "map Upstairs" (default "map") */
  mapWord: string;
}

/** How long a map's switch shows as on after loading it */
const RESET_DELAY_MS = 1000;

/**
 * A switch per saved map (#393, #582): on loads that map (a floor, or a backup of an older map), and the switch turns
 * itself off. The robot doesn't say which map is loaded.
 */
export class MapsService extends PluginServiceClass {
  private readonly switches: Service[] = [];

  constructor(coreContext: CoreContext) {
    super(coreContext);
    const subtypes = new Set<string>();
    for (const [index, map] of (this.config.maps ?? []).entries()) {
      const subtype = subtypeOf(map);
      if (!map?.name || !subtype) {
        this.log.warn(
          `WAR MapsService | Ignoring the map #${index + 1}: it needs a "name", and an "id" (floor) or a "savedAt" (backup).`
        );
        continue;
      }
      if (subtypes.has(subtype)) {
        this.log.warn(
          `WAR MapsService | Ignoring the map "${map.name}": another switch loads the same map.`
        );
        continue;
      }
      subtypes.add(subtype);
      const name = `${this.config.mapWord} ${map.name}`;
      const service = new this.hap.Service.Switch(name, subtype);
      ensureName(this.hap, service, name);
      const on = service.getCharacteristic(this.hap.Characteristic.On);
      on.onGet(() => false).onSet(async (value) => {
        if (value !== true) return;
        try {
          await this.load(map);
        } finally {
          setTimeout(() => on.updateValue(false), RESET_DELAY_MS);
        }
      });
      this.switches.push(service);
    }
  }

  public async init(): Promise<void> {}

  public get services(): Service[] {
    return this.switches;
  }

  private async load(map: SavedMap) {
    await this.deviceManager.ensureDevice("loadMap");
    const { device } = this.deviceManager;
    try {
      if (map.id !== undefined) {
        if (!supports(device, "loadMap")) {
          this.log.warn(
            `loadMap | ${this.deviceManager.model} doesn't support multi-floor maps.`
          );
          return;
        }
        this.log.info(`ACT loadMap | Loading the map "${map.name}"`);
        await device.loadMap(map.id);
        return;
      }

      if (!supports(device, "loadBackupMap")) {
        this.log.warn(
          `loadMap | ${this.deviceManager.model} doesn't support map backups.`
        );
        return;
      }
      const savedAt = seconds(map.savedAt);
      const backups = await device.getBackupMaps();
      const backup = backups.find(
        (b) => Math.round(b.savedAt.getTime() / 1000) === savedAt
      );
      if (!backup) {
        throw new Error(
          `The robot no longer has the backup of "${map.name}" (saved at ${map.savedAt}). Its backups: ${
            backups.map((b) => b.savedAt.toISOString()).join(", ") || "none"
          }. Pick it again in the plugin's settings.`
        );
      }
      this.log.info(
        `ACT loadMap | Restoring the map "${map.name}" (backup ${backup.id}, saved at ${map.savedAt})`
      );
      await device.loadBackupMap(backup.id);
    } catch (err) {
      this.log.error(`loadMap | `, err);
      throw err;
    }
  }
}

/** The backup's time, in seconds (what the robot reports) */
function seconds(date?: string) {
  const time = date ? Date.parse(date) : NaN;
  return Number.isFinite(time) ? Math.round(time / 1000) : undefined;
}

/** A stable subtype per map, so HomeKit keeps the switch (and its automations) when the list changes */
function subtypeOf(map?: SavedMap) {
  if (Number.isInteger(map?.id)) return `map${map?.id}`;
  const time = seconds(map?.savedAt);
  return time === undefined ? undefined : `mapBackup${time}`;
}
