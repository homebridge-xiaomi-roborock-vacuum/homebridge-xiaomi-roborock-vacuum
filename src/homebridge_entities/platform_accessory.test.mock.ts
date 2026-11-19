import type { XiaomiRoborockVacuumAccessory } from "./accessory";

export const createXiaomiRoborockVacuumAccessoryMock = () => {
  const mock: jest.Mocked<
    Omit<
      Pick<XiaomiRoborockVacuumAccessory, keyof XiaomiRoborockVacuumAccessory>,
      "resolvedRooms" | "roomsReady"
    >
  > & {
    roomsReady: Promise<void>;
    resolvedRooms: Array<{ id: string; name: string }>;
  } = {
    identify: jest.fn(),
    getServices: jest.fn().mockReturnValue([]),
    roomsReady: Promise.resolve(),
    resolvedRooms: [],
  };

  return mock;
};
export const XiaomiRoborockVacuumAccessoryMock = jest
  .fn()
  .mockImplementation(createXiaomiRoborockVacuumAccessoryMock);

jest.doMock("./accessory", () => ({
  XiaomiRoborockVacuumAccessory: XiaomiRoborockVacuumAccessoryMock,
}));
