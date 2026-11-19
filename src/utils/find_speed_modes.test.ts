import { findSpeedModes } from "./find_speed_modes";
import { MODELS } from "../models";

describe("findSpeedModes", () => {
  test("should assign the viomi model for any model starting with 'viomi.'", () => {
    expect(findSpeedModes("viomi.one")).toStrictEqual(MODELS.viomi[0]);
    expect(findSpeedModes("viomi.two")).toStrictEqual(MODELS.viomi[0]);
  });

  test("should return the default model for unlisted models", () => {
    expect(findSpeedModes("random-model")).toStrictEqual(MODELS.default[0]);
  });

  test("should return a known model in the list", () => {
    expect(findSpeedModes("roborock.vacuum.s5")).toStrictEqual(
      MODELS["roborock.vacuum.s5"][0]
    );
  });

  test("should apply the firmware version to choose a different set of speeds", () => {
    expect(findSpeedModes("roborock.vacuum.s5", "3.5.7")).toStrictEqual(
      MODELS["roborock.vacuum.s5"][1]
    );
  });

  describe("with modes reported by node-miio", () => {
    const reported = {
      fanSpeeds: [
        { value: 0, name: "Silent" },
        { value: 1, name: "Basic" },
        { value: 2, name: "Strong" },
        { value: 3, name: "Full Speed" },
      ],
      waterBoxModes: [
        { value: 1, name: "Level1" },
        { value: 2, name: "Level2" },
        { value: 3, name: "Level3" },
      ],
    };

    test("models listed in MODELS keep the local definitions", () => {
      expect(
        findSpeedModes("roborock.vacuum.s5", "3.5.7", reported)
      ).toStrictEqual(MODELS["roborock.vacuum.s5"][1]);
    });

    test("other models use the reported modes (with an Off speed and HomeKit levels)", () => {
      expect(
        findSpeedModes("xiaomi.vacuum.d110ch", undefined, reported)
      ).toStrictEqual({
        speed: [
          { homekitTopLevel: 0, miLevel: -1, name: "Off" },
          { homekitTopLevel: 25, miLevel: 0, name: "Silent" },
          { homekitTopLevel: 50, miLevel: 1, name: "Basic" },
          { homekitTopLevel: 75, miLevel: 2, name: "Strong" },
          { homekitTopLevel: 100, miLevel: 3, name: "Full Speed" },
        ],
        waterspeed: [
          { homekitTopLevel: 0, miLevel: 1, name: "Level1" },
          { homekitTopLevel: 50, miLevel: 2, name: "Level2" },
          { homekitTopLevel: 100, miLevel: 3, name: "Level3" },
        ],
      });
    });

    test("newer Viomi models (MIoT) use the reported modes too", () => {
      expect(
        findSpeedModes("viomi.vacuum.v18", undefined, reported).speed[1].name
      ).toBe("Silent");
    });

    test("no water levels", () => {
      expect(
        findSpeedModes("xiaomi.vacuum.x", undefined, {
          fanSpeeds: reported.fanSpeeds,
          waterBoxModes: [],
        }).waterspeed
      ).toBeUndefined();
    });

    test("falls back to the defaults when nothing is reported", () => {
      expect(
        findSpeedModes("random-model", undefined, {
          fanSpeeds: [],
          waterBoxModes: [],
        })
      ).toStrictEqual(MODELS.default[0]);
      expect(
        findSpeedModes("viomi.vacuum.v6", undefined, undefined)
      ).toStrictEqual(MODELS.viomi[0]);
    });
  });
});
