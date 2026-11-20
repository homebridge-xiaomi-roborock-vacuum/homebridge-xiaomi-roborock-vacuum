import { Subject } from "rxjs";
import type { XiaomiRoborockVacuumAccessory } from "./accessory";

export const createXiaomiRoborockVacuumAccessoryMock = () => {
  const mock: jest.Mocked<
    Omit<
      Pick<XiaomiRoborockVacuumAccessory, keyof XiaomiRoborockVacuumAccessory>,
      "resolvedRooms" | "roomsReady" | "roomList" | "currentRoom$"
    >
  > & {
    roomsReady: Promise<void>;
    resolvedRooms: Array<{ id: string; name: string }>;
    roomList: Array<{ id: string; name: string }>;
    currentRoom$: Subject<string | undefined>;
  } = {
    identify: jest.fn(),
    getServices: jest.fn().mockReturnValue([]),
    roomsReady: Promise.resolve(),
    resolvedRooms: [],
    roomList: [],
    currentRoom$: new Subject<string | undefined>(),
  };

  return mock;
};
export const XiaomiRoborockVacuumAccessoryMock = jest
  .fn()
  .mockImplementation(createXiaomiRoborockVacuumAccessoryMock);

jest.doMock("./accessory", () => ({
  XiaomiRoborockVacuumAccessory: XiaomiRoborockVacuumAccessoryMock,
}));
