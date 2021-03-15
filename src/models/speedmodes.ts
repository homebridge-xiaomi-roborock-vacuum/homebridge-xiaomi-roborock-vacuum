import type { ModesHomekitVsMiLevel, SpeedModes } from "./types";

type SimplifiedSpeedModes = Record<
  string,
  Array<Omit<ModesHomekitVsMiLevel, "homekitTopLevel">>
>;

const SPEEDMODES: SimplifiedSpeedModes = {
  gen1: [
    // 0%      = Off / Aus
    {
      miLevel: -1,
      name: "Off",
    },
    // 0-25%  = "Quiet / Leise"
    {
      miLevel: 38,
      name: "Quiet",
    },
    // 26-50%  = "Balanced / Standard"
    {
      miLevel: 60,
      name: "Balanced",
    },
    // 51-75%  = "Turbo / Stark"
    {
      miLevel: 77,
      name: "Turbo",
    },
    // 76-100% = "Full Speed / Max Speed / Max"
    {
      miLevel: 90,
      name: "Max",
    },
  ],
  gen2: [
    // 0%      = Off / Aus
    {
      miLevel: -1,
      name: "Off",
    },
    // 1-20%   = "Mop / Mopping / Nur wischen"
    {
      miLevel: 105,
      name: "Mop",
    },
    // 21-40%  = "Quiet / Leise"
    {
      miLevel: 38,
      name: "Quiet",
    },
    // 41-60%  = "Balanced / Standard"
    {
      miLevel: 60,
      name: "Balanced",
    },
    // 61-80%  = "Turbo / Stark"
    {
      miLevel: 75,
      name: "Turbo",
    },
    // 81-100% = "Full Speed / Max Speed / Max"
    {
      miLevel: 100,
      name: "Max",
    },
  ],
  "gen2-no_mop": [
    // 0%      = Off / Aus
    {
      miLevel: -1,
      name: "Off",
    },
    // 0-25%  = "Quiet / Leise"
    {
      miLevel: 38,
      name: "Quiet",
    },
    // 26-50%  = "Balanced / Standard"
    {
      miLevel: 60,
      name: "Balanced",
    },
    // 51-75%  = "Turbo / Stark"
    {
      miLevel: 75,
      name: "Turbo",
    },
    // 76-100% = "Full Speed / Max Speed / Max"
    {
      miLevel: 100,
      name: "Max",
    },
  ],
  "xiaowa-e202-02": [
    // 0%      = Off / Aus
    {
      miLevel: -1,
      name: "Off",
    },
    // 0-20%  = "Gentle"
    {
      miLevel: 41,
      name: "Gentle",
    },
    // 20-40%  = "Silent"
    {
      miLevel: 50,
      name: "Silent",
    },
    // 40-60%  = "Balanced / Standard"
    {
      miLevel: 68,
      name: "Balanced",
    },
    // 60-80%  = "Turbo / Stark"
    {
      miLevel: 79,
      name: "Turbo",
    },
    // 80-100% = "Full Speed / Max Speed / Max"
    {
      miLevel: 100,
      name: "Max",
    },
  ],
  gen3: [
    // 0%      = Off / Aus
    {
      miLevel: -1,
      name: "Off",
    },
    // 1-25%   = "Quiet / Leise"
    {
      miLevel: 101,
      name: "Quiet",
    },
    // 26-50%  = "Balanced / Standard"
    {
      miLevel: 102,
      name: "Balanced",
    },
    // 51-75%  = "Turbo / Stark"
    {
      miLevel: 103,
      name: "Turbo",
    },
    // 76-100% = "Full Speed / Max Speed / Max"
    {
      miLevel: 104,
      name: "Max",
    },
  ],
  // S5-Max (https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/79#issuecomment-576246934)
  gen4: [
    // 0%      = Off / Aus
    {
      miLevel: -1,
      name: "Off",
    },
    // 1-20%   = "Soft"
    {
      miLevel: 105,
      name: "Soft",
    },
    // 21-40%   = "Quiet / Leise"
    {
      miLevel: 101,
      name: "Quiet",
    },
    // 41-60%  = "Balanced / Standard"
    {
      miLevel: 102,
      name: "Balanced",
    },
    // 61-80%  = "Turbo / Stark"
    {
      miLevel: 103,
      name: "Turbo",
    },
    // 81-100% = "Full Speed / Max Speed / Max"
    {
      miLevel: 104,
      name: "Max",
    },
  ],
  // S5-Max + Custom (https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/110)
  "gen4+custom": [
    // 0%      = Off / Aus
    {
      miLevel: -1,
      name: "Off",
    },
    // 1-16%   = "Soft"
    {
      miLevel: 105,
      name: "Soft",
    },
    // 17-32%   = "Quiet / Leise"
    {
      miLevel: 101,
      name: "Quiet",
    },
    // 33-48%  = "Balanced / Standard"
    {
      miLevel: 102,
      name: "Balanced",
    },
    // 49-64%  = "Turbo / Stark"
    {
      miLevel: 103,
      name: "Turbo",
    },
    // 65-80% = "Full Speed / Max Speed / Max"
    {
      miLevel: 104,
      name: "Max",
    },
    // 81-100% = "Custom"
    {
      miLevel: 106,
      name: "Custom",
    },
  ],

  // From https://github.com/rytilahti/python-miio/blob/20f915c9589fed55544a5417abe3fd3d9e12d08d/miio/viomivacuum.py#L16-L20
  viomi: [
    // 0%      = Off / Aus
    {
      miLevel: -1,
      name: "Off",
    },
    // 25%      = Silent
    {
      miLevel: 0,
      name: "Silent",
    },
    // 50%      = Standard
    {
      miLevel: 1,
      name: "Standard",
    },
    // 75%      = Medium
    {
      miLevel: 2,
      name: "Medium",
    },
    // 100%      = Turbo
    {
      miLevel: 3,
      name: "Turbo",
    },
  ],
};

/**
 * Loops through all the speedmodes and assigns the `homekitTopLevel` with proportional steps.
 *
 * i.e.:
 * - If 5 possible states => 0%, 25%, 50%, 75% and 100%
 * - If 6 possible states => 0%, 20%, 40%, 60%, 80% and 100%
 * - If 7 possible states => 0%, 16%, 32%, 48%, 64%, 80% and 96%
 *
 * @returns object The SPEEDMODES + the addition of the `homekitTopLevel` property to each entry
 */
function autoAssignHomekitTopLevel(): SpeedModes {
  return Object.fromEntries(
    Object.entries(SPEEDMODES).map(([gen, modes]) => {
      const speedmodes = modes.map((mode, index) => {
        const step = Math.floor(100 / (modes.length - 1));
        return {
          // if it's the last element, max it out to 100%
          homekitTopLevel: index === modes.length - 1 ? 100 : index * step,
          ...mode, // set later should we want to overwrite this logic in the SPEEDMODES definition
        };
      });
      return [gen, speedmodes];
    })
  );
}

export const speedmodes = autoAssignHomekitTopLevel();
