import { API, Categories, Logging } from "homebridge";
import { Service } from "hap-nodejs";

import { createHomebridgeMock, miio } from "../test.mocks";
import { XiaomiRoborockVacuumAccessoryMock } from "./platform_accessory.test.mock";
import { deviceManagerMock } from "./accessory.test.mock";
import { XiaomiRoborockVacuumPlatformAccessoryInitializer } from "./platform_accessory";
import { XiaomiRoborockVacuumPlatformAccessory } from "./platform";
import { Subject } from "rxjs";
import { MiioDevice } from "../utils/miio_types";

function newAccessory(): XiaomiRoborockVacuumPlatformAccessory {
  const name = "test";
  const uuid = "test-test";
  return {
    context: { name },
    on: jest.fn(),
    emit: jest.fn(),
    displayName: name,
    UUID: uuid,
    category: Categories.FAN,
    services: [],
    addListener: jest.fn(),
    addService: jest.fn(),
    getServices: jest.fn(() => []),
  } as unknown as XiaomiRoborockVacuumPlatformAccessory;
}

describe("XiaomiRoborockVacuumPlatformAccessoryInitializer", () => {
  let homebridge: jest.Mocked<API>;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;
  const log: Logging = console as unknown as Logging;

  beforeEach(() => {
    homebridge = createHomebridgeMock();
    // Silencing the logger in the tests to reduce noise.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "info").mockImplementation();
    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();

    miio.device.find.mockRejectedValue(
      new Error("Something went terribly wrong")
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    const config = {
      name: "robot",
      ip: "my.ip",
    };

    // Can't make it work yet
    test.skip("after connect, adds services to the accessory", async () => {
      const accessory = newAccessory();
      XiaomiRoborockVacuumAccessoryMock.mockReturnValue([
        new Service.Switch("Test", "super cool"),
      ]);
      const platformAccessory =
        new XiaomiRoborockVacuumPlatformAccessoryInitializer(
          log,
          config,
          homebridge,
          accessory
        );
      (deviceManagerMock.deviceConnected$ as Subject<MiioDevice>).next(
        miio.device
      );

      expect(accessory.addService).toHaveBeenCalledTimes(1);
    });
  });
});
