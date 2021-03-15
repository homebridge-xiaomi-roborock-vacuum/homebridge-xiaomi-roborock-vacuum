import type {
  API,
  Logging,
  Service as ServiceType,
  Characteristic as CharacteristicType,
  AccessoryPlugin,
  AccessoryConfig,
} from "homebridge";

import { callbackify as callbackifyLib } from "./lib/callbackify";
import type { Config } from "./types";
import { XiaomiRoborockVacuum } from "./xiaomi_roborock_vacuum";

const noop = () => {};

let Service: typeof ServiceType;
let Characteristic: typeof CharacteristicType;

const PLUGIN_NAME = "homebridge-xiaomi-roborock-vacuum";
const ACCESSORY_NAME = "XiaomiRoborockVacuum";

export = (homebridge: API) => {
  // Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  // UUIDGen = homebridge.hap.uuid;

  homebridge.registerAccessory(
    PLUGIN_NAME,
    ACCESSORY_NAME,
    XiaomiRoborockVacuumPlugin
  );
};

class XiaomiRoborockVacuumPlugin implements AccessoryPlugin {
  private readonly device: XiaomiRoborockVacuum;
  private readonly services: Record<string, ServiceType> = {};
  constructor(
    private readonly log: Logging,
    private readonly config: Partial<Config>,
    private readonly api: API
  ) {
    // When the `silent` option is set, do not send debug and info logs
    if (this.config.silent) {
      this.log.debug = noop;
      this.log.info = noop;
    }

    this.applyDefaultConfig();
    this.validateConfig();

    // HOMEKIT SERVICES
    this.initialiseServices();

    // Initialize device
    this.device = new XiaomiRoborockVacuum(this.log, this.config);
    this.device.connect().catch(() => {
      // Do nothing in the catch because this function already logs the error internally and retries after 2 minutes.
    });
    this.device
      .on("model", (model) => {
        this.services.info.setCharacteristic(Characteristic.Model, model);
        // Now that we know the model, amend the steps in the Rotation speed (for better usability)
        const minStep = 100 / (this.device.speedmodes.speed.length - 1);
        this.services.fan
          .getCharacteristic(Characteristic.RotationSpeed)
          .setProps({ minStep: minStep });
      })
      .on("serial_number", (sn) =>
        this.services.info.setCharacteristic(
          Characteristic.SerialNumber,
          `${sn}`
        )
      )
      .on("firmware", (firmware) =>
        this.services.info.setCharacteristic(
          Characteristic.FirmwareRevision,
          `${firmware}`
        )
      )
      .on("changedCleaning", (isCleaning) => {
        // We still update the value in Homebridge. If we are calling the changed method is because we want to change it.
        this.services.fan
          .getCharacteristic(Characteristic.On)
          .updateValue(isCleaning);

        if (this.config.waterBox) {
          this.services.waterBox
            .getCharacteristic(Characteristic.On)
            .updateValue(isCleaning);
        }
      })
      .on("changedCharging", (isCharging) => this.changedCharging(isCharging));
  }

  private applyDefaultConfig() {
    this.config.name = this.config.name || "Roborock vacuum cleaner";
    this.config.cleanword = this.config.cleanword || "cleaning";
    this.config.pause = this.config.pause || false;
    this.config.pauseWord = this.config.pauseWord || "Pause";
    this.config.findMe = this.config.findMe || false;
    this.config.findMeWord = this.config.findMeWord || "where are you";
    this.config.roomTimeout = this.config.roomTimeout ?? 0;
  }
  private validateConfig() {
    if (!this.config.ip) {
      throw new Error("You must provide an ip address of the vacuum cleaner.");
    }

    if (!this.config.token) {
      throw new Error("You must provide a token of the vacuum cleaner.");
    }

    if (this.config.rooms && this.config.autoroom) {
      throw new Error(`Both "autoroom" and "rooms" config options can't be used at the same time.\n
      Please, use "autoroom" to retrieve the "rooms" config and remove it when not needed.`);
    }
  }

