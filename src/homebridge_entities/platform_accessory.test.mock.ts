import type { XiaomiRoborockVacuumAccessory } from "./accessory";

export const createXiaomiRoborockVacuumAccessoryMock = () => {
  const mock: jest.Mocked<
    Pick<XiaomiRoborockVacuumAccessory, keyof XiaomiRoborockVacuumAccessory>
  > = {
    identify: jest.fn(),
    getServices: jest.fn().mockReturnValue([]),
  };

  return mock;
};
export const XiaomiRoborockVacuumAccessoryMock = jest
  .fn()
  .mockImplementation(createXiaomiRoborockVacuumAccessoryMock);

jest.doMock("./accessory", () => ({
  XiaomiRoborockVacuumAccessory: XiaomiRoborockVacuumAccessoryMock,
}));
