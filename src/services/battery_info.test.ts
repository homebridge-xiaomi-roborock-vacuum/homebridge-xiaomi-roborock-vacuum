import { HAP } from "homebridge";
import * as HapJs from "hap-nodejs";
import { Subject } from "rxjs";
import { BatteryInfo } from "./battery_info";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";

describe("BatteryInfo", () => {
  let batteryInfo: BatteryInfo;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  beforeEach(async () => {
    hap = HapJs;
    const log = getLoggerMock();
    deviceManagerMock = createDeviceManagerMock();
    const config = applyConfigDefaults({});

    batteryInfo = new BatteryInfo({
      hap,
      log,
      config,
      deviceManager: deviceManagerMock,
    });

    await batteryInfo.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  describe("stateChanged$", () => {
    let updateBatteryLevelSpy: jest.SpyInstance;
    let updateStatusLowBatterySpy: jest.SpyInstance;
    let updateChargingStateSpy: jest.SpyInstance;

    beforeEach(() => {
      const [service] = batteryInfo.services;
      updateBatteryLevelSpy = jest.spyOn(
        service.getCharacteristic(hap.Characteristic.BatteryLevel),
        "updateValue"
      );
      updateStatusLowBatterySpy = jest.spyOn(
        service.getCharacteristic(hap.Characteristic.StatusLowBattery),
        "updateValue"
      );
      updateChargingStateSpy = jest.spyOn(
        service.getCharacteristic(hap.Characteristic.ChargingState),
        "updateValue"
      );
    });

    test("updates the status of the battery on `batteryLevel` update (Battery low)", () => {
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "batteryLevel",
        value: 10,
      });

      expect(updateBatteryLevelSpy).toHaveBeenCalledWith(10);
      expect(updateStatusLowBatterySpy).toHaveBeenCalledWith(
        hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      );
      expect(updateChargingStateSpy).not.toHaveBeenCalled();
    });

    test("updates the status of the battery on `batteryLevel` update (Battery Level Normal)", () => {
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "batteryLevel",
        value: 20,
      });

      expect(updateBatteryLevelSpy).toHaveBeenCalledWith(20);
      expect(updateStatusLowBatterySpy).toHaveBeenCalledWith(
        hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
      expect(updateChargingStateSpy).not.toHaveBeenCalled();
    });

    test("updates the status of the battery on `charging` update (true)", () => {
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "charging",
        value: true,
      });

      expect(updateBatteryLevelSpy).not.toHaveBeenCalled();
      expect(updateStatusLowBatterySpy).not.toHaveBeenCalled();
      expect(updateChargingStateSpy).toHaveBeenCalledWith(
        hap.Characteristic.ChargingState.CHARGING
      );
    });

    test("updates the status of the battery on `charging` update (true)", () => {
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "charging",
        value: false,
      });

      expect(updateBatteryLevelSpy).not.toHaveBeenCalled();
      expect(updateStatusLowBatterySpy).not.toHaveBeenCalled();
      expect(updateChargingStateSpy).toHaveBeenCalledWith(
        hap.Characteristic.ChargingState.NOT_CHARGING
      );
    });

    test("does not update anything on unknown event", () => {
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "cleaning",
        value: false,
      });

      expect(updateBatteryLevelSpy).not.toHaveBeenCalled();
      expect(updateStatusLowBatterySpy).not.toHaveBeenCalled();
      expect(updateChargingStateSpy).not.toHaveBeenCalled();
    });
  });

  test("getBattery", async () => {
    jest.spyOn(deviceManagerMock.device, "batteryLevel").mockResolvedValue(3);
    const [service] = batteryInfo.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.BatteryLevel)
        .handleGetRequest()
    ).resolves.toStrictEqual(3);
  });

  test("getBatteryLow - low", async () => {
    jest.spyOn(deviceManagerMock.device, "batteryLevel").mockResolvedValue(3);
    const [service] = batteryInfo.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.StatusLowBattery)
        .handleGetRequest()
    ).resolves.toStrictEqual(
      hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
    );
  });

  test("getBatteryLow - normal", async () => {
    jest.spyOn(deviceManagerMock.device, "batteryLevel").mockResolvedValue(25);
    const [service] = batteryInfo.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.StatusLowBattery)
        .handleGetRequest()
    ).resolves.toStrictEqual(
      hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );
  });

  test("getCharging - true", async () => {
    (deviceManagerMock.state as string) = "charging";
    const [service] = batteryInfo.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.ChargingState)
        .handleGetRequest()
    ).resolves.toStrictEqual(hap.Characteristic.ChargingState.CHARGING);
  });

  test("getCharging - false", async () => {
    const [service] = batteryInfo.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.ChargingState)
        .handleGetRequest()
    ).resolves.toStrictEqual(hap.Characteristic.ChargingState.NOT_CHARGING);
  });
});
