import { Service } from "homebridge";
import { CoreContext } from "./types.js";
import { PluginServiceClass } from "./plugin_service_class.js";
import { ensureName } from "../utils/ensure_name.js";

export interface ErrorSensorConfig {
  /** Show a sensor that detects when the robot reports an error (e.g. stuck, brush blocked), for notifications */
  errorSensor?: boolean;
}

/**
 * An occupancy sensor that is "occupied" while the robot reports an error (#232): HomeKit can notify it, or trigger
 * automations. node-miio clears the error when the robot leaves its error state.
 */
export class ErrorSensorService extends PluginServiceClass {
  private readonly service: Service;
  private hasError = false;

  constructor(coreContext: CoreContext) {
    super(coreContext);
    const name = `${this.config.name} Error`;
    this.service = new this.hap.Service.OccupancySensor(name, "Error");
    ensureName(this.hap, this.service, name);
    this.service
      .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
      .onGet(() => this.toOccupancy(this.hasError));
  }

  public async init(): Promise<void> {
    // Only the changes: the error, or `null` when it's cleared
    this.deviceManager.errorChanged$.subscribe((error) => {
      this.hasError = error !== null && error !== undefined;
      this.log.info(
        this.hasError
          ? `MON changedError | The error sensor is on: ${error!.description ?? error!.id}`
          : `MON changedError | The error sensor is off: the error is cleared`
      );
      this.service
        .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
        .updateValue(this.toOccupancy(this.hasError));
    });
  }

  public get services(): Service[] {
    return [this.service];
  }

  private toOccupancy(hasError: boolean) {
    const { OccupancyDetected } = this.hap.Characteristic;
    return hasError
      ? OccupancyDetected.OCCUPANCY_DETECTED
      : OccupancyDetected.OCCUPANCY_NOT_DETECTED;
  }
}
