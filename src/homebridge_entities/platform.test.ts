import type { API, Logging } from "homebridge";
import { Categories } from "@homebridge/hap-nodejs";
import { BehaviorSubject } from "rxjs";
import os from "node:os";

import { createHomebridgeMock, miio } from "../test.mocks";
import "./platform.test.mock";
import { XiaomiRoborockVacuumPlatformAccessoryInitializerMock } from "./platform.test.mock";
import { CloudService, RoborockService } from "../services";
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

  describe('without HomeKit services (serviceType: "vacuum" without extras)', () => {
    const startWithoutServices = (cached: boolean) => {
      XiaomiRoborockVacuumPlatformAccessoryInitializerMock.mockImplementationOnce(
        () => ({ initialized$: new BehaviorSubject(false) })
      );
      homebridge.platformAccessory.mockImplementationOnce(newAccessory);
      const platform = new XiaomiRoborockVacuumPlatform(
        log,
        {
          platform: ACCESSORY_NAME,
          devices: [{ name: "test", ip: "my.ip", token: "super-secret" }],
        },
        homebridge
      );
      if (cached) {
        const accessory = newAccessory();
        Object.assign(accessory, {
          UUID: homebridge.hap.uuid.generate(
            "homebridge-xiaomi-roborock-vacuum-accessory-test"
          ),
        });
        platform.configureAccessory(accessory);
      }
      homebridge.on.mock.calls[0][1]();
      return platform;
    };

    test("a new HomeKit accessory isn't registered", () => {
      const platform = startWithoutServices(false);
      expect(homebridge.registerPlatformAccessories).not.toHaveBeenCalled();
      expect(homebridge.unregisterPlatformAccessories).not.toHaveBeenCalled();
      expect(platform["accessories"].size).toBe(1);
    });

    test("the cached HomeKit accessory is unregistered", () => {
      const platform = startWithoutServices(true);
      expect(homebridge.registerPlatformAccessories).not.toHaveBeenCalled();
      expect(homebridge.unregisterPlatformAccessories).toHaveBeenCalledTimes(1);
      expect(platform["accessories"].size).toBe(0);
    });
  });

  describe("Matter setup warnings", () => {
    const ipv4 = {
      family: "IPv4",
      address: "192.168.1.2",
    } as os.NetworkInterfaceInfo;
    const ipv6 = {
      family: "IPv6",
      address: "fe80::1",
    } as os.NetworkInterfaceInfo;
    const start = ({
      serviceType = "vacuum",
      matter = true,
      // `null`: a Homebridge version without `isMatterExternalsOnly`
      externalsOnly = false as boolean | null,
      addresses = [ipv4, ipv6],
    } = {}) => {
      jest.spyOn(os, "networkInterfaces").mockReturnValue({ eth0: addresses });
      Object.assign(homebridge, {
        isMatterEnabled: jest.fn(() => matter),
        isMatterExternalsOnly:
          externalsOnly === null ? undefined : jest.fn(() => externalsOnly),
      });
      homebridge.platformAccessory.mockImplementation(newAccessory);
      new XiaomiRoborockVacuumPlatform(
        log,
        {
          platform: ACCESSORY_NAME,
          devices: [
            { name: "test", ip: "my.ip", token: "secret", serviceType },
          ],
        },
        homebridge
      );
      homebridge.on.mock.lastCall![1]();
    };
    const warnings = () => consoleWarnSpy.mock.calls.map(([msg]) => `${msg}`);

    test("suggests externalsOnly when the Matter bridge is published", () => {
      start();
      expect(warnings()).toEqual([
        expect.stringContaining('"externalsOnly": true'),
      ]);
    });

    test("no warnings with externalsOnly and IPv6", () => {
      start({ externalsOnly: true });
      expect(warnings()).toEqual([]);
    });

    test("no externalsOnly hint on Homebridge versions without it", () => {
      start({ externalsOnly: null });
      expect(warnings()).toEqual([]);
    });

    test("warns when the host has no IPv6", () => {
      start({ externalsOnly: true, addresses: [ipv4] });
      expect(warnings()).toEqual([
        expect.stringContaining("Matter needs IPv6"),
      ]);
    });

    test('no warnings without "vacuum" devices or without Matter', () => {
      start({ serviceType: "fan", addresses: [ipv4] });
      start({ matter: false, addresses: [ipv4] });
      expect(warnings()).toEqual([]);
    });
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

  test("robots configured with their duid use the Roborock service (and are reported without the roborock option)", async () => {
    homebridge.platformAccessory.mockImplementation(newAccessory);
    new XiaomiRoborockVacuumPlatform(
      log,
      {
        platform: ACCESSORY_NAME,
        roborock: { enabled: true },
        devices: [{ name: "saros", duid: "duid-1" }],
      },
      homebridge
    );
    homebridge.on.mock.calls[0][1]();
    await new Promise(setImmediate);
    const [call] =
      XiaomiRoborockVacuumPlatformAccessoryInitializerMock.mock.calls;
    expect(call[1]).toEqual({ name: "saros", duid: "duid-1" });
    expect(call[5]).toBeInstanceOf(RoborockService);

    XiaomiRoborockVacuumPlatformAccessoryInitializerMock.mockClear();
    homebridge.on.mockClear();
    new XiaomiRoborockVacuumPlatform(
      log,
      {
        platform: ACCESSORY_NAME,
        devices: [{ name: "saros", duid: "duid-1" }],
      },
      homebridge
    );
    homebridge.on.mock.calls[0][1]();
    await new Promise(setImmediate);
    expect(
      XiaomiRoborockVacuumPlatformAccessoryInitializerMock
    ).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'The vacuum "saros" has a `duid` (Roborock app): enable the platform\'s `roborock` option.'
    );
  });
});
