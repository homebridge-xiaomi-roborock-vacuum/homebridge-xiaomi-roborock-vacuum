import { Service } from "homebridge";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";

export interface DustCollectionConfig {
  dustCollection: boolean;
}

export class DustCollection extends PluginServiceClass {
  private readonly service: Service;
  constructor(coreContext: CoreContext) {
    super(coreContext);
    this.service = new this.hap.Service.Switch(
      `${this.config.name} Dust Collection`,
      "Dust Collection"
    );
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

    try {
      const isDustCollecting = this.isDustCollecting;
      this.log.info(
        `getDustCollectionState | Dust collection is ${isDustCollecting}`
      );
      return isDustCollecting;
    } catch (err) {
      this.log.error(
        `getDustCollectionState | Failed getting the cleaning status.`,
        err
      );
      throw err;
    }
  }

  private async setDustCollectionState(state) {
    await this.deviceManager.ensureDevice("setDustCollectionState");

    const isCharging = this.deviceManager.state;

    try {
      if (state && !this.isDustCollecting && isCharging) {
        await this.deviceManager.device.startDustCollection();
        this.log.info(
          `setDustCollectionState | Starting Dust Collection, and the device is in state ${this.deviceManager.state}`
        );
      } else if (!state && this.isDustCollecting) {
        await this.deviceManager.device.stopDustCollection();
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
