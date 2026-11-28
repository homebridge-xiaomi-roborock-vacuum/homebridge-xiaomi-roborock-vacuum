import type { CleanPreset } from "node-miio";
import type {
  ModelDefinition,
  ModesHomekitVsMiLevel,
} from "../models/types.js";
import { CleanModeTag } from "./constants.js";

/** A Matter clean mode, and the levels to send to the robot */
export interface CleanMode {
  label: string;
  mode: number;
  modeTags: Array<{ value: CleanModeTag }>;
  /**
   * The fan speed and water level (miIO values). `undefined`: not changed. With `mop` (the mop route), the robot's own
   * preset (e.g. SmartPlan): the three are set at once.
   */
  levels: { fan?: number; water?: number; mop?: number };
}

const { Auto, Day, DeepClean, LowEnergy, LowNoise, Max, Min, Night, Vacation } =
  CleanModeTag;

/**
 * Tags of the fan speeds by (lowercased) name, following their meaning in the Matter spec: LowNoise / Night (quiet, for
 * the night), LowEnergy, Day (suitable while people are around: the everyday speeds), Max (the highest setting),
 * DeepClean (more thorough). The high speeds are tagged by rank instead (see {@link fanTags}). "Custom" is Vacation,
 * the closest there is (users rely on finding it). Keep it in sync with matterbridge-xiaomi-roborock's `fanTags`.
 */
const FAN_TAGS: Record<string, CleanModeTag[]> = {
  quiet: [LowNoise, Night],
  silent: [LowNoise, Night],
  silence: [LowNoise, Night],
  gentle: [LowEnergy],
  soft: [LowEnergy],
  balanced: [Day],
  standard: [Day],
  basic: [Day],
  default: [Day],
  medium: [Day],
  middle: [Day],
  custom: [Vacation],
  auto: [Auto],
};

/** The high fan speeds, tagged by rank: the fastest is DeepClean and the others Max (or Max, if it's the only one) */
const HIGH_FAN_SPEEDS = /^(strong|turbo|max|full speed|max\+)$/;

/** Tags by (lowercased) water level name */
const WATER_TAGS: Record<string, CleanModeTag[]> = {
  light: [Min],
  low: [Min],
  "level 1": [Min],
  level1: [Min],
  medium: [Day],
  middle: [Day],
  "level 2": [Day],
  level2: [Day],
  high: [Max],
  "level 3": [Max],
  level3: [Max],
  custom: [Vacation],
};

/**
 * The tags of a mode whose name is unknown, by position: first low, last max, the others day.
 *
 * @param index The mode's position
 * @param count How many modes there are
 * @param lowest The tag of the first one
 * @returns The tags
 */
function tagsByPosition(
  index: number,
  count: number,
  lowest: CleanModeTag
): CleanModeTag[] {
  if (index === 0) return [lowest];
  return index === count - 1 ? [Max] : [Day];
}

/**
 * The tags of each fan speed (slowest first): by name, the high speeds (Strong, Turbo, Max, Full Speed, Max+) by rank
 * (the fastest DeepClean, the others Max: e.g. Turbo and Max when there's Max+), and the unknown
 * names by position.
 *
 * @param names The fan speeds' names
 * @returns The tags of each one
 */
export function fanTags(names: string[]): CleanModeTag[][] {
  const keys = names.map((name) => name.trim().toLowerCase());
  const highs = keys.flatMap((key, index) =>
    HIGH_FAN_SPEEDS.test(key) ? [index] : []
  );
  return keys.map((key, index) => {
    if (HIGH_FAN_SPEEDS.test(key)) {
      if (highs.length === 1) return [Max];
      const fromTheTop = highs.length - 1 - highs.indexOf(index);
      // The ones below them are Max too (e.g. Turbo when there are Max and Max+): "one of the strongest"
      return fromTheTop === 0 ? [DeepClean] : [Max];
    }
    return FAN_TAGS[key] ?? tagsByPosition(index, keys.length, LowNoise);
  });
}

/**
 * The tags of each water level (lowest first, without "off"): by name, or by position.
 *
 * @param names The water levels' names
 * @returns The tags of each one
 */
