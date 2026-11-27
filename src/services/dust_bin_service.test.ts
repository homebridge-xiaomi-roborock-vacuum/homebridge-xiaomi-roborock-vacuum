import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { DustBinService } from "./dust_bin_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";

describe("DustBinService", () => {
  let service: DustBinService;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  beforeEach(async () => {
    hap = HapJs;
    deviceManagerMock = createDeviceManagerMock();
    service = new DustBinService({
      hap,
      log: getLoggerMock(),
      config: applyConfigDefaults({ dustBin: true }),
      deviceManager: deviceManagerMock,
    });
    await service.init();
  });

  afterEach(() => {
    (deviceManagerMock.errorChanged$ as Subject<unknown>).complete();
    vi.resetAllMocks();
  });

  const lockState = () =>
    service.services[0]
      .getCharacteristic(hap.Characteristic.LockTargetState)
      .handleGetRequest();

  test.each([10, "10"])(
    "is secured when the robot reports the bin-full error (id %p)",
    async (id) => {
      (deviceManagerMock.errorChanged$ as Subject<unknown>).next({
        id,
        description: "Bin full",
      });
      await expect(lockState()).resolves.toBe(
        hap.Characteristic.LockTargetState.SECURED
      );
    }
  );

  test("ignores other errors and cleared errors (null)", async () => {
    const errors$ = deviceManagerMock.errorChanged$ as Subject<unknown>;
    errors$.next(null);
    errors$.next({ id: 3, description: "Wheels stuck" });
    await expect(lockState()).resolves.toBe(
      hap.Characteristic.LockTargetState.UNSECURED
    );
  });

  test("is secured again the next time the bin is full", async () => {
    const errors$ = deviceManagerMock.errorChanged$ as Subject<unknown>;
    const target = service.services[0].getCharacteristic(
      hap.Characteristic.LockTargetState
    );
    errors$.next({ id: 10, description: "Bin full" });
    // Emptied, and acknowledged in HomeKit
    errors$.next(null);
    await target.handleSetRequest(hap.Characteristic.LockTargetState.UNSECURED);
    await expect(lockState()).resolves.toBe(
      hap.Characteristic.LockTargetState.UNSECURED
    );
    errors$.next({ id: 10, description: "Bin full" });
    await expect(lockState()).resolves.toBe(
      hap.Characteristic.LockTargetState.SECURED
    );
  });
});
