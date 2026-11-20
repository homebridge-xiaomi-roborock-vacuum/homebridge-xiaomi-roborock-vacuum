import type { API, Logging } from "homebridge";
import { Service, Categories } from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";

import { createHomebridgeMock, miio } from "../test.mocks";
import {
  createXiaomiRoborockVacuumAccessoryMock,
  XiaomiRoborockVacuumAccessoryMock,
} from "./platform_accessory.test.mock";
import { deviceManagerMock } from "./accessory.test.mock";
import { XiaomiRoborockVacuumPlatformAccessoryInitializer } from "./platform_accessory";
import { XiaomiRoborockVacuumPlatformAccessory } from "./platform";
import type { MiioDeviceMock as MiioDevice } from "../test.mocks";

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
    removeService: jest.fn(),
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
      (
        deviceManagerMock.deviceConnected$ as unknown as Subject<MiioDevice>
      ).next(miio.device);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(accessorySpy).toHaveBeenCalledTimes(1);
      expect(setPrimaryServiceSpy).toHaveBeenCalledTimes(2);
      expect(accessory.addService).toHaveBeenCalledTimes(1);
    });

    const connect = async (
      accessory: XiaomiRoborockVacuumPlatformAccessory,
      instanceMock: ReturnType<typeof createXiaomiRoborockVacuumAccessoryMock>
    ) => {
      XiaomiRoborockVacuumAccessoryMock.mockReturnValue(instanceMock);
      new XiaomiRoborockVacuumPlatformAccessoryInitializer(
        log,
        config,
        homebridge,
        accessory
      );
      (
        deviceManagerMock.deviceConnected$ as unknown as Subject<MiioDevice>
      ).next(miio.device);
      await new Promise((resolve) => setTimeout(resolve, 0));
    };

    test("passes the cached rooms and persists the resolved ones", async () => {
      const accessory = newAccessory();
      accessory.context.rooms = [{ id: "16", name: "Kitchen" }];
      const instanceMock = createXiaomiRoborockVacuumAccessoryMock();
      instanceMock.resolvedRooms = [
        { id: "16", name: "Kitchen" },
        { id: "17", name: "Bedroom" },
      ];
      await connect(accessory, instanceMock);

      expect(XiaomiRoborockVacuumAccessoryMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          cachedRooms: [{ id: "16", name: "Kitchen" }],
        }),
        homebridge,
        expect.anything(),
        undefined // No Xiaomi Cloud
      );
      expect(accessory.context.rooms).toEqual(instanceMock.resolvedRooms);
    });

    test("keeps the cached rooms when none could be resolved", async () => {
      const accessory = newAccessory();
      accessory.context.rooms = [{ id: "16", name: "Kitchen" }];
      await connect(accessory, createXiaomiRoborockVacuumAccessoryMock());
      expect(accessory.context.rooms).toEqual([{ id: "16", name: "Kitchen" }]);
    });

    test("waits for the rooms before registering the services", async () => {
      const accessory = newAccessory();
      const instanceMock = createXiaomiRoborockVacuumAccessoryMock();
      let resolveRooms = () => {};
      instanceMock.roomsReady = new Promise<void>((resolve) => {
        resolveRooms = resolve;
      });
      instanceMock.getServices.mockReturnValue([
        new Service.Switch("Room", "roomService16"),
      ]);
      await connect(accessory, instanceMock);
      expect(instanceMock.getServices).not.toHaveBeenCalled();
      expect(accessory.addService).not.toHaveBeenCalled();

      resolveRooms();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(accessory.addService).toHaveBeenCalledTimes(1);
    });

    test("removes the cached services that are no longer exposed", async () => {
      const accessory = newAccessory();
      const staleRoom = new Service.Switch("Old room", "roomService99");
      accessory.services.push(staleRoom);
      const instanceMock = createXiaomiRoborockVacuumAccessoryMock();
      instanceMock.getServices.mockReturnValue([accessory.services[1]]);
      await connect(accessory, instanceMock);

      expect(accessory.removeService).toHaveBeenCalledTimes(1);
      expect(accessory.removeService).toHaveBeenCalledWith(staleRoom);
    });

    describe("waterBox auto-detection", () => {
      const configFor = () =>
        XiaomiRoborockVacuumAccessoryMock.mock.calls[0][1] as Record<
          string,
          unknown
        >;

      afterEach(() => {
        (deviceManagerMock as { reportedModes?: unknown }).reportedModes =
          undefined;
      });

      test("enables it when the model supports water levels", async () => {
        (deviceManagerMock as { reportedModes?: unknown }).reportedModes = {
          fanSpeeds: [{ value: 1, name: "Quiet" }],
          waterBoxModes: [{ value: 1, name: "Level1" }],
        };
        await connect(
          newAccessory(),
          createXiaomiRoborockVacuumAccessoryMock()
        );
        expect(configFor().waterBox).toBe(true);
      });

      test("keeps it disabled when the model doesn't support it", async () => {
        (deviceManagerMock as { reportedModes?: unknown }).reportedModes = {
          fanSpeeds: [{ value: 1, name: "Quiet" }],
          waterBoxModes: [],
        };
        await connect(
          newAccessory(),
          createXiaomiRoborockVacuumAccessoryMock()
        );
        expect(configFor().waterBox).toBe(false);
      });

      test("an explicit config wins", async () => {
        (deviceManagerMock as { reportedModes?: unknown }).reportedModes = {
          fanSpeeds: [{ value: 1, name: "Quiet" }],
          waterBoxModes: [{ value: 1, name: "Level1" }],
        };
        XiaomiRoborockVacuumAccessoryMock.mockReturnValue(
          createXiaomiRoborockVacuumAccessoryMock()
        );
        new XiaomiRoborockVacuumPlatformAccessoryInitializer(
          log,
          { ...config, waterBox: false },
          homebridge,
          newAccessory()
        );
        (
          deviceManagerMock.deviceConnected$ as unknown as Subject<MiioDevice>
        ).next(miio.device);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(configFor().waterBox).toBe(false);
      });
    });
  });
});
