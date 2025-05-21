// ============= MIIO MOCKS ================

import { API } from "homebridge";
import * as HapJs from "hap-nodejs";
import { Socket } from "net";
import { MiioDevice } from "./utils/miio_types";

const miioDevice: jest.Mocked<MiioDevice> = {
  miioModel: "test-model",
  activateCharging: jest.fn(),
  activateCleaning: jest.fn(),
  batteryLevel: jest.fn(),
  changeFanSpeed: jest.fn(),
  cleanRooms: jest.fn(),
  cleanZones: jest.fn(),
  fanSpeed: jest.fn(),
  find: jest.fn(),
  getDeviceInfo: jest.fn(),
  getRoomMap: jest.fn(),
  getSerialNumber: jest.fn(),
  getTimer: jest.fn(),
  getWaterBoxMode: jest.fn(),
  pause: jest.fn(),
  properties: jest.fn()(),
  resumeCleanRooms: jest.fn(),
  sendToLocation: jest.fn(),
  setRawProperty: jest.fn(),
  setWaterBoxMode: jest.fn(),
  startDustCollection: jest.fn(),
  stopDustCollection: jest.fn(),
  matches: jest.fn(),
  destroy: jest.fn(),
  property: jest.fn(),
  on: jest.fn(),
  handle: { api: { parent: { socket: {} as unknown as Socket } } },
  poll: jest.fn(),
  state: jest.fn().mockReturnValue({}),
};

export const miio = {
  device: miioDevice,
  createMock: () => ({
    device: jest.fn().mockImplementation(() => miioDevice),
  }),
};

// ============= HOMEBRIDGE MOCKS ================

export const createHomebridgeMock = () =>
  ({
    registerAccessory: jest.fn(),
    hap: HapJs,
    // Platform methods
    on: jest.fn(),
    platformAccessory: jest.fn(),
    registerPlatformAccessories: jest.fn(),
    unregisterPlatformAccessories: jest.fn(),
  }) as unknown as jest.Mocked<API>;
