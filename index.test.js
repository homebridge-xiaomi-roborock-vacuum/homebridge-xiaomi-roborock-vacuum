"use strict";

jest.useFakeTimers();

const { createHomebridgeMock, miio } = require("./mocks");

jest.doMock("./miio", () => miio.createMock());

const registration = require("./index");

describe("XiaomiRoborockVacuum", () => {
  test("Registers the accessory", () => {
    const homebridge = createHomebridgeMock();
    registration(homebridge);
    expect(homebridge.registerAccessory).toBeCalled();
    const XiaomiRoborockVacuum = homebridge.registerAccessory.mock.calls[0][2];
    expect(XiaomiRoborockVacuum).toHaveProperty(["cleaningStatuses"]);
    expect(XiaomiRoborockVacuum).toHaveProperty(["errors"]);
  });

  test("Fails if no IP provided", () => {
    const homebridge = createHomebridgeMock();
    registration(homebridge);
    const XiaomiRoborockVacuum = homebridge.registerAccessory.mock.calls[0][2];

    expect(() => new XiaomiRoborockVacuum(console, {})).toThrowError(
      "You must provide an ip address of the vacuum cleaner."
    );
  });

  test("Fails if no token provided", () => {
    const homebridge = createHomebridgeMock();
    registration(homebridge);
    const XiaomiRoborockVacuum = homebridge.registerAccessory.mock.calls[0][2];

    expect(
      () => new XiaomiRoborockVacuum(console, { ip: "192.168.0.1" })
    ).toThrowError("You must provide a token of the vacuum cleaner.");
  });

  test("Fails if both `room` and `autoroom` are provided", () => {
    const homebridge = createHomebridgeMock();
    registration(homebridge);
    const XiaomiRoborockVacuum = homebridge.registerAccessory.mock.calls[0][2];

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

  describe("Client with minimum config", () => {
    const homebridge = createHomebridgeMock();
    registration(homebridge);
    const XiaomiRoborockVacuum = homebridge.registerAccessory.mock.calls[0][2];

    const client = new XiaomiRoborockVacuum(console, {
      ip: "192.168.0.1",
      token: "TOKEN",
    });

    test("the miio library has been called", () => {
      expect(miio.device.matches).toHaveBeenCalledTimes(1);
      expect(miio.device.destroy).toHaveBeenCalledTimes(1);
    });

    test("succeeds in reconnecting", async () => {
      miio.device.matches.mockReturnValueOnce(true);
      await client.connect();
      expect(miio.device.matches).toHaveBeenCalledTimes(2);
      expect(miio.device.on).toHaveBeenCalledTimes(2);
      expect(miio.device.destroy).toHaveBeenCalledTimes(1);
    });

    test("it has the basic services", () => {
      const initialisedServices = client.getServices();
      expect(initialisedServices).toHaveLength(7);
      expect(
        initialisedServices.map((svc) => `${svc.name}-${svc.type}`)
      ).toMatchSnapshot();
      expect(Object.keys(client.services)).toMatchSnapshot();
    });

    xdescribe("AccessoryInformation", () => {
      const model = client.services.info.getCharacteristic.mock.calls[1];
    });
  });
});
