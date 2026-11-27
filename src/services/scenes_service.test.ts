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
import { ScenesService, type SceneRunner } from "./scenes_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, type Config } from "./config_service";

describe("ScenesService", () => {
  let service: ScenesService;
  let deviceManagerMock: DeviceManagerMock;
  let log: ReturnType<typeof getLoggerMock>;
  let run: Mock<SceneRunner>;
  const hap: HAP = HapJs;

  function create(config: Partial<Config>, withRunner = true) {
    deviceManagerMock = createDeviceManagerMock();
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
  }

  const on = (index: number) =>
    service.services[index].getCharacteristic(hap.Characteristic.On);
  const names = () =>
    service.services.map(
      (s) => s.getCharacteristic(hap.Characteristic.Name).value
    );

  beforeEach(() => {
    vi.useFakeTimers();
    create({
      scenes: [
        { name: "Full clean", id: 19799177 },
        { name: "Kitchen then bathroom", id: "2075222181387190272" },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  test("a switch per scene, named as configured, with a stable subtype", async () => {
    await service.init();
    expect(names()).toEqual(["Full clean", "Kitchen then bathroom"]);
    expect(service.services.map((s) => s.subtype)).toEqual([
      "scene19799177",
      "scene2075222181387190272",
    ]);
  });

  test("scenes without a name or an id, or repeated, are ignored", () => {
    create({
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

  test("ON runs the scene, and the switch turns itself off", async () => {
    await on(0).handleSetRequest(true);
    expect(run).toHaveBeenCalledWith("19799177");
    await expect(on(0).handleGetRequest()).resolves.toBe(false);
    const update = vi.spyOn(on(0), "updateValue");
    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledWith(false);
  });

  test("OFF does nothing", async () => {
    await on(1).handleSetRequest(false);
    expect(run).not.toHaveBeenCalled();
  });

  test("a failure is reported, and the switch still turns off", async () => {
    run.mockRejectedValueOnce(new Error("boom"));
    await expect(on(1).handleSetRequest(true)).rejects.toBeDefined();
    expect(log.error).toHaveBeenCalled();
    const update = vi.spyOn(on(1), "updateValue");
    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledWith(false);
  });

  test("without the app's account: a warning, and the switches fail", async () => {
    create({ scenes: [{ name: "Full clean", id: 1 }] }, false);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('"cloud" option')
    );
    await expect(on(0).handleSetRequest(true)).rejects.toBeDefined();
  });
});
