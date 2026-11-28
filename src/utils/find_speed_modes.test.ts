import { describe, test, expect } from "vitest";
import { resolveVacuumModes, vacuumModels } from "node-miio";
import { findSpeedModes, fromReportedModes } from "./find_speed_modes.js";

const levels = (model: string, firmware?: string) =>
  findSpeedModes(model, firmware).speed.map(({ miLevel }) => miLevel);

describe("findSpeedModes", () => {
  test("uses node-miio's modes, with an Off speed and HomeKit levels", () => {
    expect(findSpeedModes("roborock.vacuum.s5e")).toStrictEqual(
      fromReportedModes(resolveVacuumModes("roborock.vacuum.s5e"))
    );
    expect(findSpeedModes("roborock.vacuum.s5e")).toStrictEqual({
      speed: [
        { homekitTopLevel: 0, miLevel: -1, name: "Off" },
        { homekitTopLevel: 16, miLevel: 105, name: "Soft" },
        { homekitTopLevel: 32, miLevel: 101, name: "Quiet" },
        { homekitTopLevel: 48, miLevel: 102, name: "Balanced" },
        { homekitTopLevel: 64, miLevel: 103, name: "Turbo" },
        { homekitTopLevel: 80, miLevel: 104, name: "Max" },
        { homekitTopLevel: 100, miLevel: 106, name: "Custom" },
      ],
      waterspeed: [
        { homekitTopLevel: 0, miLevel: 200, name: "Off" },
        { homekitTopLevel: 33, miLevel: 201, name: "Light" },
        { homekitTopLevel: 66, miLevel: 202, name: "Medium" },
        { homekitTopLevel: 100, miLevel: 203, name: "High" },
      ],
    });
  });

  test("viomi models get the Viomi speeds", () => {
    expect(levels("viomi.one")).toStrictEqual([-1, 0, 1, 2, 3]);
  });

  test("unlisted models get the default speeds", () => {
    expect(levels("random-model")).toStrictEqual([-1, 105, 101, 102, 103, 104]);
  });

  test("the firmware version picks a different set of speeds", () => {
    expect(levels("roborock.vacuum.s5")).toStrictEqual([
      -1, 105, 38, 60, 75, 100,
    ]);
    expect(levels("roborock.vacuum.s5", "3.5.7_002034")).toStrictEqual([
      -1, 105, 101, 102, 103, 104,
    ]);
  });

  test.each(["roborock.vacuum.a15", "roborock.vacuum.a62"])(
    "%s: 105 is Mop (no suction)",
    (model) => {
      expect(findSpeedModes(model).speed[1]).toStrictEqual({
        homekitTopLevel: 16,
        miLevel: 105,
        name: "Mop",
      });
    }
  );

  // Pins what each model gets (fan speeds, water levels and HomeKit slider levels), so a change in node-miio's table
  // shows up here: update the snapshot only if it's intended.
  test.each(
    vacuumModels().flatMap((model) => [
      [model, undefined],
      [model, "4.0.0"],
    ])
  )("%s (firmware %s)", (model, firmware) => {
    expect(findSpeedModes(model, firmware)).toMatchSnapshot();
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

    test("the models in node-miio's table keep its definitions", () => {
      expect(
        findSpeedModes("roborock.vacuum.s5", "3.5.7", reported)
      ).toStrictEqual(findSpeedModes("roborock.vacuum.s5", "3.5.7"));
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
      ).toStrictEqual(findSpeedModes("random-model"));
      expect(
        findSpeedModes("viomi.vacuum.v6", undefined, undefined)
      ).toStrictEqual(findSpeedModes("viomi.one"));
    });
  });
});
