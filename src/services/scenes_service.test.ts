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
import { ScenesService, type SceneRunner } from "./scenes_service.js";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock.js";
import { getLoggerMock } from "../utils/logger.mock.js";
import { applyConfigDefaults, type Config } from "./config_service.js";

describe("ScenesService", () => {
  let service: ScenesService;
  let deviceManagerMock: DeviceManagerMock;
  let log: ReturnType<typeof getLoggerMock>;
  let run: Mock<SceneRunner>;
  const hap: HAP = HapJs;

  const setState = (state: string) => {
    (deviceManagerMock as { state: string }).state = state;
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
      key: "state",
      value: state,
    });
  };

  async function create(config: Partial<Config>, withRunner = true) {
    deviceManagerMock = createDeviceManagerMock();
    (deviceManagerMock as { state: string }).state = "charging";
    log = getLoggerMock();
    run = vi.fn<SceneRunner>().mockResolvedValue(undefined);
    service = new ScenesService(
      {
        hap,
        log,
        config: applyConfigDefaults(config),
        deviceManager: deviceManagerMock,
      },
      withRunner ? run : undefined
    );
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
      scenes: [
        { name: "Full clean", id: 19799177 },
        { name: "Kitchen then bathroom", id: "2075222181387190272" },
      ],
    });
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  test("a switch per scene, named as configured, with a stable subtype", () => {
    expect(names()).toEqual(["Full clean", "Kitchen then bathroom"]);
    expect(service.services.map((s) => s.subtype)).toEqual([
      "scene19799177",
      "scene2075222181387190272",
    ]);
  });

  test("scenes without a name or an id, or repeated, are ignored", async () => {
    await create({
      scenes: [
        { name: "", id: 1 },
        { name: "No id" } as never,
        { name: "Blank id", id: " " },
        { name: "OK", id: 1 },
        { name: "Same", id: "1" },
      ],
    });
    expect(names()).toEqual(["OK"]);
    expect(log.warn).toHaveBeenCalledTimes(4);
  });

  test("ON runs the scene, and the switch stays on while the robot works", async () => {
    await on(0).handleSetRequest(true);
    expect(run).toHaveBeenCalledWith("19799177");
    await expect(on(0).handleGetRequest()).resolves.toBe(true);
    await expect(on(1).handleGetRequest()).resolves.toBe(false);

    // A state reported before the robot starts is still the previous one
    setState("charging");
    await expect(on(0).handleGetRequest()).resolves.toBe(true);

    setState("room-cleaning");
    setState("returning"); // e.g. to wash the mop
    setState("washing-mop");
    setState("room-cleaning");
    vi.advanceTimersByTime(120_000); // Longer than the start timeout: it started
    await expect(on(0).handleGetRequest()).resolves.toBe(true);

    // Done
    setState("charging");
    await expect(on(0).handleGetRequest()).resolves.toBe(false);
  });

  test("a scene that doesn't move the robot turns its switch off after a minute", async () => {
    await on(1).handleSetRequest(true);
    vi.advanceTimersByTime(59_000);
    await expect(on(1).handleGetRequest()).resolves.toBe(true);
    vi.advanceTimersByTime(1_000);
    await expect(on(1).handleGetRequest()).resolves.toBe(false);
  });

  test("a robot that was already working: on until it rests", async () => {
    (deviceManagerMock as { state: string }).state = "cleaning";
    await on(0).handleSetRequest(true);
    vi.advanceTimersByTime(120_000);
    await expect(on(0).handleGetRequest()).resolves.toBe(true);
    setState("idle");
    await expect(on(0).handleGetRequest()).resolves.toBe(false);
  });

  test("states node-miio doesn't know don't change it", async () => {
    await on(0).handleSetRequest(true);
    setState("cleaning");
    setState("unknown-99");
    await expect(on(0).handleGetRequest()).resolves.toBe(true);
  });

  test("OFF by hand only turns the switch off (the scene keeps running in the app)", async () => {
    await on(0).handleSetRequest(true);
    setState("cleaning");
    await on(0).handleSetRequest(false);
    await expect(on(0).handleGetRequest()).resolves.toBe(false);
    expect(deviceManagerMock.device.activateCharging).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);

    // OFF on a switch that isn't on does nothing either
    await on(1).handleSetRequest(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("another scene replaces the running one", async () => {
    await on(0).handleSetRequest(true);
    await on(1).handleSetRequest(true);
    await expect(on(0).handleGetRequest()).resolves.toBe(false);
    await expect(on(1).handleGetRequest()).resolves.toBe(true);
  });

  test("a failure is reported, and turns the switch off", async () => {
    run.mockRejectedValueOnce(new Error("boom"));
    await expect(on(1).handleSetRequest(true)).rejects.toBeDefined();
    expect(log.error).toHaveBeenCalled();
    await expect(on(1).handleGetRequest()).resolves.toBe(false);
  });

  test("without the app's account: a warning, and the switches fail", async () => {
    await create({ scenes: [{ name: "Full clean", id: 1 }] }, false);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('"cloud" option')
    );
    await expect(on(0).handleSetRequest(true)).rejects.toBeDefined();
  });
});
