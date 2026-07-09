import { API } from "homebridge";
import { PLUGIN_NAME, ACCESSORY_NAME } from "./constants";
import {
  XiaomiRoborockVacuumAccessory,
  XiaomiRoborockVacuumPlatform,
} from "./homebridge_entities";

export default (api: API) => {
  // Register the "legacy" standalone accessory
  api.registerAccessory(
    PLUGIN_NAME,
    ACCESSORY_NAME,
    XiaomiRoborockVacuumAccessory
  );

  // Register the "dynamic" platform
  api.registerPlatform(
    PLUGIN_NAME,
    ACCESSORY_NAME,
    XiaomiRoborockVacuumPlatform
  );
};
