import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { findSpeedModesMock } from "./water_box_service.test.mock";
import { WaterBoxService } from "./water_box_service";
import { getLoggerMock, LoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { createMainServiceMock, MainServiceMock } from "./main_service.mock";
import { createProductInfoMock, ProductInfoMock } from "./product_info.mock";
import type { ModesHomekitVsMiLevel } from "../models/types";

/** node-miio's "gen1" water levels, with the HomeKit slider levels of `findSpeedModes` */
const GEN1_WATER: ModesHomekitVsMiLevel[] = [
  { homekitTopLevel: 0, miLevel: 200, name: "Off" },
  { homekitTopLevel: 33, miLevel: 201, name: "Light" },
  { homekitTopLevel: 66, miLevel: 202, name: "Medium" },
  { homekitTopLevel: 100, miLevel: 203, name: "High" },
];

describe("WaterBoxService", () => {
  let waterboxService: WaterBoxService;
  let deviceManagerMock: DeviceManagerMock;
  let mainService: MainServiceMock;
  let hap: HAP;
  let productInfoService: ProductInfoMock;
  let log: LoggerMock;

  beforeEach(async () => {
    hap = HapJs;
    log = getLoggerMock();

    deviceManagerMock = createDeviceManagerMock();
    productInfoService = createProductInfoMock();
    mainService = createMainServiceMock();

    const config = applyConfigDefaults({ legacyCareSensors: true });

    waterboxService = new WaterBoxService(
      {
        hap,
        log,
        config,
        deviceManager: deviceManagerMock,
      },
      productInfoService,
      mainService
    );

    await waterboxService.init();
  });

  afterEach(() => {
    findSpeedModesMock.mockClear();
  });

  test("only 1 service is exposed", () => {
    expect(waterboxService.services).toHaveLength(1);
  });

  test("registers 4 characteristics", () => {
    const service = waterboxService.services[0];
    expect(service.characteristics).toHaveLength(4);
  });

  describe("Characteristic getters", () => {
    test("should return rotation speed 0 and ON as false (no water mode supported)", async () => {
      const service = waterboxService.services[0];
      await expect(
        service.getCharacteristic(hap.Characteristic.On)["getHandler"]()
      ).resolves.toEqual(false);
      await expect(
        service
          .getCharacteristic(hap.Characteristic.RotationSpeed)
          ["getHandler"]()
      ).resolves.toEqual(0);
    });

    test("should return rotation speed 0 and ON as false (actually off)", async () => {
      findSpeedModesMock.mockReturnValueOnce({ waterspeed: GEN1_WATER });
      deviceManagerMock.device.getWaterBoxMode = jest
        .fn()
        .mockResolvedValue(200);
      const service = waterboxService.services[0];
      await expect(
        service.getCharacteristic(hap.Characteristic.On)["getHandler"]()
      ).resolves.toEqual(false);
      await expect(
        service
          .getCharacteristic(hap.Characteristic.RotationSpeed)
          ["getHandler"]()
      ).resolves.toEqual(0);
    });

    test("should return rotation speed 33 and ON as true", async () => {
      findSpeedModesMock.mockReturnValueOnce({ waterspeed: GEN1_WATER });
      findSpeedModesMock.mockReturnValueOnce({ waterspeed: GEN1_WATER });
      deviceManagerMock.device!.getWaterBoxMode = jest
        .fn()
        .mockResolvedValue(201);
      const service = waterboxService.services[0];
      await expect(
        service.getCharacteristic(hap.Characteristic.On)["getHandler"]()
      ).resolves.toEqual(true);
      await expect(
        service
          .getCharacteristic(hap.Characteristic.RotationSpeed)
          ["getHandler"]()
      ).resolves.toEqual(33);
    });
  });

  describe("Characteristics setters", () => {
    test("should log and stop when water mode is not supported (rotation speed)", async () => {
      const service = waterboxService.services[0];
      service.getCharacteristic(hap.Characteristic.RotationSpeed).setValue(35);
      await new Promise((resolve) => process.nextTick(resolve));
      expect(log.info).toHaveBeenCalledWith(
        "setWaterSpeed | Model does not support the water mode"
      );
    });

    test("should log and stop when water mode is not supported (on/off)", async () => {
      const service = waterboxService.services[0];
      service.getCharacteristic(hap.Characteristic.On).setValue(false);
      await new Promise((resolve) => process.nextTick(resolve));
      expect(log.info).toHaveBeenCalledWith(
        "setWaterSpeed | Model does not support the water mode"
      );
    });

    test("setting to ON does nothing", async () => {
      const service = waterboxService.services[0];
      service.getCharacteristic(hap.Characteristic.On).setValue(true);
      await new Promise((resolve) => process.nextTick(resolve));
      expect(log.info).not.toHaveBeenCalledWith(
        "setWaterSpeed | Model does not support the water mode"
      );
    });

    test("should disable water mode on OFF", async () => {
      expect(mainService.cachedState.get("WaterSpeed")).toBeUndefined();
      expect(mainService.cachedState.get("WaterSpeedName")).toBeUndefined();
      findSpeedModesMock.mockReturnValueOnce({ waterspeed: GEN1_WATER });
      const service = waterboxService.services[0];
      service.getCharacteristic(hap.Characteristic.On).setValue(false);
      await new Promise((resolve) => process.nextTick(resolve));
      expect(mainService.cachedState.get("WaterSpeed")).toBe(200);
      expect(mainService.cachedState.get("WaterSpeedName")).toBe("Off");
    });
  });

  // TODO: Add more tests
});

describe("WaterBoxService: water level changed from the app", () => {
  test("the robot's preset (e.g. SmartPlan) is logged as such, not as an unsupported level", async () => {
    const log = getLoggerMock();
    const deviceManagerMock = createDeviceManagerMock();
    deviceManagerMock.reportedModes = {
      fanSpeeds: [],
      waterBoxModes: [],
      presets: [
        { name: "SmartPlan", fanSpeed: 110, waterBoxMode: 209, mopRoute: 306 },
      ],
    };
    const service = new WaterBoxService(
      {
        hap: HapJs,
        log,
        config: applyConfigDefaults({}),
        deviceManager: deviceManagerMock,
      },
      createProductInfoMock(),
      createMainServiceMock()
    );
    await service.init();
    (
      deviceManagerMock.stateChanged$ as unknown as {
        next: (e: unknown) => void;
      }
    ).next({
      key: "waterBoxMode",
      value: 209,
    });
    expect(log.info).toHaveBeenCalledWith(
      'changedWaterSpeed | The robot\'s "SmartPlan" preset is on (water level 209)'
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  test('follows node-miio\'s "waterBoxMode" events', async () => {
    const log = getLoggerMock();
    const deviceManagerMock = createDeviceManagerMock();
    const service = new WaterBoxService(
      {
        hap: HapJs,
        log,
        config: applyConfigDefaults({}),
        deviceManager: deviceManagerMock,
      },
      createProductInfoMock(),
      createMainServiceMock()
    );
    await service.init();
    (
      deviceManagerMock.stateChanged$ as unknown as {
        next: (e: unknown) => void;
      }
    ).next({ key: "waterBoxMode", value: 202 });
    expect(log.info).toHaveBeenCalledWith(
      "MON changedWaterSpeed | WaterBoxMode is now 202%"
    );
  });
});
