import { HAP } from "homebridge";
import * as HapJs from "@homebridge/hap-nodejs";
import { Subject } from "rxjs";
import { GoToDockService } from "./go_to_dock_service";
import {
  createDeviceManagerMock,
  DeviceManagerMock,
} from "./device_manager.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { applyConfigDefaults } from "./config_service";

describe("GoToDockService", () => {
  let goToDockService: GoToDockService;
  let deviceManagerMock: DeviceManagerMock;
  let hap: HAP;

  const setState = (state: string) => {
    (deviceManagerMock as { state: string }).state = state;
  };

  beforeEach(async () => {
    hap = HapJs;
    deviceManagerMock = createDeviceManagerMock();
    goToDockService = new GoToDockService({
      hap,
      log: getLoggerMock(),
      config: applyConfigDefaults({ goToDock: true }),
      deviceManager: deviceManagerMock,
    });
    await goToDockService.init();
  });

  afterEach(() => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).complete();
    jest.resetAllMocks();
  });

  const onCharacteristic = () =>
    goToDockService.services[0].getCharacteristic(hap.Characteristic.On);

  test("returns a service named after the config", () => {
    expect(goToDockService.services).toHaveLength(1);
    expect(
      goToDockService.services[0].getCharacteristic(hap.Characteristic.Name)
        .value
    ).toBe("Roborock vacuum cleaner go to dock");
  });

  test.each([
    ["returning", true],
    ["docking", true],
    ["cleaning", false],
    ["charging", false],
  ])("onGet when the state is %p", async (state, expected) => {
    setState(state);
    await expect(onCharacteristic().handleGetRequest()).resolves.toBe(expected);
  });

  test("updates the switch on state changes", () => {
    const spy = jest.spyOn(onCharacteristic(), "updateValue");
    setState("returning");
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
      key: "cleaning",
      value: false,
    });
    setState("charging");
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
      key: "charging",
      value: true,
    });
    expect(spy.mock.calls).toEqual([[true], [false]]);
  });

  test("ON sends the robot to the dock", async () => {
    setState("cleaning");
    await onCharacteristic().handleSetRequest(true);
    expect(deviceManagerMock.ensureDevice).toHaveBeenCalledWith("setGoToDock");
    expect(deviceManagerMock.device.activateCharging).toHaveBeenCalledTimes(1);
  });

  test("ON does nothing when it's already returning", async () => {
    setState("returning");
    await onCharacteristic().handleSetRequest(true);
    expect(deviceManagerMock.device.activateCharging).not.toHaveBeenCalled();
  });

  test("OFF stops the robot on its way to the dock", async () => {
    setState("returning");
    await onCharacteristic().handleSetRequest(false);
    expect(deviceManagerMock.device.pause).toHaveBeenCalledTimes(1);
  });

  test("OFF does nothing when it's not returning", async () => {
    setState("cleaning");
    await onCharacteristic().handleSetRequest(false);
    expect(deviceManagerMock.device.pause).not.toHaveBeenCalled();
  });

  test("throws when the device fails", async () => {
    setState("cleaning");
    jest
      .spyOn(deviceManagerMock.device, "activateCharging")
      .mockRejectedValue(new Error("Something went terribly wrong"));
    await expect(onCharacteristic().handleSetRequest(true)).rejects.toBe(
      -70402
    );
  });
});
