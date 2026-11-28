import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { isCleaningState } from "node-miio";
import { CleaningSensorService } from "./cleaning_sensor_service.js";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock.js";
import { getLoggerMock } from "../utils/logger.mock.js";
import { applyConfigDefaults, type Config } from "./config_service.js";

describe("CleaningSensorService", () => {
  let service: CleaningSensorService;
  let deviceManagerMock: DeviceManagerMock;
  const hap: HAP = HapJs;

  const setState = (state: string) => {
    Object.assign(deviceManagerMock, {
      state,
      isCleaning: isCleaningState(state),
    });
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
      key: "state",
      value: state,
    });
  };
  const detected = () =>
    service.services[0].getCharacteristic(hap.Characteristic.OccupancyDetected);

  async function create(config: Partial<Config> = {}) {
    deviceManagerMock = createDeviceManagerMock();
    Object.assign(deviceManagerMock, { state: "charging", isCleaning: false });
    service = new CleaningSensorService({
      hap,
      log: getLoggerMock(),
      config: applyConfigDefaults({ cleaningSensor: true, ...config }),
      deviceManager: deviceManagerMock,
    });
    await service.init();
  }

  beforeEach(() => create());

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    vi.resetAllMocks();
  });

  test("named after the vacuum and the cleaning word", async () => {
    await create({ name: "Roberta", cleanword: "limpiando" });
    expect(
      service.services[0].getCharacteristic(hap.Characteristic.Name).value
    ).toBe("Roberta limpiando");
  });

  test("detected while cleaning, not while paused or docked", async () => {
    await expect(detected().handleGetRequest()).resolves.toBe(0);
    const update = vi.spyOn(detected(), "updateValue");

    setState("cleaning");
    expect(update).toHaveBeenLastCalledWith(1);
    await expect(detected().handleGetRequest()).resolves.toBe(1);

    setState("paused");
    expect(update).toHaveBeenLastCalledWith(0);

    // Going back to the dock isn't cleaning any more
    setState("room-cleaning");
    setState("returning");
    setState("charging");
    expect(update.mock.calls.map(([value]) => value)).toEqual([1, 0, 1, 0]);
  });

  test("only updates when it changes", () => {
    const update = vi.spyOn(detected(), "updateValue");
    setState("cleaning");
    setState("cleaning");
    expect(update).toHaveBeenCalledTimes(1);
  });
});
