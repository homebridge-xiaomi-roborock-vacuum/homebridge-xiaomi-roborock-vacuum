import { ErrorState, OperationalState, PowerSource } from "./constants";

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

const RUNNING_STATES = new Set([
  "cleaning",
  "spot-cleaning",
  "room-cleaning",
  "zone-cleaning",
  "manual-cleaning",
  "sweeping",
  "mopping",
  "sweeping-and-mopping",
]);

/**
 * Translates the state reported by node-miio into a Matter RVC operational state.
 *
 * - `charging` is reported as `Docked` when the battery is full.
 * - The auxiliary states (dock and maintenance activities) use the states added in revision 4 of the cluster. node-miio
 *   normalizes them, e.g. `dust-collection` (Roborock), or the kebab-cased descriptions of the MIoT spec
 *   (`dustcollecting`, `drying`…).
 *
 * @param state The state reported by node-miio
 * @param batteryLevel The battery level (to tell `Charging` from `Docked`)
 * @returns The Matter state, or `undefined` if the state is unknown
 */
export function toOperationalState(
  state: string,
  batteryLevel?: number
): OperationalState | undefined {
  if (RUNNING_STATES.has(state)) return OperationalState.Running;
  switch (state) {
    case "paused":
      return OperationalState.Paused;
    case "returning":
    case "docking":
      return OperationalState.SeekingCharger;
    case "charging":
      return batteryLevel === 100
        ? OperationalState.Docked
        : OperationalState.Charging;
    case "fully-charged":
      return OperationalState.Docked;
    case "error":
    case "charging-error":
      return OperationalState.Error;
    case "initializing":
    case "idle":
    case "sleeping":
    case "waiting":
      return OperationalState.Stopped;
  }
  if (/dust|emptying/.test(state)) return OperationalState.EmptyingDustBin;
  if (/wash|dry|self-?clean|station-?working/.test(state)) {
    return OperationalState.CleaningMop;
  }
  if (/water|refill|filling/.test(state)) {
    return OperationalState.FillingWaterTank;
  }
  if (/map|building|relocat/.test(state)) return OperationalState.UpdatingMaps;
  return undefined;
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
