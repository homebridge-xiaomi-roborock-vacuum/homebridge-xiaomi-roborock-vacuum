import { Service } from "homebridge";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";

/** A scene of the app: a routine of the Roborock app, or a manual scene of the Xiaomi Home app. Pick them in the plugin's settings. */
export interface SceneConfig {
  name: string;
  /** Its id in the app's account */
  id: string | number;
}

export interface ScenesConfig {
  /** A switch per scene of the app (#777): on runs it */
  scenes?: SceneConfig[];
}

/** Runs a scene in the robot's account (Roborock app, or the Xiaomi Cloud) */
export type SceneRunner = (id: string) => Promise<void>;

/** How long a scene's switch shows as on after running it */
const RESET_DELAY_MS = 1000;

/**
 * A switch per scene of the app (#777): a routine of the Roborock app, or a manual scene ("Tap to run") of the Xiaomi
 * Home app. They run in the app's cloud, so they can chain steps the HomeKit scenes can't (e.g. several rooms with
 * their own settings, in one run). The switch turns itself off.
 */
export class ScenesService extends PluginServiceClass {
  private readonly switches: Service[] = [];

  constructor(
    coreContext: CoreContext,
    /** `undefined` when the robot's account isn't configured (`cloud` or `roborock` option) */
    private readonly run?: SceneRunner
  ) {
    super(coreContext);
    const ids = new Set<string>();
    for (const [index, scene] of (this.config.scenes ?? []).entries()) {
      const id = scene?.id === undefined ? "" : String(scene.id).trim();
      if (!scene?.name || !id) {
        this.log.warn(
          `WAR ScenesService | Ignoring the scene #${index + 1}: it needs a "name" and an "id".`
        );
        continue;
      }
      if (ids.has(id)) {
        this.log.warn(
          `WAR ScenesService | Ignoring the scene "${scene.name}": another switch runs the same scene.`
        );
        continue;
      }
      ids.add(id);
      const service = new this.hap.Service.Switch(scene.name, `scene${id}`);
      ensureName(this.hap, service, scene.name);
      const on = service.getCharacteristic(this.hap.Characteristic.On);
      on.onGet(() => false).onSet(async (value) => {
        if (value !== true) return;
        try {
          await this.runScene(scene.name, id);
        } finally {
          setTimeout(() => on.updateValue(false), RESET_DELAY_MS);
        }
      });
      this.switches.push(service);
    }
    if (this.switches.length > 0 && !this.run) {
      this.log.warn(
        `WAR ScenesService | The scenes run in the app's account: enable the "cloud" option (Xiaomi Home) or the "roborock" option (Roborock app) of the platform.`
      );
    }
  }

  public async init(): Promise<void> {}

  public get services(): Service[] {
    return this.switches;
  }

  private async runScene(name: string, id: string) {
    if (!this.run) {
      throw new Error(
        `The scene "${name}" needs the app's account: enable the "cloud" or the "roborock" option.`
      );
    }
    this.log.info(`ACT runScene | Running the scene "${name}"`);
    try {
      await this.run(id);
    } catch (err) {
      this.log.error(`runScene | "${name}": `, err);
      throw err;
    }
  }
}
