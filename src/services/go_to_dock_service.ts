import { Service, CharacteristicValue } from "homebridge";
import { vacuumActivity } from "node-miio";
import { distinctUntilChanged, map } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";

export interface GoToDockConfig {
  goToDock: boolean;
  goToDockWord: string;
}

/**
 * A switch that sends the robot back to the dock (#322). It shows as ON while the robot is on its way.
 */
export class GoToDockService extends PluginServiceClass {
  private readonly service: Service;
  constructor(coreContext: CoreContext) {
    super(coreContext);
    const name = `${this.config.name} ${this.config.goToDockWord}`;
    this.service = new this.hap.Service.Switch(name, "Go To Dock Switch");
    ensureName(this.hap, this.service, name);
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => this.isReturning)
      .onSet((newState) => this.setGoToDock(newState));
  }

  public async init(): Promise<void> {
    // The state is refreshed on every poll
    this.deviceManager.stateChanged$
      .pipe(
        map(() => this.isReturning),
        distinctUntilChanged()
      )
      .subscribe((isReturning) => {
        this.service
          .getCharacteristic(this.hap.Characteristic.On)
          .updateValue(isReturning);
      });
  }

  public get services(): Service[] {
    return [this.service];
  }

  private get isReturning() {
    // Heading back to the dock, whatever for (charging, washing the mop, emptying the dust bin…)
    return vacuumActivity(this.deviceManager.state) === "returning";
  }

  private async setGoToDock(newState: CharacteristicValue) {
    await this.deviceManager.ensureDevice("setGoToDock");

    try {
      if (newState && !this.isReturning) {
        this.log.info(`ACT setGoToDock | Sending the robot to the dock.`);
        await this.deviceManager.device.activateCharging();
      } else if (!newState && this.isReturning) {
        this.log.info(
          `ACT setGoToDock | Stopping the robot on its way to the dock.`
        );
        await this.deviceManager.device.pause();
      }
    } catch (err) {
      this.log.error(
        `setGoToDock | Failed to send the robot to the dock.`,
        err
      );
      throw err;
    }
  }
}
