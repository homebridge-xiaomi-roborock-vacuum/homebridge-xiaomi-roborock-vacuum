import { vi, type Mocked } from "vitest";
import { Subject } from "rxjs";
import type { XiaomiRoborockVacuumAccessory } from "./accessory";

export const createXiaomiRoborockVacuumAccessoryMock = () => {
  const mock: Mocked<
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
    identify: vi.fn(),
    getServices: vi.fn().mockReturnValue([]),
    roomsReady: Promise.resolve(),
    resolvedRooms: [],
    roomList: [],
    currentRoom$: new Subject<string | undefined>(),
  };

  return mock;
};
export const XiaomiRoborockVacuumAccessoryMock = vi
  .fn()
  // A `function`: the plugin calls it with `new`
  .mockImplementation(function () {
    return createXiaomiRoborockVacuumAccessoryMock();
  });

vi.doMock("./accessory", () => ({
  XiaomiRoborockVacuumAccessory: XiaomiRoborockVacuumAccessoryMock,
}));
