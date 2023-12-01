import { Service } from "homebridge";
import { distinct, filter, map, tap } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";

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
        distinct()
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
    const isCharging = status === "charging";
    this.log.info(
      `getDocked | Robot Docked is ${isCharging} (Status is ${status})`
    );

    return isCharging;
  }
}
