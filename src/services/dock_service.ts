import { Service } from "homebridge";
import { distinct, filter } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";

export interface DockConfig {
  dock: boolean;
}

export class DockService extends PluginServiceClass {
  private readonly service: Service;
  constructor(coreContext: CoreContext) {
    super(coreContext);

    this.service = new this.hap.Service.OccupancySensor(
      `${this.config.name} Dock`
    );
    this.service
      .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
      .onGet(() => this.getDocked());
  }

  public async init(): Promise<void> {
    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "charging"),
        distinct(({ value }) => value)
      )
      .subscribe(({ value }) => {
        const isCharging = value === true;
        const msg = isCharging
          ? "Robot was docked"
          : "Robot not anymore in dock";
        this.log.info(`changedCharging | ${msg}.`);
        this.service
          .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
          .updateValue(isCharging);
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
