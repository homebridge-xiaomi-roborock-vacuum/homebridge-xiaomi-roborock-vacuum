import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { ZonesService } from "./zones_service";
import { MainService } from "./main_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults, type Config } from "./config_service";

describe("ZonesService", () => {
  let service: ZonesService;
  let deviceManagerMock: DeviceManagerMock;
  let log: ReturnType<typeof getLoggerMock>;
  let mainService: { setSpeed: jest.Mock; getCleaning: jest.Mock };
  let setWaterSpeed: jest.Mock | undefined;
  const hap: HAP = HapJs;

  const kitchen = [[24500, 27000, 28000, 30000, 2]] as [
    number,
    number,
    number,
    number,
    number,
  ][];

  async function create(
    zones: NonNullable<Config["zones"]>,
    waterSpeed: jest.Mock | null = jest.fn()
  ) {
    deviceManagerMock = createDeviceManagerMock();
    (deviceManagerMock as { isCleaning: boolean }).isCleaning = false;
    log = getLoggerMock();
    mainService = { setSpeed: jest.fn(), getCleaning: jest.fn() };
    setWaterSpeed = waterSpeed ?? undefined;
    service = new ZonesService(
      {
        hap,
        log,
        config: applyConfigDefaults({ zones }),
        deviceManager: deviceManagerMock,
      },
      mainService as unknown as MainService,
      jest.fn(),
      setWaterSpeed
    );
    await service.init();
  }

  const on = (index: number) =>
    service.services[index].getCharacteristic(hap.Characteristic.On);

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  test("a switch per zone", async () => {
    await create([
      { name: "Kitchen", zone: kitchen },
      { name: "Bedroom", zone: [[1, 2, 3, 4]] },
    ]);
    expect(
      service.services.map(
        (zone) => zone.getCharacteristic(hap.Characteristic.Name).value
      )
    ).toEqual(["cleaning Kitchen", "cleaning Bedroom"]);
  });

  test("ON cleans the zone, adding the default count of 1 when missing", async () => {
    await create([{ name: "Bedroom", zone: [[1, 2, 3, 4]] }]);
    await on(0).handleSetRequest(true);
    expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith([
      [1, 2, 3, 4, 1],
    ]);
  });

  test("without speed or water level, they're left as they are", async () => {
    await create([{ name: "Kitchen", zone: kitchen }]);
    await on(0).handleSetRequest(true);
    expect(mainService.setSpeed).not.toHaveBeenCalled();
    expect(setWaterSpeed).not.toHaveBeenCalled();
    expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith(kitchen);
  });

  test("sets the zone's fan speed and water level before cleaning it", async () => {
    await create([
      { name: "Kitchen", zone: kitchen, speed: "Mop", waterSpeed: "High" },
    ]);
    await on(0).handleSetRequest(true);
    expect(mainService.setSpeed).toHaveBeenCalledWith("Mop");
    expect(setWaterSpeed).toHaveBeenCalledWith("High");
    const cleanOrder =
      deviceManagerMock.device.cleanZones.mock.invocationCallOrder[0];
    expect(mainService.setSpeed.mock.invocationCallOrder[0]).toBeLessThan(
      cleanOrder
    );
    expect(setWaterSpeed!.mock.invocationCallOrder[0]).toBeLessThan(cleanOrder);
  });

  test('"Off" is not used as a fan speed (it would stop the cleaning)', async () => {
    await create([{ name: "Kitchen", zone: kitchen, speed: "Off" }]);
    await on(0).handleSetRequest(true);
    expect(mainService.setSpeed).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"Off"'));
    expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith(kitchen);
  });

  test("warns about the water level when the water box is disabled", async () => {
    await create(
      [{ name: "Kitchen", zone: kitchen, waterSpeed: "High" }],
      null
    );
    await on(0).handleSetRequest(true);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("waterBox"));
    expect(deviceManagerMock.device.cleanZones).toHaveBeenCalledWith(kitchen);
  });

  test("doesn't change the modes when the robot is already cleaning", async () => {
    await create([{ name: "Kitchen", zone: kitchen, speed: "Max" }]);
    (deviceManagerMock as { isCleaning: boolean }).isCleaning = true;
    await on(0).handleSetRequest(true);
    expect(mainService.setSpeed).not.toHaveBeenCalled();
    expect(deviceManagerMock.device.cleanZones).not.toHaveBeenCalled();
  });

  test("OFF sends the robot back to the dock", async () => {
    await create([{ name: "Kitchen", zone: kitchen, speed: "Max" }]);
    await on(0).handleSetRequest(false);
    expect(mainService.setSpeed).not.toHaveBeenCalled();
    expect(deviceManagerMock.device.activateCharging).toHaveBeenCalled();
  });
});
