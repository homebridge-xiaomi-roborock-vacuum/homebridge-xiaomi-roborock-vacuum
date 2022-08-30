import { Characteristic } from "hap-nodejs";

export class CareMainBrush extends Characteristic {
  public static UUID = "00000104-0000-0000-0000-000000000000";
  constructor() {
    super("Care indicator main brush", CareMainBrush.UUID, {
      format: Characteristic.Formats.FLOAT,
      unit: "%",
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
    });
    this.value = this.getDefaultValue();
  }
}
