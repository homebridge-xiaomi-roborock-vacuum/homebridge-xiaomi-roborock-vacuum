import { HAP, Service } from "homebridge";
import { Logger } from "../utils/logger";
import { callbackify } from "../utils/callbackify";
import { PluginService } from "./types";
import { DeviceManager } from "./device_manager";
import { Config } from "./config_service";

export class BatteryInfo implements PluginService {
  private readonly service: Service;
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly config: Config,
    private readonly deviceManager: DeviceManager,
    private readonly cachedState: Map<string, unknown>
  ) {
    this.service = new hap.Service.BatteryService(
      `${this.config.name} Battery`
    );
    this.service
      .getCharacteristic(hap.Characteristic.BatteryLevel)
      .on("get", (cb) => callbackify(() => this.getBattery(), cb));
    this.service
      .getCharacteristic(hap.Characteristic.ChargingState)
      .on("get", (cb) => callbackify(() => this.getCharging(), cb));
    this.service
      .getCharacteristic(hap.Characteristic.StatusLowBattery)
      .on("get", (cb) => callbackify(() => this.getBatteryLow(), cb));
  }

  public async init(): Promise<void> {
    this.deviceManager.stateChanged$.subscribe(({ key, value }) => {
      if (key === "batteryLevel") {
        this.changedBattery(value as number);
      } else if (key === "charging") {
      }
    });
  }

  public get services() {
    return [this.service];
  }

  private changedBattery(level: number) {
    this.log.debug(`DEB changedBattery | BatteryLevel ${level}%`);
    this.service
      .getCharacteristic(this.hap.Characteristic.BatteryLevel)
      .updateValue(level);
    this.service
      .getCharacteristic(this.hap.Characteristic.StatusLowBattery)
      .updateValue(
        level < 20
          ? this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
  }

  private changedCharging(isCharging) {
    const isNewValue = this.isNewValue("charging", isCharging);
    if (isNewValue) {
      this.log.info(`MON changedCharging | ChargingState is now ${isCharging}`);
      this.log.info(
        `changedCharging | Charging is ${isCharging ? "active" : "cancelled"}`
      );
    }
    // We still update the value in Homebridge. If we are calling the changed method is because we want to change it.
    this.service
      .getCharacteristic(this.hap.Characteristic.ChargingState)
      .updateValue(
        isCharging
          ? this.hap.Characteristic.ChargingState.CHARGING
          : this.hap.Characteristic.ChargingState.NOT_CHARGING
      );
  }

  private async getBattery() {
    const batteryLevel = await this.deviceManager.device.batteryLevel();
    this.log.info(`getBattery | BatteryLevel is ${batteryLevel}%`);
    return batteryLevel;
  }

  private async getBatteryLow() {
    const batteryLevel = await this.deviceManager.device.batteryLevel();
    this.log.info(`getBatteryLow | BatteryLevel is ${batteryLevel}%`);
    return batteryLevel < 20
      ? this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  private async getCharging() {
    const status = this.deviceManager.property("state");
    const isCharging = status === "charging";
    this.log.info(
      `getCharging | Charging is ${isCharging} (Status is ${status})`
    );

    return isCharging
      ? this.hap.Characteristic.ChargingState.CHARGING
      : this.hap.Characteristic.ChargingState.NOT_CHARGING;
  }

  /**
   * Returns if the newValue is different to the previously cached one
   *
   * @param {string} property
   * @param {any} newValue
   * @returns {boolean} Whether the newValue is not the same as the previously cached one.
   */
  private isNewValue(property, newValue) {
    const cachedValue = this.cachedState.get(property);
    this.cachedState.set(property, newValue);
    return cachedValue !== newValue;
  }
}
