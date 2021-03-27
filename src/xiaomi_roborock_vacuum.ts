import type { Config, ConfigZone } from "./types";
import type { Logging } from "homebridge";
import * as events from "events";
import { safeCall } from "./lib/safeCall";
import type { ModelDefinition } from "./models";
import { MODELS } from "./models";
import semver from "semver";

const miio = require("./miio");

const noop = () => void 0;
const GET_STATE_INTERVAL_MS = 30000; // 30s

export class XiaomiRoborockVacuum extends events.EventEmitter {
  // From https://github.com/aholstenson/miio/blob/master/lib/devices/vacuum.js#L128
  static cleaningStatuses = [
    "cleaning",
    "spot-cleaning",
    "zone-cleaning",
    "room-cleaning",
  ];
  static errors: Record<string, { description: string }> = {
    id1: {
      description:
        "Try turning the orange laserhead to make sure it isnt blocked.",
    },
    id2: { description: "Clean and tap the bumpers lightly." },
    id3: { description: "Try moving the vacuum to a different place." },
    id4: {
      description:
        "Wipe the cliff sensor clean and move the vacuum to a different place.",
    },
    id5: { description: "Remove and clean the main brush." },
    id6: { description: "Remove and clean the sidebrushes." },
    id7: {
      description:
        "Make sure the wheels arent blocked. Move the vacuum to a different place and try again.",
    },
    id8: {
      description: "Make sure there are no obstacles around the vacuum.",
    },
    id9: { description: "Install the dustbin and the filter." },
    id10: {
      description: "Make sure the filter has been tried or clean the filter.",
    },
    id11: {
      description:
        "Strong magnetic field detected. Move the device away from the virtual wall and try again",
    },
    id12: { description: "Battery is low, charge your vacuum." },
    id13: {
      description:
        "Couldnt charge properly. Make sure the charging surfaces are clean.",
    },
    id14: { description: "Battery malfunctioned." },
    id15: { description: "Wipe the wall sensor clean." },
    id16: { description: "Use the vacuum on a flat horizontal surface." },
    id17: { description: "Sidebrushes malfunctioned. Reboot the system." },
    id18: { description: "Fan malfunctioned. Reboot the system." },
    id19: { description: "The docking station is not connected to power." },
    id20: { description: "unkown" },
    id21: {
      description:
        "Please make sure that the top cover of the laser distance sensor is not pinned.",
    },
    id22: { description: "Please wipe the dock sensor." },
    id23: {
      description: "Make sure the signal emission area of dock is clean.",
    },
    id24: {
      description:
        "Robot stuck in a blocked area. Manually move it and resume the cleaning.",
    },
  };

  private readonly cachedState = new Map<string, unknown>();
  public readonly roomIdsToClean = new Set<string>();
  private device: typeof miio | null = null;
  private connectRetry = setTimeout(noop, 100);
  private connectingPromise: Promise<void> | null = null;
  private getStateInterval = setTimeout(noop, GET_STATE_INTERVAL_MS);
  private firmware: string | undefined;

  constructor(
    private readonly log: Logging,
    private readonly config: Partial<Config>
  ) {
    super();
  }

  public get model(): string {
    return this.device.miioModel;
  }

  public get speedmodes(): ModelDefinition {
    if (this.model.startsWith("viomi.")) {
      return MODELS.viomi[0];
    }

    return (MODELS[this.model] || []).reduce((acc, option) => {
      if (option.firmware) {
        const [, cleanFirmware] =
          (this.firmware || "").match(/^(\d+\.\d+\.\d+)/) || [];
        return semver.satisfies(cleanFirmware, option.firmware) ? option : acc;
      } else {
        return option;
      }
    }, MODELS.default[0]);
  }

  public get isCleaning() {
    const status = this.device.property("state");
    return XiaomiRoborockVacuum.cleaningStatuses.includes(status);
  }

  public get isPaused() {
    const isPaused = this.device.property("state") === "paused";
    return isPaused;
  }

  /**
   * Returns if the newValue is different to the previously cached one
   *
   * @param {string} property
   * @param {any} newValue
   * @returns {boolean} Whether the newValue is not the same as the previously cached one.
   */
  public isNewValue(property: string, newValue: unknown) {
    const cachedValue = this.cachedState.get(property);
    this.cachedState.set(property, newValue);
    return cachedValue !== newValue;
  }

