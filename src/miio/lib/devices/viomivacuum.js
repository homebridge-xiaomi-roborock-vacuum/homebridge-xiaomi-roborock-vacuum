"use strict";

const { ChargingState, AutonomousCharging } = require("abstract-things");
const {
  Vacuum,
  AdjustableFanSpeed,
  AutonomousCleaning,
  SpotCleaning,
} = require("abstract-things/climate");

const MiioApi = require("../device");
const BatteryLevel = require("./capabilities/battery-level");
const checkResult = require("../checkResult");

module.exports = class extends (
  Vacuum.with(
    MiioApi,
    BatteryLevel,
    AutonomousCharging,
    AutonomousCleaning,
    SpotCleaning,
    AdjustableFanSpeed,
    ChargingState
  )
) {
  static get type() {
    return "miio:vacuum";
  }

  constructor(options) {
    super(options);

    this.defineProperty("run_state", {
      name: "state",
      mapper: (s) => {
        switch (s) {
          case 0:
            return "paused";
          case 1:
            return "initiating";
          case 2:
            return "waiting";
          case 3:
            return "cleaning";
          case 5:
            return "charging";
          case 4:
            return "returning";
        }
        return "unknown-" + s;
      },
    });

    // Define the batteryLevel property for monitoring battery
    this.defineProperty("battary_life", {
      name: "batteryLevel",
    });

    this.defineProperty("s_time", {
      name: "cleanTime",
    });
    this.defineProperty("s_area", {
      name: "cleanArea",
      mapper: (v) => v / 1000000,
    });
    this.defineProperty("suction_grade", {
      name: "fanSpeed",
    });

    // Consumable status - times for brushes and filters
    // From https://github.com/rytilahti/python-miio/issues/550#issuecomment-570808184
    this.defineProperty("main_brush_life", {
      name: "mainBrushWorkTime",
    });
    this.defineProperty("side_brush_life", {
      name: "sideBrushWorkTime",
    });
    this.defineProperty("hypa_life", {
      name: "filterWorkTime",
    });
    this.defineProperty("mop_life", {
      // ? not sure about this one
      name: "mopWorkTime",
    });
    this.defineProperty("sensor_dirty_time", {
      // ? not sure about this one
      name: "sensorDirtyTime",
    });

    this._monitorInterval = 60000;
  }

  propertyUpdated(key, value, oldValue) {
    if (key === "state") {
      // Update charging state
      this.updateCharging(value === "charging");

      switch (value) {
        case "cleaning":
        case "spot-cleaning":
        case "zone-cleaning":
        case "room-cleaning":
          // The vacuum is cleaning
          this.updateCleaning(true);
          break;
        case "paused":
          // Cleaning has been paused, do nothing special
          break;
        case "error":
          // An error has occurred, rely on error mapping
          this.updateError(this.property("error"));
          break;
        case "charging-error":
          // Charging error, trigger an error
          this.updateError({
            code: "charging-error",
            message: "Error during charging",
          });
          break;
        case "charger-offline":
          // Charger is offline, trigger an error
          this.updateError({
            code: "charger-offline",
            message: "Charger is offline",
          });
          break;
        default:
          // The vacuum is not cleaning
          this.updateCleaning(false);
          break;
      }
    } else if (key === "fanSpeed") {
      this.updateFanSpeed(value);
    }

    super.propertyUpdated(key, value, oldValue);
  }

  getDeviceInfo() {
    return this.call("miIO.info");
  }

  async getSerialNumber() {
    const serial = await this.call("get_serial_number");
    return serial[0].serial_number;
  }

  getRoomMap() {
    return this.call("get_room_mapping");
  }

  cleanRooms(listOfRooms) {
    // From https://github.com/rytilahti/python-miio/issues/550#issuecomment-552780952
    return this.call(
      "set_mode_withroom",
      [0, 1, listOfRooms.length].concat(listOfRooms),
      {
        refresh: ["state"],
        refreshDelay: 1000,
      }
    ).then(checkResult);
  }

  resumeCleanRooms(listOfRooms) {
    return cleanRooms(listOfRooms);
  }

  getTimer() {
    return this.call("get_timer");
  }

  /**
   * Start a cleaning session.
   */
  activateCleaning() {
    return this.call("set_mode_withroom", [0, 1, 0], {
      refresh: ["state"],
      refreshDelay: 1000,
    }).then(checkResult);
  }

  /**
   * Pause the current cleaning session.
   */
  pause() {
    return this.call("set_mode_withroom", [0, 2, 0], {
      refresh: ["state"],
    }).then(checkResult);
  }

  /**
   * Stop the current cleaning session.
   */
  deactivateCleaning() {
    return this.call("set_mode", [0], {
      refresh: ["state"],
      refreshDelay: 1000,
    }).then(checkResult);
  }

  /**
   * Stop the current cleaning session and return to charge.
   */
  activateCharging() {
    return this.pause()
      .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
      .then(() =>
        this.call("set_charge", [1], {
          refresh: ["state"],
          refreshDelay: 1000,
        })
      )
      .then(checkResult);
  }

  /**
   * Set the power of the fan.
   * From https://github.com/rytilahti/python-miio/blob/20f915c9589fed55544a5417abe3fd3d9e12d08d/miio/viomivacuum.py#L16-L20
   * class ViomiVacuumSpeed(Enum):
   *   Silent = 0
   *   Standard = 1
   *   Medium = 2
   *   Turbo = 3
   */
  changeFanSpeed(speed) {
    return this.call("set_suction", [speed], {
      refresh: ["fanSpeed"],
    }).then(checkResult);
  }

  /**
   * Activate the find function, will make the device give off a sound.
   */
  find() {
    return this.call("find_me", [""]).then(() => null);
  }
};
