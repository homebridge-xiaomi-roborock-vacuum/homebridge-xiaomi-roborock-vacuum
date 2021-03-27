import type {
  API,
  Logging,
  Service as ServiceType,
  AccessoryPlugin,
} from "homebridge";

import { callbackify as callbackifyLib } from "./lib/callbackify";
import type { Config, ConfigZone } from "./types";
import { XiaomiRoborockVacuum } from "./xiaomi_roborock_vacuum";
import { RoomSwitch } from "./services/room_switch";

const noop = () => {};

const PLUGIN_NAME = "homebridge-xiaomi-roborock-vacuum";
const ACCESSORY_NAME = "XiaomiRoborockVacuum";

export = (homebridge: API) => {
  homebridge.registerAccessory(
    PLUGIN_NAME,
    ACCESSORY_NAME,
    XiaomiRoborockVacuumPlugin
  );
};

type Services = Record<string, ServiceType> & {
  rooms?: Record<string, RoomSwitch>;
};

class XiaomiRoborockVacuumPlugin implements AccessoryPlugin {
  private readonly device: XiaomiRoborockVacuum;
  private readonly services: Services = {};
  private roomTimeout = setTimeout(noop, 100);

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
    this.initialiseDevice();
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

  private initialiseDevice() {
    this.device.connect().catch(() => {
      // Do nothing in the catch because this function already logs the error internally and retries after 2 minutes.
    });
    this.device
      .on("model", async (model) => {
        this.services.info.setCharacteristic(
          this.api.hap.Characteristic.Model,
          model
        );
        // Now that we know the model, amend the steps in the Rotation speed (for better usability)
        const minStep = 100 / (this.device.speedmodes.speed.length - 1);
        this.services.fan
          .getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
          .setProps({ minStep: minStep });

        // Init steps after connection
        if (this.config.autoroom) {
          if (Array.isArray(this.config.autoroom)) {
            await this.getRoomList();
          } else {
            await this.getRoomMap();
          }
        }
      })
      .on("serial_number", (sn) =>
        this.services.info.setCharacteristic(
          this.api.hap.Characteristic.SerialNumber,
          `${sn}`
        )
      )
      .on("firmware", (firmware) =>
        this.services.info.setCharacteristic(
          this.api.hap.Characteristic.FirmwareRevision,
          `${firmware}`
        )
      )
      .on("changedSpeed", (speed) => this.changedSpeed(speed))
      .on("changedWaterSpeed", (speed) => this.changedWaterSpeed(speed))
      .on("changedCleaning", (isCleaning) => {
        this.services.fan
          .getCharacteristic(this.api.hap.Characteristic.On)
          .updateValue(isCleaning);

        this.changedPause(isCleaning);

        if (this.config.waterBox) {
          this.services.waterBox
            .getCharacteristic(this.api.hap.Characteristic.On)
            .updateValue(isCleaning);
        }
      })
      .on("changedCharging", ({ isCharging, isNewValue }) =>
        this.changedCharging(isCharging, isNewValue)
      )
      .on("changedBatteryLevel", (level) => this.changedBattery(level));
  }

