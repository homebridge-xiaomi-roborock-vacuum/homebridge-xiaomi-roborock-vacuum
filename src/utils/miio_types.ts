import { Socket } from "net";

// TODO: Move these to the `miio` library once it supports typescript

export interface MiioDevice {
  miioModel?: string;
  handle: {
    api: {
      parent: {
        get socket(): Socket;
      };
    };
  };
  destroy: () => void;
  property: <T>(propertyName: string) => T | undefined;
  properties: Record<string, unknown>;
  on: <T>(eventName: string, cb: (value: T) => void) => void;
  matches: (str: string) => boolean;
  poll: () => Promise<void>;
  find: () => Promise<void>;
  state: () => Promise<MiioState>;
  getDeviceInfo: () => Promise<MiioDeviceInfo>;
  getSerialNumber: () => Promise<string>;
  batteryLevel: () => Promise<number>;
  getTimer: () => Promise<any>;
  getRoomMap: () => Promise<[string, string][]>;
  activateCleaning: () => Promise<void>;
  activateCharging: () => Promise<void>;
  pause: () => Promise<void>;
  cleanRooms: (roomIds: Array<number | string>) => Promise<void>;
  resumeCleanRooms: (roomIds: Array<number | string>) => Promise<void>;
  fanSpeed: () => Promise<number>;
  changeFanSpeed: (miLevel: number) => Promise<void>;
  getWaterBoxMode: () => Promise<number>;
  setWaterBoxMode: (miLevel: number) => Promise<void>;
  startDustCollection: () => Promise<void>;
  stopDustCollection: () => Promise<void>;
  sendToLocation: (x: number, y: number) => Promise<void>;
  setRawProperty: (key: string, value: unknown) => Promise<void>;
  cleanZones: (zonesToClean: number[][]) => Promise<void>;
  /** Available since node-miio 0.3.0-beta.4 */
  fanSpeeds?: () => Promise<MiioVacuumMode[]>;
  /** Available since node-miio 0.3.0-beta.4 (empty if the model doesn't support it) */
  waterBoxModes?: () => Promise<MiioVacuumMode[]>;
}

export interface MiioVacuumMode {
  value: number;
  name: string;
}

export interface MiioState {
  cleaning?: boolean;
  charging?: boolean;
  fanSpeed?: number;
  batteryLevel?: number;
  water_box_mode?: string;
}

export interface MiioDeviceInfo {
  fw_ver: string;
}
