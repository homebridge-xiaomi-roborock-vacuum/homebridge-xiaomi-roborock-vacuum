import { Service } from "homebridge";
import { distinctUntilChanged, filter, map, tap } from "rxjs";
import { CoreContext } from "./types.js";
import { PluginServiceClass } from "./plugin_service_class.js";
import { ensureName } from "../utils/ensure_name.js";

export interface DockConfig {
  dock: boolean;
}

export class DockService extends PluginServiceClass {
  private readonly service: Service;
  constructor(coreContext: CoreContext) {
    super(coreContext);

    const name = `${this.config.name} Dock`;
    this.service = new this.hap.Service.OccupancySensor(name);
    ensureName(this.hap, this.service, name);
    this.service
      .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
      .onGet(() => this.getDocked());
  }

  public async init(): Promise<void> {
    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "charging"),
        map(({ value }) => value === true),
        tap((isCharging) => {
          this.service
            .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
            .updateValue(isCharging);
        }),
        distinctUntilChanged()
      )
      .subscribe((isCharging) => {
        const msg = isCharging
          ? "Robot was docked"
          : "Robot not anymore in dock";
        this.log.info(`changedCharging | ${msg}.`);
      });
  }

  public get services(): Service[] {
    return [this.service];
  }

  private async getDocked() {
    const status = this.deviceManager.state;
    // When the battery is full, the robot is still on the dock
    const isDocked = status === "charging" || status === "fully-charged";
    this.log.info(
      `getDocked | Robot Docked is ${isDocked} (Status is ${status})`
    );

    return isDocked;
  }
}