  public async connect() {
    if (this.connectingPromise === null) {
      // if already trying to connect, don't trigger yet another one
      this.connectingPromise = this.initializeDevice().catch((error) => {
        this.log.error(
          `ERR connect | miio.device, next try in 2 minutes | ${error}`
        );
        clearTimeout(this.connectRetry);
        // Using setTimeout instead of holding the promise. This way we'll keep retrying but not holding the other actions
        this.connectRetry = setTimeout(
          () => this.connect().catch(() => {}),
          120000
        );
        throw error;
      });
    }
    try {
      await this.connectingPromise;
      clearTimeout(this.connectRetry);
    } finally {
      this.connectingPromise = null;
    }
  }

  private async initializeDevice() {
    this.log.debug("DEB getDevice | Discovering vacuum cleaner");

    const device = await miio.device({
      address: this.config.ip,
      token: this.config.token,
    });

    if (device.matches("type:vaccuum")) {
      this.device = device;

      this.emit("model", this.model);

      this.log.info("STA getDevice | Connected to: %s", this.config.ip);
      this.log.info("STA getDevice | Model: " + this.device.miioModel);
      this.log.info("STA getDevice | State: " + this.device.property("state"));
      this.log.info(
        "STA getDevice | FanSpeed: " + this.device.property("fanSpeed")
      );
      this.log.info(
        "STA getDevice | BatteryLevel: " + this.device.property("batteryLevel")
      );

      try {
        const serial = await this.getSerialNumber();
        this.emit("serial_number", serial);
        this.log.info(`STA getDevice | Serialnumber: ${serial}`);
      } catch (err) {
        this.log.error(`ERR getDevice | get_serial_number | ${err}`);
      }

      try {
        const firmware = await this.getFirmware();
        this.firmware = firmware;
        this.emit("firmware", firmware);
        this.log.info(`STA getDevice | Firmwareversion: ${firmware}`);
      } catch (err) {
        this.log.error(`ERR getDevice | miIO.info | ${err}`);
      }

      this.device.on("errorChanged", (error) => this.changedError(error));
      this.device.on("stateChanged", (state) => {
        if (state.key === "cleaning") {
          this.changedCleaning(state.value);
        } else if (state.key === "charging") {
          this.changedCharging(state.value);
        } else if (state.key === "fanSpeed") {
          this.emit("changedSpeed", state.value);
        } else if (state.key === "batteryLevel") {
          this.emit("changedBatteryLevel", state.value);
        } else {
          this.log.debug(
            `DEB stateChanged | ${this.model} | Not supported stateChanged event: ${state.key}:${state.value}`
          );
        }
      });

      await this.getState();
      // Refresh the state every 30s so miio maintains a fresh connection (or recovers connection if lost until we fix https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/81)
      clearInterval(this.getStateInterval);
      this.getStateInterval = setInterval(
        () => this.getState(),
        GET_STATE_INTERVAL_MS
      );
    } else {
      const model = (device || {}).miioModel;
      this.log.error(
        `ERR getDevice | Device "${model}" is not registered as a vacuum cleaner! If you think it should be, please open an issue at https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/new and provide this line.`
      );
      this.log.debug(device);
      device.destroy();
    }
  }

  private async ensureDevice(callingMethod: string) {
    try {
      if (!this.device) {
        const errMsg = `ERR ${callingMethod} | No vacuum cleaner is discovered yet.`;
        this.log.error(errMsg);
        throw new Error(errMsg);
      }

      // checking if the device has an open socket it will fail retrieving it if not
      // https://github.com/aholstenson/miio/blob/master/lib/network.js#L227
      const socket = this.device.handle.api.parent.socket;
      this.log.debug(
        `DEB ensureDevice | ${this.model} | The socket is still on. Reusing it.`
      );
    } catch (err) {
      if (
        /destroyed/i.test(err.message) ||
        /No vacuum cleaner is discovered yet/.test(err.message)
      ) {
        this.log.info(
          `INF ensureDevice | ${this.model} | The socket was destroyed or not initialised, initialising the device`
        );
        await this.connect();
      } else {
        this.log.error(err);
        throw err;
      }
    }
  }

