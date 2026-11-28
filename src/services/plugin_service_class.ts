import { CoreContext, PluginService } from "./types.js";
import { HAP } from "homebridge";
import { Logger } from "../utils/logger.js";
import { Config } from "./config_service.js";
import { DeviceManager } from "./device_manager.js";

export abstract class PluginServiceClass implements PluginService {
  protected readonly hap: HAP;
  protected readonly log: Logger;
  protected readonly config: Config;
  protected readonly deviceManager: DeviceManager;

  protected constructor({ hap, log, config, deviceManager }: CoreContext) {
    this.hap = hap;
    this.log = log;
    this.config = config;
    this.deviceManager = deviceManager;
  }

  public abstract init(): Promise<void>;

  public abstract get services();
}
