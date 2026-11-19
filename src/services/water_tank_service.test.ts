import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { WaterTankService } from "./water_tank_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";

describe("WaterTankService", () => {
  let waterTankService: WaterTankService;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  beforeEach(async () => {
    hap = HapJs;
    deviceManagerMock = createDeviceManagerMock();
    waterTankService = new WaterTankService({
      hap,
      log: getLoggerMock(),
      config: applyConfigDefaults({ waterTankEmpty: true }),
      deviceManager: deviceManagerMock,
    });
    await waterTankService.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  const occupancy = () =>
    waterTankService.services[0].getCharacteristic(
      hap.Characteristic.OccupancyDetected
    );

  test("returns a service", () => {
    expect(waterTankService.services).toHaveLength(1);
    expect(
      waterTankService.services[0].getCharacteristic(hap.Characteristic.Name)
        .value
    ).toBe("Roborock vacuum cleaner Water Tank Empty");
  });

  test.each([
    [true, 1],
    [false, 0],
    [undefined, 0], // models that don't report it
  ])("onGet when waterShortage is %p", async (waterShortage, expected) => {
    deviceManagerMock.property.mockReturnValue(waterShortage);
    await expect(occupancy().handleGetRequest()).resolves.toBe(expected);
    expect(deviceManagerMock.property).toHaveBeenCalledWith("waterShortage");
  });

  test("updates the sensor when waterShortage changes", () => {
    const spy = jest.spyOn(occupancy(), "updateValue");
    const state$ = deviceManagerMock.stateChanged$ as Subject<unknown>;
    state$.next({ key: "charging", value: true });
    state$.next({ key: "waterShortage", value: true });
    state$.next({ key: "waterShortage", value: true });
    state$.next({ key: "waterShortage", value: false });
    expect(spy.mock.calls).toEqual([[1], [0]]);
  });
});
