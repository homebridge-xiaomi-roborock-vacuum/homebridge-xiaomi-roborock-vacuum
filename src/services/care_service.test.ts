import { CareService } from "./care_service";
import { createHomebridgeMock } from "../test.mocks";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { FanService } from "./fan_service";
import { DeviceManager } from "./device_manager";
import { HAP } from "homebridge";

describe("CareService", () => {
  describe("legacyCareSensors", () => {
    let careService: CareService;
    let deviceManagerMock: DeviceManagerMock;
    let fanServices: jest.Mock;
    let hap: jest.Mocked<HAP>;

    beforeEach(() => {
      const hbMock = createHomebridgeMock();
      hap = hbMock.hap as any;
      const log = getLoggerMock();

      deviceManagerMock = createDeviceManagerMock();

      fanServices = jest.fn();
      const fan = {
        get services() {
          return fanServices();
        },
      } as FanService;

      const config = applyConfigDefaults({ legacyCareSensors: true });

      careService = new CareService(
        hap,
        log,
        config,
        deviceManagerMock as unknown as DeviceManager,
        fan
      );
    });

    test("fan is not called", () => {
      expect(fanServices).not.toHaveBeenCalled();
    });

    test("only 1 service is exposed", () => {
      expect(careService.services).toHaveLength(1);
    });
  });

  describe("nativeCareSensors", () => {
    let careService: CareService;
    let deviceManagerMock: DeviceManagerMock;
    let fanServices: jest.Mock;
    let hap: jest.Mocked<HAP>;

    beforeEach(() => {
      const hbMock = createHomebridgeMock();
      hap = hbMock.hap as any;
      const log = getLoggerMock();

      deviceManagerMock = createDeviceManagerMock();
      deviceManagerMock.property.mockReturnValue(10);

      fanServices = jest.fn().mockImplementation(() => [new hap.Service.Fan()]);
      const fan = {
        get services() {
          return fanServices();
        },
      } as FanService;

      const config = applyConfigDefaults({});

      careService = new CareService(
        hap,
        log,
        config,
        deviceManagerMock as unknown as DeviceManager,
        fan
      );
    });

    test("fan is called", () => {
      expect(fanServices).toHaveBeenCalledTimes(1);
    });

    test("4 services are exposed", () => {
      expect(careService.services).toHaveLength(4);
    });
  });
});
