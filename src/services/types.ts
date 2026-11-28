import { HAP, Service } from "homebridge";
import { Logger } from "../utils/logger.js";
import { Config } from "./config_service.js";
import { DeviceManager } from "./device_manager.js";

export interface PluginService {
  init(): Promise<void>;
  get services(): Service[];
}

export interface CoreContext {
  hap: HAP;
  log: Logger;
  config: Config;
  deviceManager: DeviceManager;
}
