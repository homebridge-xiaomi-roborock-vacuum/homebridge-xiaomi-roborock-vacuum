import { Characteristic } from "hap-nodejs";

export class CareSensors extends Characteristic {
  public static UUID = "00000101-0000-0000-0000-000000000000";
  constructor() {
    super("Care indicator sensors", CareSensors.UUID, {
      format: Characteristic.Formats.FLOAT,
      unit: "%",
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY],
    });
    this.value = this.getDefaultValue();
  }
}