export function waterTags(names: string[]): CleanModeTag[][] {
  return names.map(
    (name, index) =>
      WATER_TAGS[name.trim().toLowerCase()] ??
      tagsByPosition(index, names.length, Min)
  );
}

/** Fan speeds that aren't one: -1 stops the cleaning */
const isFanOff = ({ miLevel, name }: ModesHomekitVsMiLevel) =>
  miLevel === -1 || /^off$/i.test(name.trim());
const isWaterOff = ({ name }: ModesHomekitVsMiLevel) =>
  /^(off|close|closed|level ?0)$/i.test(name.trim());
/** The mop-only fan speed (105): no suction on the S7 and newer, the lowest suction on the older models */
const isMopFan = ({ name }: ModesHomekitVsMiLevel) =>
  /^mop$/i.test(name.trim());

type Level = "low" | "medium" | "high";

/** More water levels than this are a slider: they get 3 mop modes (light, medium, high), not one each */
const MAX_MOP_LEVELS = 4;
/** On a slider, "Level 2" isn't "medium": the levels are picked by position (first, middle, last) */
const NO_NAMES: Record<Level, RegExp> = { low: /$^/, medium: /$^/, high: /$^/ };
/**
 * @param waters The water levels
 * @returns How to pick their low, medium and high levels
 */
const waterNames = (waters: ModesHomekitVsMiLevel[]) =>
  waters.length > MAX_MOP_LEVELS ? NO_NAMES : WATER_PRESET_NAMES;

const FAN_PRESET_NAMES: Record<Level, RegExp> = {
  low: /quiet|silen/i,
  medium: /balanced|standard|basic|default|medium/i,
  high: /^max$|full speed|^strong$|turbo/i,
};
const WATER_PRESET_NAMES: Record<Level, RegExp> = {
  low: /light|low|level ?1/i,
  medium: /medium|middle|level ?2/i,
  high: /high|level ?3/i,
};

/**
 * Picks the level by name, or by position (first, middle, last) when the names are unknown.
 *
 * @param modes The candidate modes
 * @param names The names of each level
 * @param level The level to pick
 * @returns The mode
 */
function pick(
  modes: ModesHomekitVsMiLevel[],
  names: Record<Level, RegExp>,
  level: Level
): ModesHomekitVsMiLevel {
  // `Max` must win over `Turbo` when both exist
  if (level === "high") {
    const max = modes.find(({ name }) => /^max$|full speed/i.test(name));
    if (max) return max;
  }
  const byName = modes.find(({ name }) => names[level].test(name));
  if (byName) return byName;
  const index =
    level === "low"
      ? 0
      : level === "high"
        ? modes.length - 1
        : Math.floor((modes.length - 1) / 2);
  return modes[index];
}

/**
 * Builds the Matter clean modes from the robot's fan speeds and water levels (see `findSpeedModes`):
 *
 * - **Vacuum**: one per fan speed (the water is turned off, if the robot has a water box).
 * - **Mop**: with the mop-only fan speed ("Mop"), one per water level. On a slider (more than 4 levels, e.g. 30 on the
 *   Saros 20), only light, medium and high (the first, middle and last levels).
 * - **Vacuum & mop** presets (Automatic, Deep clean, Quiet), like the native Matter vacuums, when the robot has a
 *   water box. They're listed first, but numbered after the other modes, so the numbers of the other modes don't change
 *   (controllers and automations refer to the modes by number).
 *
 * @param definition The robot's fan speeds and water levels
 *   When the robot has a SmartPlan preset (it picks the settings per room), it replaces "Automatic" (same number and
 *   tag): it's the robot's own automatic mode.
 *
 * @param robotPresets The robot's presets (`cleanPresets()` of node-miio)
 * @returns The clean modes
 */
