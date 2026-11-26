import { VACUUM_STATES } from "node-miio";
import { ErrorState, OperationalState, PowerSource } from "./constants";
import {
  toBatChargeLevel,
  toBatChargeState,
  toErrorStateId,
  toOperationalState,
} from "./rvc_mappings";

describe("toOperationalState", () => {
  test.each([
    ["cleaning", OperationalState.Running],
    ["room-cleaning", OperationalState.Running],
    ["zone-cleaning", OperationalState.Running],
    ["cleaning-and-mopping", OperationalState.Running],
    ["remote-control", OperationalState.Running],
    ["paused", OperationalState.Paused],
    ["returning", OperationalState.SeekingCharger],
    ["docking", OperationalState.SeekingCharger],
    ["returning-to-wash-mop", OperationalState.SeekingCharger],
    ["fully-charged", OperationalState.Docked],
    ["docked", OperationalState.Docked],
    ["error", OperationalState.Error],
    ["charging-error", OperationalState.Error],
    ["idle", OperationalState.Stopped],
    ["initiating", OperationalState.Stopped],
    ["sleeping", OperationalState.Stopped],
    ["updating", OperationalState.Stopped],
    ["dust-collection", OperationalState.EmptyingDustBin],
    ["washing-mop", OperationalState.CleaningMop],
    ["drying-mop", OperationalState.CleaningMop],
    ["station-working", OperationalState.CleaningMop],
    ["filling-water-tank", OperationalState.FillingWaterTank],
    ["mapping", OperationalState.UpdatingMaps],
  ])("%s", (state, expected) => {
    expect(toOperationalState(state, 50)).toBe(expected);
  });

  test("charging: Docked once the battery is full", () => {
    expect(toOperationalState("charging", 80)).toBe(OperationalState.Charging);
    expect(toOperationalState("charging", 100)).toBe(OperationalState.Docked);
  });

  // Every state node-miio can report has a Matter state
  test.each(Object.keys(VACUUM_STATES))("%s is translated", (state) => {
    expect(Object.values(OperationalState)).toContain(
      toOperationalState(state, 50)
    );
  });

  test("unknown states", () => {
    expect(toOperationalState("unknown-42")).toBeUndefined();
    expect(toOperationalState("something-new")).toBeUndefined();
    expect(toOperationalState("")).toBeUndefined();
  });
});

describe("toErrorStateId", () => {
  test("Roborock error codes", () => {
    expect(toErrorStateId("roborock.vacuum.s5", { id: 5 })).toBe(
      ErrorState.BrushJammed
    );
    expect(toErrorStateId("rockrobo.vacuum.v1", { id: "9" })).toBe(
      ErrorState.DustBinMissing
    );
  });

  test("other models: from the description", () => {
    expect(
      toErrorStateId("dreame.vacuum.p2028", {
        id: 1,
        description: "Water tank is empty",
      })
    ).toBe(ErrorState.WaterTankEmpty);
  });

  test("unknown errors", () => {
    expect(toErrorStateId("roborock.vacuum.s5", { id: 999 })).toBe(
      ErrorState.UnableToCompleteOperation
    );
  });
});

describe("battery", () => {
  test.each([
    [5, PowerSource.BatChargeLevel.Critical],
    [15, PowerSource.BatChargeLevel.Warning],
    [80, PowerSource.BatChargeLevel.Ok],
  ])("charge level at %s%%", (level, expected) => {
    expect(toBatChargeLevel(level)).toBe(expected);
  });

  test("charge state", () => {
    expect(toBatChargeState(false, 50)).toBe(
      PowerSource.BatChargeState.IsNotCharging
    );
    expect(toBatChargeState(true, 50)).toBe(
      PowerSource.BatChargeState.IsCharging
    );
    expect(toBatChargeState(true, 100)).toBe(
      PowerSource.BatChargeState.IsAtFullCharge
    );
  });
});
