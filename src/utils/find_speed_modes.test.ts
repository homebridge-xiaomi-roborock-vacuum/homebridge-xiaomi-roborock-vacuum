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
});
