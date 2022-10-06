import type { HAP } from "homebridge";

export function createCareSideBrushClass(hap: HAP) {
  class CareSideBrush extends hap.Characteristic {
    public static UUID = "00000103-0000-0000-0000-000000000000";

    constructor() {
      super("Care indicator side brush", CareSideBrush.UUID, {
        format: hap.Characteristic.Formats.FLOAT,
        unit: "%",
        perms: [hap.Characteristic.Perms.READ, hap.Characteristic.Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    }
  }

  return { CareSideBrush };
}
