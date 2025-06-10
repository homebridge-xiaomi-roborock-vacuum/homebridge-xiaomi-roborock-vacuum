import { HAP } from "homebridge";
import * as HapJs from "hap-nodejs";
import { Subject } from "rxjs";
import { RoomsService } from "./rooms_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, Config } from "./config_service";
import { MiioDevice } from "../utils/miio_types";
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

  // TODO: Keep adding tests
});
