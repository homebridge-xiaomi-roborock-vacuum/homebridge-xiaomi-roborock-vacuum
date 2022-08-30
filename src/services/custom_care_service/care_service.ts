import { Service } from "hap-nodejs";
import {
  CareFilter,
  CareMainBrush,
  CareSensors,
  CareSideBrush,
} from "./characteristics";

export class Care extends Service {
  public static UUID = "00000111-0000-0000-0000-000000000000";
  constructor(displayName: string, subType?: string) {
    super(displayName, Care.UUID, subType);
    this.addCharacteristic(CareSensors);
    this.addCharacteristic(CareFilter);
    this.addCharacteristic(CareSideBrush);
    this.addCharacteristic(CareMainBrush);
  }
}
