import { vi } from "vitest";
import { createDeviceManagerMock } from "../services/device_manager.mock.js";

export const deviceManagerMock = createDeviceManagerMock();

vi.doMock("../services/device_manager.js", () => ({
  // A `function`: the plugin calls it with `new`
  DeviceManager: vi.fn(function () {
    return deviceManagerMock;
  }),
}));
