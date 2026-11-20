import type { ModelDefinition, ModesHomekitVsMiLevel } from "../models/types";
import { CleanModeTag } from "./constants";

/** A Matter clean mode, and the levels to send to the robot */
export interface CleanMode {
  label: string;
  mode: number;
  modeTags: Array<{ value: CleanModeTag }>;
  /** The fan speed and water level (miIO values). `undefined`: not changed. */
  levels: { fan?: number; water?: number };
}

/** Tags by (lowercased) fan speed name, as named in `models/` and by node-miio */
const FAN_TAGS: Record<string, CleanModeTag> = {
  quiet: CleanModeTag.LowNoise,
  silent: CleanModeTag.LowNoise,
  silence: CleanModeTag.LowNoise,
  gentle: CleanModeTag.LowEnergy,
  soft: CleanModeTag.LowEnergy,
  balanced: CleanModeTag.Min,
  standard: CleanModeTag.Min,
  basic: CleanModeTag.Min,
  default: CleanModeTag.Min,
  medium: CleanModeTag.Day,
  middle: CleanModeTag.Day,
  strong: CleanModeTag.Day,
  turbo: CleanModeTag.Max,
  max: CleanModeTag.Max,
  "full speed": CleanModeTag.Max,
  "max+": CleanModeTag.DeepClean,
  custom: CleanModeTag.Vacation,
  auto: CleanModeTag.Auto,
};

/** Tags by (lowercased) water level name */
const WATER_TAGS: Record<string, CleanModeTag> = {
  light: CleanModeTag.Min,
  low: CleanModeTag.Min,
  "level 1": CleanModeTag.Min,
  level1: CleanModeTag.Min,
  medium: CleanModeTag.Day,
  middle: CleanModeTag.Day,
  "level 2": CleanModeTag.Day,
  level2: CleanModeTag.Day,
  high: CleanModeTag.Max,
  "level 3": CleanModeTag.Max,
  level3: CleanModeTag.Max,
  custom: CleanModeTag.Vacation,
};

/** Fan speeds that aren't one: -1 stops the cleaning */
const isFanOff = ({ miLevel, name }: ModesHomekitVsMiLevel) =>
  miLevel === -1 || /^off$/i.test(name.trim());
const isWaterOff = ({ name }: ModesHomekitVsMiLevel) =>
  /^(off|close|closed|level ?0)$/i.test(name.trim());
/** The mop-only fan speed (105): no suction on the S7 and newer, the lowest suction on the older models */
const isMopFan = ({ name }: ModesHomekitVsMiLevel) =>
  /^mop$/i.test(name.trim());

/**
 * Picks a tag by name, or by position when the name is unknown (first: low, last: max, others: day).
 *
 * @param tags The tags by name
 * @param name The mode's name
 * @param index The mode's position
 * @param count How many modes there are
 * @param lowest The tag of the first mode
 * @returns The tag
 */
function tagFor(
  tags: Record<string, CleanModeTag>,
  name: string,
  index: number,
  count: number,
  lowest: CleanModeTag
): CleanModeTag {
  const tag = tags[name.trim().toLowerCase()];
  if (tag !== undefined) return tag;
  if (index === 0) return lowest;
  return index === count - 1 ? CleanModeTag.Max : CleanModeTag.Day;
}

type Level = "low" | "medium" | "high";

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
 * - **Mop**: with the mop-only fan speed ("Mop"), one per water level.
 * - **Vacuum & mop** presets (Automatic, Deep clean, Quiet), like the native Matter vacuums, when the robot has a
 *   water box. They're listed first, but numbered after the other modes, so the numbers of the other modes don't change
 *   (controllers and automations refer to the modes by number).
 *
 * @param definition The robot's fan speeds and water levels
 * @returns The clean modes
 */
export function buildCleanModes(definition: ModelDefinition): CleanMode[] {
  const fans = definition.speed.filter((mode) => !isFanOff(mode));
  const mopFan = fans.find(isMopFan);
  const vacuumFans = fans.filter((mode) => !isMopFan(mode));
  const waterOff = definition.waterspeed?.find(isWaterOff);
  const waters = (definition.waterspeed ?? []).filter(
    (mode) => !isWaterOff(mode)
  );

  let mode = 1;
  const modes: CleanMode[] = vacuumFans.map(({ name, miLevel }, index) => ({
    label: `${name} Vacuum`,
    mode: mode++,
    modeTags: [
      { value: CleanModeTag.Vacuum },
      {
        value: tagFor(
          FAN_TAGS,
          name,
          index,
          vacuumFans.length,
          CleanModeTag.LowNoise
        ),
      },
    ],
    levels: { fan: miLevel, water: waterOff?.miLevel },
  }));

  if (mopFan && waters.length > 0) {
    waters.forEach(({ name, miLevel }, index) => {
      modes.push({
        label: `${name} Mop`,
        mode: mode++,
        modeTags: [
          { value: CleanModeTag.Mop },
          {
            value: tagFor(
              WATER_TAGS,
              name,
              index,
              waters.length,
              CleanModeTag.Min
            ),
          },
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
      water: pick(presetWaters, WATER_PRESET_NAMES, level).miLevel,
    },
  });
  const presets = [
    preset("Automatic", CleanModeTag.Auto, "medium"),
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
 * @returns The clean mode, or `undefined` if none matches (e.g. a fan speed set from the app with another water level)
 */
export function findCleanMode(
  modes: CleanMode[],
  fan: number | undefined,
  water: number | undefined
): CleanMode | undefined {
  return modes.find(
    ({ levels }) =>
      levels.fan === fan &&
      (levels.water === undefined || levels.water === water)
  );
}
