// ============= MIIO MOCKS ================

import { vi, type Mocked } from "vitest";
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
  | "getMaps"
  | "loadMap"
  | "getBackupMaps"
  | "loadBackupMap"
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

export type MiioDeviceMock = Mocked<Pick<Vacuum, MockedMembers>> & {
  miioModel: string;
  connected: boolean;
  properties: Record<string, unknown>;
  fanSpeeds?: Mocked<Vacuum>["fanSpeeds"];
  waterBoxModes?: Mocked<Vacuum>["waterBoxModes"];
};

const miioDevice: MiioDeviceMock = {
  miioModel: "test-model",
  connected: true,
  activateCharging: vi.fn(),
  activateCleaning: vi.fn(),
  batteryLevel: vi.fn(),
  changeFanSpeed: vi.fn(),
  cleanRooms: vi.fn(),
  cleanZones: vi.fn(),
  fanSpeed: vi.fn(),
  find: vi.fn(),
  getDeviceInfo: vi.fn(),
  getDoNotDisturb: vi.fn(),
  setDoNotDisturb: vi.fn(),
  disableDoNotDisturb: vi.fn(),
  getRoomMap: vi.fn(),
  getMaps: vi.fn().mockResolvedValue([]),
  loadMap: vi.fn(),
  getBackupMaps: vi.fn().mockResolvedValue([]),
  loadBackupMap: vi.fn(),
  getSerialNumber: vi.fn(),
  getTimer: vi.fn(),
  getWaterBoxMode: vi.fn(),
  pause: vi.fn(),
  properties: {},
  resetConsumable: vi.fn(),
  resumeCleanRooms: vi.fn(),
  sendToLocation: vi.fn(),
  setRawProperty: vi.fn(),
  setWaterBoxMode: vi.fn(),
  setCleanMotorMode: vi.fn(),
  cleanPresets: vi.fn().mockResolvedValue([]),
  startDustCollection: vi.fn(),
  stopDustCollection: vi.fn(),
  startMopWash: vi.fn(),
  stopMopWash: vi.fn(),
  startMopDrying: vi.fn(),
  stopMopDrying: vi.fn(),
  matches: vi.fn(),
  destroy: vi.fn(),
  // Generic: vi.fn() can't infer it
  property: vi.fn() as MiioDeviceMock["property"],
  on: vi.fn(),
  poll: vi.fn(),
  state: vi.fn().mockReturnValue({}),
};

export const miio = {
  device: miioDevice,
  createMock: async () => {
    const actual =
      await vi.importActual<typeof import("node-miio")>("node-miio");
    return {
      device: vi.fn().mockImplementation(() => miioDevice),
      configureLogging: vi.fn(),
      // Only robots of a Roborock app account have a Roborock connection
      roborockApiOf: vi.fn().mockReturnValue(undefined),
      // node-miio's own (pure functions of the state)
      isCleaningState: actual.isCleaningState,
      isKnownVacuumState: actual.isKnownVacuumState,
      vacuumActivity: actual.vacuumActivity,
      // Same logic as node-miio's
      isVacuum: (device: unknown) =>
        typeof (device as { matches?: unknown })?.matches === "function" &&
        (device as MiioDeviceMock).matches("type:vacuum"),
    };
  },
};

// ============= HOMEBRIDGE MOCKS ================

export const createHomebridgeMock = () =>
  ({
    registerAccessory: vi.fn(),
    hap: HapJs,
    // Platform methods
    on: vi.fn(),
    platformAccessory: vi.fn(),
    registerPlatformAccessories: vi.fn(),
    unregisterPlatformAccessories: vi.fn(),
  }) as unknown as Mocked<API>;
