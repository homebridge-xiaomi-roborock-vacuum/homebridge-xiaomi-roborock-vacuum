import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
  type Mocked,
} from "vitest";
import type { API, Logging } from "homebridge";
import { Service, Categories, Characteristic } from "@homebridge/hap-nodejs";
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
    on: vi.fn(),
    emit: vi.fn(),
    displayName: name,
    UUID: uuid,
    category: Categories.FAN,
    services: [
      new Service.AccessoryInformation("Preexisting info", "info"),
      new Service.Switch("Preexisting"),
    ],
    addListener: vi.fn(),
    addService: vi.fn(),
    removeService: vi.fn(),
    getServices: vi.fn(() => accessory.services),
    getServiceById: vi.fn(),
    getService: vi.fn((type: typeof Service.AccessoryInformation) =>
      accessory.services.find((s) => s instanceof type)
    ),
  } as unknown as XiaomiRoborockVacuumPlatformAccessory;
  return accessory;
}

describe("XiaomiRoborockVacuumPlatformAccessoryInitializer", () => {
  let homebridge: Mocked<API>;
  let consoleErrorSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleDebugSpy: MockInstance;
  const log: Logging = console as unknown as Logging;

  beforeEach(() => {
    homebridge = createHomebridgeMock();
    // Silencing the logger in the tests to reduce noise.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    miio.device.find.mockRejectedValue(
      new Error("Something went terribly wrong")
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    const config = {
      name: "robot",
      ip: "my.ip",
    };

    test("after connect, adds services to the accessory", async () => {
      const accessory = newAccessory();
      const instanceMock = createXiaomiRoborockVacuumAccessoryMock();
      vi.spyOn(accessory, "getServiceById").mockReturnValueOnce(
        accessory.services[0]
      );

      instanceMock.getServices.mockReturnValue([
        ...accessory.services,
        new Service.Switch("Test", "super cool"),
        new Service.Switch("Test 2"),
      ]);

      const accessorySpy = vi.spyOn(
        accessory.services[0],
        "replaceCharacteristicsFromService"
      );

      const setPrimaryServiceSpy = vi.spyOn(
        accessory.services[1],
        "setPrimaryService"
      );

      XiaomiRoborockVacuumAccessoryMock.mockImplementation(function () {
        return instanceMock;
      });
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
      XiaomiRoborockVacuumAccessoryMock.mockImplementation(function () {
        return instanceMock;
      });
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
        undefined, // No Xiaomi Cloud
        undefined // So no scenes
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

    describe('serviceType: "vacuum"', () => {
      const vacuumConfig = { ...config, did: "123", serviceType: "vacuum" };
      const matter = {
        uuid: { generate: vi.fn((id: string) => `uuid:${id}`) },
        deviceTypes: { RoboticVacuumCleaner: {} },
        status: {},
        registerPlatformAccessories: vi.fn(),
        updateAccessoryState: vi.fn(),
      };
      const configFor = () =>
        XiaomiRoborockVacuumAccessoryMock.mock.calls[0][1] as Record<
          string,
          unknown
        >;

      const start = async (
        isMatterEnabled: boolean,
        deviceConfig: Record<string, unknown> = vacuumConfig
      ) => {
        Object.assign(homebridge, {
          isMatterEnabled: () => isMatterEnabled,
          matter: isMatterEnabled ? matter : undefined,
        });
        miio.device.getDeviceInfo.mockResolvedValue({
          fw_ver: "3.5.8",
        } as never);
        miio.device.getSerialNumber.mockResolvedValue("SN1");
        const instanceMock = createXiaomiRoborockVacuumAccessoryMock();
        instanceMock.roomList = [{ id: "16", name: "Kitchen" }];
        XiaomiRoborockVacuumAccessoryMock.mockImplementation(function () {
          return instanceMock;
        });
        const initializer =
          new XiaomiRoborockVacuumPlatformAccessoryInitializer(
            log,
            deviceConfig,
            homebridge,
            newAccessory()
          );
        const initialized = vi.fn();
        initializer.initialized$.subscribe(initialized);
        (
          deviceManagerMock.deviceConnected$ as unknown as Subject<MiioDevice>
        ).next(miio.device);
        await new Promise((resolve) => setTimeout(resolve, 0));
        return { initializer, initialized };
      };

      test("registers the Matter vacuum, with the rooms", async () => {
        const { initializer, initialized } = await start(true);
        expect(matter.registerPlatformAccessories).toHaveBeenCalledWith(
          "homebridge-xiaomi-roborock-vacuum",
          "XiaomiRoborockVacuum",
          [
            expect.objectContaining({
              displayName: "test",
              serialNumber: "SN1",
              firmwareRevision: "3.5.8",
              clusters: expect.objectContaining({
                serviceArea: expect.objectContaining({
                  supportedAreas: [expect.objectContaining({ areaId: 16 })],
                }),
              }),
            }),
          ]
        );
        expect(initializer.matterVacuum).toBeDefined();
        // No HomeKit services: the HomeKit accessory isn't needed
        expect(initialized).toHaveBeenCalledWith(false);
        // The rooms are read from the robot
        expect(configFor()).toMatchObject({
          serviceType: "vacuum",
          autoroom: true,
        });
      });

      test("a failing Matter registration doesn't prevent the HomeKit accessory", async () => {
        matter.registerPlatformAccessories.mockRejectedValueOnce(
          new Error("Matter is not ready")
        );
        const { initialized } = await start(true);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Failed to register the Matter robot vacuum"),
          expect.any(Error)
        );
        expect(initialized).toHaveBeenCalledWith(false);
      });

      test("configured rooms are kept", async () => {
        await start(true, {
          ...vacuumConfig,
          rooms: [{ id: "16", name: "Kitchen" }],
        });
        expect(configFor().autoroom).toBeUndefined();
      });

      test("without Matter: warns, and falls back to the fan", async () => {
        const { initializer } = await start(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('"serviceType": "vacuum" needs Matter')
        );
        expect(configFor().serviceType).toBe("fan");
        expect(initializer.matterVacuum).toBeUndefined();
        expect(matter.registerPlatformAccessories).not.toHaveBeenCalled();
      });
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
        XiaomiRoborockVacuumAccessoryMock.mockImplementation(function () {
          return createXiaomiRoborockVacuumAccessoryMock();
        });
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

  describe("Roborock app robots (`duid`)", () => {
    test("connect through the Roborock service, without the Xiaomi Cloud locator", async () => {
      const DeviceManager = vi.mocked(
        (await import("../services/device_manager.js")).DeviceManager
      );
      DeviceManager.mockClear();
      const roborock = { connect: vi.fn().mockResolvedValue(undefined) };
      const cloud = { locate: vi.fn() };
      new XiaomiRoborockVacuumPlatformAccessoryInitializer(
        console as unknown as Logging,
        { name: "saros", duid: "duid-1", ip: "192.168.86.26" },
        homebridge,
        newAccessory(),
        cloud as never,
        roborock as never
      );
      const [, , , locate, connector] = DeviceManager.mock.calls[0];
      expect(locate).toBeUndefined();
      const logger = { debug: vi.fn() };
      await connector!(logger);
      expect(roborock.connect).toHaveBeenCalledWith(
        { duid: "duid-1", ip: "192.168.86.26" },
        logger
      );
      expect(cloud.locate).not.toHaveBeenCalled();
    });

    test("Mi Home robots keep the Xiaomi Cloud locator, and no connector", async () => {
      const DeviceManager = vi.mocked(
        (await import("../services/device_manager.js")).DeviceManager
      );
      DeviceManager.mockClear();
      const cloud = { locate: vi.fn().mockResolvedValue(undefined) };
      new XiaomiRoborockVacuumPlatformAccessoryInitializer(
        console as unknown as Logging,
        { name: "s5", did: "123", ip: "1.1.1.1", token: "t" },
        homebridge,
        newAccessory(),
        cloud as never,
        { connect: vi.fn() } as never
      );
      const [, , , locate, connector] = DeviceManager.mock.calls[0];
      expect(connector).toBeUndefined();
      await locate!({ ip: "1.1.1.1", token: "t" });
      expect(cloud.locate).toHaveBeenCalledWith(
        { did: "123", ip: "1.1.1.1", token: "t" },
        { fresh: true }
      );
    });
  });

  describe("scenes of the app", () => {
    type Runner = ((id: string) => Promise<void>) | undefined;
    const runnerOf = (
      config: Record<string, unknown>,
      cloud?: unknown,
      roborock?: unknown
    ) => {
      const initializer = new XiaomiRoborockVacuumPlatformAccessoryInitializer(
        console as unknown as Logging,
        { name: "robot", ...config },
        homebridge,
        newAccessory(),
        cloud as never,
        roborock as never
      );
      return (
        initializer as unknown as {
          sceneRunner(config: Record<string, unknown>): Runner;
        }
      ).sceneRunner(config);
    };

    test("Roborock app robots run their routines", async () => {
      const roborock = { connect: vi.fn(), runRoutine: vi.fn() };
      await runnerOf({ duid: "duid-1" }, undefined, roborock)!("19799177");
      expect(roborock.runRoutine).toHaveBeenCalledWith(19799177);
      expect(runnerOf({ duid: "duid-1" }, { locate: vi.fn() })).toBeUndefined();
    });

    test("Mi Home robots run the manual scenes through the Xiaomi Cloud", async () => {
      const cloud = { locate: vi.fn(), runScene: vi.fn() };
      await runnerOf({ did: "123", ip: "1.1.1.1", token: "t" }, cloud)!("2075");
      expect(cloud.runScene).toHaveBeenCalledWith("2075", {
        did: "123",
        ip: "1.1.1.1",
        token: "t",
      });
      expect(runnerOf({ ip: "1.1.1.1", token: "t" })).toBeUndefined();
    });
  });

  describe("room switches (#467)", () => {
    const start = async (withRegistry: boolean) => {
      const instanceMock = createXiaomiRoborockVacuumAccessoryMock();
      const kitchen = new Service.Switch("cleaning Kitchen", "roomService16");
      const kitchen2x = new Service.Switch(
        "cleaning Kitchen 2x",
        "roomService16x2"
      );
      const info = new Service.AccessoryInformation("robot", "info");
      info.setCharacteristic(Characteristic.Manufacturer, "Roborock");
      instanceMock.getServices.mockReturnValue([info]);
      Object.assign(instanceMock, { roomSwitches: [kitchen, kitchen2x] });
      XiaomiRoborockVacuumAccessoryMock.mockImplementation(function () {
        return instanceMock;
      });
      const roomAccessories = new Map<
        string,
        XiaomiRoborockVacuumPlatformAccessory
      >();
      const registry = {
        accessoryFor: vi.fn((room: string) => {
          const accessory = newAccessory();
          accessory.services.splice(1); // Only the accessory information
          roomAccessories.set(room, accessory);
          return accessory;
        }),
        commit: vi.fn(),
      };
      new XiaomiRoborockVacuumPlatformAccessoryInitializer(
        log,
        { name: "robot", ip: "my.ip" },
        homebridge,
        newAccessory(),
        undefined,
        undefined,
        withRegistry ? registry : undefined
      );
      (
        deviceManagerMock.deviceConnected$ as unknown as Subject<MiioDevice>
      ).next(miio.device);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { instanceMock, registry, roomAccessories, kitchen, kitchen2x };
    };

    test("each one gets an accessory of its own, so it can go in its room", async () => {
      const { instanceMock, registry, roomAccessories, kitchen, kitchen2x } =
        await start(true);
      expect(instanceMock.getServices).toHaveBeenCalledWith({
        withoutRooms: true,
      });
      expect(registry.accessoryFor.mock.calls).toEqual([
        ["roomService16", "cleaning Kitchen"],
        ["roomService16x2", "cleaning Kitchen 2x"],
      ]);
      const accessory = roomAccessories.get("roomService16")!;
      expect(accessory.addService).toHaveBeenCalledWith(kitchen);
      expect(kitchen.isPrimaryService).toBe(true);
      expect(
        roomAccessories.get("roomService16x2")!.addService
      ).toHaveBeenCalledWith(kitchen2x);
      const info = accessory.getService(Service.AccessoryInformation)!;
      expect(info.getCharacteristic(Characteristic.Manufacturer).value).toBe(
        "Roborock"
      );
      expect(info.getCharacteristic(Characteristic.SerialNumber).value).toBe(
        "test roomService16"
      );
      expect(registry.commit).toHaveBeenCalledWith([
        accessory,
        roomAccessories.get("roomService16x2"),
      ]);
    });

    test("without the platform's registry, they stay in the vacuum's accessory", async () => {
      const { instanceMock } = await start(false);
      expect(instanceMock.getServices).toHaveBeenCalledWith({
        withoutRooms: false,
      });
    });
  });
});
