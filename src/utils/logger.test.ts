import { Logging } from "homebridge";
import { getLogger } from "./logger";

describe("getLogger", () => {
  let homebridgeLogger: jest.Mocked<Logging> = Object.assign(
    {
      prefix: "test",
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    },
    jest.fn(),
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test.each(["debug", "info", "warn", "error"] as const)(
    "it should log %p messages by default",
    (level) => {
      const logSpy = jest.spyOn(homebridgeLogger, level);
      const logger = getLogger(homebridgeLogger, {});
      logger[level]("Test message");
      expect(logSpy).toHaveBeenCalledWith("[Model=unknown] Test message");
    },
  );

  test.each(["debug", "info", "warn", "error"] as const)(
    "it should log %p messages with a model set",
    (level) => {
      const logSpy = jest.spyOn(homebridgeLogger, level);
      const logger = getLogger(homebridgeLogger, {});
      logger.setModel("test-model");
      logger[level]("Test message");
      expect(logSpy).toHaveBeenCalledWith("[Model=test-model] Test message");
    },
  );

  describe("if silent === true", () => {
    test.each(["debug", "info"] as const)(
      "it not should log %p messages",
      (level) => {
        const logSpy = jest.spyOn(homebridgeLogger, level);
        const logger = getLogger(homebridgeLogger, { silent: true });
        logger[level]("Test message");
        expect(logSpy).not.toHaveBeenCalled();
      },
    );

    test.each(["warn", "error"] as const)(
      "it should log %p messages",
      (level) => {
        const logSpy = jest.spyOn(homebridgeLogger, level);
        const logger = getLogger(homebridgeLogger, { silent: true });
        logger[level]("Test message");
        expect(logSpy).toHaveBeenCalledWith("[Model=unknown] Test message");
      },
    );
  });
});
