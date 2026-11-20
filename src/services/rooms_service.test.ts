import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { RoomsService } from "./rooms_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, Config } from "./config_service";
import type { MiioDeviceMock as MiioDevice } from "../test.mocks";
import { miio } from "../test.mocks";

describe("RoomsService", () => {
  let roomsService: RoomsService;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;
  const setCleaning = jest.fn();

  async function createRoomService(partialConfig: Partial<Config>) {
    hap = HapJs;
    const log = getLoggerMock();
    deviceManagerMock = createDeviceManagerMock();
    const config = applyConfigDefaults(partialConfig);

    roomsService = new RoomsService(
      {
        hap,
        log,
        config,
        deviceManager: deviceManagerMock,
      },
      setCleaning
    );

    await roomsService.init();
  }

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  describe("with the default config", () => {
    beforeEach(async () => {
      await createRoomService({});
    });

    test("default config returns zero services", () => {
      expect(roomsService.services).toStrictEqual([]);
    });
  });

  test("throws an error if rooms and autoroom are present at the same time", async () => {
    await expect(
      createRoomService({ rooms: [], autoroom: true })
    ).rejects.toThrow();
  });

  test("creates a declared room", async () => {
    await createRoomService({ rooms: [{ id: 16, name: "Kitchen" }] });
    expect(roomsService.services).toHaveLength(1);
  });

  describe("repeats (clean a room 2 or 3 times)", () => {
    const names = () =>
      roomsService.services.map(
        (room) => room.getCharacteristic(hap.Characteristic.Name).value
      );
    const roomSwitch = (name: string) =>
      roomsService.services
        .find(
          (room) =>
            room.getCharacteristic(hap.Characteristic.Name).value === name
        )!
        .getCharacteristic(hap.Characteristic.On);

    beforeEach(async () => {
      await createRoomService({
        rooms: [
          { id: 16, name: "Kitchen", repeats: [2, 3] },
          { id: 17, name: "Bedroom" },
        ],
      });
      Object.assign(deviceManagerMock, { isCleaning: false, isPaused: false });
    });

    test("a switch per repeat, next to the room's", () => {
      expect(names()).toEqual([
        "cleaning Kitchen",
        "cleaning Bedroom",
        "cleaning Kitchen 2x",
        "cleaning Kitchen 3x",
      ]);
    });

    test("invalid repeats are ignored", async () => {
      await createRoomService({
        rooms: [{ id: 16, name: "Kitchen", repeats: [1, 4, "2", 2, 2] }],
      });
      expect(names()).toEqual(["cleaning Kitchen", "cleaning Kitchen 2x"]);
    });

    test("the highest repeat of the selected switches wins", async () => {
      expect(roomsService.repeat).toBe(1);
      await roomSwitch("cleaning Kitchen 2x").handleSetRequest(true);
      await roomSwitch("cleaning Bedroom").handleSetRequest(true);
      expect(roomsService.roomIdsForDevice).toEqual([16, 17]);
      expect(roomsService.repeat).toBe(2);
    });

    test("only one switch per room: the last one selected", async () => {
      const once = roomSwitch("cleaning Kitchen");
      const thrice = roomSwitch("cleaning Kitchen 3x");
      await once.handleSetRequest(true);
      await thrice.handleSetRequest(true);
      await expect(once.handleGetRequest()).resolves.toBe(false);
      await expect(thrice.handleGetRequest()).resolves.toBe(true);
      expect(roomsService.repeat).toBe(3);

      // Turning off a switch that isn't the selected one keeps the room
      await once.handleSetRequest(false);
      expect(roomsService.roomIdsForDevice).toEqual([16]);
      await thrice.handleSetRequest(false);
      expect(roomsService.roomIdsForDevice).toEqual([]);
      expect(roomsService.repeat).toBe(1);
    });
  });

  describe("autoroom (resolved and cached rooms)", () => {
    async function createConnectedRoomService(partialConfig: Partial<Config>) {
      hap = HapJs;
      deviceManagerMock = createDeviceManagerMock();
      roomsService = new RoomsService(
        {
          hap,
          log: getLoggerMock(),
          config: applyConfigDefaults(partialConfig),
          deviceManager: deviceManagerMock,
        },
        setCleaning
      );
      const initialized = roomsService.init();
      (
        deviceManagerMock.deviceConnected$ as unknown as Subject<MiioDevice>
      ).next(miio.device);
      await initialized;
    }

    const midnightTimer = (segments: string) => [
      "1",
      "off",
      ["0 0 * * *", ["start_clean", { segments }]],
    ];

    test("autoroom: true resolves the rooms from the room mapping", async () => {
      miio.device.getRoomMap.mockResolvedValue([
        ["16", "Kitchen"],
        ["17", "Bedroom"],
      ]);
      await createConnectedRoomService({ autoroom: true, cachedRooms: [] });
      expect(roomsService.services).toHaveLength(2);
      expect(roomsService.resolvedRooms).toEqual([
        { id: "16", name: "Kitchen" },
        { id: "17", name: "Bedroom" },
      ]);
    });

    test("autoroom: true falls back to the cached rooms when the device fails", async () => {
      miio.device.getRoomMap.mockRejectedValue(new Error("timeout"));
      await createConnectedRoomService({
        autoroom: true,
        cachedRooms: [{ id: "16", name: "Kitchen" }],
      });
      expect(roomsService.services).toHaveLength(1);
      expect(roomsService.resolvedRooms).toEqual([
        { id: "16", name: "Kitchen" },
      ]);
    });

    test("autoroom: [names] resolves the ids from the midnight timer", async () => {
      miio.device.getTimer.mockResolvedValue([midnightTimer("18,19")] as never);
      await createConnectedRoomService({
        autoroom: ["Kitchen", "Bedroom"],
        cachedRooms: [],
      });
      expect(roomsService.resolvedRooms).toEqual([
        { id: 18, name: "Kitchen" },
        { id: 19, name: "Bedroom" },
      ]);
    });

    test("autoroom: [names] falls back to the cached ids when the timer is gone", async () => {
      miio.device.getTimer.mockResolvedValue([] as never);
      await createConnectedRoomService({
        autoroom: ["Kitchen", "Bedroom"],
        cachedRooms: [
          { id: "18", name: "Kitchen" },
          { id: "19", name: "Bedroom" },
          { id: "20", name: "Removed from the config" },
        ],
      });
      expect(roomsService.services).toHaveLength(2);
      expect(roomsService.resolvedRooms).toEqual([
        { id: "18", name: "Kitchen" },
        { id: "19", name: "Bedroom" },
      ]);
    });

    test("does not fail when nothing can be resolved", async () => {
      miio.device.getRoomMap.mockRejectedValue(new Error("timeout"));
      await expect(
        createConnectedRoomService({ autoroom: true })
      ).resolves.toBeUndefined();
      expect(roomsService.resolvedRooms).toEqual([]);
    });
  });

  describe("roomIdsForDevice (#1032)", () => {
    test("sends numeric room IDs as numbers, in the selected order", async () => {
      await createRoomService({});
      roomsService.roomIdsToClean.add("17");
      roomsService.roomIdsToClean.add("16");
      expect(roomsService.roomIdsForDevice).toStrictEqual([17, 16]);
    });

    test("keeps non-numeric IDs as they are", async () => {
      await createRoomService({});
      roomsService.roomIdsToClean.add("kitchen");
      roomsService.roomIdsToClean.add("990001105814");
      expect(roomsService.roomIdsForDevice).toStrictEqual([
        "kitchen",
        990001105814,
      ]);
    });
  });
});
