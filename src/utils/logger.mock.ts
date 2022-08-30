import { Logger } from "./logger";

export const getLoggerMock = (): jest.Mocked<Logger> => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  setModel: jest.fn(),
});
