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
  | "getDoNotDisturb"
  | "setDoNotDisturb"
  | "disableDoNotDisturb"
  | "getRoomMap"
  | "getSerialNumber"
  | "getTimer"
  | "getWaterBoxMode"
  | "pause"
  | "resetConsumable"
  | "resumeCleanRooms"
  | "sendToLocation"
  | "setRawProperty"
  | "setWaterBoxMode"
  | "setCleanMotorMode"
  | "cleanPresets"
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
  getDoNotDisturb: jest.fn(),
  setDoNotDisturb: jest.fn(),
  disableDoNotDisturb: jest.fn(),
  getRoomMap: jest.fn(),
  getSerialNumber: jest.fn(),
  getTimer: jest.fn(),
  getWaterBoxMode: jest.fn(),
  pause: jest.fn(),
  properties: {},
  resetConsumable: jest.fn(),
  resumeCleanRooms: jest.fn(),
  sendToLocation: jest.fn(),
  setRawProperty: jest.fn(),
  setWaterBoxMode: jest.fn(),
  setCleanMotorMode: jest.fn(),
  cleanPresets: jest.fn().mockResolvedValue([]),
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
    // Only robots of a Roborock app account have a Roborock connection
    roborockApiOf: jest.fn().mockReturnValue(undefined),
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
