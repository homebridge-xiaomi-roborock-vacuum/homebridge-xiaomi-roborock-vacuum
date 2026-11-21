import { EventEmitter } from "node:events";
import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { CurrentRoomService } from "./current_room_service";
import type { CloudService } from "./cloud_service";
import type { RoomsService } from "./rooms_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock, LoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, Config } from "./config_service";

const { OCCUPANCY_DETECTED: DETECTED, OCCUPANCY_NOT_DETECTED: NOT_DETECTED } =
  HapJs.Characteristic.OccupancyDetected;
const flush = () => new Promise(setImmediate);

const createWatcher = () =>
  Object.assign(new EventEmitter(), {
    start: jest.fn(async () => undefined),
    stop: jest.fn(),
    refresh: jest.fn(),
  });

describe("CurrentRoomService", () => {
  const hap: HAP = HapJs;
  let log: LoggerMock;
  let deviceManagerMock: DeviceManagerMock;
  let watcher: ReturnType<typeof createWatcher>;
  let cloud: { createMapWatcher: jest.Mock };
  let service: CurrentRoomService;
  const rooms = {
    roomList: [
      { id: "16", name: "Kitchen" },
      { id: "17", name: "Bedroom" },
    ],
  } as unknown as RoomsService;

  async function create(
    partialConfig: Partial<Config> = { roomSensors: true },
    withCloud = true
  ) {
    log = getLoggerMock();
    deviceManagerMock = createDeviceManagerMock();
    watcher = createWatcher();
    cloud = { createMapWatcher: jest.fn(async () => watcher) };
    service = new CurrentRoomService(
      {
        hap,
        log,
        config: applyConfigDefaults({
          ip: "1.1.1.1",
          token: "abc",
          name: "Robot",
          ...partialConfig,
        }),
        deviceManager: deviceManagerMock,
      },
      rooms,
      withCloud ? (cloud as unknown as CloudService) : undefined
    );
    await service.init();
    (deviceManagerMock.deviceConnected$ as Subject<unknown>).next(
      deviceManagerMock.device
    );
    await flush();
  }

  const occupancy = (index: number) =>
    service.services[index].getCharacteristic(
      hap.Characteristic.OccupancyDetected
    );

  afterEach(() => {
    service.stop();
    jest.resetAllMocks();
  });

  test("an occupancy sensor per room, detected while the robot is in it", async () => {
    await create();
    expect(cloud.createMapWatcher).toHaveBeenCalledWith(
      deviceManagerMock.device,
      { ip: "1.1.1.1", token: "abc" }
    );
    expect(watcher.start).toHaveBeenCalledTimes(1);
    expect(service.services.map((s) => s.displayName)).toStrictEqual([
      "Robot in Kitchen",
      "Robot in Bedroom",
    ]);
    expect(service.services).toHaveLength(2); // Created only once

    watcher.emit("currentRoom", 17);
    expect(occupancy(0).value).toBe(NOT_DETECTED);
    expect(occupancy(1).value).toBe(DETECTED);
    await expect(occupancy(1).handleGetRequest()).resolves.toBe(
      hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
    );
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining('The robot is in "Bedroom"')
    );

    watcher.emit("position", { x: 25000, y: 26000 });
    watcher.emit("currentRoom", undefined); // Stopped cleaning
    expect(occupancy(1).value).toBe(NOT_DETECTED);
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("The robot stopped at x=25000, y=26000")
    );
  });

  test("logs the position on demand (find me)", async () => {
    await create({});
    expect(service.services).toStrictEqual([]); // No sensors without `roomSensors`
    watcher.refresh.mockResolvedValue({ robot: { x: 1, y: 2 } });
    await service.logPosition();
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'The robot is at x=1, y=2 (use them as "goToX" and "goToY")'
      )
    );
  });

  test("a reconnection replaces the watcher; stop() stops it", async () => {
    await create();
    const first = watcher;
    watcher = createWatcher();
    cloud.createMapWatcher.mockResolvedValue(watcher);
    (deviceManagerMock.deviceConnected$ as Subject<unknown>).next(
      deviceManagerMock.device
    );
    await flush();
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(watcher.start).toHaveBeenCalledTimes(1);

    service.stop();
    expect(watcher.stop).toHaveBeenCalledTimes(1);
  });

  test("without the Xiaomi Cloud: no sensors, and a warning if they were requested", async () => {
    await create({ roomSensors: true }, false);
    expect(service.services).toStrictEqual([]);
    expect(cloud.createMapWatcher).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('enable the platform\'s "cloud" option')
    );
    await expect(service.logPosition()).resolves.toBeUndefined();
  });

  describe("from the robot's status (Roborock app robots, `duid`)", () => {
    test("the sensors follow `currentSegment`, without the Xiaomi Cloud", async () => {
      await create({ roomSensors: true, duid: "duid-1" }, false);
      const rooms$: (string | undefined)[] = [];
      service.currentRoom$.subscribe((room) => rooms$.push(room));
      const [kitchen, bedroom] = service.services;
      expect(service.services).toHaveLength(2);
      const stateChanged$ = deviceManagerMock.stateChanged$ as Subject<unknown>;

      stateChanged$.next({ key: "currentSegment", value: 17 });
      expect(
        bedroom.getCharacteristic(hap.Characteristic.OccupancyDetected).value
      ).toBe(DETECTED);
      expect(
        kitchen.getCharacteristic(hap.Characteristic.OccupancyDetected).value
      ).toBe(NOT_DETECTED);
      expect(log.info).toHaveBeenCalledWith(
        'INF CurrentRoomService | The robot is in "Bedroom"'
      );

      stateChanged$.next({ key: "currentSegment", value: undefined });
      expect(
        bedroom.getCharacteristic(hap.Characteristic.OccupancyDetected).value
      ).toBe(NOT_DETECTED);
      expect(rooms$).toStrictEqual(["17", undefined]);
      expect(log.warn).not.toHaveBeenCalled();
    });

    test("even with the Xiaomi Cloud enabled, the map isn't followed", async () => {
      await create({ roomSensors: true, duid: "duid-1" }, true);
      await flush();
      expect(cloud.createMapWatcher).not.toHaveBeenCalled();
      const [kitchen] = service.services;
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "currentSegment",
        value: 16,
      });
      expect(
        service.services[0].getCharacteristic(
          hap.Characteristic.OccupancyDetected
        ).value
      ).toBe(DETECTED);
    });
  });
});
