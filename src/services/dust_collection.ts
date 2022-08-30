import { HAP, Service } from "homebridge";
import { PluginService } from "./types";
import { Logger } from "../utils/logger";
import { Config } from "./config_service";
import { DeviceManager } from "./device_manager";
import { callbackify } from "../utils/callbackify";

export class DustCollection implements PluginService {
  private readonly service: Service;
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly config: Config,
    private readonly deviceManager: DeviceManager
  ) {
    this.service = new this.hap.Service.Switch(
      `${this.config.name} Dust Collection`,
      "Dust Collection"
    );
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .on("get", (cb) => callbackify(() => this.getDustCollectionState(), cb))
      .on("set", (newState, cb) =>
        callbackify(() => this.setDustCollectionState(newState), cb)
      );
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
    return state;
  }
}
