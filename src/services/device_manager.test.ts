import "./device_manager.test.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { createHomebridgeMock, miio } from "../test.mocks";
import { DeviceManager } from "./device_manager";

describe("DeviceManager", () => {
  const log = getLoggerMock();

  describe("constructor", () => {
    test("Fails if no IP provided", () => {
      expect(
        () => new DeviceManager(createHomebridgeMock().hap, log, {})
      ).toThrowError("You must provide an ip address of the vacuum cleaner.");
    });

    test("Fails if no token provided", () => {
      expect(
        () =>
          new DeviceManager(createHomebridgeMock().hap, log, {
            ip: "192.168.0.1",
          })
      ).toThrowError("You must provide a token of the vacuum cleaner.");
    });

    test("Does not fail if ip and token are provided (but fails to connects)", () => {
      expect(
        () =>
          new DeviceManager(createHomebridgeMock().hap, log, {
            ip: "192.168.0.1",
            token: "token",
          })
      ).not.toThrow();
    });
  });

  describe("get device", () => {
    test("fails when not connected yet", () => {
      const deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      expect(deviceManager.model).toStrictEqual("unknown model");
      expect(() => deviceManager.state).toThrowError("Not connected yet");
      expect(() => deviceManager.isCleaning).toThrowError("Not connected yet");
      expect(() => deviceManager.isPaused).toThrowError("Not connected yet");
    });

    test("connects and loads", async () => {
      miio.device.matches.mockReturnValue(true);
      miio.device.property.mockReturnValue("cleaning");
      const deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      await new Promise((resolve) => process.nextTick(resolve));
      expect(deviceManager.model).toStrictEqual("test-model");
      expect(deviceManager.device).toStrictEqual(miio.device);
      expect(deviceManager.state).toStrictEqual("cleaning");
      expect(deviceManager.isCleaning).toStrictEqual(true);
      expect(deviceManager.isPaused).toStrictEqual(false);
    });
  });
});
