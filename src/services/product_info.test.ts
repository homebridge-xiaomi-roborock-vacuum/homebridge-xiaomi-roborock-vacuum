import { HAP } from "homebridge";
import * as HapJs from "hap-nodejs";
import { Subject } from "rxjs";
import { ProductInfo } from "./product_info";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";

describe("ProductInfo", () => {
  let productInfo: ProductInfo;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  beforeEach(async () => {
    hap = HapJs;
    const log = getLoggerMock();
    deviceManagerMock = createDeviceManagerMock();
    const config = applyConfigDefaults({});

    productInfo = new ProductInfo({
      hap,
      log,
      config,
      deviceManager: deviceManagerMock,
    });

    await productInfo.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  describe("deviceConnected$", () => {
    let setCharacteristicSpy: jest.SpyInstance;

    beforeEach(() => {
      const [service] = productInfo.services;
      setCharacteristicSpy = jest.spyOn(service, "setCharacteristic");
    });

    test("fetches the serial number and firmware on first connection", async () => {
      jest
        .spyOn(deviceManagerMock.device, "getSerialNumber")
        .mockResolvedValue("1234");
      jest
        .spyOn(deviceManagerMock.device, "getDeviceInfo")
        .mockResolvedValue({ fw_ver: "1.2.3" });

      (deviceManagerMock.deviceConnected$ as Subject<unknown>).next({});

      await new Promise((resolve) => process.nextTick(resolve));

      expect(setCharacteristicSpy).toHaveBeenCalledWith(
        hap.Characteristic.SerialNumber,
        "1234"
      );
      expect(setCharacteristicSpy).toHaveBeenCalledWith(
        hap.Characteristic.FirmwareRevision,
        "1.2.3"
      );
    });

    test("handles errors", async () => {
      const err = new Error("Something went terribly wrong");
      jest
        .spyOn(deviceManagerMock.device, "getSerialNumber")
        .mockRejectedValue(err);
      jest
        .spyOn(deviceManagerMock.device, "getDeviceInfo")
        .mockRejectedValue(err);

      (deviceManagerMock.deviceConnected$ as Subject<unknown>).next({});

      await new Promise((resolve) => process.nextTick(resolve));

      expect(setCharacteristicSpy).toHaveBeenCalledTimes(1);
      expect(setCharacteristicSpy).toHaveBeenCalledWith(
        hap.Characteristic.SerialNumber,
        "Unknown"
      );
    });
  });

  test("getFirmware", async () => {
    jest
      .spyOn(deviceManagerMock.device, "getDeviceInfo")
      .mockResolvedValue({ fw_ver: "1.2.3" });
    const [service] = productInfo.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.FirmwareRevision)
        .handleGetRequest()
    ).resolves.toStrictEqual("1.2.3");
  });

  test("getModel", async () => {
    const [service] = productInfo.services;
    await expect(
      service.getCharacteristic(hap.Characteristic.Model).handleGetRequest()
    ).resolves.toStrictEqual("test-model");
  });

  test("getSerialNumber", async () => {
    jest
      .spyOn(deviceManagerMock.device, "getSerialNumber")
      .mockResolvedValue("1234");
    const [service] = productInfo.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.SerialNumber)
        .handleGetRequest()
    ).resolves.toStrictEqual("1234");
  });

  test("getManufacturer", async () => {
    const [service] = productInfo.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.Manufacturer)
        .handleGetRequest()
    ).resolves.toStrictEqual("Xiaomi");
  });
});
