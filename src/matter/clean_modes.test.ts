import { findSpeedModes } from "../utils/find_speed_modes";
import {
  buildCleanModes,
  fanTags,
  findCleanMode,
  waterTags,
} from "./clean_modes";
import { CleanModeTag } from "./constants";

const summary = (model: string) =>
  buildCleanModes(findSpeedModes(model)).map(
    ({ mode, label, modeTags, levels }) => ({
      mode,
      label,
      tags: modeTags.map(({ value }) => value),
      ...levels,
    })
  );

describe("buildCleanModes", () => {
  test("without a water box: one vacuum mode per fan speed (no water level)", () => {
    expect(summary("rockrobo.vacuum.v1")).toStrictEqual([
      {
        mode: 1,
        label: "Quiet Vacuum",
        tags: [CleanModeTag.Vacuum, CleanModeTag.LowNoise, CleanModeTag.Night],
        fan: 38,
        water: undefined,
      },
      {
        mode: 2,
        label: "Balanced Vacuum",
        tags: [CleanModeTag.Vacuum, CleanModeTag.Day],
        fan: 60,
        water: undefined,
      },
      {
        mode: 3,
        label: "Turbo Vacuum",
        tags: [CleanModeTag.Vacuum, CleanModeTag.Max],
        fan: 75,
        water: undefined,
      },
      {
        mode: 4,
        label: "Max Vacuum",
        tags: [CleanModeTag.Vacuum, CleanModeTag.DeepClean],
        fan: 100,
        water: undefined,
      },
    ]);
  });

  test('a "Mop" fan speed without water levels is a single mop mode', () => {
    const modes = summary("roborock.vacuum.s5");
    expect(modes.map(({ label }) => label)).toStrictEqual([
      "Quiet Vacuum",
      "Balanced Vacuum",
      "Turbo Vacuum",
      "Max Vacuum",
      "Mop",
    ]);
    expect(modes[4]).toStrictEqual({
      mode: 5,
      label: "Mop",
      tags: [CleanModeTag.Mop],
      fan: 105,
    });
  });

  test("S7 and newer: vacuum (water off), mop-only (105) and the vacuum & mop presets, listed first", () => {
    const modes = summary("roborock.vacuum.a15");
    expect(modes.map(({ mode, label }) => [mode, label])).toStrictEqual([
      [10, "Automatic"],
      [11, "Deep clean"],
      [12, "Quiet"],
      [1, "Quiet Vacuum"],
      [2, "Balanced Vacuum"],
      [3, "Turbo Vacuum"],
      [4, "Max Vacuum"],
      [5, "Custom Vacuum"],
      [6, "Light Mop"],
      [7, "Medium Mop"],
      [8, "High Mop"],
      [9, "Custom Mop"],
    ]);
    // Vacuum only: the water is turned off
    expect(modes[3]).toMatchObject({ fan: 101, water: 200 });
    // Mop only: no suction
    expect(modes[10]).toMatchObject({
      tags: [CleanModeTag.Mop, CleanModeTag.Max],
      fan: 105,
      water: 203,
    });
    // The presets don't use the custom levels
    expect(modes.slice(0, 3)).toStrictEqual([
      {
        mode: 10,
        label: "Automatic",
        tags: [CleanModeTag.Auto, CleanModeTag.Vacuum, CleanModeTag.Mop],
        fan: 102,
        water: 202,
      },
      {
        mode: 11,
        label: "Deep clean",
        tags: [CleanModeTag.DeepClean, CleanModeTag.Vacuum, CleanModeTag.Mop],
        fan: 104,
        water: 203,
      },
      {
        mode: 12,
        label: "Quiet",
        tags: [CleanModeTag.Quiet, CleanModeTag.Vacuum, CleanModeTag.Mop],
        fan: 101,
        water: 201,
      },
    ]);
  });

  test("modes reported by node-miio (MIoT): unknown names are tagged by position, no water off", () => {
    const modes = buildCleanModes({
      speed: [
        { homekitTopLevel: 0, miLevel: -1, name: "Off" },
        { homekitTopLevel: 33, miLevel: 0, name: "Silent" },
        { homekitTopLevel: 66, miLevel: 1, name: "Level A" },
        { homekitTopLevel: 100, miLevel: 2, name: "Level B" },
      ],
      waterspeed: [
        { homekitTopLevel: 0, miLevel: 1, name: "Low" },
        { homekitTopLevel: 100, miLevel: 2, name: "High" },
      ],
    });
    expect(
      modes.map(({ label, modeTags, levels }) => [
        label,
        modeTags.map(({ value }) => value),
        levels,
      ])
    ).toStrictEqual([
      [
        "Automatic",
        [CleanModeTag.Auto, CleanModeTag.Vacuum, CleanModeTag.Mop],
        // "Level A" is the middle one
        { fan: 1, water: 1 },
      ],
      [
        "Deep clean",
        [CleanModeTag.DeepClean, CleanModeTag.Vacuum, CleanModeTag.Mop],
        { fan: 2, water: 2 },
      ],
      [
        "Quiet",
        [CleanModeTag.Quiet, CleanModeTag.Vacuum, CleanModeTag.Mop],
        { fan: 0, water: 1 },
      ],
      // Without a "water off" level, the vacuum modes keep the current water level
      [
        "Silent Vacuum",
        [CleanModeTag.Vacuum, CleanModeTag.LowNoise, CleanModeTag.Night],
        { fan: 0, water: undefined },
      ],
      [
        "Level A Vacuum",
        [CleanModeTag.Vacuum, CleanModeTag.Day],
        { fan: 1, water: undefined },
      ],
      [
        "Level B Vacuum",
        [CleanModeTag.Vacuum, CleanModeTag.Max],
        { fan: 2, water: undefined },
      ],
    ]);
  });
});

