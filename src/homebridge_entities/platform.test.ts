import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
  type Mocked,
} from "vitest";
import type { API, Logging } from "homebridge";
import { Categories } from "@homebridge/hap-nodejs";
import { BehaviorSubject } from "rxjs";
import os, { networkInterfaces } from "node:os";

import { createHomebridgeMock, miio } from "../test.mocks.js";
import "./platform.test.mock.js";
import { XiaomiRoborockVacuumPlatformAccessoryInitializerMock } from "./platform.test.mock.js";
import { CloudService, RoborockService } from "../services/index.js";
import {
  XiaomiRoborockVacuumPlatform,
  XiaomiRoborockVacuumPlatformAccessory,
} from "./platform.js";
import { ACCESSORY_NAME } from "../constants.js";
import { applyConfigDefaults } from "../services/index.js";

// `platform.ts` imports `networkInterfaces` itself: spying on `os` doesn't reach it
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: actual,
    networkInterfaces: vi.fn(actual.networkInterfaces),
  };
});

function newAccessory(): XiaomiRoborockVacuumPlatformAccessory {
  const name = "test";
  const uuid = "test-test";
  return {
    context: { name },
    on: vi.fn(),
    emit: vi.fn(),
    displayName: name,
    UUID: uuid,
    category: Categories.FAN,
    services: [],
    addListener: vi.fn(),
    addService: vi.fn(),
  } as unknown as XiaomiRoborockVacuumPlatformAccessory;
}

describe("XiaomiRoborockVacuumPlatform", () => {
  let homebridge: Mocked<API>;
  let consoleErrorSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleDebugSpy: MockInstance;
  const log: Logging = console as unknown as Logging;

  beforeEach(() => {
    homebridge = createHomebridgeMock();
    // Silencing the logger in the tests to reduce noise.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    miio.device.find.mockRejectedValue(
      new Error("Something went terribly wrong")
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
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
        function () {
          return { initialized$: new BehaviorSubject(false) };
        }
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
      vi.mocked(networkInterfaces).mockReturnValue({ eth0: addresses });
      Object.assign(homebridge, {
        isMatterEnabled: vi.fn(() => matter),
        isMatterExternalsOnly:
          externalsOnly === null ? undefined : vi.fn(() => externalsOnly),
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
    const locate = vi
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
    vi.spyOn(CloudService.prototype, "locate").mockResolvedValue(undefined);
    homebridge.platformAccessory.mockImplementation(newAccessory);
    XiaomiRoborockVacuumPlatformAccessoryInitializerMock.mockImplementationOnce(
      function () {
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
    vi.restoreAllMocks();
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

  describe("room switches' accessories (#467)", () => {
    const accessoryOf = (name: string, uuid: string, context = {}) =>
      ({ displayName: name, UUID: uuid, context }) as never;

    const registryFor = async (cached: unknown[] = []) => {
      homebridge.platformAccessory.mockImplementation(function (
        name: string,
        uuid: string
      ) {
        return accessoryOf(name, uuid, {});
      } as never);
      const platform = new XiaomiRoborockVacuumPlatform(
        log,
        {
          platform: ACCESSORY_NAME,
          devices: [{ name: "robot", ip: "1.1.1.1", token: "t" }],
        },
        homebridge
      );
      cached.forEach((accessory) =>
        platform.configureAccessory(accessory as never)
      );
      XiaomiRoborockVacuumPlatformAccessoryInitializerMock.mockClear();
      homebridge.on.mock.calls.at(-1)![1]();
      await new Promise(setImmediate);
      const [call] =
        XiaomiRoborockVacuumPlatformAccessoryInitializerMock.mock.calls;
      return call[6] as import("./platform.js").RoomAccessories;
    };
    const uuidOf = (room: string) =>
      homebridge.hap.uuid.generate(
        `homebridge-xiaomi-roborock-vacuum-accessory-robot-${room}`
      );

    test("new accessories are named after the switch, and registered on commit", async () => {
      const registry = await registryFor();
      const kitchen = registry.accessoryFor(
        "roomService16",
        "cleaning Kitchen"
      );
      expect(kitchen).toMatchObject({
        displayName: "cleaning Kitchen",
        UUID: uuidOf("roomService16"),
        context: { name: "robot", room: "roomService16" },
      });
      expect(homebridge.registerPlatformAccessories).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        [kitchen]
      );
      registry.commit([kitchen]);
      expect(homebridge.registerPlatformAccessories).toHaveBeenCalledWith(
        "homebridge-xiaomi-roborock-vacuum",
        ACCESSORY_NAME,
        [kitchen]
      );
    });

    test("cached ones are reused, and the ones no longer used are unregistered (only this vacuum's)", async () => {
      const cachedKitchen = accessoryOf(
        "cleaning Kitchen",
        uuidOf("roomService16"),
        {
          name: "robot",
          room: "roomService16",
        }
      );
      const removedRoom = accessoryOf(
        "cleaning Garage",
        uuidOf("roomService20"),
        {
          name: "robot",
          room: "roomService20",
        }
      );
      const vacuum = accessoryOf("robot", "vacuum-uuid", { name: "robot" });
      const registry = await registryFor([cachedKitchen, removedRoom, vacuum]);

      const kitchen = registry.accessoryFor(
        "roomService16",
        "cleaning Kitchen"
      );
      expect(kitchen).toBe(cachedKitchen);
      registry.commit([kitchen]);
      expect(homebridge.registerPlatformAccessories).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        [kitchen]
      );
      expect(homebridge.unregisterPlatformAccessories).toHaveBeenCalledWith(
        "homebridge-xiaomi-roborock-vacuum",
        ACCESSORY_NAME,
        [removedRoom]
      );
    });

    test("they're removed with their vacuum", () => {
      const room = accessoryOf("cleaning Kitchen", "room-uuid", {
        name: "gone",
        room: "roomService16",
      });
      const platform = new XiaomiRoborockVacuumPlatform(
        log,
        { platform: ACCESSORY_NAME, devices: [] },
        homebridge
      );
      platform.configureAccessory(room);
      homebridge.on.mock.calls.at(-1)![1]();
      expect(homebridge.unregisterPlatformAccessories).toHaveBeenCalledWith(
        "homebridge-xiaomi-roborock-vacuum",
        ACCESSORY_NAME,
        [room]
      );
    });
  });
});
