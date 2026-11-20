import { MODELS } from "./models";

describe("Ensure speed tests", () => {
  describe("rockrobo.vacuum.v1", () => {
    const { speed } = MODELS["rockrobo.vacuum.v1"][0];
    test("ensure miLevels are consistent", () => {
      const miLevels = speed.map(({ miLevel }) => miLevel);
      expect(miLevels).toStrictEqual([-1, 38, 60, 75, 100]);
    });
  });
});

describe("Mop-only fan speed (105)", () => {
  const nameOf105 = (model: string) =>
    MODELS[model][0].speed.find(({ miLevel }) => miLevel === 105)?.name;

  test.each([
    "roborock.vacuum.a15",
    "roborock.vacuum.a27",
    "roborock.vacuum.a51",
    "roborock.vacuum.a65",
    "roborock.vacuum.a73",
    "roborock.vacuum.a75",
  ])("%s calls it Mop (no suction)", (model) => {
    expect(nameOf105(model)).toBe("Mop");
  });

  test.each(["roborock.vacuum.s6", "roborock.vacuum.a10"])(
    "%s keeps Soft (it still vacuums)",
    (model) => {
      expect(nameOf105(model)).toBe("Soft");
    }
  );
});
