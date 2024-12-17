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
      // @ts-expect-error type should exist but TS says it doesn't
      initialisedServices.map((svc) => `${svc.name}-${svc.type}`)
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
        dock: true,
        zones: [],
        disableCareServices: true,
      },
      homebridge
    );
    const initialisedServices = client.getServices();
    expect(initialisedServices).toHaveLength(9);
    expect(
      // @ts-expect-error type should exist but TS says it doesn't
      initialisedServices.map((svc) => `${svc.name}-${svc.type}`)
    ).toMatchSnapshot();
    expect(Object.keys(client["pluginServices"])).toMatchSnapshot();
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
    miio.device.setRawProperty.mockRejectedValue(
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
