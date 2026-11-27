import { Service } from "homebridge";
import { filter } from "rxjs";
import { vacuumActivity, type VacuumActivity } from "node-miio";
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

/**
 * How long the switch waits for the robot to start working: the state is polled every 30s, so two polls. A scene that
 * doesn't move the robot (e.g. it only changes a setting) turns its switch off then.
 */
const START_TIMEOUT_MS = 60_000;

/** The activities of a robot that isn't doing anything (the scene is done) */
const AT_REST = new Set<VacuumActivity>([
  "stopped",
  "charging",
  "docked",
  "error",
]);

/**
 * A switch per scene of the app (#777): a routine of the Roborock app, or a manual scene ("Tap to run") of the Xiaomi
 * Home app. They run in the app's cloud, so they can chain steps the HomeKit scenes can't (e.g. several rooms with
 * their own settings, in one run).
 *
 * The switch stays on while the robot works (cleaning, washing the mop, going back to the dock…), and turns off once
 * it's done: an automation can follow the end of the scene. The apps don't say when a scene ends: if the robot doesn't
 * start within a minute, the switch turns off. Turning it off by hand only turns the switch off: the scene keeps
 * running in the app's cloud.
 */
export class ScenesService extends PluginServiceClass {
  private readonly switches: Array<Service & { sceneId: string }> = [];
  /** The scene that's running (its switch shows as on) */
  private active?: string;
  /** Whether the robot was seen working since the scene started */
  private started = false;
  private startTimeout?: NodeJS.Timeout;

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
      const service = Object.assign(
        new this.hap.Service.Switch(scene.name, `scene${id}`),
        { sceneId: id }
      );
      ensureName(this.hap, service, scene.name);
      service
        .getCharacteristic(this.hap.Characteristic.On)
        .onGet(() => this.active === id)
        .onSet(async (value) => {
          if (value === true) {
            await this.runScene(scene.name, id);
          } else if (this.active === id) {
            // The scene keeps running in the app's cloud: only the switch turns off
            this.finish();
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

  public async init(): Promise<void> {
    this.deviceManager.stateChanged$
      .pipe(filter(({ key }) => key === "state"))
      .subscribe(() => this.followRobot());
  }

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
    this.finish();
    this.active = id;
    // Already working (e.g. the scene adds to what it was doing): it's done once the robot rests
    this.started = this.isWorking() === true;
    this.refresh();
    try {
      await this.run(id);
    } catch (err) {
      this.log.error(`runScene | "${name}": `, err);
      this.finish();
      throw err;
    }
    if (!this.started && this.active === id) {
      this.startTimeout = setTimeout(() => {
        this.log.info(
          `INF runScene | The robot didn't start with the scene "${name}": its switch turns off.`
        );
        this.finish();
      }, START_TIMEOUT_MS);
    }
  }

  /** The switch of the running scene turns off once the robot is done */
  private followRobot() {
    if (!this.active) return;
    const working = this.isWorking();
    if (working === true) {
      this.started = true;
      clearTimeout(this.startTimeout);
    } else if (working === false && this.started) {
      this.finish();
    }
  }

  /** @returns Whether the robot is working, or `undefined` for a state node-miio doesn't know */
  private isWorking() {
    const activity = vacuumActivity(this.deviceManager.state);
    return activity === undefined ? undefined : !AT_REST.has(activity);
  }

  private finish() {
    clearTimeout(this.startTimeout);
    this.startTimeout = undefined;
    this.active = undefined;
    this.started = false;
    this.refresh();
  }

  private refresh() {
    for (const service of this.switches) {
      service
        .getCharacteristic(this.hap.Characteristic.On)
        .updateValue(this.active === service.sceneId);
    }
  }
}
