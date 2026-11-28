import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { DustCollection } from "./dust_collection.js";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock.js";
import { getLoggerMock, LoggerMock } from "../utils/logger.mock.js";
import { applyConfigDefaults } from "./config_service.js";

describe("DustCollection", () => {
  let dustCollection: DustCollection;
  let deviceManagerMock: DeviceManagerMock;
  let log: LoggerMock;
  const hap: HAP = HapJs;

  const setState = (state: string) => {
    (deviceManagerMock as { state: string }).state = state;
  };

  beforeEach(async () => {
    deviceManagerMock = createDeviceManagerMock();
    log = getLoggerMock();
    dustCollection = new DustCollection({
      hap,
      log,
      config: applyConfigDefaults({ dustCollection: true }),
      deviceManager: deviceManagerMock,
    });
    await dustCollection.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    vi.resetAllMocks();
  });

  const onCharacteristic = () =>
    dustCollection.services[0].getCharacteristic(hap.Characteristic.On);

  test("returns a switch named after the config", () => {
    expect(dustCollection.services).toHaveLength(1);
    expect(
      dustCollection.services[0].getCharacteristic(hap.Characteristic.Name)
        .value
    ).toBe("Roborock vacuum cleaner Dust Collection");
  });

  test.each([
    ["dust-collection", true],
    ["charging", false],
    ["cleaning", false],
  ])("onGet when the state is %p", async (state, expected) => {
    setState(state);
    await expect(onCharacteristic().handleGetRequest()).resolves.toBe(expected);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith(
      "getDustCollectionState"
    );
  });

  test("ON starts the dust collection when it isn't collecting", async () => {
    setState("charging");
    await onCharacteristic().handleSetRequest(true);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith(
      "setDustCollectionState"
    );
    expect(deviceManagerMock.device.startDustCollection).toHaveBeenCalledTimes(
      1
    );
    expect(deviceManagerMock.device.stopDustCollection).not.toHaveBeenCalled();
  });

  test("ON does nothing while it's already collecting", async () => {
    setState("dust-collection");
    await onCharacteristic().handleSetRequest(true);
    expect(deviceManagerMock.device.startDustCollection).not.toHaveBeenCalled();
    expect(deviceManagerMock.device.stopDustCollection).not.toHaveBeenCalled();
  });

  test("OFF stops the dust collection while it's collecting", async () => {
    setState("dust-collection");
    await onCharacteristic().handleSetRequest(false);
    expect(deviceManagerMock.device.stopDustCollection).toHaveBeenCalledTimes(
      1
    );
  });

  test("OFF does nothing when it isn't collecting", async () => {
    setState("charging");
    await onCharacteristic().handleSetRequest(false);
    expect(deviceManagerMock.device.stopDustCollection).not.toHaveBeenCalled();
  });

  test.each(["charging", "docked", "fully-charged"])(
    "ON starts the dust collection on the dock (%p)",
    async (state) => {
      setState(state);
      await onCharacteristic().handleSetRequest(true);
      expect(
        deviceManagerMock.device.startDustCollection
      ).toHaveBeenCalledTimes(1);
    }
  );

  test.each(["cleaning", "returning", "paused", "idle", ""])(
    "ON away from the dock turns the switch back off (%p)",
    async (state) => {
      setState(state);
      const spy = vi.spyOn(onCharacteristic(), "updateValue");
      await onCharacteristic().handleSetRequest(true);
      expect(
        deviceManagerMock.device.startDustCollection
      ).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(false);
    }
  );

  test("warns and does nothing on models without dust collection", async () => {
    (deviceManagerMock as { device: unknown }).device = {};
    await onCharacteristic().handleSetRequest(true);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("doesn't support the dust collection")
    );
  });

  test("logs and rethrows the device's errors", async () => {
    setState("charging");
    const error = new Error("Boom");
    deviceManagerMock.device.startDustCollection.mockRejectedValueOnce(error);
    await expect(onCharacteristic().handleSetRequest(true)).rejects.toThrow();
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed updating dust collection state true"),
      error
    );
  });
});
