import { HAP } from "homebridge";
import * as HapJs from "hap-nodejs";
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
import { watermodes } from "../models/watermodes";

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

  test("registers 3 characteristics", () => {
    const service = waterboxService.services[0];
    expect(service.characteristics).toHaveLength(3);
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
      findSpeedModesMock.mockReturnValueOnce({ waterspeed: watermodes.gen1 });
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

    test("should return rotation speed 35 and ON as true", async () => {
      findSpeedModesMock.mockReturnValueOnce({ waterspeed: watermodes.gen1 });
      findSpeedModesMock.mockReturnValueOnce({ waterspeed: watermodes.gen1 });
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
      ).resolves.toEqual(35);
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
      findSpeedModesMock.mockReturnValueOnce({ waterspeed: watermodes.gen1 });
      const service = waterboxService.services[0];
      service.getCharacteristic(hap.Characteristic.On).setValue(false);
      await new Promise((resolve) => process.nextTick(resolve));
      expect(mainService.cachedState.get("WaterSpeed")).toBe(200);
      expect(mainService.cachedState.get("WaterSpeedName")).toBe("Off");
    });
  });

  // TODO: Add more tests
});
