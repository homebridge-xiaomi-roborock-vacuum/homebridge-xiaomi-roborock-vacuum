import * as HapJs from "@homebridge/hap-nodejs";
import { ReplaySubject, Subject } from "rxjs";
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
  let firmware$: ReplaySubject<string | undefined>;

  function create(rooms: { ids: number[]; repeat: number }) {
    firmware$ = new ReplaySubject(1);
    deviceManagerMock = createDeviceManagerMock();
    Object.assign(deviceManagerMock, { isCleaning: false });
    let latestFirmware: string | undefined;
    firmware$.subscribe((fw) => (latestFirmware = fw));
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
      {
        get firmware() {
          return latestFirmware;
        },
        firmware$,
      } as unknown as ProductInfo,
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

  describe("fan speed changed from the app", () => {
    test("the robot's preset (e.g. SmartPlan) is logged as such, not as an unsupported speed", async () => {
      const service = create({ ids: [], repeat: 1 });
      deviceManagerMock.reportedModes = {
        fanSpeeds: [],
        waterBoxModes: [],
        presets: [
          {
            name: "SmartPlan",
            fanSpeed: 110,
            waterBoxMode: 209,
            mopRoute: 306,
          },
        ],
      };
      const log = (
        service as unknown as { log: ReturnType<typeof getLoggerMock> }
      ).log;
      await service.init();
      firmware$.next(undefined);
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "fanSpeed",
        value: 110,
      });
      expect(log.info).toHaveBeenCalledWith(
        'changedSpeed | The robot\'s "SmartPlan" preset is on (fan speed 110)'
      );
      expect(log.warn).not.toHaveBeenCalled();
    });

    test("a speed reported before the firmware is known is looked up once it is", async () => {
      // The roborock.vacuum.s5's speeds depend on the firmware: 102 is only "Balanced" with 3.5.7+
      const service = create({ ids: [], repeat: 1 });
      Object.assign(deviceManagerMock, { model: "roborock.vacuum.s5" });
      const log = (
        service as unknown as { log: ReturnType<typeof getLoggerMock> }
      ).log;
      await service.init();

      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "fanSpeed",
        value: 102,
      });
      expect(log.info).not.toHaveBeenCalledWith(
        expect.stringContaining("changedSpeed")
      );

      firmware$.next("3.5.8_002034");
      expect(log.info).toHaveBeenCalledWith(
        "changedSpeed | Speed was changed to 102% (Balanced), for HomeKit 60%"
      );
      expect(log.warn).not.toHaveBeenCalled();
    });
  });
});
