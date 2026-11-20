import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { GoToSpotsService } from "./go_to_spots_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, type Config } from "./config_service";

describe("GoToSpotsService", () => {
  let service: GoToSpotsService;
  let deviceManagerMock: DeviceManagerMock;
  let log: ReturnType<typeof getLoggerMock>;
  const hap: HAP = HapJs;

  const setState = (state: string) => {
    (deviceManagerMock as { state: string }).state = state;
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
      key: "state",
      value: state,
    });
  };

  async function create(config: Partial<Config>) {
    deviceManagerMock = createDeviceManagerMock();
    (deviceManagerMock as { state: string }).state = "charging";
    log = getLoggerMock();
    service = new GoToSpotsService({
      hap,
      log,
      config: applyConfigDefaults(config),
      deviceManager: deviceManagerMock,
    });
    await service.init();
  }

  const on = (index: number) =>
    service.services[index].getCharacteristic(hap.Characteristic.On);

  beforeEach(() =>
    create({
      goToSpots: [
        { name: "Kitchen door", x: 25500, y: 26000 },
        { name: "Sofa", x: 30000, y: 24000 },
      ],
    })
  );

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  test("a switch per spot, named after it", () => {
    expect(
      service.services.map(
        (switchService) =>
          switchService.getCharacteristic(hap.Characteristic.Name).value
      )
    ).toEqual(["go to Kitchen door", "go to Sofa"]);
  });

  test("the switches' first word(s) can be configured, e.g. in another language", async () => {
    await create({
      goToSpotWord: "ve a",
      goToSpots: [{ name: "la cocina", x: 1, y: 2 }],
    });
    expect(
      service.services[0].getCharacteristic(hap.Characteristic.Name).value
    ).toBe("ve a la cocina");
  });

  test("spots without a name or coordinates are ignored", async () => {
    await create({
      goToSpots: [
        { name: "", x: 1, y: 2 },
        { name: "No coordinates" } as never,
        { name: "OK", x: 1, y: 2 },
      ],
    });
    expect(service.services).toHaveLength(1);
    expect(log.warn).toHaveBeenCalledTimes(2);
  });

  test("ON sends the robot to the spot, and the switch stays on until it gets there", async () => {
    await on(0).handleSetRequest(true);
    expect(deviceManagerMock.device.sendToLocation).toHaveBeenCalledWith(
      25500,
      26000
    );
    await expect(on(0).handleGetRequest()).resolves.toBe(true);
    await expect(on(1).handleGetRequest()).resolves.toBe(false);

    // A state reported right after sending it may still be the previous one
    setState("charging");
    await expect(on(0).handleGetRequest()).resolves.toBe(true);

    setState("going-to-location");
    await expect(on(0).handleGetRequest()).resolves.toBe(true);

    // It got there
    setState("idle");
    await expect(on(0).handleGetRequest()).resolves.toBe(false);
  });

  test("OFF sends the robot back to the dock (only from the spot it's going to)", async () => {
    await on(1).handleSetRequest(false);
    expect(deviceManagerMock.device.activateCharging).not.toHaveBeenCalled();

    await on(1).handleSetRequest(true);
    await on(1).handleSetRequest(false);
    expect(deviceManagerMock.device.activateCharging).toHaveBeenCalledTimes(1);
    await expect(on(1).handleGetRequest()).resolves.toBe(false);
  });

  test("a failure turns the switch off, and is reported", async () => {
    deviceManagerMock.device.sendToLocation.mockRejectedValueOnce(
      new Error("boom")
    );
    await expect(on(0).handleSetRequest(true)).rejects.toBeDefined();
    await expect(on(0).handleGetRequest()).resolves.toBe(false);
  });
});