  private async getState() {
    try {
      await this.ensureDevice("getState");
      await this.device.poll();
      const state = await this.device.state();
      this.log.debug(
        `DEB getState | ${this.model} | State %j | Props %j`,
        state,
        this.device.properties
      );

      safeCall(state.cleaning, (cleaning) => this.changedCleaning(cleaning));
      safeCall(state.charging, (charging) => this.changedCharging(charging));
      safeCall(state.fanSpeed, (fanSpeed) =>
        this.emit("changedSpeed", fanSpeed)
      );
      safeCall(state.batteryLevel, (batteryLevel) =>
        this.emit("changedBatteryLevel", batteryLevel)
      );
      if (this.config.waterBox) {
        safeCall(state["water_box_mode"], (waterBoxMode) =>
          this.emit("changedWaterSpeed", waterBoxMode)
        );
      }

      // No need to throw the error at this point. This are just warnings like (https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/91)
      safeCall(state.error, (error) => this.changedError(error));
    } catch (err) {
      this.log.error(`ERR getState | %j`, err);
    }
  }

  public async getSerialNumber() {
    await this.ensureDevice("getSerialNumber");

    try {
      const serialNumber = await this.device.getSerialNumber();
      this.log.info(
        `INF getSerialNumber | ${this.model} | Serial Number is ${serialNumber}`
      );

      return `${serialNumber}`;
    } catch (err) {
      this.log.warn(
        `ERR getSerialNumber | Failed getting the serial number.`,
        err
      );
      return `Unknown`;
    }
  }

  public async getFirmware() {
    await this.ensureDevice("getFirmware");

    try {
      const firmware = await this.device.getDeviceInfo();
      this.log.info(
        `INF getFirmware | ${this.model} | Firmwareversion is ${firmware.fw_ver}`
      );

      return firmware.fw_ver;
    } catch (err) {
      this.log.error(
        `ERR getFirmware | Failed getting the firmware version.`,
        err
      );
      throw err;
    }
  }

  public async getCleaning() {
    try {
      const isCleaning = this.isCleaning;
      this.log.info(
        `INF getCleaning | ${this.model} | Cleaning is ${isCleaning}`
      );

      return isCleaning;
    } catch (err) {
      this.log.error(
        `ERR getCleaning | Failed getting the cleaning status.`,
        err
      );
      throw err;
    }
  }

  public async setCleaning(state: boolean) {
    await this.ensureDevice("setCleaning");
    this.log.info(
      `ACT setCleaning | ${this.model} | Set cleaning to ${state}}`
    );
    try {
      if (state && !this.isCleaning) {
        // Start cleaning

        if (this.roomIdsToClean.size > 0) {
          await this.device.cleanRooms(Array.from(this.roomIdsToClean));
          this.log.info(
            `ACT setCleaning | ${
              this.model
            } | Start rooms cleaning for rooms ${Array.from(
              this.roomIdsToClean
            )}, device is in state ${this.device.property("state")}.`
          );
        } else {
          await this.device.activateCleaning();
          this.log.info(
            `ACT setCleaning | ${
              this.model
            } | Start full cleaning, device is in state ${this.device.property(
              "state"
            )}.`
          );
        }
      } else if (!state && (this.isCleaning || this.isPaused)) {
        // Stop cleaning
        this.log.info(
          `ACT setCleaning | ${
            this.model
          } | Stop cleaning and go to charge, device is in state ${this.device.property(
            "state"
          )}`
        );
        await this.device.activateCharging();
        this.roomIdsToClean.clear();
      }
    } catch (err) {
      this.log.error(
        `ERR setCleaning | ${this.model} | Failed to set cleaning to ${state}`,
        err
      );
      throw err;
    }
  }

