"use strict";

const loggerMock = jest.fn();
const debugMock = jest.fn().mockImplementation((label) => {
  return loggerMock;
});

jest.doMock("debug", () => debugMock);

function createParentMock() {
  return {
    socket: {
      send: jest
        .fn()
        .mockImplementation((data, size, length, port, address, cb) => {
          cb();
        }),
    },
  };
}

const DeviceInfo = require("./device_info");
const Packet = require("./packet");

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
  });

  describe("handshake", () => {
    test("happy-path: runs the handshake", async () => {
      const packet = new Packet(false);
      const parent = createParentMock();
      const device = new DeviceInfo(parent, "MY-ID", "localhost", 1234);
      device.token = "TOKEN";
      packet.token = "TOKEN";
      parent.socket.send.mockImplementation(
        (data, size, length, port, address, cb) => {
          cb();
          packet.data = null;
          device.onMessage(packet.raw);
        }
      );
      const token = await device.handshake();
      expect(token.toString()).toBe("TOKEN");
      // Second call is not triggered
      const token2 = await device.handshake();
      expect(token2.toString()).toBe("TOKEN");
    });

    test("fails because 'missing-token'", async () => {
      const packet = new Packet(false);
      const parent = createParentMock();
      const device = new DeviceInfo(parent, "MY-ID", "localhost", 1234);
      packet.token = "TOKEN";
      parent.socket.send.mockImplementation(
        (data, size, length, port, address, cb) => {
          cb();
          packet.data = null;
          device.onMessage(packet.raw);
        }
      );
      await expect(device.handshake()).rejects.toThrow(
        "Could not connect to device, token needs to be specified"
      );
    });

    test("fails because to send the handshake request", async () => {
      const packet = new Packet(false);
      const parent = createParentMock();
      const device = new DeviceInfo(parent, "MY-ID", "localhost", 1234);
      packet.token = "TOKEN";
      parent.socket.send.mockImplementation(
        (data, size, length, port, address, cb) => {
          cb(new Error("Something went terribly wrong"));
        }
      );
      await expect(device.handshake()).rejects.toThrow(
        "Something went terribly wrong"
      );
    });

    test("timesout after 2 secs", async () => {
      const parent = createParentMock();
      const device = new DeviceInfo(parent, "MY-ID", "localhost", 1234);
      device.token = "TOKEN";
      await expect(device.handshake()).rejects.toThrow(
        "Could not connect to device, handshake timeout"
      );
    });
  });

  describe("onMessage", () => {
    test("swallows error to parse the message", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      expect(device.onMessage("test")).toBeUndefined();
    });

    test("handshake message but no handler", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      const packet = new Packet();
      device.token = "TOKEN";
      packet.token = "TOKEN";
      packet.data = null;
      expect(device.onMessage(packet.raw)).toBeUndefined();
    });

    test("swallows error because data is not a valid JSON", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      const packet = new Packet();
      device.token = "TOKEN";
      packet.token = "TOKEN";
      packet.data = Buffer.from("test").fill(0);
      expect(device.onMessage(packet.raw)).toBeUndefined();
    });

    test("does not call the promise resolvers because there's none", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      const packet = new Packet();
      device.token = "TOKEN";
      packet.token = "TOKEN";
      const response = { id: "1", result: "something" };
      packet.data = Buffer.from(JSON.stringify(response));
      expect(device.onMessage(packet.raw)).toBeUndefined();
    });

    test("calls the promise resolver when there's a result", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      const packet = new Packet();
      device.token = "TOKEN";
      packet.token = "TOKEN";
      const response = { id: "1", result: "something" };
      const promiseResolvers = { resolve: jest.fn(), reject: jest.fn() };
      device.promises.set("1", promiseResolvers);
      packet.data = Buffer.from(JSON.stringify(response));
      expect(device.onMessage(packet.raw)).toBeUndefined();
      expect(promiseResolvers.resolve).toHaveBeenCalledWith("something");
    });

    test("calls the promise resolver's reject when there's an error", async () => {
      const device = new DeviceInfo({}, "MY-ID", "localhost", 1234);
      const packet = new Packet();
      device.token = "TOKEN";
      packet.token = "TOKEN";
      const response = { id: "1", error: "something" };
      const promiseResolvers = { resolve: jest.fn(), reject: jest.fn() };
      device.promises.set("1", promiseResolvers);
      packet.data = Buffer.from(JSON.stringify(response));
      expect(device.onMessage(packet.raw)).toBeUndefined();
      expect(promiseResolvers.reject).toHaveBeenCalledWith("something");
    });
  });

  // TODO: Keep adding use cases
});
