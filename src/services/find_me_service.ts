import { Service } from "homebridge";
import { CharacteristicValue } from "hap-nodejs/dist/types";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";

export interface FindMeConfig {
  findMe: boolean;
  findMeWord: string;
}

export class FindMeService extends PluginServiceClass {
  private readonly service?: Service;
  constructor(coreContext: CoreContext) {
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
  }
}
