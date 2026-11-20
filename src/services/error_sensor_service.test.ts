import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { ErrorSensorService } from "./error_sensor_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";

describe("ErrorSensorService", () => {
  let service: ErrorSensorService;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  beforeEach(async () => {
    hap = HapJs;
    deviceManagerMock = createDeviceManagerMock();
    service = new ErrorSensorService({
      hap,
      log: getLoggerMock(),
      config: applyConfigDefaults({ name: "Robot", errorSensor: true }),
      deviceManager: deviceManagerMock,
    });
    await service.init();
  });

  afterEach(() => {
    (deviceManagerMock.errorChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  const occupancy = () =>
    service.services[0].getCharacteristic(hap.Characteristic.OccupancyDetected);

  test("returns a sensor", () => {
    expect(service.services).toHaveLength(1);
    expect(occupancy().value).toBe(0);
    expect(
      service.services[0].getCharacteristic(hap.Characteristic.Name).value
    ).toBe("Robot Error");
  });

  test("detected while the robot reports an error, every time", async () => {
    const spy = jest.spyOn(occupancy(), "updateValue");
    const errors$ = deviceManagerMock.errorChanged$ as Subject<unknown>;
    errors$.next({ id: 8, description: "Device stuck" });
    await expect(occupancy().handleGetRequest()).resolves.toBe(1);
    errors$.next(null);
    await expect(occupancy().handleGetRequest()).resolves.toBe(0);
    errors$.next({ id: 5, description: "Main brush blocked" });
    errors$.next(null);
    expect(spy.mock.calls).toEqual([[1], [0], [1], [0]]);
  });
});
