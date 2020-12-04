"use strict";

const loggerMock = jest.fn();
const debugMock = jest.fn().mockImplementation((label) => {
  return loggerMock;
});

jest.doMock("debug", () => debugMock);

const DeviceInfo = require("./device_info");

describe("DeviceInfo", () => {
  describe("constructor", () => {
    test("creates a new DeviceInfo without id", () => {
      const device = new DeviceInfo({}, null, "localhost", 1234);
      expect(debugMock).toHaveBeenCalledWith("thing:miio:pending");
    });
    test("creates a new DeviceInfo with id", () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      expect(debugMock).toHaveBeenCalledWith("thing:miio:MY-ID");
    });
  });

  describe("token", () => {
    const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
    test("initial token does not exist", () => {
      expect(device.token).toBeNull();
    });
    test("token stored", () => {
      expect(device.tokenChanged).toBe(false);
      device.token = Buffer.from("my-token");
      expect(device.tokenChanged).toBe(true);
      expect(device.token.toString("utf8")).toBe("my-token");
    });
  });

  xdescribe("enrich");
});
