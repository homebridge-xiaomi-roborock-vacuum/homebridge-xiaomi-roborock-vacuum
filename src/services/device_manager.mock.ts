import { Subject } from "rxjs";
import { DeviceManager } from "./device_manager";
import { miio } from "../test.mocks";

export type DeviceManagerMock = jest.Mocked<
  Pick<DeviceManager, keyof DeviceManager>
>;

export const createDeviceManagerMock = (): DeviceManagerMock => {
  return {
    errorChanged$: new Subject(),
    stateChanged$: new Subject(),
    deviceConnected$: new Subject(),
    model: "test-model",
    state: "cleaning",
    isCleaning: true,
    isPaused: false,
    device: miio.device as any, // TODO: Replace this with actual miio mock
    property: jest.fn(),
    ensureDevice: jest.fn(),
  };
};
