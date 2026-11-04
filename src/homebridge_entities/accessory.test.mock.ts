import { createDeviceManagerMock } from "../services/device_manager.mock";

export const deviceManagerMock = createDeviceManagerMock();

jest.doMock("../services/device_manager", () => ({
  DeviceManager: jest.fn().mockReturnValue(deviceManagerMock),
}));
