import { vi, type Mocked } from "vitest";
import { Logger } from "./logger";

export type LoggerMock = Mocked<Logger>;

export const getLoggerMock = (): LoggerMock => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  setModel: vi.fn(),
});
