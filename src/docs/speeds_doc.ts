/**
 * Renders `docs/speeds-and-modes.md`: for every model, the fan speeds and water levels with the HomeKit slider steps
 * that select them, and the Matter clean modes. It's generated from the same code the plugin runs, and a test checks
 * that the page is up to date (`npm run docs:speeds` writes it).
 */
import { resolveVacuumModes, vacuumModels, type CleanPreset } from "node-miio";
import type {
  ModelDefinition,
  ModesHomekitVsMiLevel,
} from "../models/types.js";
import { findSpeedModes } from "../utils/find_speed_modes.js";
import { buildCleanModes, type CleanMode } from "../matter/clean_modes.js";
import { CleanModeTag } from "../matter/constants.js";

/**
 * The models whose fan speeds changed with a firmware update, and the first firmware with the new ones (as in
 * node-miio's table: a test checks that they match, and that no other model changes with the firmware).
 */
export const FIRMWARE_VARIANTS: Record<string, string> = {
  "roborock.vacuum.s5": "3.5.7",
};

/** An unknown Roborock model: it gets node-miio's default fan speeds */
const DEFAULT_MODEL = "roborock.vacuum.default";

/**
 * The commercial names of the models. Sources: Roborock's product catalog, python-miio's model list, Roborock's pages
 * (Xiaowa) and this repo's issues. The ones without a confirmed name (a09, t4, viomi.vacuum.v7) show their model only.
 */
const MODEL_NAMES: Record<string, string> = {
  "dreame.vacuum.mc1808": "Dreame 1C",
  "rockrobo.vacuum.v1": "Xiaomi Mi Robot Vacuum (1st generation)",
  "roborock.vacuum.a08": "Roborock S6 Pure",
  "roborock.vacuum.a10": "Roborock S6 MaxV",
  "roborock.vacuum.a11": "Roborock T7 (Chinese S7)",
  "roborock.vacuum.a15": "Roborock S7",
  "roborock.vacuum.a27": "Roborock S7 MaxV",
  "roborock.vacuum.a296": "Roborock Saros 20 Neo",
  "roborock.vacuum.a51": "Roborock S8",
  "roborock.vacuum.a62": "Roborock S7 Pro Ultra",
  "roborock.vacuum.a65": "Roborock S7 Max Ultra",
  "roborock.vacuum.a72": "Roborock Q5 Pro",
  "roborock.vacuum.a73": "Roborock Q8 Max",
  "roborock.vacuum.a75": "Roborock Q Revo",
  "roborock.vacuum.c1": "Roborock Xiaowa Lite (C1)",
  "roborock.vacuum.e2": "Roborock Xiaowa (E2)",
  "roborock.vacuum.m1s": "Xiaomi Mi Robot Vacuum 1S",
  "roborock.vacuum.s5": "Roborock S5 / S50 / S55",
  "roborock.vacuum.s5e": "Roborock S5 Max",
  "roborock.vacuum.s6": "Roborock S6",
  "roborock.vacuum.t6": "Roborock T6 (Chinese S6)",
  "viomi.vacuum.v8": "Xiaomi Mi Robot Vacuum-Mop Pro",
};

const TAG_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(CleanModeTag)
    .filter(([, value]) => typeof value === "number")
    .map(([name, value]) => [value as number, name])
);

interface Variant {
  /** e.g. "firmware >=3.5.7" */
  label?: string;
  definition: ModelDefinition;
  presets: CleanPreset[];
}

/**
 * @param modes The fan speeds or water levels
 * @returns The table rows: the HomeKit slider values that select each one (the first one whose top is at least the
 * slider's value)
 */
function sliderRows(modes: ModesHomekitVsMiLevel[]): string[] {
  return modes.map((mode, index) => {
    const from = index === 0 ? 0 : modes[index - 1].homekitTopLevel + 1;
    const to = mode.homekitTopLevel;
    const range = from >= to ? `${to}%` : `${from}–${to}%`;
    return `| ${mode.name} | ${mode.miLevel} | ${range} |`;
  });
}

/**
 * @param modes The Matter clean modes
 * @returns The table rows
 */
