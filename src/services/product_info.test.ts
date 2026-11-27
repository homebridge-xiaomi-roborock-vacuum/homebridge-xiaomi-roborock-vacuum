import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
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
    vi.resetAllMocks();
  });

  describe("deviceConnected$", () => {
    let updateCharacteristicSpy: MockInstance;

    beforeEach(() => {
      const [service] = productInfo.services;
      updateCharacteristicSpy = vi.spyOn(service, "updateCharacteristic");
    });

    test("fetches the serial number and firmware on first connection", async () => {
      vi.spyOn(deviceManagerMock.device, "getSerialNumber").mockResolvedValue(
        "1234"
      );
      vi.spyOn(deviceManagerMock.device, "getDeviceInfo").mockResolvedValue({
        fw_ver: "1.2.3",
      } as never);

      (deviceManagerMock.deviceConnected$ as Subject<unknown>).next({});

      await new Promise((resolve) => process.nextTick(resolve));

      expect(updateCharacteristicSpy).toHaveBeenCalledTimes(3);
      expect(updateCharacteristicSpy).toHaveBeenNthCalledWith(
        1,
        hap.Characteristic.Model,
        "test-model"
      );
      expect(updateCharacteristicSpy).toHaveBeenNthCalledWith(
        2,
        hap.Characteristic.SerialNumber,
        "1234"
      );
      expect(updateCharacteristicSpy).toHaveBeenNthCalledWith(
        3,
        hap.Characteristic.FirmwareRevision,
        "1.2.3"
      );
    });

    test("firmware$ emits once the firmware is read, and replays it", async () => {
      vi.spyOn(deviceManagerMock.device, "getSerialNumber").mockResolvedValue(
        "1234"
      );
      vi.spyOn(deviceManagerMock.device, "getDeviceInfo").mockResolvedValue({
        fw_ver: "1.2.3",
      } as never);
      const before = vi.fn();
      productInfo.firmware$.subscribe(before);
      expect(before).not.toHaveBeenCalled();

      (deviceManagerMock.deviceConnected$ as Subject<unknown>).next({});
      await new Promise((resolve) => process.nextTick(resolve));

      expect(before).toHaveBeenCalledWith("1.2.3");
      const after = vi.fn();
      productInfo.firmware$.subscribe(after);
      expect(after).toHaveBeenCalledWith("1.2.3");
    });

    test("firmware$ emits undefined when the firmware can't be read", async () => {
      vi.spyOn(deviceManagerMock.device, "getDeviceInfo").mockRejectedValue(
        new Error("timeout")
      );
      const firmware = vi.fn();
      productInfo.firmware$.subscribe(firmware);

      (deviceManagerMock.deviceConnected$ as Subject<unknown>).next({});
      await new Promise((resolve) => process.nextTick(resolve));

      expect(firmware).toHaveBeenCalledWith(undefined);
    });

    test("handles errors", async () => {
      const err = new Error("Something went terribly wrong");
      vi.spyOn(deviceManagerMock.device, "getSerialNumber").mockRejectedValue(
        err
      );
      vi.spyOn(deviceManagerMock.device, "getDeviceInfo").mockRejectedValue(
        err
      );

      (deviceManagerMock.deviceConnected$ as Subject<unknown>).next({});

      await new Promise((resolve) => process.nextTick(resolve));

      expect(updateCharacteristicSpy).toHaveBeenCalledTimes(2);
      expect(updateCharacteristicSpy).toHaveBeenNthCalledWith(
        1,
        hap.Characteristic.Model,
        "test-model"
      );
      expect(updateCharacteristicSpy).toHaveBeenNthCalledWith(
        2,
        hap.Characteristic.SerialNumber,
        "Unknown"
      );
    });
  });

  test("getFirmware", async () => {
    vi.spyOn(deviceManagerMock.device, "getDeviceInfo").mockResolvedValue({
      fw_ver: "1.2.3",
    } as never);
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
    vi.spyOn(deviceManagerMock.device, "getSerialNumber").mockResolvedValue(
      "1234"
    );
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
