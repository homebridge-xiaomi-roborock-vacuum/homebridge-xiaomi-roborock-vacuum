import { Service } from "homebridge";
import { distinct, filter } from "rxjs";
import { cleaningStatuses } from "../utils/constants";
import { findSpeedModes } from "../utils/find_speed_modes";
import { callbackify } from "../utils/callbackify";
import { CoreContext } from "./types";
import type { RoomsService } from "./rooms_service";
import type { ProductInfo } from "./product_info";
import { PluginServiceClass } from "./plugin_service_class";

export interface MainServiceConfig {
  serviceType: "fan" | "switch";
}

export class MainService extends PluginServiceClass {
  public readonly cachedState = new Map<string, unknown>();
  private readonly service: Service;
  constructor(
    coreContext: CoreContext,
    private readonly productInfo: ProductInfo,
    private readonly roomsService: RoomsService,
    private readonly setWaterSpeed: (mode: string) => Promise<void>,
    private readonly changedPause: (isCleaning: boolean) => void
  ) {
    super(coreContext);
    if (this.config.serviceType === "fan") {
      this.service = new this.hap.Service.Fan(this.config.name, "Vacuum");
      this.service
        .getCharacteristic(this.hap.Characteristic.RotationSpeed)
        .on("get", (cb) => callbackify(() => this.getSpeed(), cb))
        .on("set", (newState, cb) =>
          callbackify(() => this.setSpeed(newState), cb)
        );
    } else {
      this.service = new this.hap.Service.Switch(this.config.name, "Vacuum");
    }

    if (this.service.setPrimaryService) this.service.setPrimaryService(true);

    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .on("get", (cb) => callbackify(() => this.getCleaning(), cb))
      .on("set", (newState, cb) =>
        callbackify(() => this.setCleaning(newState), cb)
      )
      .on("change", ({ newValue }) => {
        this.changedPause(newValue === true);
      });
  }

  public async init() {
    if (this.config.serviceType === "fan") {
      this.deviceManager.deviceConnected$.subscribe(() => {
        // Now that we know the model, amend the steps in the Rotation speed (for better usability)
        const minStep =
          100 / (findSpeedModes(this.deviceManager.model).speed.length - 1);
        this.service
          .getCharacteristic(this.hap.Characteristic.RotationSpeed)
          .setProps({ minStep: minStep });
      });

      this.deviceManager.stateChanged$
        .pipe(
          filter(({ key }) => key === "fanSpeed"),
          distinct(({ value }) => value)
        )
        .subscribe(({ value: speed }) => {
          this.log.info(`MON changedSpeed | FanSpeed is now ${speed}%`);
          const speedMode = this.findSpeedModeFromMiio(speed);

          if (typeof speedMode === "undefined") {
            this.log.warn(
              `WAR changedSpeed | Speed was changed to ${speed}%, this speed is not supported`
            );
          } else {
            const { homekitTopLevel, name } = speedMode;
            this.log.info(
              `changedSpeed | Speed was changed to ${speed}% (${name}), for HomeKit ${homekitTopLevel}%`
            );
            this.service
              .getCharacteristic(this.hap.Characteristic.RotationSpeed)
              .updateValue(homekitTopLevel);
          }
        });
    }

    this.deviceManager.stateChanged$
      .pipe(
        filter(({ key }) => key === "cleaning"),
        distinct(({ value }) => value)
      )
      .subscribe(({ value }) => {
        const isCleaning = value === true;
        this.log.debug(
          `MON changedCleaning | CleaningState is now ${isCleaning}`
        );
        this.log.info(
          `changedCleaning | Cleaning is ${isCleaning ? "ON" : "OFF"}.`
        );
        if (!isCleaning) {
          this.roomsService.roomIdsToClean.clear();
        }

        this.service
          .getCharacteristic(this.hap.Characteristic.On)
          .updateValue(isCleaning);
      });
  }

  get services() {
    return [this.service];
  }

  private get isPaused() {
    const isPaused = this.deviceManager.property("state") === "paused";
    return isPaused;
  }

  private get isCleaning() {
    const status = this.deviceManager.property("state");
    return cleaningStatuses.includes(`${status}`);
  }

