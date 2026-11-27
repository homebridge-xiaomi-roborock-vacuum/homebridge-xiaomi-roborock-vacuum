import { Service } from "homebridge";
import { distinctUntilChanged, filter, map } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";

export interface CleaningSensorConfig {
  /** An occupancy sensor detected while the robot cleans: e.g. for a notification when it starts (#447) */
  cleaningSensor: boolean;
}

/**
 * An occupancy sensor, detected while the robot cleans (not while it's paused, docked or idle). The Home app can notify
 * when it's detected, which it can't do for a switch. Unlike the room sensors, it needs no account.
 */
export class CleaningSensorService extends PluginServiceClass {
  private readonly service: Service;

  constructor(coreContext: CoreContext) {
    super(coreContext);
    const name = `${this.config.name} ${this.config.cleanword}`;
    this.service = new this.hap.Service.OccupancySensor(
      name,
      "Cleaning Sensor"
    );
    ensureName(this.hap, this.service, name);
    this.service
      .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
      .onGet(() => this.occupancy(this.deviceManager.isCleaning));
  }

  public async init(): Promise<void> {
    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "state"),
        map(() => this.deviceManager.isCleaning),
        distinctUntilChanged()
      )
      .subscribe((isCleaning) => {
        this.log.info(
          `changedCleaningSensor | Cleaning sensor is now ${isCleaning ? "detected" : "not detected"}.`
        );
        this.service
          .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
          .updateValue(this.occupancy(isCleaning));
      });
  }

  public get services(): Service[] {
    return [this.service];
  }

  private occupancy(isCleaning: boolean) {
    const { OccupancyDetected } = this.hap.Characteristic;
    return isCleaning
      ? OccupancyDetected.OCCUPANCY_DETECTED
      : OccupancyDetected.OCCUPANCY_NOT_DETECTED;
  }
}
