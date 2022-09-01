"use strict";

import { API } from "homebridge";

jest.useFakeTimers();

import { createHomebridgeMock, miio } from "./test.mocks";

import getXiaomiRoborockVacuumAccessory from "./xiaomi_roborock_vacuum_accessory";

describe("XiaomiRoborockVacuum", () => {
  let homebridge: jest.Mocked<API>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    homebridge = createHomebridgeMock();
    // Silencing the logger in the tests to reduce noise.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "info").mockImplementation();
    jest.spyOn(console, "debug").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Returns the accessory class", () => {
    const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(homebridge);
    expect(XiaomiRoborockVacuum).toHaveProperty("prototype");
    expect(XiaomiRoborockVacuum.prototype).toHaveProperty("identify");
    expect(XiaomiRoborockVacuum.prototype).toHaveProperty("getServices");
  });

  test("Fails if no IP provided", () => {
    const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(homebridge);

    expect(() => new XiaomiRoborockVacuum(console, {})).toThrowError(
      "You must provide an ip address of the vacuum cleaner."
    );
  });

  test("Fails if no token provided", () => {
    const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(homebridge);

    expect(
      () => new XiaomiRoborockVacuum(console, { ip: "192.168.0.1" })
    ).toThrowError("You must provide a token of the vacuum cleaner.");
  });

  test("Fails if both `room` and `autoroom` are provided", () => {
    const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(homebridge);

    expect(
      () =>
        new XiaomiRoborockVacuum(console, {
          ip: "192.168.0.1",
          token: "TOKEN",
          rooms: [],
          autoroom: true,
        })
    )
      .toThrowError(`Both "autoroom" and "rooms" config options can't be used at the same time.\n
      Please, use "autoroom" to retrieve the "rooms" config and remove it when not needed.`);
  });

  test("Client with minimum config has the basic services", () => {
    const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(homebridge);

    const client = new XiaomiRoborockVacuum(console, {
      ip: "192.168.0.1",
      token: "TOKEN",
    });
    const initialisedServices = client.getServices();
    expect(initialisedServices).toHaveLength(7);
    expect(
      // @ts-expect-error type should exist but TS says it doesn't
      initialisedServices.map((svc) => `${svc.name}-${svc.type}`)
    ).toMatchSnapshot();
    expect(Object.keys(client["pluginServices"])).toMatchSnapshot();
  });

  test("Client with all config has all the services", () => {
    const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(homebridge);

    const client = new XiaomiRoborockVacuum(console, {
      ip: "192.168.0.1",
      token: "TOKEN",
      serviceType: "switch",
      pause: true,
      waterBox: true,
      dustBin: true,
      dustCollection: true,
      goTo: true,
      dock: true,
      zones: [],
      disableCareServices: true,
    });
    const initialisedServices = client.getServices();
    expect(initialisedServices).toHaveLength(9);
    expect(
      // @ts-expect-error type should exist but TS says it doesn't
      initialisedServices.map((svc) => `${svc.name}-${svc.type}`)
    ).toMatchSnapshot();
    expect(Object.keys(client["pluginServices"])).toMatchSnapshot();
  });

  test("identify API", async () => {
    const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(homebridge);

    const client = new XiaomiRoborockVacuum(console, {
      ip: "192.168.0.1",
      token: "TOKEN",
    });
    const identifySpy = jest.spyOn(client["pluginServices"].findMe, "identify");
    expect(client.identify()).toBeUndefined();
    expect(identifySpy).toHaveBeenCalledTimes(1);
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