function cleanModeRows(modes: CleanMode[]): string[] {
  return [...modes]
    .sort((a, b) => a.mode - b.mode)
    .map(({ mode, label, modeTags, levels }) => {
      const tags = modeTags.map(({ value }) => TAG_NAMES[value] ?? value);
      const value = (v?: number) => (v === undefined ? "–" : `${v}`);
      return `| ${mode} | ${label} | ${tags.join(", ")} | ${value(levels.fan)} | ${value(levels.water)} | ${value(levels.mop)} |`;
    });
}

/**
 * @param model The model
 * @returns Its variants (some models changed their fan speeds with a firmware update)
 */
function variantsOf(model: string): Variant[] {
  // The same lookup as the plugin (`findSpeedModes`, from node-miio's table)
  const variant = (firmware?: string, label?: string): Variant => ({
    label,
    definition: findSpeedModes(model, firmware),
    presets: resolveVacuumModes(model, firmware).presets,
  });
  const newFirmware = FIRMWARE_VARIANTS[model];
  return newFirmware
    ? [variant(), variant(newFirmware, `firmware >=${newFirmware}`)]
    : [variant()];
}

/**
 * @param model The model
 * @returns The title of its section
 */
function titleOf(model: string): string {
  if (model === DEFAULT_MODEL) return "Other models (default)";
  const name = MODEL_NAMES[model];
  return name ? `${model} — ${name}` : model;
}

/**
 * @param title A heading
 * @returns Its anchor, as GitHub makes it
 */
function anchorOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/**
 * @param model The model
 * @returns Its section of the page
 */
function modelSection(model: string): string {
  const title = titleOf(model);
  const parts = [`## ${title}`];
  const variants = variantsOf(model);
  for (const { label, definition, presets } of variants) {
    if (label) parts.push(`**With ${label}**`);
    parts.push(
      "Fan speed (the main fan's slider):",
      [
        "| Speed | Robot value | HomeKit slider |",
        "| ----- | ----------- | -------------- |",
        ...sliderRows(definition.speed),
      ].join("\n")
    );
    if (definition.waterspeed?.length) {
      parts.push(
        "Water level (the water box's slider):",
        [
          "| Level | Robot value | HomeKit slider |",
          "| ----- | ----------- | -------------- |",
          ...sliderRows(definition.waterspeed),
        ].join("\n")
      );
    }
    parts.push(
      'Matter clean modes (`"serviceType": "vacuum"`):',
      [
        "| Mode | Name | Tags | Fan | Water | Mop route |",
        "| ---- | ---- | ---- | --- | ----- | --------- |",
        ...cleanModeRows(buildCleanModes(definition, presets)),
      ].join("\n")
    );
  }
  return parts.join("\n\n");
}

/**
 * @returns The page
 */
export function renderSpeedsDoc(): string {
  const models = [...vacuumModels()].sort();
  const index = [...models, DEFAULT_MODEL]
    .map((m) => `- [${titleOf(m)}](#${anchorOf(titleOf(m))})`)
    .join("\n");
  const intro = `# Fan speeds and water levels

[← Back to the README](../README.md)

<!-- Generated by \`npm run docs:speeds\` from the plugin's code (src/docs/speeds_doc.ts): don't edit it by hand. -->

What each step of the HomeKit sliders and each Matter clean mode sends to the robot, by model.

- **HomeKit (\`"serviceType": "fan"\`)**: the main fan's slider sets the fan speed, and the water box's slider (\`waterBox\`)
  the water level. A slider value selects the first speed whose range includes it; the plugin then moves the slider to
  the top of that range. 0% turns the fan off (stops the cleaning).
- **Matter (\`"serviceType": "vacuum"\`)**: Apple Home groups the clean modes by their tags: **Vacuum**, **Mop**, or
  both (vacuum & mop). The other tags (Quiet, Max, Deep clean…) tell it how intense each one is. The numbers are what
  automations refer to.
- **Robot value**: the value sent to the robot (\`fan_power\`, \`water_box_mode\`, \`mop_mode\`), as in the logs.

Models not listed use the [default](#other-models-default) fan speeds, unless node-miio reports their own (e.g. the
MIoT vacuums, from their spec: they're in the logs with \`"debug": true\`). The Viomi vacuums have their own list.`;
  return `${[intro, "## Models", index, ...models.map(modelSection), modelSection(DEFAULT_MODEL)].join("\n\n")}\n`;
}
