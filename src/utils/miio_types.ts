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
  cleanRooms: (roomIds: string[]) => Promise<void>;
  fanSpeed: () => Promise<number>;
  changeFanSpeed: (miLevel: number) => Promise<void>;
  getWaterBoxMode: () => Promise<number>;
  setWaterBoxMode: (miLevel: number) => Promise<void>;
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