  public initialiseServices() {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify: typeof callbackifyLib = async (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.services.info = new Service.AccessoryInformation();
    this.services.info
      .setCharacteristic(Characteristic.Manufacturer, "Xiaomi")
      .setCharacteristic(Characteristic.Model, "Roborock");
    this.services.info
      .getCharacteristic(Characteristic.FirmwareRevision)
      .on("get", (cb) => callbackify(() => this.device.getFirmware(), cb));
    this.services.info
      .getCharacteristic(Characteristic.Model)
      .on("get", (cb) => callbackify(() => this.device.model, cb));
    this.services.info
      .getCharacteristic(Characteristic.SerialNumber)
      .on("get", (cb) => callbackify(() => this.device.getSerialNumber(), cb));

    this.services.fan = new Service.Fan(this.config.name, "Speed");
    if (this.services.fan.setPrimaryService) {
      this.services.fan.setPrimaryService(true);
    }
    this.services.fan
      .getCharacteristic(Characteristic.On)
      .on("get", (cb) => callbackify(() => this.getCleaning(), cb))
      .on("set", (newState, cb) =>
        callbackify(async () => {
          await this.device.setCleaning(newState === true);
          return newState;
        }, cb)
      )
      .on("change", ({ newValue }) => {
        this.changedPause(newValue === true);
      });
    this.services.fan
      .getCharacteristic(Characteristic.RotationSpeed)
      .on("get", (cb) => callbackify(() => this.getSpeed(), cb))
      .on("set", (newState, cb) =>
        callbackify(async () => {
          await this.device.setSpeed(newState);
          return newState;
        }, cb)
      );

    if (this.config.waterBox) {
      this.services.waterBox = new Service.Fan(
        `${this.config.name} Water Box`,
        "Water Box"
      );
      this.services.waterBox
        .getCharacteristic(Characteristic.RotationSpeed)
        .on("get", (cb) => callbackify(() => this.getWaterSpeed(), cb))
        .on("set", (newState, cb) =>
          callbackify(async () => {
            await this.device.setWaterSpeed(newState);
            return newState;
          }, cb)
        );
      // We need to handle the ON/OFF characteristic (https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/284)
      this.services.waterBox
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) =>
          // If the speed is over 0%, assume it's ON
          callbackify(async () => (await this.device.getWaterSpeed()) > 0, cb)
        )
        .on("set", (newState, cb) =>
          callbackify(async () => {
            // Set to 0% (Off) when receiving an OFF request, do nothing otherwise.
            if (!newState) {
              await this.device.setCleaning(0);
            }
            return newState;
          }, cb)
        );
    }

    this.services.battery = new Service.BatteryService(
      `${this.config.name} Battery`
    );
    this.services.battery
      .getCharacteristic(Characteristic.BatteryLevel)
      .on("get", (cb) => callbackify(() => this.device.getBattery(), cb));
    this.services.battery
      .getCharacteristic(Characteristic.ChargingState)
      .on("get", (cb) => callbackify(() => this.getCharging(), cb));
    this.services.battery
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on("get", (cb) => callbackify(() => this.getBatteryLow(), cb));

