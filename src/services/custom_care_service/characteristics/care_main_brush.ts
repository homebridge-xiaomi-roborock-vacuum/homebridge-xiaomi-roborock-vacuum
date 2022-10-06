import type { HAP } from "homebridge";

export function createCareMainBrushClass(hap: HAP) {
  class CareMainBrush extends hap.Characteristic {
    public static UUID = "00000104-0000-0000-0000-000000000000";
    constructor() {
      super("Care indicator main brush", CareMainBrush.UUID, {
        format: hap.Characteristic.Formats.FLOAT,
        unit: "%",
        perms: [hap.Characteristic.Perms.READ, hap.Characteristic.Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    }
  }
  return { CareMainBrush };
}
