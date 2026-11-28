import { Service } from "homebridge";
import { CoreContext } from "./types.js";
import { PluginServiceClass } from "./plugin_service_class.js";
import { ensureName } from "../utils/ensure_name.js";
import { supports } from "../utils/supports.js";

export interface DustCollectionConfig {
  dustCollection: boolean;
}

export class DustCollection extends PluginServiceClass {
  private readonly service: Service;
  constructor(coreContext: CoreContext) {
    super(coreContext);
    const name = `${this.config.name} Dust Collection`;
    this.service = new this.hap.Service.Switch(name, "Dust Collection");
    ensureName(this.hap, this.service, name);
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => this.getDustCollectionState())
      .onSet((newState) => this.setDustCollectionState(newState));
  }

  public async init(): Promise<void> {}

  public get services(): Service[] {
    return [this.service];
  }

  private get isDustCollecting() {
    return this.deviceManager.state === "dust-collection";
  }

  private async getDustCollectionState() {
    await this.deviceManager.ensureDevice("getDustCollectionState");

    // ensureDevice() resolves only once connected: the state can be read without throwing
    const isDustCollecting = this.isDustCollecting;
    this.log.info(
      `getDustCollectionState | Dust collection is ${isDustCollecting}`
    );
    return isDustCollecting;
  }

  private async setDustCollectionState(state) {
    await this.deviceManager.ensureDevice("setDustCollectionState");

    const isCharging = this.deviceManager.state;
    const { device } = this.deviceManager;
    if (!supports(device, "startDustCollection")) {
      this.log.warn(
        `setDustCollectionState | ${this.deviceManager.model} doesn't support the dust collection.`
      );
      return;
    }

    try {
      if (state && !this.isDustCollecting && isCharging) {
        await device.startDustCollection();
        this.log.info(
          `setDustCollectionState | Starting Dust Collection, and the device is in state ${this.deviceManager.state}`
        );
      } else if (!state && this.isDustCollecting) {
        await device.stopDustCollection();
        this.log.info(
          `setDustCollectionState | Stopping Dust Collection, and the device is in state ${this.deviceManager.state}`
        );
      } else if (state && !this.isDustCollecting && !isCharging) {
        this.service
          .getCharacteristic(this.hap.Characteristic.On)
          .updateValue(false);
        this.log.info(
          `setDustCollectionState | Starting Dust Collection not possible, and the device is in state ${this.deviceManager.state}`
        );
      }
    } catch (err) {
      this.log.error(
        `setDustCollectionState | Failed updating dust collection state ${state}.`,
        err
      );
      throw err;
    }
  }
}
