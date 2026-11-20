"use strict";

import { API, Logging } from "homebridge";
import { Subject } from "rxjs";

jest.useFakeTimers();

import { createHomebridgeMock, miio } from "../test.mocks";
import { deviceManagerMock } from "./accessory.test.mock";

import { XiaomiRoborockVacuumAccessory } from "./accessory";

describe("XiaomiRoborockVacuum", () => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Returns the accessory class", () => {
    expect(XiaomiRoborockVacuumAccessory).toHaveProperty("prototype");
    expect(XiaomiRoborockVacuumAccessory.prototype).toHaveProperty("identify");
    expect(XiaomiRoborockVacuumAccessory.prototype).toHaveProperty(
      "getServices"
    );
  });

  test("Fails if both `room` and `autoroom` are provided", () => {
    expect(
      () =>
        new XiaomiRoborockVacuumAccessory(
          log,
          {
            ip: "192.168.0.1",
            token: "TOKEN",
            rooms: [],
            autoroom: true,
          },
          homebridge
        )
    )
      .toThrow(`Both "autoroom" and "rooms" config options can't be used at the same time.\n
      Please, use "autoroom" to retrieve the "rooms" config and remove it when not needed.`);
  });

  describe("an accessories block saved with the platform form of the UI (#1248)", () => {
    test("uses the first device and explains how to fix the config", () => {
      const client = new XiaomiRoborockVacuumAccessory(
        log,
        {
          accessory: "XiaomiRoborockVacuum",
          devices: [
            { name: "Robi", ip: "192.168.0.1", token: "TOKEN", pause: true },
            { name: "Other", ip: "192.168.0.2", token: "TOKEN2" },
          ],
        } as never,
        homebridge
      );
      expect(client["config"]).toMatchObject({
        name: "Robi",
        ip: "192.168.0.1",
        token: "TOKEN",
        pause: true,
      });
      expect(client["pluginServices"].pause).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'move this block from "accessories" to "platforms"'
        )
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("the other 1 are ignored")
      );
    });

    test("regular accessory configs are untouched", () => {
      const client = new XiaomiRoborockVacuumAccessory(
        log,
        { ip: "192.168.0.1", token: "TOKEN" },
        homebridge
      );
      expect(client["config"]).toMatchObject({ ip: "192.168.0.1" });
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('"devices" list')
      );
    });
  });

  test("Client with minimum config has the basic services", () => {
    const client = new XiaomiRoborockVacuumAccessory(
      log,
      {
        ip: "192.168.0.1",
        token: "TOKEN",
      },
      homebridge
    );
    const initialisedServices = client.getServices();
    expect(initialisedServices).toHaveLength(7);
    expect(
      initialisedServices.map((svc) => `${svc.displayName}-${svc.subtype}`)
    ).toMatchSnapshot();
    expect(Object.keys(client["pluginServices"])).toMatchSnapshot();
  });

  test("Client with all config has all the services", () => {
    const client = new XiaomiRoborockVacuumAccessory(
      log,
      {
        ip: "192.168.0.1",
        token: "TOKEN",
        serviceType: "switch",
        pause: true,
        waterBox: true,
        dustBin: true,
        dustCollection: true,
        goTo: true,
        goToDock: true,
        dock: true,
        mopWash: true,
        mopDrying: true,
        waterTankEmpty: true,
        zones: [],
        disableCareServices: true,
      },
      homebridge
    );
    const initialisedServices = client.getServices();
    expect(initialisedServices).toHaveLength(13);
    expect(
      initialisedServices.map((svc) => `${svc.displayName}-${svc.subtype}`)
    ).toMatchSnapshot();
    expect(Object.keys(client["pluginServices"])).toMatchSnapshot();
  });

  describe('serviceType: "vacuum"', () => {
    test("legacy accessory: not available, falls back to the fan", () => {
      const client = new XiaomiRoborockVacuumAccessory(
        log,
        { ip: "192.168.0.1", token: "TOKEN", serviceType: "vacuum" },
        homebridge
      );
      expect(client["config"].serviceType).toBe("fan");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"serviceType": "vacuum" is only available')
      );
      expect(client.getServices()).toHaveLength(7);
    });

    test("platform: no HomeKit services without extras (the Matter vacuum has them)", () => {
      const client = new XiaomiRoborockVacuumAccessory(
        log,
        {
          ip: "192.168.0.1",
          token: "TOKEN",
          serviceType: "vacuum",
          pause: true,
          findMe: true,
          goToDock: true,
          dock: true,
          waterBox: true,
          rooms: [{ id: "16", name: "Kitchen" }],
          disableCareServices: true,
        },
        homebridge,
        deviceManagerMock
      );
      expect(client.getServices()).toStrictEqual([]);
      expect(client.roomList).toStrictEqual([{ id: "16", name: "Kitchen" }]);
    });

    test("platform: only the extras that Matter doesn't cover, with the accessory information", () => {
      const client = new XiaomiRoborockVacuumAccessory(
        log,
        {
          ip: "192.168.0.1",
          token: "TOKEN",
          serviceType: "vacuum",
          pause: true,
          goToDock: true,
          dustCollection: true,
          zones: [],
          disableCareServices: true,
        },
        homebridge,
        deviceManagerMock
      );
      const services = client.getServices();
      expect(services[0]).toBeInstanceOf(
        homebridge.hap.Service.AccessoryInformation
      );
      expect(services.map((svc) => svc.constructor.name)).not.toContain("Fan");
      expect(services).toHaveLength(
        1 +
          client["pluginServices"].dustCollection!.services.length +
          client["pluginServices"].zones!.services.length
      );
    });

    test("care sensors are opt-in", () => {
      const create = (config: Record<string, unknown>) =>
        new XiaomiRoborockVacuumAccessory(
          log,
          {
            ip: "192.168.0.1",
            token: "TOKEN",
            serviceType: "vacuum",
            ...config,
          },
          homebridge,
          deviceManagerMock
        );
      expect(create({}).getServices()).toStrictEqual([]);
      expect(create({ disableCareServices: true }).getServices()).toStrictEqual(
        []
      );
      const withCare = create({ disableCareServices: false });
      expect(withCare["pluginServices"].careServices).toBeDefined();
      expect(withCare.getServices().length).toBeGreaterThan(1);
    });
  });

  test("identify API", async () => {
    const client = new XiaomiRoborockVacuumAccessory(
      log,
      {
        ip: "192.168.0.1",
        token: "TOKEN",
      },
      homebridge
    );
    miio.device.find.mockRejectedValue(
      new Error("Something went terribly wrong")
    );
    const identifySpy = jest.spyOn(client["pluginServices"].findMe, "identify");
    expect(client.identify()).toBeUndefined();
    expect(identifySpy).toHaveBeenCalledTimes(1);
  });

  test("errorChanged$ (unknown error)", () => {
    (deviceManagerMock.errorChanged$ as Subject<unknown>).next({
      id: "error",
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `[Model=unknown] WAR changedError | Robot has an ERROR - error, undefined`
    );
  });

  test("errorChanged$ (known error)", async () => {
    (miio.device.setRawProperty as jest.Mock).mockRejectedValue(
      new Error("Something went terribly wrong")
    );

    (deviceManagerMock.errorChanged$ as Subject<unknown>).next({
      id: "1",
      description: "unknown",
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `[Model=unknown] WAR changedError | Robot has an ERROR - 1, Try turning the orange laser-head to make sure it isn't blocked.`
    );
  });

  test("errorChanged$ (cleared: null) is ignored, and later errors are still reported", async () => {
    new XiaomiRoborockVacuumAccessory(
      log,
      { ip: "192.168.0.1", token: "TOKEN" },
      homebridge
    );
    miio.device.setRawProperty.mockImplementationOnce(() => {
      throw new Error("Something went terribly wrong");
    });
    const errors$ = deviceManagerMock.errorChanged$ as Subject<unknown>;
    errors$.next({ id: "error1" }); // processing it fails
    errors$.next(null);
    errors$.next({ id: "error2" });
    // Let `concatMap` process the errors (`process.nextTick` is faked in this file)
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error processing the error reported by the robot"
      ),
      expect.any(Error)
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `[Model=unknown] WAR changedError | Robot has an ERROR - error2, undefined`
    );
  });

  test("stateChanged$ are logged to debug", () => {
    (deviceManagerMock.stateChanged$ as Subject<unknown>).next({
      key: "charging",
      value: false,
    });
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      `[Model=unknown] stateChanged | stateChanged event: charging:false`
    );
  });

  // These should be moved to the DeviceManager tests
  // test("the miio library has been called", () => {
  //   expect(miio.device.matches).toHaveBeenCalledTimes(1);
  //   expect(miio.device.destroy).toHaveBeenCalledTimes(1);
  // });

  // test("succeeds in reconnecting", async () => {
  //   miio.device.matches.mockReturnValueOnce(true);
  //   await client.connect();
  //   expect(miio.device.matches).toHaveBeenCalledTimes(2);
  //   expect(miio.device.on).toHaveBeenCalledTimes(2);
  //   expect(miio.device.destroy).toHaveBeenCalledTimes(1);
  // });
});
