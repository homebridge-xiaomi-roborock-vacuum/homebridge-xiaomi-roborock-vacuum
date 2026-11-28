import { vi, type Mocked } from "vitest";
import { MainService } from "./main_service.js";

export type MainServiceMock = Mocked<MainService>;

export const createMainServiceMock = (): MainServiceMock => {
  const mainServiceMock: Mocked<Pick<MainService, keyof MainService>> = {
    cachedState: new Map(),
    init: vi.fn(),
    services: [],
    getCleaning: vi.fn(),
    setCleaning: vi.fn(),
    setSpeed: vi.fn(),
  };

  return mainServiceMock as MainServiceMock;
};
