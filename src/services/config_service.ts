import { CustomLoggerConfig } from "../utils/logger";
import { RoomsConfig } from "./rooms_service";
import { DeviceManagerConfig } from "./device_manager";
import { PauseConfig } from "./pause_switch";
import { WaterBoxConfig } from "./water_box_service";
import { DustCollectionConfig } from "./dust_collection";
import { ErrorSensorConfig } from "./error_sensor_service";
import { FindMeConfig } from "./find_me_service";
import { GoToConfig } from "./go_to_service";
import { GoToSpotsConfig } from "./go_to_spots_service";
import { GoToDockConfig } from "./go_to_dock_service";
import { DockConfig } from "./dock_service";
import { DoNotDisturbConfig } from "./do_not_disturb_service";
import { MopDockConfig } from "./mop_dock_service";
import { WaterTankConfig } from "./water_tank_service";
import { ZonesConfig } from "./zones_service";
import { CareConfig } from "./care_service";
import { MainServiceConfig } from "./main_service";
import { DustBinConfig } from "./dust_bin_service";
import { CurrentRoomConfig } from "./current_room_service";
import { MapsConfig } from "./maps_service";
import { CleaningSensorConfig } from "./cleaning_sensor_service";

export interface Config
  extends
    MainServiceConfig,
    DeviceManagerConfig,
    CustomLoggerConfig,
    RoomsConfig,
    PauseConfig,
    WaterBoxConfig,
    DustBinConfig,
    DustCollectionConfig,
    ErrorSensorConfig,
    FindMeConfig,
    GoToConfig,
    GoToSpotsConfig,
    GoToDockConfig,
    DockConfig,
    DoNotDisturbConfig,
    MopDockConfig,
    WaterTankConfig,
    ZonesConfig,
    CareConfig,
    CurrentRoomConfig,
    MapsConfig,
    CleaningSensorConfig {
  /**
   * The name of the main service as it will show up in the Home App.
   */
  name: string;

  // For now, let's allow anything until all config entries are defined
  [key: string]: any;
}

/**
 * The Homebridge UI shows pre-1.0 `accessories` blocks with the platform form, which moves their settings into
 * `devices: [...]` and keeps `"accessory": "XiaomiRoborockVacuum"` (#1248). The legacy accessory can only run one
 * device: it uses the first one.
 *
 * @param config The config of an `accessories` block.
 * @returns The config of the first device and how many devices were ignored, or `undefined` if it isn't such a block.
 */
export function fromUiPlatformForm(
  config: Partial<Config> & { devices?: unknown }
): { config: Partial<Config>; ignoredDevices: number } | undefined {
  const { devices, ...rest } = config;
  if (!Array.isArray(devices) || devices.length === 0 || config.ip) {
    return undefined;
  }
  return {
    config: { ...rest, ...(devices[0] as Partial<Config>) },
    ignoredDevices: devices.length - 1,
  };
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
    serviceType: "fan",
    cleanword: "cleaning",
    pause: false,
    pauseWord: "Pause",
    findMe: false,
    findMeWord: "where are you",
    goTo: false,
    goToWord: "go to coordinates",
    goToX: 25500,
    goToY: 25500,
    goToSpotWord: "go to",
    goToDock: false,
    goToDockWord: "go to dock",
    mapWord: "map",
    roomTimeout: 0,
    waterBox: false,
    dustBin: false,
    dustCollection: false,
    dock: false,
    cleaningSensor: false,
    doNotDisturb: false,
    doNotDisturbWord: "Do Not Disturb",
    mopWash: false,
    mopDrying: false,
    waterTankEmpty: false,
    ...config,
  };
}
