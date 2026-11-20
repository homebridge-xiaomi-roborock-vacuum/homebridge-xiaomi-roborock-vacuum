import { HAP, Service } from "homebridge";
import { Subject } from "rxjs";
import * as HapJs from "@homebridge/hap-nodejs";
import { CareService } from "./care_service";
import { createHomebridgeMock } from "../test.mocks";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import type { MainService } from "./main_service";
import type { DeviceManager } from "./device_manager";

describe("CareService", () => {
  describe("legacyCareSensors", () => {
    let careService: CareService;
    let deviceManagerMock: DeviceManagerMock;
    let fanServices: jest.Mock;
    let hap: HAP;

    beforeEach(() => {
      hap = HapJs;
      const log = getLoggerMock();

      deviceManagerMock = createDeviceManagerMock();
      deviceManagerMock.property.mockReturnValue(10);

      fanServices = jest.fn();
      const fan = {
        get services() {
          return fanServices();
        },
      } as MainService;

      const config = applyConfigDefaults({ legacyCareSensors: true });

      careService = new CareService(
        {
          hap,
          log,
          config,
          deviceManager: deviceManagerMock,
        },
        fan
      );
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.resetAllMocks();
    });

    test("fan is not called", () => {
      expect(fanServices).not.toHaveBeenCalled();
    });

    test("only 1 service is exposed", () => {
      expect(careService.services).toHaveLength(1);
    });

    test("the custom Care service characteristics call all getters", async () => {
      const service = careService.services[0];
      expect(service.characteristics).toHaveLength(5);
      const [name, ...characteristics] = service.characteristics;
      const onCallsHandlers = characteristics.map(
        (characteristic) => characteristic["getHandler"]
      );
      for (const listener of onCallsHandlers) {
        await expect(listener()).resolves.toMatchSnapshot();
      }
    });
  });

  describe("nativeCareSensors", () => {
    let careService: CareService;
    let deviceManagerMock: DeviceManagerMock;
    let fanServices: jest.Mock;
    let fanGetCaracteristicSpy: jest.SpyInstance;
    let hap: HAP;

    beforeEach(() => {
      const hbMock = createHomebridgeMock();
      hap = HapJs;
      const log = getLoggerMock();

      deviceManagerMock = createDeviceManagerMock();
      deviceManagerMock.property.mockReturnValue(10);

      fanServices = jest.fn().mockImplementation(() => {
        const fan = new hbMock.hap.Service.Fan();
        const originalGetCharacteristic = fan.getCharacteristic.bind(fan);
        fanGetCaracteristicSpy = jest
          .spyOn(fan, "getCharacteristic")
          .mockImplementation((...args) => {
            const result = originalGetCharacteristic(...args);
            jest.spyOn(result!, "onGet");
            return result;
          });
        return [fan];
      });
      const fan = {
        get services() {
          return fanServices();
        },
      } as MainService;

      const config = applyConfigDefaults({});

      careService = new CareService(
        {
          hap,
          log,
          config,
          deviceManager: deviceManagerMock as unknown as DeviceManager,
        },
        fan
      );
    });

    test("fan is called", () => {
      expect(fanServices).toHaveBeenCalledTimes(1);
    });

    test("4 services are exposed", () => {
      expect(careService.services).toHaveLength(4);
    });

    test("the fan's service characteristic calls all getters", async () => {
      const fanService = fanServices.mock.results[0].value[0];
      expect(fanGetCaracteristicSpy.mock.results).toHaveLength(2);
      const onCallsHandlers = fanGetCaracteristicSpy.mock.results.map(
        ({ value }) => value.onGet.mock.calls[0][0]
      );
      await expect(onCallsHandlers[0]()).resolves.toBe(false);
      await expect(onCallsHandlers[1]()).resolves.toBe(99.99074074074075);
    });

    test("the FilterMaintenance services' characteristics call all getters", async () => {
      for (const service of careService.services) {
        // Name, FilterChangeIndication, FilterLifeLevel and ResetFilterIndication (write only)
        expect(service.characteristics).toHaveLength(4);
        const [name, ...characteristics] = service.characteristics;
        const onCallsHandlers = characteristics
          .map((characteristic) => characteristic["getHandler"])
          .filter(Boolean);
        for (const listener of onCallsHandlers) {
          await expect(listener()).resolves.toMatchSnapshot();
        }
      }
    });

    test("handles -1 responses", async () => {
      for (const service of careService.services) {
        // Name, FilterChangeIndication, FilterLifeLevel and ResetFilterIndication (write only)
        expect(service.characteristics).toHaveLength(4);
        const [name, ...characteristics] = service.characteristics;
        const onCallsHandlers = characteristics
          .map((characteristic) => characteristic["getHandler"])
          .filter(Boolean);
        for (const listener of onCallsHandlers) {
          deviceManagerMock.property.mockReturnValueOnce(-1);
          await expect(listener()).resolves.toMatchSnapshot();
        }
      }
    });
  });

  describe("maintenance (#651)", () => {
    let deviceManagerMock: DeviceManagerMock;
    let log: ReturnType<typeof getLoggerMock>;
    let fan: Service;
    let hap: HAP;
    let properties: Record<string, number>;

    const create = (
      config: Partial<Parameters<typeof applyConfigDefaults>[0]> = {},
      showCareSensors = true
    ) => {
      const careService = new CareService(
        {
          hap,
          log,
          config: applyConfigDefaults({ name: "Robot", ...config }),
          deviceManager: deviceManagerMock as unknown as DeviceManager,
        },
        { services: [fan] } as unknown as MainService,
        showCareSensors
      );
      return careService;
    };
    const service = (careService: CareService, subtype: string) =>
      careService.services.find((s) => s.subtype === subtype)!;
    const poll = async () => {
      (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
        key: "state",
        value: "charging",
      });
      await jest.advanceTimersByTimeAsync(1000);
    };

    beforeEach(() => {
      jest.useFakeTimers();
      hap = HapJs;
      log = getLoggerMock();
      fan = new hap.Service.Fan("Robot");
      properties = {
        sensorDirtyTime: 0,
        filterWorkTime: 270000, // 50%
        sideBrushWorkTime: 0,
        mainBrushWorkTime: 0,
      };
      deviceManagerMock = createDeviceManagerMock();
      deviceManagerMock.property.mockImplementation(
        (name: string) => properties[name] as never
      );
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.resetAllMocks();
    });

    test("HomeKit is updated after each poll", async () => {
      const careService = create();
      await careService.init();
      await poll();
      const filter = service(careService, "filter");
      expect(
        filter.getCharacteristic(hap.Characteristic.FilterLifeLevel).value
      ).toBe(50);
      expect(
        filter.getCharacteristic(hap.Characteristic.FilterChangeIndication)
          .value
      ).toBe(0);

      properties.filterWorkTime = 540000;
      await poll();
      expect(
        filter.getCharacteristic(hap.Characteristic.FilterChangeIndication)
          .value
      ).toBe(1);
      expect(
        fan.getCharacteristic(hap.Characteristic.FilterChangeIndication).value
      ).toBe(1);
      expect(
        fan.getCharacteristic(hap.Characteristic.FilterLifeLevel).value
      ).toBe(0);
    });

    test("a consumable can be reset after replacing it", async () => {
      const careService = create();
      await careService.services[2]
        .getCharacteristic(hap.Characteristic.ResetFilterIndication)
        .handleSetRequest(1);
      expect(deviceManagerMock.device.resetConsumable).toHaveBeenCalledWith(
        "side_brush_work_time"
      );
    });

    test("reset on models without it: a warning", async () => {
      const { resetConsumable, ...withoutReset } = deviceManagerMock.device;
      void resetConsumable;
      Object.assign(deviceManagerMock, { device: withoutReset });
      const careService = create();
      await service(careService, "filter")
        .getCharacteristic(hap.Characteristic.ResetFilterIndication)
        .handleSetRequest(1);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("doesn't support resetting the filter")
      );
    });

    test("the maintenance sensor is opt-in, and works without the care sensors", () => {
      expect(create().services).toHaveLength(4);
      const sensorOnly = create({ maintenanceSensor: true }, false);
      expect(sensorOnly.services).toHaveLength(1);
      expect(sensorOnly.services[0].displayName).toBe(
        "Robot needs maintenance"
      );
      expect(create({ maintenanceSensor: true }).services).toHaveLength(5);
    });

    test("the maintenance sensor detects any consumable that needs maintenance", async () => {
      const careService = create({ maintenanceSensor: true }, false);
      await careService.init();
      const detected = () =>
        service(careService, "maintenance").getCharacteristic(
          hap.Characteristic.OccupancyDetected
        );
      await poll();
      expect(detected().value).toBe(0);
      expect(await detected().handleGetRequest()).toBe(0);

      properties.mainBrushWorkTime = 1080000;
      properties.sensorDirtyTime = 200000;
      await poll();
      expect(detected().value).toBe(1);
      expect(log.info).toHaveBeenCalledWith(
        "INF care | Maintenance needed: sensors, main brush."
      );

      properties.mainBrushWorkTime = 0;
      properties.sensorDirtyTime = 0;
      await poll();
      expect(detected().value).toBe(0);
    });

    test("models that don't report the counters never need maintenance", async () => {
      deviceManagerMock.property.mockReturnValue(undefined as never);
      const careService = create({ maintenanceSensor: true });
      await careService.init();
      await poll();
      expect(
        service(careService, "filter").getCharacteristic(
          hap.Characteristic.FilterLifeLevel
        ).value
      ).toBe(100);
    });
  });
});
