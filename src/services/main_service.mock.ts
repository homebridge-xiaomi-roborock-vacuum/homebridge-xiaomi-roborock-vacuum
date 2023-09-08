import { MainService } from "./main_service";

export type MainServiceMock = jest.Mocked<MainService>;

export const createMainServiceMock = (): MainServiceMock => {
  const mainServiceMock: jest.Mocked<Pick<MainService, keyof MainService>> = {
    cachedState: new Map(),
    init: jest.fn(),
    services: [],
    getCleaning: jest.fn(),
    setCleaning: jest.fn(),
    setSpeed: jest.fn(),
  };

  return mainServiceMock as MainServiceMock;
};
