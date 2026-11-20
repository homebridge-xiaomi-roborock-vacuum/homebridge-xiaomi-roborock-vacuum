import { Service, CharacteristicValue } from "homebridge";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";

export interface FindMeConfig {
  findMe: boolean;
  findMeWord: string;
}

export class FindMeService extends PluginServiceClass {
  private readonly service?: Service;
  constructor(
    coreContext: CoreContext,
    /** Called after the robot says hello (e.g. to log its position) */
    private readonly afterFind?: () => Promise<void>
  ) {
    super(coreContext);
    if (this.config.findMe) {
      const name = `${this.config.name} ${this.config.findMeWord}`;
      this.service = new this.hap.Service.Switch(name, "FindMe Switch");
      ensureName(this.hap, this.service, name);
      this.service
        .getCharacteristic(this.hap.Characteristic.On)
        .onGet(() => false)
        .onSet((newState) => this.identify(newState));
    }
  }

  public async init(): Promise<void> {}

  public get services(): Service[] {
    return this.service ? [this.service] : [];
  }

  public async identify(newState: CharacteristicValue) {
    await this.deviceManager.ensureDevice("identify");

    this.log.info(`ACT identify | Find me - Hello!`);
    try {
      await this.deviceManager.device.find();
    } catch (err) {
      this.log.error(`identify | `, err);
      throw err;
    }
    await this.afterFind?.().catch((err) =>
      this.log.debug(
        `DEB identify | Failed to get the robot's position: ${err}`
      )
    );
  }
}
