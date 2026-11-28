import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { GoToService } from "./go_to_service.js";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock.js";
import { getLoggerMock, LoggerMock } from "../utils/logger.mock.js";
import { applyConfigDefaults } from "./config_service.js";

describe("GoToService", () => {
  let goToService: GoToService;
  let deviceManagerMock: DeviceManagerMock;
  let log: LoggerMock;
  const hap: HAP = HapJs;

  const setState = (state: string) => {
    (deviceManagerMock as { state: string }).state = state;
  };

  beforeEach(async () => {
    deviceManagerMock = createDeviceManagerMock();
    log = getLoggerMock();
    goToService = new GoToService({
      hap,
      log,
      config: applyConfigDefaults({ goTo: true, goToX: 100, goToY: 200 }),
      deviceManager: deviceManagerMock,
    });
    await goToService.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    vi.resetAllMocks();
  });

  const onCharacteristic = () =>
    goToService.services[0].getCharacteristic(hap.Characteristic.On);

  test("returns a switch named after the config", () => {
    expect(goToService.services).toHaveLength(1);
    expect(
      goToService.services[0].getCharacteristic(hap.Characteristic.Name).value
    ).toBe("Roborock vacuum cleaner go to coordinates");
  });

  test.each([
    ["going-to-location", true],
    ["idle", true],
    ["waiting", true],
    ["cleaning", false],
    ["charging", false],
  ])("onGet when the state is %p", async (state, expected) => {
    setState(state);
    await expect(onCharacteristic().handleGetRequest()).resolves.toBe(expected);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith("getGoToState");
  });

  test("ON sends the robot to the configured coordinates", async () => {
    await onCharacteristic().handleSetRequest(true);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith("goTo");
    expect(deviceManagerMock.device.sendToLocation).toHaveBeenCalledWith(
      100,
      200
    );
    expect(deviceManagerMock.device.activateCharging).not.toHaveBeenCalled();
  });

  test("OFF sends the robot back to the dock", async () => {
    await onCharacteristic().handleSetRequest(false);
    expect(deviceManagerMock.device.activateCharging).toHaveBeenCalledTimes(1);
    expect(deviceManagerMock.device.sendToLocation).not.toHaveBeenCalled();
  });

  test("warns and does nothing on models that can't go to a location", async () => {
    const activateCharging = vi.fn();
    (deviceManagerMock as { device: unknown }).device = { activateCharging };
    await onCharacteristic().handleSetRequest(false);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("doesn't support going to a location")
    );
    expect(activateCharging).not.toHaveBeenCalled();
  });

  test("logs and rethrows the device's errors", async () => {
    const error = new Error("Boom");
    deviceManagerMock.device.sendToLocation.mockRejectedValueOnce(error);
    await expect(onCharacteristic().handleSetRequest(true)).rejects.toThrow();
    expect(log.error).toHaveBeenCalledWith("goTo | ", error);
  });
});
