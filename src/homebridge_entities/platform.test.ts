import type { API, Logging } from "homebridge";
import { Categories } from "@homebridge/hap-nodejs";

import { createHomebridgeMock, miio } from "../test.mocks";
import "./platform.test.mock";
import { XiaomiRoborockVacuumPlatformAccessoryInitializerMock } from "./platform.test.mock";
import { CloudService } from "../services";
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

  test("gets the IP and token of the robots configured with their did, or without a token, from the Xiaomi Cloud", async () => {
    const locate = jest
      .spyOn(CloudService.prototype, "locate")
      .mockImplementation(async ({ did, ip }) => {
        if (did === "123") return { ip: "4.4.4.4", token: "did-token" };
        if (ip === "2.2.2.2") return { ip: "2.2.2.2", token: "cloud-token" };
        return undefined;
      });
    homebridge.platformAccessory.mockImplementation(newAccessory);
    new XiaomiRoborockVacuumPlatform(
      log,
      {
        platform: ACCESSORY_NAME,
        cloud: { enabled: true },
        devices: [
          { name: "with-token", ip: "1.1.1.1", token: "token1" },
          { name: "from-the-cloud", ip: "2.2.2.2" },
          { name: "by-did", did: "123", ip: "9.9.9.9", token: "old-token" },
        ],
      },
      homebridge
    );
    homebridge.on.mock.calls[0][1]();
    await new Promise(setImmediate);
    expect(locate).toHaveBeenCalledTimes(2);
    expect(locate).toHaveBeenCalledWith({ did: undefined, ip: "2.2.2.2" });
    expect(locate).toHaveBeenCalledWith({ did: "123", ip: "9.9.9.9" });
    const configs =
      XiaomiRoborockVacuumPlatformAccessoryInitializerMock.mock.calls.map(
        ([, config]) => config
      );
    expect(configs).toEqual([
      { name: "with-token", ip: "1.1.1.1", token: "token1" },
      { name: "from-the-cloud", ip: "2.2.2.2", token: "cloud-token" },
      { name: "by-did", did: "123", ip: "4.4.4.4", token: "did-token" },
    ]);
    expect(homebridge.registerPlatformAccessories).toHaveBeenCalledTimes(3);
    locate.mockRestore();
  });

  test("a robot whose token can't be initialized is reported, without failing the others", async () => {
    jest.spyOn(CloudService.prototype, "locate").mockResolvedValue(undefined);
    homebridge.platformAccessory.mockImplementation(newAccessory);
    XiaomiRoborockVacuumPlatformAccessoryInitializerMock.mockImplementationOnce(
      () => {
        throw new Error("You must provide a token of the vacuum cleaner");
      }
    );
    new XiaomiRoborockVacuumPlatform(
      log,
      {
        platform: ACCESSORY_NAME,
        cloud: { enabled: true },
        devices: [{ name: "not-in-the-account", ip: "3.3.3.3" }],
      },
      homebridge
    );
    homebridge.on.mock.calls[0][1]();
    await new Promise(setImmediate);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize the vacuum "not-in-the-account": You must provide a token of the vacuum cleaner'
    );
    jest.restoreAllMocks();
  });
});
