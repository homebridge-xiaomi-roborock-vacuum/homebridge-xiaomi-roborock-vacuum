import { PluginService } from "./types";
import { HAP, Service } from "homebridge";
import { Logger } from "../utils/logger";
import { Config } from "./config_service";
import { DeviceManager } from "./device_manager";
import { callbackify } from "../utils/callbackify";
import { findSpeedModes } from "../utils/find_speed_modes";
import { ProductInfo } from "./product_info";
import { FanService } from "./fan_service";
import { distinct, filter } from "rxjs";

export class WaterBoxService implements PluginService {
  private readonly service: Service;
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly config: Config,
    private readonly deviceManager: DeviceManager,
    private readonly cachedState: Map<string, unknown>,
    private readonly productInfo: ProductInfo,
    private readonly fanService: FanService
  ) {
    this.service = new hap.Service.Fan(
      `${this.config.name} Water Box`,
      "Water Box"
    );
    this.service
      .getCharacteristic(hap.Characteristic.RotationSpeed)
      .on("get", (cb) => callbackify(() => this.getWaterSpeed(), cb))
      .on("set", (newState, cb) =>
        callbackify(() => this.setWaterSpeed(newState), cb)
      );
    // We need to handle the ON/OFF characteristic (https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/284)
    this.service
      .getCharacteristic(hap.Characteristic.On)
      .on("get", (cb) =>
        // If the speed is over 0%, assume it's ON
        callbackify(async () => (await this.getWaterSpeed()) > 0, cb)
      )
      .on("set", (newState, cb) =>
        callbackify(async () => {
          // Set to 0% (Off) when receiving an OFF request, do nothing otherwise.
          if (!newState) {
            await this.fanService.setCleaning(false);
          }
          return newState;
        }, cb)
      );
  }

  public async init(): Promise<void> {
    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "cleaning"),
        distinct(({ value }) => value)
      )
      .subscribe(({ value: isCleaning }) => {
        this.service
          .getCharacteristic(this.hap.Characteristic.On)
          .updateValue(isCleaning as boolean);
      });

    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "water_box_mode"),
        distinct(({ value }) => value)
      )
      .subscribe(({ value: speed }) => {
        this.log.info(`MON changedWaterSpeed | WaterBoxMode is now ${speed}%`);

        const speedMode = this.findWaterSpeedModeFromMiio(speed);

        if (typeof speedMode === "undefined") {
          this.log.warn(
            `WAR changedWaterSpeed | Speed was changed to ${speed}%, this speed is not supported`
          );
        } else {
          const { homekitTopLevel, name } = speedMode;
          this.log.info(
            `changedWaterSpeed | Speed was changed to ${speed}% (${name}), for HomeKit ${homekitTopLevel}%`
          );
          this.service
            .getCharacteristic(this.hap.Characteristic.RotationSpeed)
            .updateValue(homekitTopLevel);
          this.service
            .getCharacteristic(this.hap.Characteristic.On)
            .updateValue(homekitTopLevel > 0);
        }
      });
  }

  public get services() {
    return [this.service];
  }

  public async setWaterSpeed(speed) {
    await this.deviceManager.ensureDevice("setWaterSpeed");

    if (typeof speed === "number") {
      this.log.debug(
        `ACT setWaterSpeed | Speed got ${speed}% over HomeKit > CLEANUP.`
      );
    }

    // Get the speed modes for this model
    const speedModes =
      findSpeedModes(this.deviceManager.model, this.productInfo.firmware)
        .waterspeed || [];

    // If the robot does not support water-mode cleaning
    if (speedModes.length === 0) {
      this.log.info(`setWaterSpeed | Model does not support the water mode`);
      return;
    }

    let miLevel: number | null = null;
    let name: string | null = null;

    if (typeof speed === "number") {
      // Speed set by number
      // gen1 has maximum of 91%, so anything over that won't work. Getting safety maximum.
      const safeSpeed = Math.min(
        speed,
        speedModes[speedModes.length - 1].homekitTopLevel
      );

      // Find the minimum homekitTopLevel that matches the desired speed
      const speedMode = speedModes.find(
        (mode) => safeSpeed <= mode.homekitTopLevel
      )!;
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    } else {
      // Set by mode name
      const speedMode = speedModes.find((mode) => mode.name === speed);

      if (speedMode == null) {
        this.log.info(`setWaterSpeed | Mode "${speed}" does not exist.`);
        return;
      }
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    }

    this.log.info(
      `ACT setWaterSpeed | WaterBoxMode set to ${miLevel} over miIO for "${name}".`
    );

    // Save the latest set speed for handling the "custom" speed later
    this.cachedState.set("WaterSpeed", miLevel);
    this.cachedState.set("WaterSpeedName", name);

    await this.deviceManager.device.setWaterBoxMode(miLevel);

    // If speed is "custom", also set the water speed to "custom" (for Xiaomi App)
    if (
      name === "Custom" &&
      this.cachedState.get("FanSpeedName") !== "Custom"
    ) {
      await this.fanService.setSpeed("Custom");
    }
    // If speed is not "custom" remove set the water speed also to a fixed value (for Xiaomi App)
    else if (
      name !== "Custom" &&
      this.cachedState.get("FanSpeedName") === "Custom"
    ) {
      await this.fanService.setSpeed("Balanced");
    }

    return speed;
  }

  private async getWaterSpeed() {
    await this.deviceManager.ensureDevice("getWaterSpeed");

    const speed = await this.deviceManager.device.getWaterBoxMode();
    this.log.info(
      `getWaterSpeed | WaterBoxMode is ${speed} over miIO. Converting to HomeKit`
    );

    const waterSpeed = this.findWaterSpeedModeFromMiio(speed);

    let homekitValue = 0;
    if (waterSpeed) {
      const { homekitTopLevel, name } = waterSpeed;
      this.log.info(
        `getWaterSpeed | WaterBoxMode is ${speed} over miIO "${name}" > HomeKit speed ${homekitTopLevel}%`
      );
      homekitValue = homekitTopLevel || 0;
    }
    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .updateValue(homekitValue > 0);
    return homekitValue;
  }

  private findWaterSpeedModeFromMiio(speed) {
    // Get the speed modes for this model
    const speedModes =
      findSpeedModes(this.deviceManager.model, this.productInfo.firmware)
        .waterspeed || [];

    // Find speed mode that matches the miLevel
    return speedModes.find((mode) => mode.miLevel === speed);
  }
}
