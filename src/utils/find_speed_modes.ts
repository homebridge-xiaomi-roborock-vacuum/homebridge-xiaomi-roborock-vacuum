import { MODELS } from "../models";
import semver from "semver";

export function findSpeedModes(model: string, firmware?: string) {
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
