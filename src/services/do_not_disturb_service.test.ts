import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { DoNotDisturbService } from "./do_not_disturb_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock, LoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, Config } from "./config_service";
import type { MiioDeviceMock } from "../test.mocks";

describe("DoNotDisturbService", () => {
  let deviceManagerMock: DeviceManagerMock;
  let log: LoggerMock;
  let hap: HAP;

  const create = async (config: Partial<Config> = {}) => {
    const service = new DoNotDisturbService({
      hap,
      log,
      config: applyConfigDefaults({
        name: "Robot",
        doNotDisturb: true,
        ...config,
      }),
      deviceManager: deviceManagerMock,
    });
    await service.init();
    return service;
  };

  const on = (service: DoNotDisturbService) =>
    service.services[0].getCharacteristic(hap.Characteristic.On);

  const connect = async () => {
    (
      deviceManagerMock.deviceConnected$ as unknown as Subject<MiioDeviceMock>
    ).next(deviceManagerMock.device);
    await new Promise(setImmediate);
  };

  beforeEach(() => {
    hap = HapJs;
    log = getLoggerMock();
    deviceManagerMock = createDeviceManagerMock();
    deviceManagerMock.device.getDoNotDisturb.mockResolvedValue({
      enabled: true,
      start: "21:00",
      end: "07:30",
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("no switch unless enabled", async () => {
    expect((await create({ doNotDisturb: false })).services).toHaveLength(0);
    const service = await create();
    expect(service.services).toHaveLength(1);
    expect(service.services[0].displayName).toBe("Robot Do Not Disturb");
  });

  test("shows the robot's schedule once connected", async () => {
    const service = await create();
    expect(on(service).value).toBe(false);
    await connect();
    expect(on(service).value).toBe(true);
  });

  test("turning it on re-enables the robot's schedule", async () => {
    deviceManagerMock.device.getDoNotDisturb.mockResolvedValue({
      enabled: false,
      start: "21:00",
      end: "07:30",
    });
    const service = await create();
    await on(service).handleSetRequest(true);
    expect(deviceManagerMock.device.setDoNotDisturb).toHaveBeenCalledWith(
      "21:00",
      "07:30"
    );
    expect(on(service).value).toBe(true);
  });

  test("turning it on with a configured schedule", async () => {
    const service = await create({
      doNotDisturbStart: "00:00",
      doNotDisturbEnd: "23:59",
    });
    await on(service).handleSetRequest(true);
    expect(deviceManagerMock.device.setDoNotDisturb).toHaveBeenCalledWith(
      "00:00",
      "23:59"
    );
  });

  test("turning it on without a schedule uses the robot's default", async () => {
    deviceManagerMock.device.getDoNotDisturb.mockRejectedValue(
      new Error("timeout")
    );
    const service = await create();
    await on(service).handleSetRequest(true);
    expect(deviceManagerMock.device.setDoNotDisturb).toHaveBeenCalledWith(
      "22:00",
      "08:00"
    );
  });

  test("turning it off disables the schedule", async () => {
    const service = await create();
    await connect();
    await on(service).handleSetRequest(false);
    expect(deviceManagerMock.device.disableDoNotDisturb).toHaveBeenCalled();
    expect(on(service).value).toBe(false);
  });

  test("reading it refreshes it from the robot (e.g. changed in the app)", async () => {
    const service = await create();
    await connect();
    deviceManagerMock.device.getDoNotDisturb.mockResolvedValue({
      enabled: false,
      start: "21:00",
      end: "07:30",
    });
    // Answers right away with the last known value
    expect(await on(service).handleGetRequest()).toBe(true);
    await new Promise(setImmediate);
    expect(on(service).value).toBe(false);
  });

  test("models without Do Not Disturb: a warning", async () => {
    const { getDoNotDisturb, ...withoutDnd } = deviceManagerMock.device;
    void getDoNotDisturb;
    Object.assign(deviceManagerMock, { device: withoutDnd });
    const service = await create();
    await on(service).handleSetRequest(true);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("doesn't support Do Not Disturb")
    );
  });

  test("failures are rethrown (HomeKit shows them)", async () => {
    deviceManagerMock.device.disableDoNotDisturb.mockRejectedValue(
      new Error("timeout")
    );
    const service = await create();
    await expect(on(service).handleSetRequest(false)).rejects.toBe(-70402);
  });
});
