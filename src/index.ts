import { API } from "homebridge";
import getXiaomiRoborockVacuumAccessory from "./xiaomi_roborock_vacuum_accessory";

const PLUGIN_NAME = "homebridge-xiaomi-roborock-vacuum";
const ACCESSORY_NAME = "XiaomiRoborockVacuum";

export default (api: API) => {
  const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(api);

  api.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, XiaomiRoborockVacuum);
};
