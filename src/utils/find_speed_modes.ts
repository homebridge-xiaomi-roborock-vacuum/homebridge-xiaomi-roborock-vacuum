import type {
  ModelDefinition,
  ModesHomekitVsMiLevel,
} from "../models/types.js";
import {
  resolveVacuumModes,
  vacuumModels,
  type CleanPreset,
  type VacuumMode,
} from "node-miio";

/** Fan speeds and water levels reported by node-miio (e.g. from the device's MIoT spec) */
export interface ReportedModes {
  fanSpeeds: VacuumMode[];
  waterBoxModes: VacuumMode[];
  /** The robot's presets of the 3 settings (e.g. SmartPlan), for the Matter clean modes */
  presets?: CleanPreset[];
}

/**
 * Finds the speed modes that apply to the current model and firmware version.
 *
 * node-miio is the source of the fan speeds and water levels: the models in its table (`vacuumModels()`) use it, with
 * the firmware variants; any other model uses the modes it reports for the robot (e.g. from the MIoT spec), or its
 * brand's defaults when nothing is reported. The plugin only adds the HomeKit slider levels and an "Off" fan speed.
 *
 * @param model The Robot Vacuum's model
 * @param firmware The firmware's version
 * @param reported The modes reported by node-miio (see `DeviceManager.reportedModes`)
 * @returns The speed modes that apply to the robot.
 */
export function findSpeedModes(
  model: string,
  firmware?: string,
  reported?: ReportedModes
): ModelDefinition {
  if (
    !vacuumModels().includes(model) &&
    reported &&
    reported.fanSpeeds.length > 0
  ) {
    return fromReportedModes(reported);
  }
  return fromReportedModes(resolveVacuumModes(model, firmware));
}

/**
 * Assigns the `homekitTopLevel` with proportional steps: the slider is split evenly, the last mode ends at 100%.
 *
 * @param modes The modes
 * @returns The modes with `homekitTopLevel`
 */
function withHomekitTopLevel(
  modes: Array<{ miLevel: number; name: string }>
): ModesHomekitVsMiLevel[] {
  const step = Math.floor(100 / Math.max(modes.length - 1, 1));
  return modes.map((mode, index) => ({
    homekitTopLevel: index === modes.length - 1 ? 100 : index * step,
    ...mode,
  }));
}

/**
 * Converts the modes reported by node-miio into a {@link ModelDefinition}.
 * An "Off" fan speed (-1, which stops the cleaning) is prepended.
 *
 * @param reported The reported modes
 * @returns The model definition
 */
export function fromReportedModes(reported: ReportedModes): ModelDefinition {
  const speed = withHomekitTopLevel([
    { miLevel: -1, name: "Off" },
    ...reported.fanSpeeds.map(({ value, name }) => ({ miLevel: value, name })),
  ]);
  const waterspeed = withHomekitTopLevel(
    reported.waterBoxModes.map(({ value, name }) => ({ miLevel: value, name }))
  );
  return waterspeed.length > 0 ? { speed, waterspeed } : { speed };
}
