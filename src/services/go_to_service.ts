import { Service } from "homebridge";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";

export interface GoToConfig {
  goTo: boolean;
  goToWord: string;
  goToX: number;
  goToY: number;
}

export class GoToService extends PluginServiceClass {
  private readonly service: Service;
  constructor(coreContext: CoreContext) {
    super(coreContext);
    this.service = new this.hap.Service.Switch(
      `${this.config.name} ${this.config.goToWord}`,
      "GoTo Switch"
    );
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => this.getGoToState())
      .onSet((newState) => this.goTo(newState));
  }

  public async init(): Promise<void> {}

  public get services(): Service[] {
    return [this.service];
  }

  private async goTo(newState) {
    await this.deviceManager.ensureDevice("goTo");

    this.log.info(`ACT goTo | Let's go!`);
    try {
      if (newState) {
        //trigger go to location if newState is true
        await this.deviceManager.device.sendToLocation(
          this.config.goToX,
          this.config.goToY
        )
      } else if (!newState) {
        //trigger go to dock if newState is false
        await this.deviceManager.device.activateCharging()
      }
    } catch (err) {
      this.log.error(`goTo | `, err);
      throw err;
    }
  }

  private async getGoToState() {
    await this.deviceManager.ensureDevice("getGoToState");

    try {
      const goingToLocation = 
        this.deviceManager.state === "going-to-location" || this.deviceManager.state === "waiting";
      this.log.info(`getGoToState | Going to location or waiting is ${goingToLocation}`);
      return goingToLocation;
    } catch (err) {
      this.log.error(`getGoToState | Failed getting the cleaning status.`, err);
      throw err;
    }
  }    
}