describe("findCleanMode", () => {
  const modes = buildCleanModes(findSpeedModes("roborock.vacuum.a15"));

  test.each([
    [101, 200, "Quiet Vacuum"],
    [105, 202, "Medium Mop"],
    [104, 203, "Deep clean"],
  ])("fan %s and water %s: %s", (fan, water, label) => {
    expect(findCleanMode(modes, fan, water)?.label).toBe(label);
  });

  test("no match: a combination that isn't a mode", () => {
    expect(findCleanMode(modes, 101, 203)).toBeUndefined();
  });

  test("without a water box, the fan speed is enough", () => {
    const noWater = buildCleanModes(findSpeedModes("rockrobo.vacuum.v1"));
    expect(findCleanMode(noWater, 60, undefined)?.label).toBe(
      "Balanced Vacuum"
    );
  });
});

describe("the robot's SmartPlan preset", () => {
  const smartPlan = {
    name: "SmartPlan",
    fanSpeed: 110,
    waterBoxMode: 209,
    mopRoute: 306,
  };
  const modes = buildCleanModes(findSpeedModes("roborock.vacuum.a15"), [
    smartPlan,
  ]);

  test('replaces "Automatic" (same number and Auto tag), and sets the 3 settings', () => {
    const automatic = buildCleanModes(
      findSpeedModes("roborock.vacuum.a15")
    ).find(({ label }) => label === "Automatic");
    const mode = modes.find(({ label }) => label === "SmartPlan");
    expect(mode).toStrictEqual({
      label: "SmartPlan",
      mode: automatic?.mode,
      modeTags: [
        { value: CleanModeTag.Auto },
        { value: CleanModeTag.Vacuum },
        { value: CleanModeTag.Mop },
      ],
      levels: { fan: 110, water: 209, mop: 306 },
    });
    expect(modes.some(({ label }) => label === "Automatic")).toBe(false);
    expect(modes).toHaveLength(12);
  });

  test("is the current mode only with its mop route", () => {
    expect(findCleanMode(modes, 110, 209, 306)?.label).toBe("SmartPlan");
    expect(findCleanMode(modes, 110, 209, 300)).toBeUndefined();
    // The other modes don't depend on the mop route
    expect(findCleanMode(modes, 101, 200, 306)?.label).toBe("Quiet Vacuum");
  });
});