  public async setCleaningZone(state: boolean, zone: ConfigZone["zone"]) {
    try {
      if (state && !this.device.isCleaning) {
        // Start cleaning
        this.log.info(
          `ACT setCleaning | ${this.model} | Start cleaning Zone ${zone}, not charging.`
        );

        const zoneParams = [];
        for (const zon of zone) {
          if (zon.length === 4) {
            zoneParams.push(zon.concat(1));
          } else if (zon.length === 5) {
            zoneParams.push(zon);
          }
        }
        await this.device.cleanZones(zoneParams);
      } else if (!state) {
        // Stop cleaning
        this.log.info(
          `ACT setCleaning | ${this.model} | Stop cleaning and go to charge.`
        );
        await this.device.activateCharging();
      }
    } catch (err) {
      this.log.error(
        `ERR setCleaning | ${this.model} | Failed to set cleaning to ${state}`,
        err
      );
      throw err;
    }
    return state;
  }

  public async getRoomIDsFromTimer(): Promise<string[]> {
    await this.ensureDevice("getRoomList");

    try {
      const timers: any[] = await this.device.getTimer();

      // Find specific timer containing the room order
      // Timer needs to be scheduled for 00:00 and inactive
      let leetTimer = timers.find(
        (x) => x[2][0].startsWith("0 0") && x[1] == "off"
      );
      if (typeof leetTimer === "undefined") {
        this.log.error(
          `ERR getRoomList | ${this.model} | Could not find a timer for autoroom`
        );
        return [];
      }

      return leetTimer[2][1][1]["segments"].split(`,`);
    } catch (err) {
      this.log.error(`ERR getRoomList | Failed getting the Room List.`, err);
      throw err;
    }
  }

  public async getRoomMap() {
    await this.ensureDevice("getRoomMap");

    try {
      const map = await this.device.getRoomMap();
      return map;
    } catch (err) {
      this.log.error(`ERR getRoomMap | Failed getting the Room Map.`, err);
      throw err;
    }
  }

  public findSpeedModeFromMiio(speed: number) {
    // Get the speed modes for this model
    const speedModes = this.speedmodes.speed;

    // Find speed mode that matches the miLevel
    return speedModes.find((mode) => mode.miLevel === speed);
  }

  public async getSpeed() {
    await this.ensureDevice("getSpeed");

    const speed = await this.device.fanSpeed();
    this.log.info(
      `INF getSpeed | ${this.model} | Fanspeed is ${speed} over miIO. Converting to HomeKit`
    );

    const { homekitTopLevel, name } = this.findSpeedModeFromMiio(speed) || {};

    this.log.info(
      `INF getSpeed | ${this.model} | Fanspeed is ${speed} over miIO "${name}" > HomeKit speed ${homekitTopLevel}%`
    );

    return homekitTopLevel || 0;
  }

