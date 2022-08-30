import { HAP, Service } from "homebridge";
import { PluginService } from "./types";
import { Logger } from "../utils/logger";
import { Config } from "./config_service";
import { DeviceManager } from "./device_manager";
import { callbackify } from "../utils/callbackify";
import { RoomsService } from "./rooms_service";
import { distinct, filter } from "rxjs";

export interface FindMeConfig {
  findMe: boolean;
  findMeWord: string;
}

export class FindMeService implements PluginService {
  private readonly service?: Service;
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly config: Config,
    private readonly deviceManager: DeviceManager
  ) {
    if (this.config.findMe) {
      this.service = new this.hap.Service.Switch(
        `${this.config.name} ${this.config.findMeWord}`,
        "FindMe Switch"
      );
      this.service
        .getCharacteristic(this.hap.Characteristic.On)
        .on("get", (cb) => cb(null, false))
        .on("set", (newState, cb) =>
          callbackify(() => this.identify(newState), cb)
        );
    }
  }

  public async init(): Promise<void> {}

  public get services(): Service[] {
    return this.service ? [this.service] : [];
  }

  public async identify(newState) {
    await this.deviceManager.ensureDevice("identify");

    this.log.info(`ACT identify | Find me - Hello!`);
    try {
      await this.deviceManager.device.find();
    } catch (err) {
      this.log.error(`identify | `, err);
      throw err;
    }
    return newState;
  }
}
