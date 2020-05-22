"use strict";

const Vacuum = require("./vacuum");

function checkResult(r) {
  //console.log(r)
  // {"result":0,"id":17}      = Firmware 3.3.9_003095 (Gen1)
  // {"result":["ok"],"id":11} = Firmware 3.3.9_003194 (Gen1), 3.3.9_001168 (Gen2)
  if (r !== 0 && r[0] !== "ok" && r[0] !== "OK") {
    throw new Error("Could not complete call to device");
  }
}

/**
 * Implementation of the interface used by the Mi Robot Vacuum. This device
 * doesn't use properties via get_prop but instead has a get_status.
 */
module.exports = class extends Vacuum {
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
    this.defineProperty("main_brush_work_time", {
      name: "mainBrushWorkTime",
    });
    this.defineProperty("side_brush_work_time", {
      name: "sideBrushWorkTime",
    });
    this.defineProperty("filter_work_time", {
      name: "filterWorkTime",
    });
    this.defineProperty("sensor_dirty_time", {
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
      refresh: ["state "],
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

  loadProperties(props) {
    // We override loadProperties
    props = props.map((key) => this._reversePropertyDefinitions[key] || key);

    return this.call("get_prop", props, {
      refresh: ["state"],
      refreshDelay: 1000,
    }).then((status) => {
      const mapped = {};
      props.forEach((prop, index) => {
        const value = status[index];
        this._pushProperty(mapped, prop, value);
      });
      return mapped;
    });
  }
};
