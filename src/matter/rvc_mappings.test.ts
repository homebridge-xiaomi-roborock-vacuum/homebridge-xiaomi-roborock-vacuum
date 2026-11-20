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
    ["sweeping-and-mopping", OperationalState.Running],
    ["paused", OperationalState.Paused],
    ["returning", OperationalState.SeekingCharger],
    ["docking", OperationalState.SeekingCharger],
    ["fully-charged", OperationalState.Docked],
    ["error", OperationalState.Error],
    ["charging-error", OperationalState.Error],
    ["idle", OperationalState.Stopped],
    ["sleeping", OperationalState.Stopped],
    ["dust-collection", OperationalState.EmptyingDustBin],
    ["washing-mop", OperationalState.CleaningMop],
    ["drying", OperationalState.CleaningMop],
    ["refilling-water", OperationalState.FillingWaterTank],
    ["building-map", OperationalState.UpdatingMaps],
  ])("%s", (state, expected) => {
    expect(toOperationalState(state, 50)).toBe(expected);
  });

  test("charging: Docked once the battery is full", () => {
    expect(toOperationalState("charging", 80)).toBe(OperationalState.Charging);
    expect(toOperationalState("charging", 100)).toBe(OperationalState.Docked);
  });

  test("unknown states", () => {
    expect(toOperationalState("something-new")).toBeUndefined();
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
