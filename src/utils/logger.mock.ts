import { Logger } from "./logger";

export type LoggerMock = jest.Mocked<Logger>;

export const getLoggerMock = (): LoggerMock => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  setModel: jest.fn(),
});
