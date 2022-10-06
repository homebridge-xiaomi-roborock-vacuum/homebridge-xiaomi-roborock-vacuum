import type { HAP } from "homebridge";

export function createCareSensorsClass(hap: HAP) {
  class CareSensors extends hap.Characteristic {
    public static UUID = "00000101-0000-0000-0000-000000000000";

    constructor() {
      super("Care indicator sensors", CareSensors.UUID, {
        format: hap.Characteristic.Formats.FLOAT,
        unit: "%",
        perms: [hap.Characteristic.Perms.READ, hap.Characteristic.Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    }
  }
  return { CareSensors };
}
