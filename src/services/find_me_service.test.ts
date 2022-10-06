import { HAP } from "homebridge";
import * as HapJs from "hap-nodejs";
import { Subject } from "rxjs";
import { FindMeService } from "./find_me_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";

describe("FindMeService", () => {
  let findMeService: FindMeService;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  beforeEach(async () => {
    hap = HapJs;
    const log = getLoggerMock();
    deviceManagerMock = createDeviceManagerMock();
    const config = applyConfigDefaults({ findMe: true });

    findMeService = new FindMeService({
      hap,
      log,
      config,
      deviceManager: deviceManagerMock,
    });

    await findMeService.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  test("returns a service", () => {
    expect(findMeService.services).toHaveLength(1);
  });

  test("default config does not return any service", () => {
    findMeService = new FindMeService({
      hap,
      log: getLoggerMock(),
      config: applyConfigDefaults({}),
      deviceManager: deviceManagerMock,
    });
    expect(findMeService.services).toStrictEqual([]);
  });

  test("onGet", async () => {
    const [service] = findMeService.services;
    await expect(
      service.getCharacteristic(hap.Characteristic.On).handleGetRequest()
    ).resolves.toStrictEqual(false);
  });

  test("onSet", async () => {
    const [service] = findMeService.services;
    await expect(
      service.getCharacteristic(hap.Characteristic.On).handleSetRequest(true)
    ).resolves.toStrictEqual(undefined);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledTimes(1);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith("identify");
    expect(deviceManagerMock.device?.find).toHaveBeenCalledTimes(1);
  });
});
