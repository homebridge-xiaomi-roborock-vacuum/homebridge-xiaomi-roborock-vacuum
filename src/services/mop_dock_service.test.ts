import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { MopDockService } from "./mop_dock_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, Config } from "./config_service";

describe("MopDockService", () => {
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  const create = async (config: Partial<Config>) => {
    const service = new MopDockService({
      hap,
      log: getLoggerMock(),
      config: applyConfigDefaults(config),
      deviceManager: deviceManagerMock,
    });
    await service.init();
    return service;
  };

  const on = (service: MopDockService, subtype: string) =>
    service.services
      .find((s) => s.subtype === subtype)!
      .getCharacteristic(hap.Characteristic.On);

  beforeEach(() => {
    hap = HapJs;
    deviceManagerMock = createDeviceManagerMock();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  test("only returns the enabled switches", async () => {
    expect((await create({})).services).toHaveLength(0);
    expect(
      (await create({ mopWash: true })).services.map((s) => s.subtype)
    ).toEqual(["Wash Mop"]);
    expect(
      (await create({ mopDrying: true })).services.map((s) => s.subtype)
    ).toEqual(["Dry Mop"]);
    expect(
      (await create({ mopWash: true, mopDrying: true })).services
    ).toHaveLength(2);
  });

  describe("wash mop", () => {
    test("is always OFF", async () => {
      const service = await create({ mopWash: true });
      await expect(on(service, "Wash Mop").handleGetRequest()).resolves.toBe(
        false
      );
    });

    test("ON starts washing the mop, and goes back to OFF", async () => {
      vi.useFakeTimers();
      const service = await create({ mopWash: true });
      const spy = vi.spyOn(on(service, "Wash Mop"), "updateValue");
      await on(service, "Wash Mop").handleSetRequest(true);
      expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith("washMop");
      expect(deviceManagerMock.device.startMopWash).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1000);
      expect(spy).toHaveBeenCalledWith(false);
    });

    test("OFF does nothing", async () => {
      const service = await create({ mopWash: true });
      await on(service, "Wash Mop").handleSetRequest(false);
      expect(deviceManagerMock.device.startMopWash).not.toHaveBeenCalled();
    });

    test("throws when the device fails", async () => {
      vi.useFakeTimers();
      const service = await create({ mopWash: true });
      vi.spyOn(deviceManagerMock.device, "startMopWash").mockRejectedValue(
        new Error("Something went terribly wrong")
      );
      await expect(on(service, "Wash Mop").handleSetRequest(true)).rejects.toBe(
        -70402
      );
    });
  });

  describe("dry mop", () => {
    test.each([
      [true, true],
      [false, false],
      [undefined, false],
    ])("onGet when mopDrying is %p", async (mopDrying, expected) => {
      deviceManagerMock.property.mockReturnValue(mopDrying);
      const service = await create({ mopDrying: true });
      await expect(on(service, "Dry Mop").handleGetRequest()).resolves.toBe(
        expected
      );
      expect(deviceManagerMock.property).toHaveBeenCalledWith("mopDrying");
    });

    test("updates the switch when mopDrying changes", async () => {
      const service = await create({ mopDrying: true });
      const spy = vi.spyOn(on(service, "Dry Mop"), "updateValue");
      const state$ = deviceManagerMock.stateChanged$ as Subject<unknown>;
      state$.next({ key: "cleaning", value: true });
      state$.next({ key: "mopDrying", value: true });
      state$.next({ key: "mopDrying", value: false });
      // The next drying
      state$.next({ key: "mopDrying", value: true });
      state$.next({ key: "mopDrying", value: true });
      state$.next({ key: "mopDrying", value: false });
      expect(spy.mock.calls).toEqual([[true], [false], [true], [false]]);
    });

    test.each([
      [true, "startMopDrying"],
      [false, "stopMopDrying"],
    ] as const)("%p calls %s", async (state, method) => {
      const service = await create({ mopDrying: true });
      await on(service, "Dry Mop").handleSetRequest(state);
      expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith("setDrying");
      expect(deviceManagerMock.device[method]).toHaveBeenCalledTimes(1);
    });

    test("does nothing if node-miio doesn't support it", async () => {
      const service = await create({ mopDrying: true });
      const { startMopDrying } = deviceManagerMock.device;
      delete (
        deviceManagerMock.device as Partial<typeof deviceManagerMock.device>
      ).startMopDrying;
      try {
        await expect(
          on(service, "Dry Mop").handleSetRequest(true)
        ).resolves.toBeUndefined();
      } finally {
        deviceManagerMock.device.startMopDrying = startMopDrying;
      }
    });

    test("throws when the device fails", async () => {
      const service = await create({ mopDrying: true });
      vi.spyOn(deviceManagerMock.device, "startMopDrying").mockRejectedValue(
        new Error("Something went terribly wrong")
      );
      await expect(on(service, "Dry Mop").handleSetRequest(true)).rejects.toBe(
        -70402
      );
    });
  });
});
