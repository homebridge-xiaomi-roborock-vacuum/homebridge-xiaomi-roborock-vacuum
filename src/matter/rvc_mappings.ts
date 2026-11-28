import { vacuumActivity, type VacuumActivity } from "node-miio";

import { ErrorState, OperationalState, PowerSource } from "./constants.js";

/** The error reported by node-miio (`errorChanged`) */
export interface MiioError {
  id: number | string;
  description?: string;
}

/**
 * Error codes of the Roborock / Mi Robot vacuums (legacy miIO).
 * Codes without an equivalent Matter error fall back to `UnableToCompleteOperation`.
 */
const ROBOROCK_ERRORS: Record<number, ErrorState> = {
  1: ErrorState.NavigationSensorObscured, // Laser sensor fault
  2: ErrorState.Stuck, // Collision sensor fault
  3: ErrorState.Stuck, // Wheel floating
  4: ErrorState.NavigationSensorObscured, // Cliff sensor fault
  5: ErrorState.BrushJammed, // Main brush blocked
  6: ErrorState.BrushJammed, // Side brush blocked
  7: ErrorState.WheelsJammed, // Wheel blocked
  8: ErrorState.Stuck, // Device stuck
  9: ErrorState.DustBinMissing, // Dust bin missing
  12: ErrorState.LowBattery, // Low battery
  15: ErrorState.NavigationSensorObscured, // Wall sensor fault
  16: ErrorState.Stuck, // Uneven surface
  17: ErrorState.BrushJammed, // Side brush failure
  19: ErrorState.FailedToFindChargingDock, // Unpowered charging station
  21: ErrorState.NavigationSensorObscured, // Laser pressure sensor problem
  22: ErrorState.FailedToFindChargingDock, // Charge sensor problem
  23: ErrorState.FailedToFindChargingDock, // Dock problem
  24: ErrorState.CannotReachTargetArea, // No-go zone or invisible wall detected
  254: ErrorState.DustBinFull, // Bin full
};

/**
 * Keywords in the error message (e.g. the descriptions of the MIoT spec's `vacuum:fault`), checked in order.
 * Each entry needs every pattern to match.
 */
const ERROR_KEYWORDS: Array<[RegExp[], ErrorState]> = [
  [[/dirty[- ]?water/i, /full/i], ErrorState.DirtyWaterTankFull],
  [
    [/dirty[- ]?water/i, /miss|not install|install/i],
    ErrorState.DirtyWaterTankMissing,
  ],
  [[/water/i, /lid/i], ErrorState.WaterTankLidOpen],
  [[/water/i, /empty|low|insufficient|lack|short/i], ErrorState.WaterTankEmpty],
  [[/water/i, /miss|not install|install/i], ErrorState.WaterTankMissing],
  [
    [/mop/i, /miss|not install|install|remove/i],
    ErrorState.MopCleaningPadMissing,
  ],
  [[/dust|bin|box/i, /full/i], ErrorState.DustBinFull],
  [[/dust|bin|box/i, /miss|not install|install/i], ErrorState.DustBinMissing],
  [[/battery/i, /low|insufficient/i], ErrorState.LowBattery],
  [[/brush|roller/i], ErrorState.BrushJammed],
  [[/wheel/i], ErrorState.WheelsJammed],
  [[/stuck|trapped|suspended|float|uneven|tilt/i], ErrorState.Stuck],
  [
    [/no-?go|forbidden|restricted|virtual wall|invisible wall/i],
    ErrorState.CannotReachTargetArea,
  ],
  [
    [/laser|lidar|lds|cliff|sensor|radar|camera/i],
    ErrorState.NavigationSensorObscured,
  ],
  [[/dock|charg|station|base|return/i], ErrorState.FailedToFindChargingDock],
];

/**
 * Translates an error reported by node-miio into a Matter RVC error state.
 *
 * @param model The device model (e.g. `roborock.vacuum.s5`)
 * @param error The error reported by node-miio
 * @returns The Matter error state
 */
export function toErrorStateId(model: string, error: MiioError): ErrorState {
  const code = Number(error.id);
  if (/^(roborock|rockrobo)\./.test(model) && code in ROBOROCK_ERRORS) {
    return ROBOROCK_ERRORS[code];
  }
  const message = error.description ?? "";
  for (const [patterns, errorState] of ERROR_KEYWORDS) {
    if (patterns.every((pattern) => pattern.test(message))) return errorState;
  }
  return ErrorState.UnableToCompleteOperation;
}

/** Matter operational state of each activity reported by node-miio (`vacuumActivity`) */
const OPERATIONAL_STATES: Record<VacuumActivity, OperationalState> = {
  stopped: OperationalState.Stopped,
  running: OperationalState.Running,
  paused: OperationalState.Paused,
  returning: OperationalState.SeekingCharger,
  charging: OperationalState.Charging,
  docked: OperationalState.Docked,
  error: OperationalState.Error,
  "emptying-dust-bin": OperationalState.EmptyingDustBin,
  "cleaning-mop": OperationalState.CleaningMop,
  "filling-water-tank": OperationalState.FillingWaterTank,
  "updating-maps": OperationalState.UpdatingMaps,
};

/**
 * Translates the state reported by node-miio into a Matter RVC operational state, from its activity (node-miio's
 * `vacuumActivity`: the dock and maintenance activities use the states added in revision 4 of the cluster).
 * `charging` is reported as `Docked` when the battery is full.
 *
 * @param state The state reported by node-miio
 * @param batteryLevel The battery level (to tell `Charging` from `Docked`)
 * @returns The Matter state, or `undefined` if the state is unknown (`unknown-<code>`)
 */
export function toOperationalState(
  state: string,
  batteryLevel?: number
): OperationalState | undefined {
  const activity = vacuumActivity(state);
  if (activity === undefined) return undefined;
  if (activity === "charging" && batteryLevel === 100) {
    return OperationalState.Docked;
  }
  return OPERATIONAL_STATES[activity];
}

/**
 * @param batteryLevel The battery level (%)
 * @returns The battery charge level (OK, Warning, Critical)
 */
export function toBatChargeLevel(batteryLevel: number) {
  if (batteryLevel < 10) return PowerSource.BatChargeLevel.Critical;
  if (batteryLevel < 20) return PowerSource.BatChargeLevel.Warning;
  return PowerSource.BatChargeLevel.Ok;
}

/**
 * @param charging Whether the robot is charging
 * @param batteryLevel The battery level (%)
 * @returns The battery charge state
 */
export function toBatChargeState(charging: boolean, batteryLevel?: number) {
  if (!charging) return PowerSource.BatChargeState.IsNotCharging;
  return batteryLevel === 100
    ? PowerSource.BatChargeState.IsAtFullCharge
    : PowerSource.BatChargeState.IsCharging;
}
