import type { HAP } from "homebridge";
import {
  createCareSensorsClass,
  createCareFilterClass,
  createCareSideBrushClass,
  createCareMainBrushClass,
} from "./characteristics";

export function createCareServicesClasses(hap: HAP) {
  const { CareSensors } = createCareSensorsClass(hap);
  const { CareFilter } = createCareFilterClass(hap);
  const { CareSideBrush } = createCareSideBrushClass(hap);
  const { CareMainBrush } = createCareMainBrushClass(hap);

  class Care extends hap.Service {
    public static UUID = "00000111-0000-0000-0000-000000000000";
    constructor(displayName: string, subType?: string) {
      super(displayName, Care.UUID, subType);
      this.addCharacteristic(CareSensors);
      this.addCharacteristic(CareFilter);
      this.addCharacteristic(CareSideBrush);
      this.addCharacteristic(CareMainBrush);
    }
  }

  return {
    Care,
    Characteristic: {
      CareSensors,
      CareFilter,
      CareSideBrush,
      CareMainBrush,
    },
  };
}
