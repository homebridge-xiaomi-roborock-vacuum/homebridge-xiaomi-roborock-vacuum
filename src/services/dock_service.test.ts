import { HAP } from "homebridge";
import * as HapJs from "hap-nodejs";
import { Subject } from "rxjs";
import { DockService } from "./dock_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";

describe("DockService", () => {
  let dockService: DockService;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  beforeEach(async () => {
    hap = HapJs;
    const log = getLoggerMock();
    deviceManagerMock = createDeviceManagerMock();
    const config = applyConfigDefaults({});

    dockService = new DockService({
      hap,
      log,
      config,
      deviceManager: deviceManagerMock,
    });

    await dockService.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  describe("stateChanged$", () => {
    let occupancyDetectedSpy: jest.SpyInstance;

    beforeEach(() => {
      const [service] = dockService.services;
      occupancyDetectedSpy = jest.spyOn(
        service.getCharacteristic(hap.Characteristic.OccupancyDetected),
        "updateValue"
      );
    });

    test("updates the service on `charging` update (true)", () => {
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "charging",
        value: true,
      });

      expect(occupancyDetectedSpy).toHaveBeenCalledWith(true);
    });

    test("updates the service on `charging` update (true)", () => {
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "charging",
        value: false,
      });

      expect(occupancyDetectedSpy).toHaveBeenCalledWith(false);
    });
  });

  test("getDocked - true", async () => {
    (deviceManagerMock.state as string) = "charging";
    const [service] = dockService.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.OccupancyDetected)
        .handleGetRequest()
    ).resolves.toStrictEqual(
      hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
    );
  });

  test("getDocked - false", async () => {
    const [service] = dockService.services;
    await expect(
      service
        .getCharacteristic(hap.Characteristic.OccupancyDetected)
        .handleGetRequest()
    ).resolves.toStrictEqual(
      hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
    );
  });
});
