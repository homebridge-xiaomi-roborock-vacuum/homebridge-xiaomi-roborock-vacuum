import type { API, Logging } from "homebridge";
import { Categories } from "hap-nodejs";

import { createHomebridgeMock, miio } from "../test.mocks";
import "./platform.test.mock";
import {
  XiaomiRoborockVacuumPlatform,
  XiaomiRoborockVacuumPlatformAccessory,
} from "./platform";
import { ACCESSORY_NAME } from "../constants";
import { applyConfigDefaults } from "../services";

function newAccessory(): XiaomiRoborockVacuumPlatformAccessory {
  const name = "test";
  const uuid = "test-test";
  return {
    context: { name },
    on: jest.fn(),
    emit: jest.fn(),
    displayName: name,
    UUID: uuid,
    category: Categories.FAN,
    services: [],
    addListener: jest.fn(),
    addService: jest.fn(),
  } as unknown as XiaomiRoborockVacuumPlatformAccessory;
}

describe("XiaomiRoborockVacuumPlatform", () => {
  let homebridge: jest.Mocked<API>;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;
  const log: Logging = console as unknown as Logging;

  beforeEach(() => {
    homebridge = createHomebridgeMock();
    // Silencing the logger in the tests to reduce noise.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "info").mockImplementation();
    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();

    miio.device.find.mockRejectedValue(
      new Error("Something went terribly wrong")
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("returns the dynamic platform class", () => {
    expect(XiaomiRoborockVacuumPlatform).toHaveProperty("prototype");
    expect(XiaomiRoborockVacuumPlatform.prototype).toHaveProperty(
      "configureAccessory"
    );
  });

  describe("constructor", () => {
    test("ensures `devices` as an empty array", () => {
      const platform = new XiaomiRoborockVacuumPlatform(
        log,
        {
          platform: ACCESSORY_NAME,
        },
        homebridge
      );
      expect(platform["config"]).toHaveProperty("devices", []);
    });

    test("waits for the didFinishLaunching event", () => {
      new XiaomiRoborockVacuumPlatform(
        log,
        {
          platform: ACCESSORY_NAME,
        },
        homebridge
      );
      expect(homebridge.on).toHaveBeenCalledTimes(1);
      expect(homebridge.on).toHaveBeenCalledWith(
        "didFinishLaunching",
        expect.any(Function)
      );
      // Trigger the handler
      homebridge.on.mock.calls[0][1]();
    });
  });

  describe("configureAccessory", () => {
    test("appends the accessory to the list", () => {
      const platform = new XiaomiRoborockVacuumPlatform(
        log,
        { platform: ACCESSORY_NAME },
        homebridge
      );
      expect(platform["accessories"].size).toBe(0);
      const accessory = newAccessory();
      platform.configureAccessory(accessory);
      expect(platform["accessories"].size).toBe(1);
      // Handles duplicated calls
      platform.configureAccessory(accessory);
      expect(platform["accessories"].size).toBe(1);
    });
  });

  test("unregisters all devices because the config has an empty array", () => {
    homebridge.platformAccessory.mockImplementationOnce(newAccessory);

    const platform = new XiaomiRoborockVacuumPlatform(
      log,
      {
        platform: ACCESSORY_NAME,
        devices: [],
      },
      homebridge
    );
    expect(platform["accessories"].size).toBe(0);
    // Registers a cached service
    const accessory = newAccessory();
    platform.configureAccessory(accessory);
    expect(platform["accessories"].size).toBe(1);
    // Trigger the handler
    homebridge.on.mock.calls[0][1]();
    expect(platform["accessories"].size).toBe(0);
    // Unregisters one accessory
    expect(homebridge.unregisterPlatformAccessories).toHaveBeenCalledTimes(1);
    // Tries to register the accessory
    expect(homebridge.platformAccessory).toHaveBeenCalledTimes(0);
    expect(homebridge.registerPlatformAccessories).toHaveBeenCalledTimes(0);
  });

  test("unregisters all cached devices and creates some others because their configs have changed", () => {
    homebridge.platformAccessory.mockImplementationOnce(newAccessory);

    const platform = new XiaomiRoborockVacuumPlatform(
      log,
      {
        platform: ACCESSORY_NAME,
        devices: [
          applyConfigDefaults({
            name: "other-name",
            ip: "my.ip",
            token: "super-secret",
          }),
        ],
      },
      homebridge
    );
    expect(platform["accessories"].size).toBe(0);
    // Registers a cached service
    const accessory = newAccessory();
    platform.configureAccessory(accessory);
    expect(platform["accessories"].size).toBe(1);
    // Trigger the handler
    homebridge.on.mock.calls[0][1]();
    expect(platform["accessories"].size).toBe(1);
    // Unregisters one accessory
    expect(homebridge.unregisterPlatformAccessories).toHaveBeenCalledTimes(1);
    // Tries to register the accessory
    expect(homebridge.platformAccessory).toHaveBeenCalledTimes(1);
    expect(homebridge.registerPlatformAccessories).toHaveBeenCalledTimes(1);
  });
});
