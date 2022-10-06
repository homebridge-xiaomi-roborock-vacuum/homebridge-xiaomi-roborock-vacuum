import { Subject } from "rxjs";
import { DeviceManager } from "./device_manager";
import { miio } from "../test.mocks";

export type DeviceManagerMock = jest.Mocked<DeviceManager>;

export const createDeviceManagerMock = (): DeviceManagerMock => {
  const deviceManagerMock: jest.Mocked<
    Pick<DeviceManager, keyof DeviceManager>
  > = {
    errorChanged$: new Subject(),
    stateChanged$: new Subject(),
    deviceConnected$: new Subject(),
    model: "test-model",
    state: "cleaning",
    isCleaning: true,
    isPaused: false,
    device: miio.device,
    property: jest.fn(),
    ensureDevice: jest.fn(),
  };

  return deviceManagerMock as DeviceManagerMock;
};
