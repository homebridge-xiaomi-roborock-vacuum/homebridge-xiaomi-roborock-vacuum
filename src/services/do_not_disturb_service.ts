import { CharacteristicValue, Service } from "homebridge";
import { first } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";
import { supports } from "../utils/supports";

export interface DoNotDisturbConfig {
  /** Show a switch that enables/disables the robot's Do Not Disturb schedule (Roborock only) */
  doNotDisturb?: boolean;
  /** The switch's name, after the vacuum's */
  doNotDisturbWord: string;
  /**
   * The schedule to set when the switch is turned on (`HH:mm`). Without them, the robot's own schedule (from the app)
   * is turned back on. E.g. `"00:00"` to `"23:59"` for the whole day.
   */
  doNotDisturbStart?: string;
  doNotDisturbEnd?: string;
}

/** The robot's default schedule, if it has never had one */
const DEFAULT_SCHEDULE = { start: "22:00", end: "08:00" };

/**
 * A switch for the robot's Do Not Disturb schedule (#1136): during it, the robot is quiet (no voice, dimmed lights)
 * and the dock doesn't empty the dust bin, e.g. turned on while someone is home.
 */
export class DoNotDisturbService extends PluginServiceClass {
  private readonly service?: Service;
  private enabled = false;

  constructor(coreContext: CoreContext) {
    super(coreContext);
    if (!this.config.doNotDisturb) return;
    const name = `${this.config.name} ${this.config.doNotDisturbWord}`;
    this.service = new this.hap.Service.Switch(name, "Do Not Disturb");
    ensureName(this.hap, this.service, name);
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => {
        // It may have changed from the app: refresh it in the background, HomeKit doesn't wait for the robot
        this.refresh().catch(() => {});
        return this.enabled;
      })
      .onSet((newState) => this.setEnabled(newState));
  }

  public async init(): Promise<void> {
    if (!this.service) return;
    this.deviceManager.deviceConnected$.pipe(first()).subscribe(() => {
      this.refresh().catch((err) =>
        this.log.debug(`DEB doNotDisturb | Failed to read the schedule: ${err}`)
      );
    });
  }

  public get services(): Service[] {
    return this.service ? [this.service] : [];
  }

  private get device() {
    const { device } = this.deviceManager;
    return supports(device, "getDoNotDisturb") &&
      supports(device, "setDoNotDisturb") &&
      supports(device, "disableDoNotDisturb")
      ? device
      : undefined;
  }

  private async getSchedule() {
    await this.deviceManager.ensureDevice("doNotDisturb");
    return this.device?.getDoNotDisturb();
  }

  private async refresh() {
    const schedule = await this.getSchedule();
    if (!schedule) return;
    this.update(schedule.enabled);
  }

  private update(enabled: boolean) {
    this.enabled = enabled;
    this.service!.getCharacteristic(this.hap.Characteristic.On).updateValue(
      enabled
    );
  }

  private async setEnabled(newState: CharacteristicValue) {
    await this.deviceManager.ensureDevice("setDoNotDisturb");
    const { device } = this;
    if (!device) {
      this.log.warn(
        `setDoNotDisturb | ${this.deviceManager.model} doesn't support Do Not Disturb.`
      );
      return;
    }
    try {
      if (newState) {
        const current = await device.getDoNotDisturb().catch(() => undefined);
        const start =
          this.config.doNotDisturbStart ??
          current?.start ??
          DEFAULT_SCHEDULE.start;
        const end =
          this.config.doNotDisturbEnd ?? current?.end ?? DEFAULT_SCHEDULE.end;
        this.log.info(
          `ACT setDoNotDisturb | Do Not Disturb from ${start} to ${end}.`
        );
        await device.setDoNotDisturb(start, end);
      } else {
        this.log.info(`ACT setDoNotDisturb | Do Not Disturb disabled.`);
        await device.disableDoNotDisturb();
      }
      this.update(newState === true);
    } catch (err) {
      this.log.error(`setDoNotDisturb | Failed to change Do Not Disturb.`, err);
      throw err;
    }
  }
}
