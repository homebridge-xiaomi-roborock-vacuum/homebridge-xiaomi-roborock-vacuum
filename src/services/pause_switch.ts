import { Service } from "homebridge";
import { distinct, filter } from "rxjs";
import { CoreContext } from "./types";
import { RoomsService } from "./rooms_service";
import { PluginServiceClass } from "./plugin_service_class";

export interface PauseConfig {
  pause: boolean;
  pauseWord: string;
}

export class PauseSwitch extends PluginServiceClass {
  private readonly service: Service;
  constructor(
    coreContext: CoreContext,
    private readonly roomsService: RoomsService
  ) {
    super(coreContext);
    this.service = new this.hap.Service.Switch(
      `${this.config.name} ${this.config.pauseWord}`,
      "Pause Switch"
    );
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => this.getPauseState())
      .onSet((newState) => this.setPauseState(newState));
  }

  public async init(): Promise<void> {
    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "cleaning"),
        distinct(({ value }) => value)
      )
      .subscribe(({ value }) => this.changedPause(value));
  }

  public get services(): Service[] {
    return [this.service];
  }

  public changedPause(isCleaning) {
    this.log.debug(`MON changedPause | CleaningState is now ${isCleaning}`);
    this.log.info(
      `changedPause | ${
        isCleaning ? "Paused possible" : "Paused not possible, no cleaning"
      }`
    );
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .updateValue(isCleaning === true);
  }

  private async getPauseState() {
    await this.deviceManager.ensureDevice("getPauseState");

    try {
      const isPaused = this.deviceManager.isPaused;
      const canBePaused = this.deviceManager.isCleaning && !isPaused;
      this.log.info(`getPauseState | Pause possible is ${canBePaused}`);
      return canBePaused;
    } catch (err) {
      this.log.error(
        `getPauseState | Failed getting the cleaning status.`,
        err
      );
      throw err;
    }
  }

  private async setPauseState(state) {
    await this.deviceManager.ensureDevice("setPauseState");

    try {
      if (state && this.deviceManager.isPaused) {
        if (this.roomsService.roomIdsToClean.size > 0) {
          await this.deviceManager.device.resumeCleanRooms(
            Array.from(this.roomsService.roomIdsToClean)
          );
          this.log.info(
            `setPauseState | Resume room cleaning, and the device is in state  ${this.deviceManager.state}`
          );
        } else {
          await this.deviceManager.device.activateCleaning();
          this.log.info(
            `setPauseState | Resume normal cleaning, and the device is in state ${this.deviceManager.state}`
          );
        }
      } else if (!state && this.deviceManager.isCleaning) {
        await this.deviceManager.device.pause();
        this.log.info(
          `setPauseState | Pause cleaning, and the device is in state ${this.deviceManager.state}`
        );
      }
    } catch (err) {
      this.log.error(
        `setPauseState | Failed updating pause state ${state}.`,
        err
      );
    }
  }
}
