import { vi } from "vitest";
import { createDeviceManagerMock } from "../services/device_manager.mock";

export const deviceManagerMock = createDeviceManagerMock();

vi.doMock("../services/device_manager", () => ({
  // A `function`: the plugin calls it with `new`
  DeviceManager: vi.fn(function () {
    return deviceManagerMock;
  }),
}));