  private initialiseServices() {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify: typeof callbackifyLib = async (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.services.info = new this.api.hap.Service.AccessoryInformation();
    this.services.info
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "Xiaomi")
      .setCharacteristic(this.api.hap.Characteristic.Model, "Roborock");
    this.services.info
      .getCharacteristic(this.api.hap.Characteristic.FirmwareRevision)
      .on("get", (cb) => callbackify(() => this.device.getFirmware(), cb));
    this.services.info
      .getCharacteristic(this.api.hap.Characteristic.Model)
      .on("get", (cb) => callbackify(() => this.device.model, cb));
    this.services.info
      .getCharacteristic(this.api.hap.Characteristic.SerialNumber)
      .on("get", (cb) => callbackify(() => this.device.getSerialNumber(), cb));

    this.services.fan = new this.api.hap.Service.Fan(this.config.name, "Speed");
    if (this.services.fan.setPrimaryService) {
      this.services.fan.setPrimaryService(true);
    }
    this.services.fan
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on("get", (cb) => callbackify(() => this.device.getCleaning(), cb))
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
      .getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
      .on("get", (cb) => callbackify(() => this.device.getSpeed(), cb))
      .on("set", (newState, cb) =>
        callbackify(async () => {
          await this.device.setSpeed(newState as string | number);
          return newState;
        }, cb)
      );

    if (this.config.waterBox) {
      this.services.waterBox = new this.api.hap.Service.Fan(
        `${this.config.name} Water Box`,
        "Water Box"
      );
      this.services.waterBox
        .getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
        .on("get", (cb) => callbackify(() => this.device.getWaterSpeed(), cb))
        .on("set", (newState, cb) =>
          callbackify(async () => {
            await this.device.setWaterSpeed(newState as string | number);
            return newState;
          }, cb)
        );
      // We need to handle the ON/OFF characteristic (https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/284)
      this.services.waterBox
        .getCharacteristic(this.api.hap.Characteristic.On)
        .on("get", (cb) =>
          // If the speed is over 0%, assume it's ON
          callbackify(async () => (await this.device.getWaterSpeed()) > 0, cb)
        )
        .on("set", (newState, cb) =>
          callbackify(async () => {
            // Set to 0% (Off) when receiving an OFF request, do nothing otherwise.
            if (!newState) {
              await this.device.setCleaning(false);
            }
            return newState;
          }, cb)
        );
    }

    this.services.battery = new this.api.hap.Service.BatteryService(
      `${this.config.name} Battery`
    );
    this.services.battery
      .getCharacteristic(this.api.hap.Characteristic.BatteryLevel)
      .on("get", (cb) => callbackify(() => this.device.getBattery(), cb));
    this.services.battery
      .getCharacteristic(this.api.hap.Characteristic.ChargingState)
      .on("get", (cb) => callbackify(() => this.getCharging(), cb));
    this.services.battery
      .getCharacteristic(this.api.hap.Characteristic.StatusLowBattery)
      .on("get", (cb) => callbackify(() => this.getBatteryLow(), cb));

    if (this.config.pause) {
      this.services.pause = new this.api.hap.Service.Switch(
        `${this.config.name} ${this.config.pauseWord}`,
        "Pause Switch"
      );
      this.services.pause
        .getCharacteristic(this.api.hap.Characteristic.On)
        .on("get", (cb) => callbackify(() => this.device.getPauseState(), cb))
        .on("set", (newState, cb) =>
          callbackify(() => this.device.setPauseState(newState === true), cb)
        );
    }

    if (this.config.findMe) {
      this.services.findMe = new this.api.hap.Service.Switch(
        `${this.config.name} ${this.config.findMeWord}`,
        "FindMe Switch"
      );
      this.services.findMe
        .getCharacteristic(this.api.hap.Characteristic.On)
        .on("get", (cb) => callbackify(() => false, cb))
        .on("set", (newState, cb) =>
          callbackify(async () => {
            await this.identify();
            return false;
          }, cb)
        );
    }

    if (this.config.dock) {
      this.services.dock = new this.api.hap.Service.OccupancySensor(
        `${this.config.name} Dock`
      );
      this.services.dock
        .getCharacteristic(this.api.hap.Characteristic.OccupancyDetected)
        .on("get", (cb) => callbackify(() => this.device.getDocked(), cb));
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

  private initialiseCareServices() {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify: typeof callbackifyLib = async (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.services.fan
      .getCharacteristic(this.api.hap.Characteristic.FilterChangeIndication)
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
      .getCharacteristic(this.api.hap.Characteristic.FilterLifeLevel)
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
    this.services.CareSensors = new this.api.hap.Service.FilterMaintenance(
      "Care indicator sensors",
      "sensors"
    );
    this.services.CareSensors.getCharacteristic(
      this.api.hap.Characteristic.FilterChangeIndication
    ).on("get", (cb) =>
      callbackify(async () => {
        return (await this.device.getCareSensors()) >= 100;
      }, cb)
    );
    this.services.CareSensors.getCharacteristic(
      this.api.hap.Characteristic.FilterLifeLevel
    ).on("get", (cb) =>
      callbackify(async () => 100 - (await this.device.getCareSensors()), cb)
    );

    this.services.CareFilter = new this.api.hap.Service.FilterMaintenance(
      "Care indicator filter",
      "filter"
    );
    this.services.CareFilter.getCharacteristic(
      this.api.hap.Characteristic.FilterChangeIndication
    ).on("get", (cb) =>
      callbackify(async () => {
        return (await this.device.getCareFilter()) >= 100;
      }, cb)
    );
    this.services.CareFilter.getCharacteristic(
      this.api.hap.Characteristic.FilterLifeLevel
    ).on("get", (cb) =>
      callbackify(async () => 100 - (await this.device.getCareFilter()), cb)
    );

    this.services.CareSideBrush = new this.api.hap.Service.FilterMaintenance(
      "Care indicator side brush",
      "side brush"
    );
    this.services.CareSideBrush.getCharacteristic(
      this.api.hap.Characteristic.FilterChangeIndication
    ).on("get", (cb) =>
      callbackify(async () => {
        return (await this.device.getCareSideBrush()) >= 100;
      }, cb)
    );
    this.services.CareSideBrush.getCharacteristic(
      this.api.hap.Characteristic.FilterLifeLevel
    ).on("get", (cb) =>
      callbackify(async () => 100 - (await this.device.getCareSideBrush()), cb)
    );

    this.services.CareMainBrush = new this.api.hap.Service.FilterMaintenance(
      "Care indicator main brush",
      "main brush"
    );
    this.services.CareMainBrush.getCharacteristic(
      this.api.hap.Characteristic.FilterChangeIndication
    ).on("get", (cb) =>
      callbackify(async () => {
        return (await this.device.getCareMainBrush()) >= 100;
      }, cb)
    );
    this.services.CareMainBrush.getCharacteristic(
      this.api.hap.Characteristic.FilterLifeLevel
    ).on("get", (cb) =>
      callbackify(async () => 100 - (await this.device.getCareMainBrush()), cb)
    );
  }

  private changedPause(newValue: boolean) {
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
        .getCharacteristic(this.api.hap.Characteristic.On)
        .updateValue(isCleaning);

      if (this.config.waterBox) {
        this.services.waterBox
          .getCharacteristic(this.api.hap.Characteristic.On)
          .updateValue(isCleaning);
      }
    }
  }

  private changedCharging(isCharging: boolean, isNewValue: boolean) {
    // We still update the value in Homebridge. If we are calling the changed method is because we want to change it.
    this.services.battery
      .getCharacteristic(this.api.hap.Characteristic.ChargingState)
      .updateValue(
        isCharging
          ? this.api.hap.Characteristic.ChargingState.CHARGING
          : this.api.hap.Characteristic.ChargingState.NOT_CHARGING
      );
    if (this.config.dock) {
      if (isNewValue) {
        const msg = isCharging
          ? "Robot was docked"
          : "Robot not anymore in dock";
        this.log.info(`INF changedCharging | ${this.device.model} | ${msg}.`);
      }
      this.services.dock
        .getCharacteristic(this.api.hap.Characteristic.OccupancyDetected)
        .updateValue(isCharging);
    }
  }

  private changedSpeed(speed: number) {
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
        .getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
        .updateValue(homekitTopLevel);
    }
  }

  private changedWaterSpeed(speed: number) {
    this.log.info(
      `MON changedWaterSpeed | ${this.device.model} | WaterBoxMode is now ${speed}%`
    );

    const speedMode = this.device.findWaterSpeedModeFromMiio(speed);

    if (typeof speedMode === "undefined") {
      this.log.warn(
        `WAR changedWaterSpeed | ${this.device.model} | Speed was changed to ${speed}%, this speed is not supported`
      );
    } else {
      const { homekitTopLevel, name } = speedMode;
      this.log.info(
        `INF changedWaterSpeed | ${this.device.model} | Speed was changed to ${speed}% (${name}), for HomeKit ${homekitTopLevel}%`
      );
      this.services.waterBox
        .getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
        .updateValue(homekitTopLevel);
      this.services.waterBox
        .getCharacteristic(this.api.hap.Characteristic.On)
        .updateValue(homekitTopLevel > 0);
    }
  }

  private createRoom(roomId: string, roomName: string) {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify: typeof callbackifyLib = async (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.log.info(
      `INF createRoom | ${this.device.model} | Room ${roomName} (${roomId})`
    );

    this.services.rooms = this.services.rooms || {};
    this.services.rooms[roomName] = new RoomSwitch(
      roomId,
      roomName,
      this.config.cleanword!
    );
    this.services.rooms[roomName]
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on("get", (cb) =>
        callbackify(
          () => this.getCleaningRoom(this.services.rooms![roomName].roomId),
          cb
        )
      )
      .on("set", (newState, cb) =>
        callbackify(
          () =>
            this.setCleaningRoom(
              newState as boolean,
              this.services.rooms![roomName].roomId
            ),
          cb
        )
      );
  }

  private async getCleaningRoom(roomId: string) {
    return this.device.roomIdsToClean.has(roomId);
  }

  private async setCleaningRoom(state: boolean, roomId: string) {
    try {
      if (state && !this.device.isCleaning && !this.device.isPaused) {
        this.log.info(
          `ACT setCleaningRoom | ${this.device.model} | Enable cleaning Room ID ${roomId}.`
        );
        // Delete then add, to maintain the correct order.
        this.device.roomIdsToClean.delete(roomId);
        this.device.roomIdsToClean.add(roomId);
        this.checkRoomTimeout();
      } else if (!state && !this.device.isCleaning && !this.device.isPaused) {
        this.log.info(
          `ACT setCleaningRoom | ${this.device.model} | Disable cleaning Room ID ${roomId}.`
        );
        this.device.roomIdsToClean.delete(roomId);
        this.checkRoomTimeout();
      }
    } catch (err) {
      this.log.error(
        `ERR setCleaningRoom | ${this.device.model} | Failed to set cleaning to ${state}`,
        err
      );
      throw err;
    }
    return state;
  }

  private async getRoomList() {
    try {
      let roomIds = await this.device.getRoomIDsFromTimer();
      this.log.debug(
        `DEB getRoomList | ${this.device.model} | Room IDs are ${roomIds}`
      );

      const autoroomConfig = (this.config.autoroom as string[]) || [];

      if (roomIds.length !== autoroomConfig.length) {
        this.log.error(
          `ERR getRoomList | ${this.device.model} | Number of rooms in config does not match number of rooms in the timer`
        );
        return;
      }
      let roomMap = [];
      for (const [i, roomId] of roomIds.entries()) {
        this.services.rooms![autoroomConfig[i]].roomId = roomId;
        roomMap.push({ id: roomId, name: autoroomConfig[i] });
      }
      this.log.info(
        `INF getRoomList | ${
          this.device.model
        } | Created "rooms": ${JSON.stringify(roomMap)}`
      );
    } catch (err) {
      this.log.error(`ERR getRoomList | Failed getting the Room List.`, err);
      throw err;
    }
  }

  private async getRoomMap() {
    const map = await this.device.getRoomMap();
    this.log.info(`INF getRoomMap | ${this.device.model} | Map is ${map}`);
    for (let val of map) {
      this.createRoom(val[0], val[1]);
    }
  }

  private checkRoomTimeout() {
    if (this.config.roomTimeout! > 0) {
      this.log.info(
        `ACT setCleaningRoom | ${this.device.model} | Start timeout to clean rooms`
      );
      clearTimeout(this.roomTimeout);
      if (this.device.roomIdsToClean.size > 0) {
        this.roomTimeout = setTimeout(
          () => this.device.setCleaning(true),
          this.config.roomTimeout! * 1000
        );
      }
    }
  }

  private createZone(zoneName: string, zoneParams: ConfigZone["zone"]) {
    // Make sure `this.device` exists before calling any of the methods
    const callbackify: typeof callbackifyLib = async (fn, cb) =>
      this.device ? callbackifyLib(fn, cb) : cb(new Error("Not connected yet"));

    this.log.info(
      `INF createRoom | ${this.device.model} | Zone ${zoneName} (${zoneParams})`
    );
    this.services[zoneName] = new this.api.hap.Service.Switch(
      `${this.config.cleanword} ${zoneName}`,
      "zoneCleaning" + zoneName
    );
    this.services[zoneName]
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on("get", (cb) => callbackify(() => this.device.getCleaning(), cb))
      .on("set", (newState, cb) =>
        callbackify(
          () => this.device.setCleaningZone(Boolean(newState), zoneParams),
          cb
        )
      );
  }

  private changedBattery(level: number) {
    this.log.debug(
      `DEB changedBattery | ${this.device.model} | BatteryLevel ${level}%`
    );
    this.services.battery
      .getCharacteristic(this.api.hap.Characteristic.BatteryLevel)
      .updateValue(level);
    this.services.battery
      .getCharacteristic(this.api.hap.Characteristic.StatusLowBattery)
      .updateValue(
        level < 20
          ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
  }

  private async getCharging() {
    const isCharging = this.device.getCharging();
    return isCharging
      ? this.api.hap.Characteristic.ChargingState.CHARGING
      : this.api.hap.Characteristic.ChargingState.NOT_CHARGING;
  }

  private async getBatteryLow() {
    const batteryLevel = await this.device.getBattery();
    return batteryLevel < 20
      ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  public async identify() {
    await this.device.identify();
  }

  public getServices() {
    this.log.debug(`DEB getServices | ${this.device.model}`);
    return Object.keys(this.services).reduce((services, key) => {
      let currentServices: ServiceType[];

      if (key === "rooms") {
        currentServices = Object.values(this.services[key]!);
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
