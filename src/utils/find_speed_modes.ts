import { MODELS } from "../models";
import semver from "semver";
import type { ModelDefinition, ModesHomekitVsMiLevel } from "../models/types";
import type { VacuumMode } from "node-miio";

/** Fan speeds and water levels reported by node-miio (e.g. from the device's MIoT spec) */
export interface ReportedModes {
  fanSpeeds: VacuumMode[];
  waterBoxModes: VacuumMode[];
}

/**
 * Finds the speed modes that apply to the current model and firmware version.
 *
 * Models listed in `MODELS` keep using the local definitions. Any other model uses the modes reported by node-miio
 * (when available), so devices like MIoT vacuums get their real fan speeds instead of the Roborock defaults.
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
  if (!MODELS[model] && reported && reported.fanSpeeds.length > 0) {
    return fromReportedModes(reported);
  }

  if (model.startsWith("viomi.")) {
    return MODELS.viomi[0];
  }

  return (MODELS[model] || []).reduce((acc, option) => {
    if (option.firmware) {
      const [, cleanFirmware] =
        (firmware || "").match(/^(\d+\.\d+\.\d+)/) || [];
      return semver.satisfies(cleanFirmware, option.firmware) ? option : acc;
    } else {
      return option;
    }
  }, MODELS.default[0]);
}

/**
 * Assigns the `homekitTopLevel` with proportional steps (same logic as in `models/speedmodes.ts`).
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
 * An "Off" fan speed (-1, which stops the cleaning) is prepended, as in `models/speedmodes.ts`.
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
