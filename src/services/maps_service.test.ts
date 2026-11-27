import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { MapsService } from "./maps_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, type Config } from "./config_service";

describe("MapsService", () => {
  let service: MapsService;
  let deviceManagerMock: DeviceManagerMock;
  let log: ReturnType<typeof getLoggerMock>;
  const hap: HAP = HapJs;

  async function create(config: Partial<Config>) {
    deviceManagerMock = createDeviceManagerMock();
    log = getLoggerMock();
    service = new MapsService({
      hap,
      log,
      config: applyConfigDefaults(config),
      deviceManager: deviceManagerMock,
    });
    await service.init();
  }

  const on = (index: number) =>
    service.services[index].getCharacteristic(hap.Characteristic.On);
  const names = () =>
    service.services.map(
      (s) => s.getCharacteristic(hap.Characteristic.Name).value
    );

  beforeEach(async () => {
    vi.useFakeTimers();
    await create({
      maps: [
        { name: "Ground floor", id: 0 },
        { name: "Upstairs", id: 1 },
        { name: "Doors open", savedAt: "2026-10-05T08:43:55.000Z" },
      ],
    });
    // Replayed from a roborock.vacuum.s5: the slots don't follow the dates
    deviceManagerMock.device.getBackupMaps.mockResolvedValue([
      { id: 1, savedAt: new Date(1791368336000) },
      { id: 2, savedAt: new Date(1791189835000) },
      { id: 3, savedAt: new Date(1761993118000) },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  test("a switch per map, named after it", () => {
    expect(names()).toEqual([
      "map Ground floor",
      "map Upstairs",
      "map Doors open",
    ]);
  });

  test("stable subtypes: by floor id, or by backup date", () => {
    expect(service.services.map((s) => s.subtype)).toEqual([
      "map0",
      "map1",
      "mapBackup1791189835",
    ]);
  });

  test("the switches' first word(s) can be configured", async () => {
    await create({ mapWord: "mapa", maps: [{ name: "Arriba", id: 1 }] });
    expect(names()).toEqual(["mapa Arriba"]);
  });

  test("maps without a name, a floor or a valid date, or loading the same map, are ignored", async () => {
    await create({
      maps: [
        { name: "", id: 1 },
        { name: "Nothing" },
        { name: "Bad date", savedAt: "yesterday" },
        { name: "OK", id: 1 },
        { name: "Same floor", id: 1 },
      ],
    });
    expect(names()).toEqual(["map OK"]);
    expect(log.warn).toHaveBeenCalledTimes(4);
  });

  test("ON loads the floor, and the switch turns itself off", async () => {
    await on(1).handleSetRequest(true);
    expect(deviceManagerMock.device.loadMap).toHaveBeenCalledWith(1);
    expect(deviceManagerMock.device.loadBackupMap).not.toHaveBeenCalled();
    await expect(on(1).handleGetRequest()).resolves.toBe(false);

    const update = vi.spyOn(on(1), "updateValue");
    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledWith(false);
  });

  test("OFF does nothing", async () => {
    await on(0).handleSetRequest(false);
    expect(deviceManagerMock.device.loadMap).not.toHaveBeenCalled();
  });

  test("a backup is restored from its current slot, found by its date", async () => {
    await on(2).handleSetRequest(true);
    expect(deviceManagerMock.device.loadBackupMap).toHaveBeenCalledWith(2);
  });

  test("a backup the robot no longer has fails, with the dates it has", async () => {
    deviceManagerMock.device.getBackupMaps.mockResolvedValue([
      { id: 1, savedAt: new Date(1791368336000) },
    ]);
    await expect(on(2).handleSetRequest(true)).rejects.toBeDefined();
    expect(deviceManagerMock.device.loadBackupMap).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(
      "loadMap | ",
      expect.objectContaining({
        message: expect.stringContaining("2026-10-07T10:18:56.000Z"),
      })
    );
    // It still turns off
    const update = vi.spyOn(on(2), "updateValue");
    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledWith(false);
  });

  test("models without maps only log a warning", async () => {
    const device = deviceManagerMock.device as unknown as Record<
      string,
      unknown
    >;
    const { loadMap, loadBackupMap } = device;
    delete device.loadMap;
    delete device.loadBackupMap;
    try {
      await on(0).handleSetRequest(true);
      await on(2).handleSetRequest(true);
      expect(log.warn).toHaveBeenCalledTimes(2);
    } finally {
      Object.assign(device, { loadMap, loadBackupMap });
    }
  });

  test("a failure is reported", async () => {
    deviceManagerMock.device.loadMap.mockRejectedValueOnce(new Error("boom"));
    await expect(on(0).handleSetRequest(true)).rejects.toBeDefined();
    expect(log.error).toHaveBeenCalled();
  });
});
