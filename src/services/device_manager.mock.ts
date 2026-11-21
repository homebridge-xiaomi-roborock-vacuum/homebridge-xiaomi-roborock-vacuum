import { Subject } from "rxjs";
import { DeviceManager } from "./device_manager";
import { miio, type MiioDeviceMock } from "../test.mocks";

/** The vacuum is only partially mocked (see `MiioDeviceMock`) */
export type DeviceManagerMock = jest.Mocked<DeviceManager> & {
  device: MiioDeviceMock;
};

export const createDeviceManagerMock = (): DeviceManagerMock => {
  const deviceManagerMock: jest.Mocked<
    Pick<DeviceManager, Exclude<keyof DeviceManager, "device">>
  > & { device: MiioDeviceMock } = {
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
    roomName: jest.fn(),
  };

  return deviceManagerMock as unknown as DeviceManagerMock;
};
