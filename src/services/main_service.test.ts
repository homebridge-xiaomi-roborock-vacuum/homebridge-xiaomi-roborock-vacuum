import { describe, test, expect, afterEach, vi, type Mock } from "vitest";
import * as HapJs from "@homebridge/hap-nodejs";
import { ReplaySubject, Subject } from "rxjs";
import { MainService } from "./main_service.js";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock.js";
import { getLoggerMock } from "../utils/logger.mock.js";
import { applyConfigDefaults } from "./config_service.js";
import type { ProductInfo } from "./product_info.js";
import type { RoomsService } from "./rooms_service.js";

describe("MainService", () => {
  let deviceManagerMock: DeviceManagerMock;
  let firmware$: ReplaySubject<string | undefined>;

  let setWaterSpeed: Mock<(mode: string) => Promise<void>>;
  let changedPause: Mock<(isCleaning: boolean) => void>;

  function create(
    rooms: { ids: number[]; repeat: number },
    config: Record<string, unknown> = {}
  ) {
    setWaterSpeed = vi.fn();
    changedPause = vi.fn();
    firmware$ = new ReplaySubject(1);
    deviceManagerMock = createDeviceManagerMock();
    Object.assign(deviceManagerMock, { isCleaning: false });
    let latestFirmware: string | undefined;
    firmware$.subscribe((fw) => (latestFirmware = fw));
    const roomsService = {
      roomIdsToClean: new Set(rooms.ids.map(String)),
      roomIdsForDevice: rooms.ids,
      repeat: rooms.repeat,
    } as unknown as RoomsService;
    return new MainService(
      {
        hap: HapJs,
        log: getLoggerMock(),
        config: applyConfigDefaults(config),
        deviceManager: deviceManagerMock,
      },
      {
        get firmware() {
          return latestFirmware;
        },
        firmware$,
      } as unknown as ProductInfo,
      roomsService,
      setWaterSpeed,
      changedPause
    );
  }

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    vi.resetAllMocks();
  });

  describe("setCleaning with selected rooms", () => {
    test("cleans them once (the legacy format, for every firmware)", async () => {
      await create({ ids: [16, 17], repeat: 1 }).setCleaning(true);
      expect(deviceManagerMock.device.cleanRooms).toHaveBeenCalledWith([
        16, 17,
      ]);
    });

    test("cleans them as many times as the selected switches ask", async () => {
      await create({ ids: [16, 17], repeat: 3 }).setCleaning(true);
      expect(deviceManagerMock.device.cleanRooms).toHaveBeenCalledWith(
        [16, 17],
        { repeat: 3 }
      );
    });
  });

  describe("fan speed changed from the app", () => {
    test("the robot's preset (e.g. SmartPlan) is logged as such, not as an unsupported speed", async () => {
      const service = create({ ids: [], repeat: 1 });
      deviceManagerMock.reportedModes = {
        fanSpeeds: [],
        waterBoxModes: [],
        presets: [
          {
            name: "SmartPlan",
            fanSpeed: 110,
            waterBoxMode: 209,
            mopRoute: 306,
          },
        ],
      };
      const log = (
        service as unknown as { log: ReturnType<typeof getLoggerMock> }
      ).log;
      await service.init();
      firmware$.next(undefined);
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "fanSpeed",
        value: 110,
      });
      expect(log.info).toHaveBeenCalledWith(
        'changedSpeed | The robot\'s "SmartPlan" preset is on (fan speed 110)'
      );
      expect(log.warn).not.toHaveBeenCalled();
    });

    test("an unknown speed is logged as not supported", async () => {
      const service = create({ ids: [], repeat: 1 });
      Object.assign(deviceManagerMock, { model: "roborock.vacuum.s5" });
      const log = (
        service as unknown as { log: ReturnType<typeof getLoggerMock> }
      ).log;
      await service.init();
      firmware$.next("3.5.8_002034");
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "fanSpeed",
        value: 999,
      });
      expect(log.warn).toHaveBeenCalledWith(
        "WAR changedSpeed | Speed was changed to 999%, this speed is not supported"
      );
    });

    test("the speed steps follow the firmware's speeds", async () => {
      const service = create({ ids: [], repeat: 1 });
      Object.assign(deviceManagerMock, { model: "roborock.vacuum.s5" });
      await service.init();
      firmware$.next("3.5.8_002034");
      const rotationSpeed = service.services[0].getCharacteristic(
        HapJs.Characteristic.RotationSpeed
      );
      // Off, Soft, Quiet, Balanced, Turbo, Max: 5 steps
      expect(rotationSpeed.props.minStep).toBe(20);
    });

    test("a speed reported before the firmware is known is looked up once it is", async () => {
      // The roborock.vacuum.s5's speeds depend on the firmware: 102 is only "Balanced" with 3.5.7+
      const service = create({ ids: [], repeat: 1 });
      Object.assign(deviceManagerMock, { model: "roborock.vacuum.s5" });
      const log = (
        service as unknown as { log: ReturnType<typeof getLoggerMock> }
      ).log;
      await service.init();

      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "fanSpeed",
        value: 102,
      });
      expect(log.info).not.toHaveBeenCalledWith(
        expect.stringContaining("changedSpeed")
      );

      firmware$.next("3.5.8_002034");
      expect(log.info).toHaveBeenCalledWith(
        "changedSpeed | Speed was changed to 102% (Balanced), for HomeKit 60%"
      );
      expect(log.warn).not.toHaveBeenCalled();
    });
  });

  const logOf = (service: MainService) =>
    (service as unknown as { log: ReturnType<typeof getLoggerMock> }).log;
  const stateChanged = (key: string, value: unknown) =>
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({ key, value });
  /** A model node-miio doesn't list: its speeds come from what the robot reports */
  const withReportedSpeeds = () => {
    deviceManagerMock.reportedModes = {
      fanSpeeds: [
        { value: 101, name: "Quiet" },
        { value: 102, name: "Balanced" },
        { value: 106, name: "Custom" },
      ],
      waterBoxModes: [],
      presets: [],
    };
  };

  describe("service type", () => {
    test("a fan (the default) with the rotation speed, as the primary service", () => {
      const [service] = create({ ids: [], repeat: 1 }).services;
      expect(service.UUID).toBe(HapJs.Service.Fan.UUID);
      expect(service.isPrimaryService).toBe(true);
      expect(
        service.testCharacteristic(HapJs.Characteristic.RotationSpeed)
      ).toBe(true);
    });

    test("a switch, without the rotation speed", async () => {
      const mainService = create(
        { ids: [], repeat: 1 },
        { serviceType: "switch" }
      );
      const [service] = mainService.services;
      expect(service.UUID).toBe(HapJs.Service.Switch.UUID);
      expect(
        service.testCharacteristic(HapJs.Characteristic.RotationSpeed)
      ).toBe(false);
      // No speed subscriptions: the firmware isn't awaited
      await mainService.init();
      stateChanged("fanSpeed", 102);
      expect(logOf(mainService).info).not.toHaveBeenCalledWith(
        expect.stringContaining("changedSpeed")
      );
    });
  });

  describe("cleaning state", () => {
    test("onGet fails (and logs) before the robot is connected", async () => {
      const service = create({ ids: [], repeat: 1 });
      const error = new Error("Not connected yet");
      Object.defineProperty(deviceManagerMock, "isCleaning", {
        get: () => {
          throw error;
        },
      });
      await expect(service.getCleaning()).rejects.toBe(error);
      expect(logOf(service).error).toHaveBeenCalledWith(
        "getCleaning | Failed getting the cleaning status.",
        error
      );
    });

    test.each([true, false])(
      "onGet returns isCleaning (%p)",
      async (isCleaning) => {
        const service = create({ ids: [], repeat: 1 });
        Object.assign(deviceManagerMock, { isCleaning });
        await expect(
          service.services[0]
            .getCharacteristic(HapJs.Characteristic.On)
            .handleGetRequest()
        ).resolves.toBe(isCleaning);
      }
    );

    test("follows the robot, and tells the pause switch", async () => {
      const service = create({ ids: [], repeat: 1 });
      await service.init();
      const on = service.services[0].getCharacteristic(HapJs.Characteristic.On);
      stateChanged("cleaning", true);
      expect(on.value).toBe(true);
      expect(changedPause).toHaveBeenLastCalledWith(true);
      stateChanged("cleaning", false);
      expect(on.value).toBe(false);
      expect(changedPause).toHaveBeenLastCalledWith(false);
      expect(logOf(service).info).toHaveBeenCalledWith(
        "changedCleaning | Cleaning is OFF."
      );
    });
  });

  describe("setCleaning", () => {
    test("the On switch starts the cleaning", async () => {
      const service = create({ ids: [], repeat: 1 });
      await service.services[0]
        .getCharacteristic(HapJs.Characteristic.On)
        .handleSetRequest(true);
      expect(deviceManagerMock.device.activateCleaning).toHaveBeenCalledTimes(
        1
      );
    });

    test("ON starts a full cleaning when no room is selected", async () => {
      await create({ ids: [], repeat: 1 }).setCleaning(true);
      expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith(
        "setCleaning"
      );
      expect(deviceManagerMock.device.activateCleaning).toHaveBeenCalledTimes(
        1
      );
      expect(deviceManagerMock.device.cleanRooms).not.toHaveBeenCalled();
    });

    test("ON does nothing while it's already cleaning", async () => {
      const service = create({ ids: [], repeat: 1 });
      Object.assign(deviceManagerMock, { isCleaning: true });
      await service.setCleaning(true);
      expect(deviceManagerMock.device.activateCleaning).not.toHaveBeenCalled();
    });

    test.each([
      [{ isCleaning: true, isPaused: false }],
      [{ isCleaning: false, isPaused: true }],
    ])("OFF sends it to the dock (%o)", async (flags) => {
      const service = create({ ids: [], repeat: 1 });
      Object.assign(deviceManagerMock, flags);
      await service.setCleaning(false);
      expect(deviceManagerMock.device.activateCharging).toHaveBeenCalledTimes(
        1
      );
    });

    test("OFF does nothing when it's idle", async () => {
      const service = create({ ids: [], repeat: 1 });
      Object.assign(deviceManagerMock, { isCleaning: false, isPaused: false });
      await service.setCleaning(false);
      expect(deviceManagerMock.device.activateCharging).not.toHaveBeenCalled();
    });

    test("logs and rethrows the device's errors", async () => {
      const service = create({ ids: [], repeat: 1 });
      const error = new Error("Boom");
      deviceManagerMock.device.activateCleaning.mockRejectedValueOnce(error);
      await expect(service.setCleaning(true)).rejects.toBe(error);
      expect(logOf(service).error).toHaveBeenCalledWith(
        "setCleaning | Failed to set cleaning to true",
        error
      );
    });
  });

  describe("fan speed from HomeKit", () => {
    const rotationSpeed = (service: MainService) =>
      service.services[0].getCharacteristic(HapJs.Characteristic.RotationSpeed);

    test("onGet converts the robot's speed to the HomeKit level", async () => {
      const service = create({ ids: [], repeat: 1 });
      withReportedSpeeds();
      deviceManagerMock.device.fanSpeed.mockResolvedValue(102);
      await expect(rotationSpeed(service).handleGetRequest()).resolves.toBe(66);
      expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith("getSpeed");
    });

    test("onGet is 0 for an unknown speed", async () => {
      const service = create({ ids: [], repeat: 1 });
      withReportedSpeeds();
      deviceManagerMock.device.fanSpeed.mockResolvedValue(999);
      await expect(rotationSpeed(service).handleGetRequest()).resolves.toBe(0);
    });

    test.each([
      [1, 101, "Quiet"],
      [33, 101, "Quiet"],
      [34, 102, "Balanced"],
      [100, 106, "Custom"],
    ])("onSet %p%% sets the speed %p (%s)", async (level, miLevel, name) => {
      const service = create({ ids: [], repeat: 1 });
      withReportedSpeeds();
      await rotationSpeed(service).handleSetRequest(level);
      expect(deviceManagerMock.device.changeFanSpeed).toHaveBeenCalledWith(
        miLevel
      );
      expect(service.cachedState.get("FanSpeed")).toBe(miLevel);
      expect(service.cachedState.get("FanSpeedName")).toBe(name);
    });

    test("0% stops the cleaning instead of changing the speed", async () => {
      const service = create({ ids: [], repeat: 1 });
      withReportedSpeeds();
      Object.assign(deviceManagerMock, { isCleaning: true });
      await service.setSpeed(0);
      expect(deviceManagerMock.device.changeFanSpeed).not.toHaveBeenCalled();
      expect(deviceManagerMock.device.activateCharging).toHaveBeenCalledTimes(
        1
      );
    });

    test("sets a speed by its mode name", async () => {
      const service = create({ ids: [], repeat: 1 });
      withReportedSpeeds();
      await service.setSpeed("Balanced");
      expect(deviceManagerMock.device.changeFanSpeed).toHaveBeenCalledWith(102);
    });

    test("ignores an unknown mode name", async () => {
      const service = create({ ids: [], repeat: 1 });
      withReportedSpeeds();
      await service.setSpeed("Hurricane");
      expect(deviceManagerMock.device.changeFanSpeed).not.toHaveBeenCalled();
      expect(logOf(service).info).toHaveBeenCalledWith(
        'setSpeed | Mode "Hurricane" does not exist.'
      );
    });

    describe("with the water box", () => {
      test("the Custom speed sets the water to Custom too", async () => {
        const service = create({ ids: [], repeat: 1 }, { waterBox: true });
        withReportedSpeeds();
        await service.setSpeed("Custom");
        expect(setWaterSpeed).toHaveBeenCalledWith("Custom");
      });

      test("the Custom speed leaves the water alone when it's already Custom", async () => {
        const service = create({ ids: [], repeat: 1 }, { waterBox: true });
        withReportedSpeeds();
        service.cachedState.set("WaterSpeedName", "Custom");
        await service.setSpeed("Custom");
        expect(setWaterSpeed).not.toHaveBeenCalled();
      });

      test("leaving the Custom speed sets the water to Medium", async () => {
        const service = create({ ids: [], repeat: 1 }, { waterBox: true });
        withReportedSpeeds();
        service.cachedState.set("WaterSpeedName", "Custom");
        await service.setSpeed("Quiet");
        expect(setWaterSpeed).toHaveBeenCalledWith("Medium");
      });

      test("other speeds leave the water alone", async () => {
        const service = create({ ids: [], repeat: 1 }, { waterBox: true });
        withReportedSpeeds();
        await service.setSpeed("Quiet");
        expect(setWaterSpeed).not.toHaveBeenCalled();
      });
    });

    test("without the water box, the Custom speed leaves the water alone", async () => {
      const service = create({ ids: [], repeat: 1 });
      withReportedSpeeds();
      await service.setSpeed("Custom");
      expect(setWaterSpeed).not.toHaveBeenCalled();
    });
  });

  describe("fan speed changed from the app (known speed)", () => {
    test("updates the HomeKit level", async () => {
      const service = create({ ids: [], repeat: 1 });
      withReportedSpeeds();
      await service.init();
      firmware$.next(undefined);
      stateChanged("fanSpeed", 106);
      expect(
        service.services[0].getCharacteristic(
          HapJs.Characteristic.RotationSpeed
        ).value
      ).toBe(100);
    });
  });
});
