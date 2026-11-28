import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { PauseSwitch } from "./pause_switch.js";
import type { RoomsService } from "./rooms_service.js";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock.js";
import { getLoggerMock, LoggerMock } from "../utils/logger.mock.js";
import { applyConfigDefaults } from "./config_service.js";

describe("PauseSwitch", () => {
  let pauseSwitch: PauseSwitch;
  let deviceManagerMock: DeviceManagerMock;
  let log: LoggerMock;
  let roomsService: Pick<RoomsService, "roomIdsToClean" | "roomIdsForDevice">;
  const hap: HAP = HapJs;

  const setFlags = (flags: { isCleaning: boolean; isPaused: boolean }) =>
    Object.assign(deviceManagerMock, flags);
  const stateChanged = (key: string, value: unknown) =>
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({ key, value });

  beforeEach(async () => {
    deviceManagerMock = createDeviceManagerMock();
    log = getLoggerMock();
    roomsService = { roomIdsToClean: new Set(), roomIdsForDevice: [] };
    pauseSwitch = new PauseSwitch(
      {
        hap,
        log,
        config: applyConfigDefaults({ pause: true }),
        deviceManager: deviceManagerMock,
      },
      roomsService as RoomsService
    );
    await pauseSwitch.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    vi.resetAllMocks();
  });

  const onCharacteristic = () =>
    pauseSwitch.services[0].getCharacteristic(hap.Characteristic.On);

  test("returns a switch named after the config", () => {
    expect(pauseSwitch.services).toHaveLength(1);
    expect(
      pauseSwitch.services[0].getCharacteristic(hap.Characteristic.Name).value
    ).toBe("Roborock vacuum cleaner Pause");
  });

  test.each([
    [{ isCleaning: true, isPaused: false }, true],
    [{ isCleaning: true, isPaused: true }, false],
    [{ isCleaning: false, isPaused: false }, false],
  ])("onGet with %o is %p", async (flags, expected) => {
    setFlags(flags);
    await expect(onCharacteristic().handleGetRequest()).resolves.toBe(expected);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith(
      "getPauseState"
    );
  });

  test("follows the cleaning state, once per change", () => {
    const spy = vi.spyOn(onCharacteristic(), "updateValue");
    stateChanged("cleaning", true);
    stateChanged("cleaning", true);
    stateChanged("charging", true);
    stateChanged("cleaning", false);
    expect(spy.mock.calls).toEqual([[true], [false]]);
  });

  test("OFF pauses while cleaning", async () => {
    setFlags({ isCleaning: true, isPaused: false });
    await onCharacteristic().handleSetRequest(false);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith(
      "setPauseState"
    );
    expect(deviceManagerMock.device.pause).toHaveBeenCalledTimes(1);
  });

  test("OFF does nothing when it isn't cleaning", async () => {
    setFlags({ isCleaning: false, isPaused: false });
    await onCharacteristic().handleSetRequest(false);
    expect(deviceManagerMock.device.pause).not.toHaveBeenCalled();
  });

  test("ON resumes the normal cleaning when paused", async () => {
    setFlags({ isCleaning: false, isPaused: true });
    await onCharacteristic().handleSetRequest(true);
    expect(deviceManagerMock.device.activateCleaning).toHaveBeenCalledTimes(1);
    expect(deviceManagerMock.device.resumeCleanRooms).not.toHaveBeenCalled();
  });

  test("ON resumes the room cleaning when rooms were selected", async () => {
    setFlags({ isCleaning: false, isPaused: true });
    roomsService.roomIdsToClean.add("16");
    (roomsService as { roomIdsForDevice: unknown }).roomIdsForDevice = [16];
    await onCharacteristic().handleSetRequest(true);
    expect(deviceManagerMock.device.resumeCleanRooms).toHaveBeenCalledWith([
      16,
    ]);
    expect(deviceManagerMock.device.activateCleaning).not.toHaveBeenCalled();
  });

  test("ON does nothing when it isn't paused", async () => {
    setFlags({ isCleaning: true, isPaused: false });
    await onCharacteristic().handleSetRequest(true);
    expect(deviceManagerMock.device.activateCleaning).not.toHaveBeenCalled();
    expect(deviceManagerMock.device.pause).not.toHaveBeenCalled();
  });

  test("logs the device's errors without rethrowing", async () => {
    setFlags({ isCleaning: true, isPaused: false });
    const error = new Error("Boom");
    deviceManagerMock.device.pause.mockRejectedValueOnce(error);
    await onCharacteristic().handleSetRequest(false);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed updating pause state false"),
      error
    );
  });
});
