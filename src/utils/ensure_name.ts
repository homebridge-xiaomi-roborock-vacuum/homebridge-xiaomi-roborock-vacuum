import { Service, HAP } from "homebridge";

export function ensureName(hap: HAP, service: Service, name: string) {
  const key = [
    `homebridge-xiaomi-roborock-vacuum`,
    `configured-name`,
    name.replaceAll(" ", "_"),
  ].join("-");
  if (service.getCharacteristic(hap.Characteristic.ConfiguredName)) {
    // Let's assume the listener is already added
    return;
  }

  service.addOptionalCharacteristic(hap.Characteristic.ConfiguredName);

  if (!hap.HAPStorage.storage().getItemSync(key)) {
    service.setCharacteristic(hap.Characteristic.ConfiguredName, name);
  }
  service
    .getCharacteristic(hap.Characteristic.ConfiguredName)
    .on("change", ({ newValue }) => {
      hap.HAPStorage.storage().setItemSync(key, newValue);
    });
}
