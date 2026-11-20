import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { MainService } from "./main_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";
import type { ProductInfo } from "./product_info";
import type { RoomsService } from "./rooms_service";

describe("MainService", () => {
  let deviceManagerMock: DeviceManagerMock;

  function create(rooms: { ids: number[]; repeat: number }) {
    deviceManagerMock = createDeviceManagerMock();
    Object.assign(deviceManagerMock, { isCleaning: false });
    const roomsService = {
      roomIdsToClean: new Set(rooms.ids.map(String)),
      roomIdsForDevice: rooms.ids,
      repeat: rooms.repeat,
    } as unknown as RoomsService;
    return new MainService(
      {
        hap: HapJs,
        log: getLoggerMock(),
        config: applyConfigDefaults({}),
        deviceManager: deviceManagerMock,
      },
      {} as ProductInfo,
      roomsService,
      jest.fn(),
      jest.fn()
    );
  }

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  describe("setCleaning with selected rooms", () => {
    test("cleans them once (the legacy format, for every firmware)", async () => {
      await create({ ids: [16, 17], repeat: 1 }).setCleaning(true);
      expect(deviceManagerMock.device.cleanRooms).toHaveBeenCalledWith([
        16, 17,
      ]);
    });

    test("cleans them as many times as the selected switches ask", async () => {
      await create({ ids: [16, 17], repeat: 3 }).setCleaning(true);
      expect(deviceManagerMock.device.cleanRooms).toHaveBeenCalledWith(
        [16, 17],
        { repeat: 3 }
      );
    });
  });
});
