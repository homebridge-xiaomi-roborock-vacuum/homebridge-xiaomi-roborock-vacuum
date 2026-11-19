import { Service, CharacteristicValue } from "homebridge";
import { distinct, filter } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";

export interface MopDockConfig {
  /** Show a switch that starts washing the mop (docks with mop washing only) */
  mopWash: boolean;
  /** Show a switch that starts/stops drying the mop (docks with a mop dryer only) */
  mopDrying: boolean;
}

/** How long the "wash mop" switch stays ON before going back to OFF (it's a button) */
const BUTTON_RESET_MS = 1000;

/**
 * Switches to wash and dry the mop in the dock (#752).
 */
export class MopDockService extends PluginServiceClass {
  private readonly washService?: Service;
  private readonly dryService?: Service;
  private resetTimer?: NodeJS.Timeout;

  constructor(coreContext: CoreContext) {
    super(coreContext);

    if (this.config.mopWash) {
      const name = `${this.config.name} Wash Mop`;
      this.washService = new this.hap.Service.Switch(name, "Wash Mop");
      ensureName(this.hap, this.washService, name);
      this.washService
        .getCharacteristic(this.hap.Characteristic.On)
        .onGet(() => false)
        .onSet((newState) => this.washMop(newState));
    }

    if (this.config.mopDrying) {
      const name = `${this.config.name} Dry Mop`;
      this.dryService = new this.hap.Service.Switch(name, "Dry Mop");
      ensureName(this.hap, this.dryService, name);
      this.dryService
        .getCharacteristic(this.hap.Characteristic.On)
        .onGet(() => this.isDrying)
        .onSet((newState) => this.setDrying(newState));
    }
  }

  public async init(): Promise<void> {
    if (!this.dryService) return;
    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "mopDrying"),
        distinct(({ value }) => value)
      )
      .subscribe(({ value }) => {
        this.log.info(`MON changedMopDrying | Mop drying is now ${value}`);
        this.dryService!.getCharacteristic(
          this.hap.Characteristic.On
        ).updateValue(value === true);
      });
  }

  public get services(): Service[] {
    return [this.washService, this.dryService].filter(
      (service): service is Service => !!service
    );
  }

  private get isDrying() {
    return this.deviceManager.property<boolean>("mopDrying") === true;
  }

  private async washMop(newState: CharacteristicValue) {
    if (!newState) return;
    await this.deviceManager.ensureDevice("washMop");

    const { device } = this.deviceManager;
    try {
      if (typeof device.startMopWash !== "function") {
        this.log.warn(`washMop | This model doesn't support mop washing.`);
        return;
      }
      this.log.info(`ACT washMop | Washing the mop.`);
      await device.startMopWash();
    } catch (err) {
      this.log.error(`washMop | Failed to wash the mop.`, err);
      throw err;
    } finally {
      // It's a button: go back to OFF
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        this.washService!.getCharacteristic(
          this.hap.Characteristic.On
        ).updateValue(false);
      }, BUTTON_RESET_MS);
    }
  }

  private async setDrying(newState: CharacteristicValue) {
    await this.deviceManager.ensureDevice("setDrying");

    const { device } = this.deviceManager;
    try {
      if (
        typeof device.startMopDrying !== "function" ||
        typeof device.stopMopDrying !== "function"
      ) {
        this.log.warn(`setDrying | This model doesn't support mop drying.`);
        return;
      }
      if (newState) {
        this.log.info(`ACT setDrying | Drying the mop.`);
        await device.startMopDrying();
      } else {
        this.log.info(`ACT setDrying | Stop drying the mop.`);
        await device.stopMopDrying();
      }
    } catch (err) {
      this.log.error(`setDrying | Failed to change the mop drying.`, err);
      throw err;
    }
  }
}
