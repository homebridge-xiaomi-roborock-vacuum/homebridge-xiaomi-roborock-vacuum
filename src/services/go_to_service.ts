import { HAP, Service } from "homebridge";
import { PluginService } from "./types";
import { Logger } from "../utils/logger";
import { Config } from "./config_service";
import { DeviceManager } from "./device_manager";
import { callbackify } from "../utils/callbackify";
import { RoomsService } from "./rooms_service";
import { distinct, filter } from "rxjs";

export interface GoToConfig {
  goTo: boolean;
  goToWord: string;
  goToX: number;
  goToY: number;
}

export class GoToService implements PluginService {
  private readonly service: Service;
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly config: Config,
    private readonly deviceManager: DeviceManager
  ) {
    this.service = new this.hap.Service.Switch(
      `${this.config.name} ${this.config.goToWord}`,
      "GoTo Switch"
    );
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .on("get", (cb) => callbackify(() => this.getGoToState(), cb))
      .on("set", (newState, cb) => callbackify(() => this.goTo(newState), cb));
  }

  public async init(): Promise<void> {}

  public get services(): Service[] {
    return [this.service];
  }

  private async goTo(newState) {
    await this.deviceManager.ensureDevice("goTo");

    this.log.info(`ACT goTo | Let's go!`);
    try {
      await this.deviceManager.device.sendToLocation(
        this.config.goToX,
        this.config.goToY
      );
    } catch (err) {
      this.log.error(`goTo | `, err);
      throw err;
    }
    return newState;
  }

  private async getGoToState() {
    await this.deviceManager.ensureDevice("getGoToState");

    try {
      const goingToLocation = this.deviceManager.state === "going-to-location";
      this.log.info(`getGoToState | Going to location is ${goingToLocation}`);
      return goingToLocation;
    } catch (err) {
      this.log.error(`getGoToState | Failed getting the cleaning status.`, err);
      throw err;
    }
  }
}
