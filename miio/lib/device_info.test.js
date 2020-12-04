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

  describe("enrich", () => {
    // const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
    test("fails if the id is not populated yet", async () => {
      const device = new DeviceInfo({}, null, "localhost", 1234);
      await expect(device.enrich()).rejects.toThrow(
        "Device has no identifier yet, handshake needed"
      );
    });

    test("returns undefined because everything is properly initialised already", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      device.token = "TOKEN";
      device.tokenChanged = false;
      device.model = {};
      await expect(device.enrich()).resolves.toBeUndefined();
    });

    test("happy path", async () => {
      const model = { test: 1 };
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      device.token = "TOKEN";
      device.call = jest.fn().mockImplementation(async () => ({ model }));
      await expect(device.enrich()).resolves.toBeUndefined();
      expect(device.tokenChanged).toBe(false);
      expect(device.model).toBe(model);
      expect(device.enriched).toBe(true);
      expect(device.enrichPromise).toBeNull();
    });

    test("errors with 'missing-token'", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      device.token = "TOKEN";
      device.enrichPromise = Promise.reject({ code: "missing-token" });
      await expect(device.enrich()).rejects.toStrictEqual({
        code: "missing-token",
        device,
      });
      expect(device.tokenChanged).toBe(true);
      expect(device.enriched).toBe(true);
      expect(device.enrichPromise).toBeNull();
    });

    test("errors with 'connection-failure'", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      device.token = "TOKEN";
      device.tokenChanged = false;
      device.enrichPromise = Promise.reject("Something went terribly wrong");
      await expect(device.enrich()).rejects.toThrow(
        "Could not connect to device, token might be wrong"
      );
      expect(device.tokenChanged).toBe(false);
      expect(device.enriched).toBe(true);
      expect(device.enrichPromise).toBeNull();
    });

    test("errors with 'missing-token' custom", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      device.enrichPromise = Promise.reject("Something went terribly wrong");
      await expect(device.enrich()).rejects.toThrow(
        "Could not connect to device, token needs to be specified"
      );
      expect(device.tokenChanged).toBe(false);
      expect(device.enriched).toBe(true);
      expect(device.enrichPromise).toBeNull();
    });

    // TODO: Keep adding use cases
  });
});