describe("a water slider (Saros 20: 30 levels)", () => {
  const reported = {
    fanSpeeds: [
      { value: 105, name: "Mop" },
      { value: 101, name: "Quiet" },
      { value: 102, name: "Balanced" },
      { value: 103, name: "Turbo" },
      { value: 104, name: "Max" },
    ],
    waterBoxModes: [
      { value: 200, name: "Off" },
      ...Array.from({ length: 30 }, (_, i) => ({
        value: 221 + i,
        name: `Level ${i + 1}`,
      })),
    ],
  };
  const modes = buildCleanModes(
    findSpeedModes("roborock.vacuum.a296", undefined, reported)
  ).map(({ mode, label, levels }) => ({ mode, label, ...levels }));

  test("only light, medium and high mop modes (first, middle, last level), not 30", () => {
    expect(modes.filter(({ label }) => label.endsWith("Mop"))).toStrictEqual([
      { mode: 5, label: "Light Mop", fan: 105, water: 221 },
      { mode: 6, label: "Medium Mop", fan: 105, water: 235 },
      { mode: 7, label: "High Mop", fan: 105, water: 250 },
    ]);
    expect(modes).toHaveLength(10);
  });

  test('the presets use the slider\'s positions, not "Level 1/2/3"', () => {
    const byLabel = Object.fromEntries(modes.map((m) => [m.label, m]));
    expect(byLabel["Automatic"]).toMatchObject({ fan: 102, water: 235 });
    expect(byLabel["Deep clean"]).toMatchObject({ fan: 104, water: 250 });
    expect(byLabel["Quiet"]).toMatchObject({ fan: 101, water: 221 });
  });
});

describe("fanTags / waterTags", () => {
  const names = (list: CleanModeTag[][]) =>
    list.map((tags) =>
      tags
        .map(
          (tag) =>
            Object.entries(CleanModeTag).find(([, value]) => value === tag)?.[0]
        )
        .join("+")
    );

  test.each([
    [
      "Roborock: Turbo and Max are Max and DeepClean",
      ["Soft", "Quiet", "Balanced", "Turbo", "Max", "Custom"],
      ["LowEnergy", "LowNoise+Night", "Day", "Max", "DeepClean", "Vacation"],
    ],
    [
      "S7 MaxV: Turbo and Max are Max, Max+ is DeepClean",
      ["Quiet", "Balanced", "Turbo", "Max", "Max+", "Custom"],
      ["LowNoise+Night", "Day", "Max", "Max", "DeepClean", "Vacation"],
    ],
    [
      "Viomi: the only high speed is Max",
      ["Silent", "Standard", "Medium", "Turbo"],
      ["LowNoise+Night", "Day", "Day", "Max"],
    ],
    [
      "Dreame: Strong and Turbo are Max and DeepClean",
      ["Quiet", "Standard", "Strong", "Turbo"],
      ["LowNoise+Night", "Day", "Max", "DeepClean"],
    ],
    [
      "MIoT names",
      ["Silent", "Basic", "Strong", "Full Speed"],
      ["LowNoise+Night", "Day", "Max", "DeepClean"],
    ],
    [
      "unknown names, by position",
      ["Level A", "Level B", "Level C"],
      ["LowNoise", "Day", "Max"],
    ],
  ])("fan speeds: %s", (_, speeds, expected) => {
    expect(names(fanTags(speeds))).toStrictEqual(expected);
  });

  test("water levels", () => {
    expect(
      names(waterTags(["Light", "Medium", "High", "Custom"]))
    ).toStrictEqual(["Min", "Day", "Max", "Vacation"]);
    expect(names(waterTags(["Wet 1", "Wet 2", "Wet 3"]))).toStrictEqual([
      "Min",
      "Day",
      "Max",
    ]);
  });
});
