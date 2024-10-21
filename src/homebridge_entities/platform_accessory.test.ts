import { API, Categories, Logging } from "homebridge";
import { Service } from "hap-nodejs";
import { Subject } from "rxjs";

import { createHomebridgeMock, miio } from "../test.mocks";
import {
  createXiaomiRoborockVacuumAccessoryMock,
  XiaomiRoborockVacuumAccessoryMock,
} from "./platform_accessory.test.mock";
import { deviceManagerMock } from "./accessory.test.mock";
import { XiaomiRoborockVacuumPlatformAccessoryInitializer } from "./platform_accessory";
import { XiaomiRoborockVacuumPlatformAccessory } from "./platform";
import { MiioDevice } from "../utils/miio_types";

function newAccessory(): XiaomiRoborockVacuumPlatformAccessory {
  const name = "test";
  const uuid = "test-test";
  const accessory = {
    context: { name },
    on: jest.fn(),
    emit: jest.fn(),
    displayName: name,
    UUID: uuid,
    category: Categories.FAN,
    services: [
      new Service.AccessoryInformation("Preexisting info", "info"),
      new Service.Switch("Preexisting"),
    ],
    addListener: jest.fn(),
    addService: jest.fn(),
    getServices: jest.fn(() => accessory.services),
    getServiceById: jest.fn(),
  } as unknown as XiaomiRoborockVacuumPlatformAccessory;
  return accessory;
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

    test("after connect, adds services to the accessory", async () => {
      const accessory = newAccessory();
      const instanceMock = createXiaomiRoborockVacuumAccessoryMock();
      jest
        .spyOn(accessory, "getServiceById")
        .mockReturnValueOnce(accessory.services[0]);

      instanceMock.getServices.mockReturnValue([
        ...accessory.services,
        new Service.Switch("Test", "super cool"),
        new Service.Switch("Test 2"),
      ]);

      const accessorySpy = jest.spyOn(
        accessory.services[0],
        "replaceCharacteristicsFromService"
      );

      const setPrimaryServiceSpy = jest.spyOn(
        accessory.services[1],
        "setPrimaryService"
      );

      XiaomiRoborockVacuumAccessoryMock.mockReturnValue(instanceMock);
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

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(accessorySpy).toHaveBeenCalledTimes(1);
      expect(setPrimaryServiceSpy).toHaveBeenCalledTimes(2);
      expect(accessory.addService).toHaveBeenCalledTimes(1);
    });
  });
});