export function buildCleanModes(
  definition: ModelDefinition,
  robotPresets: CleanPreset[] = []
): CleanMode[] {
  const fans = definition.speed.filter((mode) => !isFanOff(mode));
  const mopFan = fans.find(isMopFan);
  const vacuumFans = fans.filter((mode) => !isMopFan(mode));
  const waterOff = definition.waterspeed?.find(isWaterOff);
  const waters = (definition.waterspeed ?? []).filter(
    (mode) => !isWaterOff(mode)
  );

  let mode = 1;
  const vacuumTags = fanTags(vacuumFans.map(({ name }) => name));
  const modes: CleanMode[] = vacuumFans.map(({ name, miLevel }, index) => ({
    label: `${name} Vacuum`,
    mode: mode++,
    modeTags: [
      { value: CleanModeTag.Vacuum },
      ...vacuumTags[index].map((value) => ({ value })),
    ],
    levels: { fan: miLevel, water: waterOff?.miLevel },
  }));

  if (mopFan && waters.length > MAX_MOP_LEVELS) {
    // A slider (e.g. 30 levels on the Saros 20): only light, medium and high, not a mode per level
    const levels: [string, Level, CleanModeTag][] = [
      ["Light", "low", CleanModeTag.Min],
      ["Medium", "medium", CleanModeTag.Day],
      ["High", "high", CleanModeTag.Max],
    ];
    for (const [label, level, tag] of levels) {
      modes.push({
        label: `${label} Mop`,
        mode: mode++,
        modeTags: [{ value: CleanModeTag.Mop }, { value: tag }],
        levels: {
          fan: mopFan.miLevel,
          water: pick(waters, waterNames(waters), level).miLevel,
        },
      });
    }
  } else if (mopFan && waters.length > 0) {
    const mopTags = waterTags(waters.map(({ name }) => name));
    waters.forEach(({ name, miLevel }, index) => {
      modes.push({
        label: `${name} Mop`,
        mode: mode++,
        modeTags: [
          { value: CleanModeTag.Mop },
          ...mopTags[index].map((value) => ({ value })),
        ],
        levels: { fan: mopFan.miLevel, water: miLevel },
      });
    });
  } else if (mopFan) {
    modes.push({
      label: "Mop",
      mode: mode++,
      modeTags: [{ value: CleanModeTag.Mop }],
      levels: { fan: mopFan.miLevel },
    });
  }

  const presetFans = vacuumFans.filter(({ name }) => !/custom/i.test(name));
  const presetWaters = waters.filter(({ name }) => !/custom/i.test(name));
  if (presetFans.length === 0 || presetWaters.length === 0) return modes;

  const preset = (label: string, tag: CleanModeTag, level: Level) => ({
    label,
    mode: mode++,
    modeTags: [
      { value: tag },
      { value: CleanModeTag.Vacuum },
      { value: CleanModeTag.Mop },
    ],
    levels: {
      fan: pick(presetFans, FAN_PRESET_NAMES, level).miLevel,
      water: pick(presetWaters, waterNames(presetWaters), level).miLevel,
    },
  });
  const smartPlan = robotPresets.find(({ name }) =>
    /^smart ?plan$/i.test(name)
  );
  const presets = [
    smartPlan
      ? {
          ...preset(smartPlan.name, CleanModeTag.Auto, "medium"),
          levels: {
            fan: smartPlan.fanSpeed,
            water: smartPlan.waterBoxMode,
            mop: smartPlan.mopRoute,
          },
        }
      : preset("Automatic", CleanModeTag.Auto, "medium"),
    preset("Deep clean", CleanModeTag.DeepClean, "high"),
    preset("Quiet", CleanModeTag.Quiet, "low"),
  ];
  return [...presets, ...modes];
}

/**
 * Finds the clean mode that matches the robot's current fan speed and water level.
 *
 * @param modes The clean modes
 * @param fan The robot's fan speed
 * @param water The robot's water level (`undefined` without a water box)
 * @param mop The robot's mop route (only the presets, e.g. SmartPlan, check it)
 * @returns The clean mode, or `undefined` if none matches (e.g. a fan speed set from the app with another water level)
 */
export function findCleanMode(
  modes: CleanMode[],
  fan: number | undefined,
  water: number | undefined,
  mop?: number
): CleanMode | undefined {
  return modes.find(
    ({ levels }) =>
      levels.fan === fan &&
      (levels.water === undefined || levels.water === water) &&
      (levels.mop === undefined || levels.mop === mop)
  );
}
