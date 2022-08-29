import { CustomLoggerConfig } from "../utils/logger";
import { RoomsConfig } from "./rooms_service";
import { DeviceManagerConfig } from "./device_manager";

export interface Config
  extends DeviceManagerConfig,
    CustomLoggerConfig,
    RoomsConfig {
  /**
   * The name of the main service as it will show up in the Home App.
   */
  name: string;

  // For now, let's allow anything until all config entries are defined
  [key: string]: any;
}

/**
 * Applies the default configuration values to the config provided by the user.
 * @param config The config provided by the user.
 *
 * @remarks We may want to use a validation library like io-ts in the future for easier typing and defaulting.
 */
export function applyConfigDefaults(config: Partial<Config>): Config {
  return {
    name: "Roborock vacuum cleaner",
    cleanword: "cleaning",
    pause: false,
    pauseWord: "Pause",
    findMe: false,
    findMeWord: "where are you",
    goTo: false,
    goToWord: "go to coordinates",
    goToX: 25500,
    goToY: 25500,
    roomTimeout: 0,
    ...config,
  };
}
