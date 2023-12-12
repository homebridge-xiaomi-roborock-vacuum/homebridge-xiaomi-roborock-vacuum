import { API } from "homebridge";
import { PLUGIN_NAME, ACCESSORY_NAME } from "./constants";
import { XiaomiRoborockVacuum } from "./xiaomi_roborock_vacuum_accessory";
import { XiaomiRoborockVacuumPlatform } from "./xiaomi_roborock_vacuum_platform";

export default (api: API) => {
  // Register the "legacy" standalone accessory
  api.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, XiaomiRoborockVacuum);

  // Register the "dynamic" platform
  api.registerPlatform(
    PLUGIN_NAME,
    ACCESSORY_NAME,
    XiaomiRoborockVacuumPlatform
  );
};
