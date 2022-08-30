import { HAP, Service } from "homebridge";
import { PluginService } from "./types";
import { Logger } from "../utils/logger";
import { Config } from "./config_service";
import { DeviceManager } from "./device_manager";
import { callbackify } from "../utils/callbackify";
import { RoomsService } from "./rooms_service";
import { distinct, filter } from "rxjs";

export interface DockConfig {
  dock: boolean;
}

export class DockService implements PluginService {
  private readonly service: Service;
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly config: Config,
    private readonly deviceManager: DeviceManager
  ) {
    this.service = new this.hap.Service.OccupancySensor(
      `${this.config.name} Dock`
    );
    this.service
      .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
      .on("get", (cb) => callbackify(() => this.getDocked(), cb));
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