  public async setSpeed(speed: string | number) {
    await this.ensureDevice("setSpeed");

    if (typeof speed === "number") {
      this.log.debug(
        `ACT setSpeed | ${this.model} | Speed got ${speed}% over HomeKit > CLEANUP.`
      );
    }

    // Get the speed modes for this model
    const speedModes = this.speedmodes.speed;

    let miLevel = null;
    let name = null;

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
      );
      if (speedMode) {
        miLevel = speedMode.miLevel;
        name = speedMode.name;
      }
    } else {
      // Set by mode name
      const speedMode = speedModes.find((mode) => mode.name === speed);

      if (speedMode == null) {
        this.log.info(
          `INF setSpeed | ${this.model} | Mode "${speed}" does not exist.`
        );
        return;
      }
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    }

    this.log.info(
      `ACT setSpeed | ${this.model} | FanSpeed set to ${miLevel} over miIO for "${name}".`
    );

    // Save the latest set speed for handling the "custom" speed later
    this.cachedState.set("FanSpeed", miLevel);
    this.cachedState.set("FanSpeedName", name);

    if (miLevel === -1) {
      this.log.info(
        `INF setSpeed | ${this.model} | FanSpeed is -1 => Calling setCleaning(false) instead of changing the fan speed`
      );
      await this.setCleaning(false);
    } else {
      await this.device.changeFanSpeed(miLevel);

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
  }

  public findWaterSpeedModeFromMiio(speed: number) {
    // Get the speed modes for this model
    const speedModes = this.speedmodes.waterspeed || [];

    // Find speed mode that matches the miLevel
    return speedModes.find((mode) => mode.miLevel === speed);
  }

  public async getWaterSpeed() {
    await this.ensureDevice("getWaterSpeed");

    const speed = await this.device.getWaterBoxMode();
    this.log.info(
      `INF getWaterSpeed | ${this.model} | WaterBoxMode is ${speed} over miIO. Converting to HomeKit`
    );

    const waterSpeed = this.findWaterSpeedModeFromMiio(speed);

    let homekitValue = 0;
    if (waterSpeed) {
      const { homekitTopLevel, name } = waterSpeed;
      this.log.info(
        `INF getWaterSpeed | ${this.model} | WaterBoxMode is ${speed} over miIO "${name}" > HomeKit speed ${homekitTopLevel}%`
      );
      homekitValue = homekitTopLevel || 0;
    }
    return homekitValue;
  }

  async setWaterSpeed(speed: string | number) {
    await this.ensureDevice("setWaterSpeed");

    if (typeof speed === "number") {
      this.log.debug(
        `ACT setWaterSpeed | ${this.model} | Speed got ${speed}% over HomeKit > CLEANUP.`
      );
    }

    // Get the speed modes for this model
    const speedModes = this.speedmodes.waterspeed || [];

    // If the robot does not support water-mode cleaning
    if (speedModes.length === 0) {
      this.log.info(
        `INF setWaterSpeed | ${this.model} | Model does not support the water mode`
      );
      return;
    }

    let miLevel = null;
    let name = null;

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
      );
      if (speedMode) {
        miLevel = speedMode.miLevel;
        name = speedMode.name;
      }
    } else {
      // Set by mode name
      const speedMode = speedModes.find((mode) => mode.name === speed);

      if (speedMode == null) {
        this.log.info(
          `INF setWaterSpeed | ${this.model} | Mode "${speed}" does not exist.`
        );
        return;
      }
      miLevel = speedMode.miLevel;
      name = speedMode.name;
    }

    this.log.info(
      `ACT setWaterSpeed | ${this.model} | WaterBoxMode set to ${miLevel} over miIO for "${name}".`
    );

    // Save the latest set speed for handling the "custom" speed later
    this.cachedState.set("WaterSpeed", miLevel);
    this.cachedState.set("WaterSpeedName", name);

    await this.device.setWaterBoxMode(miLevel);

    // If speed is "custom", also set the water speed to "custom" (for Xiaomi App)
    if (
      name === "Custom" &&
      this.cachedState.get("FanSpeedName") !== "Custom"
    ) {
      await this.setSpeed("Custom");
    }
    // If speed is not "custom" remove set the water speed also to a fixed value (for Xiaomi App)
    else if (
      name !== "Custom" &&
      this.cachedState.get("FanSpeedName") === "Custom"
    ) {
      await this.setSpeed("Balanced");
    }
  }

  public async getPauseState() {
    await this.ensureDevice("getPauseState");

    try {
      const isPaused = this.device.property("state") === "paused";
      const canBePaused = this.isCleaning && !isPaused;
      this.log.info(
        `INF getPauseState | ${this.model} | Pause possible is ${canBePaused}`
      );
      return canBePaused;
    } catch (err) {
      this.log.error(
        `ERR getPauseState | ${this.model} | Failed getting the cleaning status.`,
        err
      );
      throw err;
    }
  }

  public async setPauseState(state: boolean) {
    await this.ensureDevice("setPauseState");

    try {
      if (state && this.isPaused) {
        if (this.roomIdsToClean.size > 0) {
          await this.device.resumeCleanRooms(Array.from(this.roomIdsToClean));
          this.log.info(
            `INF setPauseState | Resume room cleaning, and the device is in state  ${this.device.property(
              "state"
            )}`
          );
        } else {
          await this.device.activateCleaning();
          this.log.info(
            `INF setPauseState | Resume normal cleaning, and the device is in state ${this.device.property(
              "state"
            )}`
          );
        }
      } else if (!state && this.isCleaning) {
        await this.device.pause();
        this.log.info(
          `INF setPauseState | Pause cleaning, and the device is in state ${this.device.property(
            "state"
          )}`
        );
      }
    } catch (err) {
      this.log.error(
        `ERR setPauseState | ${this.model} | Failed updating pause state ${state}.`,
        err
      );
      throw err;
    }
    return state;
  }

  public async getCharging() {
    const status = this.device.property("state");
    this.log.info(
      `INF getCharging | ${this.model} | Charging is ${
        status === "charging"
      } (Status is ${status})`
    );

    return status === "charging";
  }

  public async getDocked() {
    const status = this.device.property("state");
    this.log.info(
      `INF getDocked | ${this.model} | Robot Docked is ${
        status === "charging"
      } (Status is ${status})`
    );

    return status === "charging";
  }

  public async getBattery() {
    const batteryLevel = await this.device.batteryLevel();
    this.log.info(
      `INF getBattery | ${this.model} | Batterylevel is ${batteryLevel}%`
    );
    return batteryLevel;
  }

  public async identify() {
    await this.ensureDevice("identify");

    this.log.info(`ACT identify | ${this.model} | Find me - Hello!`);
    try {
      await this.device.find();
    } catch (err) {
      this.log.error(`ERR identify | ${this.model} | `, err);
      throw err;
    }
  }

  // CONSUMABLE / CARE
  public async getCareSensors() {
    // 30h = sensor_dirty_time
    const lifetime = 108000;
    const sensorDirtyTime = this.device.property("sensorDirtyTime");
    const lifetimepercent = (sensorDirtyTime / lifetime) * 100;
    this.log.info(
      `INF getCareSensors | ${
        this.model
      } | Sensors dirtytime is ${sensorDirtyTime} seconds / ${lifetimepercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimepercent);
  }

  public async getCareFilter() {
    // 150h = filter_work_time
    const lifetime = 540000;
    const lifetimepercent =
      (this.device.property("filterWorkTime") / lifetime) * 100;
    this.log.info(
      `INF getCareFilter | ${
        this.model
      } | Filter worktime is ${this.device.property(
        "filterWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return Math.min(100, lifetimepercent);
  }

  public async getCareSideBrush() {
    // 200h = side_brush_work_time
    const lifetime = 720000;
    const lifetimepercent =
      (this.device.property("sideBrushWorkTime") / lifetime) * 100;
    this.log.info(
      `INF getCareSideBrush | ${
        this.model
      } | Sidebrush worktime is ${this.device.property(
        "sideBrushWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return Math.min(100, lifetimepercent);
  }

  public async getCareMainBrush() {
    // 300h = main_brush_work_time
    const lifetime = 1080000;
    const lifetimepercent =
      (this.device.property("mainBrushWorkTime") / lifetime) * 100;
    this.log.info(
      `INF getCareMainBrush | ${
        this.model
      } | Mainbrush worktime is ${this.device.property(
        "mainBrushWorkTime"
      )} seconds / ${lifetimepercent.toFixed(2)}%.`
    );
    return Math.min(100, lifetimepercent);
  }

  private changedError(robotError?: { id: number; description: string }) {
    if (!robotError) return;
    if (!this.isNewValue("error", robotError.id)) return;
    this.log.debug(
      `DEB changedError | ${this.model} | ErrorID: ${robotError.id}, ErrorDescription: ${robotError.description}`
    );
    let robotErrorTxt = XiaomiRoborockVacuum.errors[`id${robotError.id}`]
      ? XiaomiRoborockVacuum.errors[`id${robotError.id}`].description
      : `Unknown ERR | errorid can't be mapped. (${robotError.id})`;
    if (!`${robotError.description}`.toLowerCase().startsWith("unknown")) {
      robotErrorTxt = robotError.description;
    }
    this.log.warn(
      `WAR changedError | ${this.model} | Robot has an ERROR - ${robotError.id}, ${robotErrorTxt}`
    );
    // Clear the error_code property
    this.device.setRawProperty("error_code", 0);
  }

  private changedCleaning(isCleaning: boolean) {
    if (this.isNewValue("cleaning", isCleaning)) {
      this.log.debug(
        `MON changedCleaning | ${this.model} | CleaningState is now ${isCleaning}`
      );
      this.log.info(
        `INF changedCleaning | ${this.model} | Cleaning is ${
          isCleaning ? "ON" : "OFF"
        }.`
      );
      if (!isCleaning) {
        this.roomIdsToClean.clear();
      }
    }
    this.emit("changedCleaning", isCleaning);
  }

  private changedCharging(isCharging: boolean) {
    const isNewValue = this.isNewValue("charging", isCharging);
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
    this.emit("changedCharging", { isCharging, isNewValue });
  }
}
