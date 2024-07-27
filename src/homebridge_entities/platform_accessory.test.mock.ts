import { XiaomiRoborockVacuumAccessory } from "./accessory";

export const XiaomiRoborockVacuumAccessoryMock = jest
  .fn()
  .mockImplementation(() => {
    const mock: jest.Mocked<
      Pick<XiaomiRoborockVacuumAccessory, keyof XiaomiRoborockVacuumAccessory>
    > = {
      identify: jest.fn(),
      getServices: jest.fn().mockReturnValue([]),
    };

    return mock;
  });

jest.doMock("./accessory", () => ({
  XiaomiRoborockVacuumAccessory: XiaomiRoborockVacuumAccessoryMock,
}));
