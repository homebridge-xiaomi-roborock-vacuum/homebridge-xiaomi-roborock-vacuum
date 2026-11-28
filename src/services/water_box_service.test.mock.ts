import { vi } from "vitest";

export const findSpeedModesMock = vi.fn().mockReturnValue({});

vi.doMock("../utils/find_speed_modes.js", () => ({
  findSpeedModes: findSpeedModesMock,
}));