    if (this.config.pause) {
      this.services.pause = new Service.Switch(
        `${this.config.name} ${this.config.pauseWord}`,
        "Pause Switch"
      );
      this.services.pause
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) => callbackify(() => this.device.getPauseState(), cb))
        .on("set", (newState, cb) =>
          callbackify(() => this.device.setPauseState(newState === true), cb)
        );
    }

    if (this.config.findMe) {
      this.services.findMe = new Service.Switch(
        `${this.config.name} ${this.config.findMeWord}`,
        "FindMe Switch"
      );
      this.services.findMe
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) => callbackify(() => false, cb))
        .on("set", (newState, cb) => this.identify(cb));
    }

    if (this.config.dock) {
      this.services.dock = new Service.OccupancySensor(
        `${this.config.name} Dock`
      );
      this.services.dock
        .getCharacteristic(Characteristic.OccupancyDetected)
        .on("get", (cb) => callbackify(() => this.getDocked(), cb));
    }

    if (this.config.rooms && !this.config.autoroom) {
      for (const i in this.config.rooms) {
        this.createRoom(this.config.rooms[i].id, this.config.rooms[i].name);
      }
    }

    // Declare services for rooms in advance, so HomeKit can create the switches
    if (this.config.autoroom && Array.isArray(this.config.autoroom)) {
      for (const i in this.config.autoroom) {
        // Index will be overwritten, when robot is available
        this.createRoom(i, this.config.autoroom[i]);
      }
    }

    if (this.config.zones) {
      for (const i in this.config.zones) {
        this.createZone(this.config.zones[i].name, this.config.zones[i].zone);
      }
    }

    // ADDITIONAL HOMEKIT SERVICES
    this.initialiseCareServices();
  }

  public initialiseCareServices() {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify: typeof callbackifyLib = async (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.services.fan
      .getCharacteristic(Characteristic.FilterChangeIndication)
      .on("get", (cb) =>
        callbackify(async () => {
          const carePercentages = await Promise.all([
            this.device.getCareSensors(),
            this.device.getCareFilter(),
            this.device.getCareSideBrush(),
          ]);
          return carePercentages.some((item) => item >= 100);
        }, cb)
      );
    this.services.fan
      .getCharacteristic(Characteristic.FilterLifeLevel)
      .on("get", (cb) =>
        callbackify(async () => {
          const carePercentages = await Promise.all([
            this.device.getCareSensors(),
            this.device.getCareFilter(),
            this.device.getCareSideBrush(),
          ]);
          return 100 - Math.max(...carePercentages);
        }, cb)
      );

    // Use Homekit's native FilterMaintenance Service
    this.services.CareSensors = new Service.FilterMaintenance(
      "Care indicator sensors",
      "sensors"
    );
    this.services.CareSensors.getCharacteristic(
      Characteristic.FilterChangeIndication
    ).on("get", (cb) =>
      callbackify(async () => {
        return (await this.device.getCareSensors()) >= 100;
      }, cb)
    );
    this.services.CareSensors.getCharacteristic(
      Characteristic.FilterLifeLevel
    ).on("get", (cb) =>
      callbackify(async () => 100 - (await this.device.getCareSensors()), cb)
    );

    this.services.CareFilter = new Service.FilterMaintenance(
      "Care indicator filter",
      "filter"
    );
    this.services.CareFilter.getCharacteristic(
      Characteristic.FilterChangeIndication
    ).on("get", (cb) =>
      callbackify(async () => {
        return (await this.device.getCareFilter()) >= 100;
      }, cb)
    );
    this.services.CareFilter.getCharacteristic(
      Characteristic.FilterLifeLevel
    ).on("get", (cb) =>
      callbackify(async () => 100 - (await this.device.getCareFilter()), cb)
    );

    this.services.CareSideBrush = new Service.FilterMaintenance(
      "Care indicator side brush",
      "side brush"
    );
    this.services.CareSideBrush.getCharacteristic(
      Characteristic.FilterChangeIndication
    ).on("get", (cb) =>
      callbackify(async () => {
        return (await this.device.getCareSideBrush()) >= 100;
      }, cb)
    );
    this.services.CareSideBrush.getCharacteristic(
      Characteristic.FilterLifeLevel
    ).on("get", (cb) =>
      callbackify(async () => 100 - (await this.device.getCareSideBrush()), cb)
    );

    this.services.CareMainBrush = new Service.FilterMaintenance(
      "Care indicator main brush",
      "main brush"
    );
    this.services.CareMainBrush.getCharacteristic(
      Characteristic.FilterChangeIndication
    ).on("get", (cb) =>
      callbackify(async () => {
        return (await this.device.getCareMainBrush()) >= 100;
      }, cb)
    );
    this.services.CareMainBrush.getCharacteristic(
      Characteristic.FilterLifeLevel
    ).on("get", (cb) =>
      callbackify(async () => 100 - (await this.device.getCareMainBrush()), cb)
    );
  }

  changedPause(newValue: boolean) {
    const isCleaning = newValue === true;
    if (this.config.pause) {
      if (this.device.isNewValue("pause", isCleaning)) {
        this.log.debug(
          `MON changedPause | ${this.device.model} | CleaningState is now ${isCleaning}`
        );
        this.log.info(
          `INF changedPause | ${this.device.model} | ${
            isCleaning ? "Paused possible" : "Paused not possible, no cleaning"
          }`
        );
      }
      // We still update the value in Homebridge. If we are calling the changed method is because we want to change it.
      this.services.pause
        .getCharacteristic(Characteristic.On)
        .updateValue(isCleaning);

      if (this.config.waterBox) {
        this.services.waterBox
          .getCharacteristic(Characteristic.On)
          .updateValue(isCleaning);
      }
    }
  }

  changedCharging(isCharging: boolean) {
    const isNewValue = this.device.isNewValue("charging", isCharging);
    if (isNewValue) {
      this.log.info(
        `MON changedCharging | ${this.device.model} | ChargingState is now ${isCharging}`
      );
      this.log.info(
        `INF changedCharging | ${this.device.model} | Charging is ${
          isCharging ? "active" : "cancelled"
        }`
      );
    }
    // We still update the value in Homebridge. If we are calling the changed method is because we want to change it.
    this.services.battery
      .getCharacteristic(Characteristic.ChargingState)
      .updateValue(
        isCharging
          ? Characteristic.ChargingState.CHARGING
          : Characteristic.ChargingState.NOT_CHARGING
      );
    if (this.config.dock) {
      if (isNewValue) {
        const msg = isCharging
          ? "Robot was docked"
          : "Robot not anymore in dock";
        this.log.info(`INF changedCharging | ${this.device.model} | ${msg}.`);
      }
      this.services.dock
        .getCharacteristic(Characteristic.OccupancyDetected)
        .updateValue(isCharging);
    }
  }

  changedSpeed(speed: number) {
    const isNewValue = this.device.isNewValue("speed", speed);
    if (isNewValue) {
      this.log.info(
        `MON changedSpeed | ${this.device.model} | FanSpeed is now ${speed}%`
      );
    }

    const speedMode = this.device.findSpeedModeFromMiio(speed);

    if (typeof speedMode === "undefined") {
      this.log.warn(
        `WAR changedSpeed | ${this.device.model} | Speed was changed to ${speed}%, this speed is not supported`
      );
    } else {
      const { homekitTopLevel, name } = speedMode;
      if (isNewValue) {
        this.log.info(
          `INF changedSpeed | ${this.device.model} | Speed was changed to ${speed}% (${name}), for HomeKit ${homekitTopLevel}%`
        );
      }
      this.services.fan
        .getCharacteristic(Characteristic.RotationSpeed)
        .updateValue(homekitTopLevel);
    }
  }

  private changedBattery(level: number) {
    this.log.debug(
      `DEB changedBattery | ${this.device.model} | BatteryLevel ${level}%`
    );
    this.services.battery
      .getCharacteristic(Characteristic.BatteryLevel)
      .updateValue(level);
    this.services.battery
      .getCharacteristic(Characteristic.StatusLowBattery)
      .updateValue(
        level < 20
          ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
  }

  private async getCharging() {
    const isCharging = this.device.getCharging();
    return isCharging
      ? Characteristic.ChargingState.CHARGING
      : Characteristic.ChargingState.NOT_CHARGING;
  }

  private async getBatteryLow() {
    const batteryLevel = await this.device.getBattery();
    return batteryLevel < 20
      ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  public async identify() {
    await this.device.identify();
  }

  public getServices() {
    this.log.debug(`DEB getServices | ${this.device.model}`);
    return Object.keys(this.services).reduce((services, key) => {
      let currentServices: ServiceType[] = [];

      if (key === "rooms") {
        currentServices = Object.values(this.services[key]);
      } else {
        currentServices = [this.services[key]];
      }

      if (key !== "fan" && this.services.fan.addLinkedService) {
        let fanService = this.services.fan;
        currentServices.forEach((currentService) => {
          fanService.addLinkedService(currentService);
        });
      }

      services = services.concat(currentServices);
      return services;
    }, new Array<ServiceType>());
  }
}
