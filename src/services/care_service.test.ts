import { HAP } from "homebridge";
import * as HapJs from "hap-nodejs";
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
    let hap: HAP;

    beforeEach(() => {
      const hbMock = createHomebridgeMock();
      hap = HapJs;
      const log = getLoggerMock();

      deviceManagerMock = createDeviceManagerMock();
      deviceManagerMock.property.mockReturnValue(10);

      fanServices = jest
        .fn()
        .mockImplementation(() => [new hbMock.hap.Service.Fan()]);
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
      expect(fanService.getCharacteristic.mock.results).toHaveLength(2);
      const onCallsHandlers = fanService.getCharacteristic.mock.results.map(
        ({ value }) => value.onGet.mock.calls[0][0]
      );
      await expect(onCallsHandlers[0]()).resolves.toBe(false);
      await expect(onCallsHandlers[1]()).resolves.toBe(99.99074074074075);
    });

    test("the FilterMaintenance services' characteristics call all getters", async () => {
      for (const service of careService.services) {
        expect(service.characteristics).toHaveLength(3);
        const [name, ...characteristics] = service.characteristics;
        const onCallsHandlers = characteristics.map(
          (characteristic) => characteristic["getHandler"]
        );
        for (const listener of onCallsHandlers) {
          await expect(listener()).resolves.toMatchSnapshot();
        }
      }
    });

    test("handles -1 responses", async () => {
      for (const service of careService.services) {
        expect(service.characteristics).toHaveLength(3);
        const [name, ...characteristics] = service.characteristics;
        const onCallsHandlers = characteristics.map(
          (characteristic) => characteristic["getHandler"]
        );
        for (const listener of onCallsHandlers) {
          deviceManagerMock.property.mockReturnValueOnce(-1);
          await expect(listener()).resolves.toMatchSnapshot();
        }
      }
    });
  });
});
