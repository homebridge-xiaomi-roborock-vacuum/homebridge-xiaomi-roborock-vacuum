/**
 * Values from the Matter specification (the same ones as matter.js).
 *
 * Homebridge's `api.matter.types` only exports `RvcOperationalState` (as of Homebridge 2.5), so they're defined here.
 * Keeping them local also means the tests don't need to load matter.js.
 */

/** Matter device type: Robotic Vacuum Cleaner */
export const ROBOTIC_VACUUM_CLEANER_DEVICE_TYPE = 0x74;

/** RVC Run Mode: mode tags */
export const RunModeTag = {
  Idle: 16384,
  Cleaning: 16385,
  Mapping: 16386,
} as const;

/** RVC Clean Mode: mode tags (the common mode tags, plus the RVC-specific ones) */
export const CleanModeTag = {
  Auto: 0,
  Quick: 1,
  Quiet: 2,
  LowNoise: 3,
  LowEnergy: 4,
  Vacation: 5,
  Min: 6,
  Max: 7,
  Night: 8,
  Day: 9,
  DeepClean: 16384,
  Vacuum: 16385,
  Mop: 16386,
  VacuumThenMop: 16387,
} as const;
export type CleanModeTag = (typeof CleanModeTag)[keyof typeof CleanModeTag];

/** RVC Operational State: states */
export const OperationalState = {
  Stopped: 0,
  Running: 1,
  Paused: 2,
  Error: 3,
  SeekingCharger: 64,
  Charging: 65,
  Docked: 66,
  // Revision 4 of the cluster: dock and maintenance activities
  EmptyingDustBin: 67,
  CleaningMop: 68,
  FillingWaterTank: 69,
  UpdatingMaps: 70,
} as const;
export type OperationalState =
  (typeof OperationalState)[keyof typeof OperationalState];

/** RVC Operational State: errors */
export const ErrorState = {
  NoError: 0,
  UnableToStartOrResume: 1,
  UnableToCompleteOperation: 2,
  CommandInvalidInState: 3,
  FailedToFindChargingDock: 64,
  Stuck: 65,
  DustBinMissing: 66,
  DustBinFull: 67,
  WaterTankEmpty: 68,
  WaterTankMissing: 69,
  WaterTankLidOpen: 70,
  MopCleaningPadMissing: 71,
  LowBattery: 72,
  CannotReachTargetArea: 73,
  DirtyWaterTankFull: 74,
  DirtyWaterTankMissing: 75,
  WheelsJammed: 76,
  BrushJammed: 77,
  NavigationSensorObscured: 78,
} as const;
export type ErrorState = (typeof ErrorState)[keyof typeof ErrorState];

/** Power Source cluster values */
export const PowerSource = {
  Status: { Active: 1 },
  BatChargeLevel: { Ok: 0, Warning: 1, Critical: 2 },
  BatReplaceability: { NotReplaceable: 1 },
  BatChargeState: {
    Unknown: 0,
    IsCharging: 1,
    IsAtFullCharge: 2,
    IsNotCharging: 3,
  },
} as const;

/** RVC Run Mode: the modes this plugin supports */
export const RunMode = { Idle: 1, Cleaning: 2 } as const;

export const SUPPORTED_RUN_MODES = [
  { label: "Idle", mode: RunMode.Idle, modeTags: [{ value: RunModeTag.Idle }] },
  {
    label: "Cleaning",
    mode: RunMode.Cleaning,
    modeTags: [{ value: RunModeTag.Cleaning }],
  },
];

export const SUPPORTED_OPERATIONAL_STATES = [
  OperationalState.Stopped,
  OperationalState.Running,
  OperationalState.Paused,
  OperationalState.Error,
  OperationalState.SeekingCharger,
  OperationalState.Charging,
  OperationalState.Docked,
  OperationalState.EmptyingDustBin,
  OperationalState.CleaningMop,
  OperationalState.FillingWaterTank,
  OperationalState.UpdatingMaps,
].map((operationalStateId) => ({ operationalStateId }));
