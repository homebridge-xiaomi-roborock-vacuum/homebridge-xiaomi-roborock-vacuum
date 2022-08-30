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
    jest.fn()
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("it should log info messages by default", () => {
    const infoSpy = jest.spyOn(homebridgeLogger, "info");
    const logger = getLogger(homebridgeLogger, {});
    logger.info("Test message");
    expect(infoSpy).toHaveBeenCalledWith("[Model=unknown] Test message");
  });

  test("it not should log info messages if silent === true", () => {
    const infoSpy = jest.spyOn(homebridgeLogger, "info");
    const logger = getLogger(homebridgeLogger, { silent: true });
    logger.info("Test message");
    expect(infoSpy).not.toHaveBeenCalledWith("Test message");
  });
});
