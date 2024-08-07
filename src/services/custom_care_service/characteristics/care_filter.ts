import type { HAP } from "homebridge";

export function createCareFilterClass(hap: HAP) {
  class CareFilter extends hap.Characteristic {
    public static UUID = "00000102-0000-0000-0000-000000000000";

    constructor() {
      super("Care indicator filter", CareFilter.UUID, {
        format: hap.Formats.FLOAT,
        unit: "%",
        perms: [hap.Perms.PAIRED_READ, hap.Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    }
  }

  return { CareFilter };
}
