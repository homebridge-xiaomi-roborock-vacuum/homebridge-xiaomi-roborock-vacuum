"use strict";

jest.useFakeTimers();

import { createHomebridgeMock, miio } from "./mocks";

import getXiaomiRoborockVacuumAccessory from "./xiaomi_roborock_vacuum_accessory";

describe("XiaomiRoborockVacuum", () => {
  let homebridge;

  beforeEach(() => {
    homebridge = createHomebridgeMock();
    // Silencing the logger in the tests to reduce noise.
    jest.spyOn(console, "debug").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
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

  describe("Client with minimum config", () => {
    let client;

    beforeAll(() => {
      const XiaomiRoborockVacuum = getXiaomiRoborockVacuumAccessory(homebridge);

      client = new XiaomiRoborockVacuum(console, {
        ip: "192.168.0.1",
        token: "TOKEN",
      });
    });

    test("it has the basic services", () => {
      const initialisedServices = client.getServices();
      expect(initialisedServices).toHaveLength(7);
      expect(
        initialisedServices.map((svc) => `${svc.name}-${svc.type}`)
      ).toMatchSnapshot();
      expect(Object.keys(client.pluginServices)).toMatchSnapshot();
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

    xdescribe("AccessoryInformation", () => {
      // const model = client.services.info.getCharacteristic.mock.calls[1];
    });
  });
});
