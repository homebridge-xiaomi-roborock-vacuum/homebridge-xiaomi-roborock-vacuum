export const findSpeedModesMock = jest.fn().mockReturnValue({});

jest.doMock("../utils/find_speed_modes", () => ({
  findSpeedModes: findSpeedModesMock,
}));
