import { Service } from "homebridge";
import { distinctUntilKeyChanged, filter } from "rxjs";
import { CoreContext } from "./types.js";
import { PluginServiceClass } from "./plugin_service_class.js";
import { ensureName } from "../utils/ensure_name.js";

export interface WaterTankConfig {
  /** Show a sensor that detects when the clean water tank is empty */
  waterTankEmpty: boolean;
}

/**
 * An occupancy sensor that is "occupied" when the robot reports a water shortage (#1169).
 *
 * It relies on node-miio's `waterShortage` property (`water_shortage_status`), only reported by some models
 * (usually the ones with a self-refilling dock).
 */
export class WaterTankService extends PluginServiceClass {
  private readonly service: Service;
  constructor(coreContext: CoreContext) {
    super(coreContext);

    const name = `${this.config.name} Water Tank Empty`;
    this.service = new this.hap.Service.OccupancySensor(
      name,
      "Water Tank Empty"
    );
    ensureName(this.hap, this.service, name);
    this.service
      .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
      .onGet(() => this.toOccupancy(this.isEmpty));
  }

  public async init(): Promise<void> {
    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "waterShortage"),
        distinctUntilKeyChanged("value")
      )
      .subscribe(({ value }) => {
        const isEmpty = value === true;
        this.log.info(
          `MON changedWaterShortage | The water tank is ${isEmpty ? "empty" : "not empty"}`
        );
        this.service
          .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
          .updateValue(this.toOccupancy(isEmpty));
      });
  }

  public get services(): Service[] {
    return [this.service];
  }

  private get isEmpty() {
    return this.deviceManager.property<boolean>("waterShortage") === true;
  }

  private toOccupancy(isEmpty: boolean) {
    const { OccupancyDetected } = this.hap.Characteristic;
    return isEmpty
      ? OccupancyDetected.OCCUPANCY_DETECTED
      : OccupancyDetected.OCCUPANCY_NOT_DETECTED;
  }
}
