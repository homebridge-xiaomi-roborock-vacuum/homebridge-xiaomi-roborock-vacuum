import { describe, test, expect, vi } from "vitest";
import type { VacuumDevice } from "node-miio";
import { supports } from "./supports.js";

describe("supports", () => {
  const device = {
    cleanZones: vi.fn(),
    notAFunction: 42,
  } as unknown as VacuumDevice;

  test("is true when the vacuum has the method", () => {
    expect(supports(device, "cleanZones")).toBe(true);
  });

  test("is false when it doesn't (e.g. a MIoT vacuum and a Roborock-only method)", () => {
    expect(supports(device, "sendToLocation")).toBe(false);
    expect(supports(device, "notAFunction")).toBe(false);
  });
});
