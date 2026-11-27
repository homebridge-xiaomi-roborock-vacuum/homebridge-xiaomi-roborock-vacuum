import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { ZonesService } from "./zones_service";
import { MainService } from "./main_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, type Config } from "./config_service";

describe("ZonesService", () => {
  let service: ZonesService;
  let deviceManagerMock: DeviceManagerMock;
  let log: ReturnType<typeof getLoggerMock>;
  let mainService: { setSpeed: Mock; getCleaning: Mock };
  let setWaterSpeed: Mock | undefined;
  const hap: HAP = HapJs;

  const kitchen = [[24500, 27000, 28000, 30000, 2]] as [
    number,
    number,
    number,
    number,
    number,
  ][];

  async function create(
    zones: NonNullable<Config["zones"]>,
    waterSpeed: Mock | null = vi.fn(),
    config: Partial<Config> = {}
  ) {
    deviceManagerMock = createDeviceManagerMock();
    (deviceManagerMock as { isCleaning: boolean }).isCleaning = false;
    log = getLoggerMock();
    mainService = { setSpeed: vi.fn(), getCleaning: vi.fn() };
    setWaterSpeed = waterSpeed ?? undefined;
    service = new ZonesService(
      {
        hap,
        log,
        config: applyConfigDefaults({ zones, ...config }),
        deviceManager: deviceManagerMock,
      },
      mainService as unknown as MainService,
      vi.fn(),
      setWaterSpeed
    );
    await service.init();
  }

  const on = (index: number) =>
    service.services[index].getCharacteristic(hap.Characteristic.On);

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  const stoppedCleaning = () =>
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
      key: "cleaning",
      value: false,
    });

  test("a switch per zone", async () => {
    await create([
      { name: "Kitchen", zone: kitchen },
      { name: "Bedroom", zone: [[1, 2, 3, 4]] },
    ]);
    expect(
      service.services.map(
        (zone) => zone.getCharacteristic(hap.Characteristic.Name).value
      )
    ).toEqual(["cleaning Kitchen", "cleaning Bedroom"]);
  });

  test("ON cleans the zone, adding the default count of 1 when missing", async () => {
    await create([{ name: "Bedroom", zone: [[1, 2, 3, 4]] }]);
    await on(0).handleSetRequest(true);
    expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith([
      [1, 2, 3, 4, 1],
    ]);
  });

  test("without speed or water level, they're left as they are", async () => {
    await create([{ name: "Kitchen", zone: kitchen }]);
    await on(0).handleSetRequest(true);
    expect(mainService.setSpeed).not.toHaveBeenCalled();
    expect(setWaterSpeed).not.toHaveBeenCalled();
    expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith(kitchen);
  });

  test("sets the zone's fan speed and water level before cleaning it", async () => {
    await create([
      { name: "Kitchen", zone: kitchen, speed: "Mop", waterSpeed: "High" },
    ]);
    await on(0).handleSetRequest(true);
    expect(mainService.setSpeed).toHaveBeenCalledWith("Mop");
    expect(setWaterSpeed).toHaveBeenCalledWith("High");
    const cleanOrder =
      deviceManagerMock.device.cleanZones.mock.invocationCallOrder[0];
    expect(mainService.setSpeed.mock.invocationCallOrder[0]).toBeLessThan(
      cleanOrder
    );
    expect(setWaterSpeed!.mock.invocationCallOrder[0]).toBeLessThan(cleanOrder);
  });

  test('"Off" is not used as a fan speed (it would stop the cleaning)', async () => {
    await create([{ name: "Kitchen", zone: kitchen, speed: "Off" }]);
    await on(0).handleSetRequest(true);
    expect(mainService.setSpeed).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"Off"'));
    expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith(kitchen);
  });

  test("warns about the water level when the water box is disabled", async () => {
    await create(
      [{ name: "Kitchen", zone: kitchen, waterSpeed: "High" }],
      null
    );
    await on(0).handleSetRequest(true);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("waterBox"));
    expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith(kitchen);
  });

  test("doesn't change the modes when the robot is already cleaning", async () => {
    await create([{ name: "Kitchen", zone: kitchen, speed: "Max" }]);
    (deviceManagerMock as { isCleaning: boolean }).isCleaning = true;
    await on(0).handleSetRequest(true);
    expect(mainService.setSpeed).not.toHaveBeenCalled();
    expect(deviceManagerMock.device.cleanZones).not.toHaveBeenCalled();
  });

  test("OFF sends the robot back to the dock", async () => {
    await create([{ name: "Kitchen", zone: kitchen, speed: "Max" }]);
    await on(0).handleSetRequest(false);
    expect(mainService.setSpeed).not.toHaveBeenCalled();
    expect(deviceManagerMock.device.activateCharging).toHaveBeenCalled();
  });

  describe("only the zones being cleaned are ON (#594)", () => {
    test("the other zones stay OFF, and all go OFF when the cleaning ends", async () => {
      await create([
        { name: "Kitchen", zone: kitchen },
        { name: "Bedroom", zone: [[1, 2, 3, 4]] },
      ]);
      await on(0).handleSetRequest(true);
      expect(await on(0).handleGetRequest()).toBe(true);
      expect(await on(1).handleGetRequest()).toBe(false);
      stoppedCleaning();
      expect(on(0).value).toBe(false);
      expect(await on(0).handleGetRequest()).toBe(false);
    });

    test("a failed start leaves the zone OFF", async () => {
      await create([{ name: "Kitchen", zone: kitchen }]);
      deviceManagerMock.device.cleanZones.mockRejectedValueOnce(
        new Error("timeout")
      );
      await expect(on(0).handleSetRequest(true)).rejects.toBe(-70402);
      expect(await on(0).handleGetRequest()).toBe(false);
    });
  });

  describe("zoneTimeout (#594)", () => {
    const zones = [
      { name: "Kitchen", zone: kitchen, speed: "Max" },
      {
        name: "Bedroom",
        zone: [[1, 2, 3, 4]] as [number, number, number, number][],
      },
      {
        name: "Hall",
        zone: [[5, 6, 7, 8]] as [number, number, number, number][],
      },
    ];

    beforeEach(() => vi.useFakeTimers());

    test("the zones turned on are cleaned together once the timeout expires", async () => {
      await create(zones, vi.fn(), { zoneTimeout: 10 });
      await on(1).handleSetRequest(true);
      await on(0).handleSetRequest(true);
      expect(deviceManagerMock.device.cleanZones).not.toHaveBeenCalled();
      // Selected: ON already
      expect(await on(0).handleGetRequest()).toBe(true);
      expect(await on(1).handleGetRequest()).toBe(true);
      expect(await on(2).handleGetRequest()).toBe(false);

      await vi.advanceTimersByTimeAsync(10_000);
      // In the order they were turned on, with the first zone's fan speed
      expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith([
        [1, 2, 3, 4, 1],
        ...kitchen,
      ]);
      expect(mainService.setSpeed).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("using the ones of Bedroom")
      );
      expect(on(0).value).toBe(true);
      expect(on(1).value).toBe(true);
      expect(on(2).value).toBe(false);
    });

    test("each change restarts the timeout", async () => {
      await create(zones, vi.fn(), { zoneTimeout: 10 });
      await on(0).handleSetRequest(true);
      await vi.advanceTimersByTimeAsync(8_000);
      await on(1).handleSetRequest(true);
      await vi.advanceTimersByTimeAsync(8_000);
      expect(deviceManagerMock.device.cleanZones).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledTimes(1);
    });

    test("turning a zone off before it starts unselects it", async () => {
      await create(zones, vi.fn(), { zoneTimeout: 10 });
      await on(0).handleSetRequest(true);
      await on(1).handleSetRequest(true);
      await on(0).handleSetRequest(false);
      expect(deviceManagerMock.device.activateCharging).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith([
        [1, 2, 3, 4, 1],
      ]);
      // Its own fan speed: the only zone left
      expect(log.warn).not.toHaveBeenCalled();
    });

    test("unselecting every zone cancels the cleaning", async () => {
      await create(zones, vi.fn(), { zoneTimeout: 10 });
      await on(0).handleSetRequest(true);
      await on(0).handleSetRequest(false);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(deviceManagerMock.device.cleanZones).not.toHaveBeenCalled();
    });
  });
});
