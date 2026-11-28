import { vi, type Mocked } from "vitest";
import { Subject } from "rxjs";
import { DeviceManager } from "./device_manager.js";
import { miio, type MiioDeviceMock } from "../test.mocks.js";

/** The vacuum is only partially mocked (see `MiioDeviceMock`) */
export type DeviceManagerMock = Mocked<DeviceManager> & {
  device: MiioDeviceMock;
};

export const createDeviceManagerMock = (): DeviceManagerMock => {
  const deviceManagerMock: Mocked<
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
    // Generic: vi.fn() can't infer it
    property: vi.fn() as DeviceManagerMock["property"],
    ensureDevice: vi.fn(),
    roomName: vi.fn(),
  };

  return deviceManagerMock as unknown as DeviceManagerMock;
};
