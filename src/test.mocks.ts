// ============= MIIO MOCKS ================

import { API } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import type { Vacuum } from "node-miio";

/** The members of a node-miio vacuum that the plugin uses (the Roborock `Vacuum` has all of them) */
type MockedMembers =
  | "activateCharging"
  | "activateCleaning"
  | "batteryLevel"
  | "changeFanSpeed"
  | "cleanRooms"
  | "cleanZones"
  | "fanSpeed"
  | "find"
  | "getDeviceInfo"
  | "getRoomMap"
  | "getSerialNumber"
  | "getTimer"
  | "getWaterBoxMode"
  | "pause"
  | "resumeCleanRooms"
  | "sendToLocation"
  | "setRawProperty"
  | "setWaterBoxMode"
  | "startDustCollection"
  | "stopDustCollection"
  | "startMopWash"
  | "stopMopWash"
  | "startMopDrying"
  | "stopMopDrying"
  | "matches"
  | "destroy"
  | "property"
  | "on"
  | "poll"
  | "state";

export type MiioDeviceMock = jest.Mocked<Pick<Vacuum, MockedMembers>> & {
  miioModel: string;
  connected: boolean;
  properties: Record<string, unknown>;
  fanSpeeds?: jest.Mocked<Vacuum>["fanSpeeds"];
  waterBoxModes?: jest.Mocked<Vacuum>["waterBoxModes"];
};

const miioDevice: MiioDeviceMock = {
  miioModel: "test-model",
  connected: true,
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
  properties: {},
  resumeCleanRooms: jest.fn(),
  sendToLocation: jest.fn(),
  setRawProperty: jest.fn(),
  setWaterBoxMode: jest.fn(),
  startDustCollection: jest.fn(),
  stopDustCollection: jest.fn(),
  startMopWash: jest.fn(),
  stopMopWash: jest.fn(),
  startMopDrying: jest.fn(),
  stopMopDrying: jest.fn(),
  matches: jest.fn(),
  destroy: jest.fn(),
  property: jest.fn(),
  on: jest.fn(),
  poll: jest.fn(),
  state: jest.fn().mockReturnValue({}),
};

export const miio = {
  device: miioDevice,
  createMock: () => ({
    device: jest.fn().mockImplementation(() => miioDevice),
    configureLogging: jest.fn(),
    // Same logic as node-miio's
    isVacuum: (device: unknown) =>
      typeof (device as { matches?: unknown })?.matches === "function" &&
      (device as MiioDeviceMock).matches("type:vaccuum"),
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