  public async getCleaning() {
    try {
      const isCleaning = this.isCleaning;
      this.log.info(`getCleaning | Cleaning is ${isCleaning}`);

      return isCleaning;
    } catch (err) {
      this.log.error(`getCleaning | Failed getting the cleaning status.`, err);
      throw err;
    }
  }

  public async setCleaning(state) {
    await this.deviceManager.ensureDevice("setCleaning");
    this.log.info(`ACT setCleaning | Set cleaning to ${state}}`);
    try {
      if (state && !this.isCleaning) {
        // Start cleaning
        const roomIdsToClean = this.roomsService.roomIdsToClean;
        if (roomIdsToClean.size > 0) {
          await this.deviceManager.device.cleanRooms(
            Array.from(roomIdsToClean)
          );
          this.log.info(
            `ACT setCleaning | Start rooms cleaning for rooms ${Array.from(
              roomIdsToClean
            )}, device is in state ${this.deviceManager.property("state")}.`
          );
        } else {
          await this.deviceManager.device.activateCleaning();
          this.log.info(
            `ACT setCleaning | Start full cleaning, device is in state ${this.deviceManager.property(
              "state"
            )}.`
          );
        }
      } else if (!state && (this.isCleaning || this.isPaused)) {
        // Stop cleaning
        this.log.info(
          `ACT setCleaning | Stop cleaning and go to charge, device is in state ${this.deviceManager.property(
            "state"
          )}`
        );
        await this.deviceManager.device.activateCharging();
        this.roomsService.roomIdsToClean.clear();
      }
      return null;
    } catch (err) {
      this.log.error(`setCleaning | Failed to set cleaning to ${state}`, err);
      throw err;
    }
  }

  private async getSpeed() {
    await this.deviceManager.ensureDevice("getSpeed");

    const speed = await this.deviceManager.device.fanSpeed();
    this.log.info(
      `getSpeed | Fanspeed is ${speed} over miIO. Converting to HomeKit`
    );

    const { homekitTopLevel, name } = this.findSpeedModeFromMiio(speed) || {};

    this.log.info(
      `getSpeed | FanSpeed is ${speed} over miIO "${name}" > HomeKit speed ${homekitTopLevel}%`
    );

    return homekitTopLevel || 0;
  }

  public async setSpeed(speed) {
    await this.deviceManager.ensureDevice("setSpeed");

    if (typeof speed === "number") {
      this.log.debug(
        `ACT setSpeed | Speed got ${speed}% over HomeKit > CLEANUP.`
      );
    }

    // Get the speed modes for this model
    const speedModes = findSpeedModes(
      this.deviceManager.model,
      this.productInfo.firmware
    ).speed;

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
        this.log.info(`setSpeed | Mode "${speed}" does not exist.`);
        return null;
      }
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    }

    this.log.info(
      `ACT setSpeed | FanSpeed set to ${miLevel} over miIO for "${name}".`
    );

    // Save the latest set speed for handling the "custom" speed later
    this.cachedState.set("FanSpeed", miLevel);
    this.cachedState.set("FanSpeedName", name);

    if (miLevel === -1) {
      this.log.info(
        `setSpeed | FanSpeed is -1 => Calling setCleaning(false) instead of changing the fan speed`
      );
      await this.setCleaning(false);
    } else {
      await this.deviceManager.device.changeFanSpeed(miLevel);

      // If speed is "custom", also set the water speed to "custom" (for Xiaomi App)
      if (
        name === "Custom" &&
        this.config.waterBox &&
        this.cachedState.get("WaterSpeedName") !== "Custom"
      ) {
        await this.setWaterSpeed("Custom");
      }
      // If speed is not "custom" remove set the water speed also to a fixed value (for Xiaomi App)
      else if (
        name !== "Custom" &&
        this.config.waterBox &&
        this.cachedState.get("WaterSpeedName") === "Custom"
      ) {
        await this.setWaterSpeed("Medium");
      }
    }

    return null;
  }

  private findSpeedModeFromMiio(speed) {
    // Get the speed modes for this model
    const speedModes = findSpeedModes(
      this.deviceManager.model,
      this.productInfo.firmware
    ).speed;

    // Find speed mode that matches the miLevel
    return speedModes.find((mode) => mode.miLevel === speed);
  }
}
