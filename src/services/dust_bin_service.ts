import { Service } from "homebridge";
import { BehaviorSubject, distinct, filter } from "rxjs";
import { CoreContext } from "./types";
import { callbackify } from "../utils/callbackify";
import { PluginServiceClass } from "./plugin_service_class";
import { CharacteristicValue } from "hap-nodejs/dist/types";

export interface DustBinConfig {
  dustBin: boolean;
}

const DUST_BIN_FULL_ERROR_CODES = ["10"];

export class DustBinService extends PluginServiceClass {
  private readonly service: Service;
  private readonly state$ = new BehaviorSubject<boolean>(false);
  constructor(coreContext: CoreContext) {
    super(coreContext);

    this.service = new this.hap.Service.LockMechanism(
      `${this.config.name} Dust Bin Full`,
      "Dust Bin Full"
    );
    this.service
      .getCharacteristic(this.hap.Characteristic.LockTargetState)
      .on("get", (cb) => callbackify(() => this.getLockedState(), cb))
      .on("set", (value, cb) =>
        callbackify(() => this.setLockedState(value), cb)
      );
  }

  public async init(): Promise<void> {
    this.deviceManager.errorChanged$
      .pipe(
        filter(({ id }) => DUST_BIN_FULL_ERROR_CODES.includes(id)),
        distinct(({ description }) => description)
      )
      .subscribe(() => {
        this.state$.next(true);
        this.log.info(
          `The Dust Bin is full. Setting the dust bin indicator ON.`
        );
        this.service
          .getCharacteristic(this.hap.Characteristic.LockTargetState)
          .updateValue(this.hap.Characteristic.LockTargetState.SECURED);
      });
  }

  public get services(): Service[] {
    return [this.service];
  }

  private async getLockedState() {
    return this.state$.value
      ? this.hap.Characteristic.LockTargetState.SECURED
      : this.hap.Characteristic.LockTargetState.UNSECURED;
  }

  private async setLockedState(value: CharacteristicValue) {
    this.state$.next(value === this.hap.Characteristic.LockTargetState.SECURED);
    return value;
  }
}
