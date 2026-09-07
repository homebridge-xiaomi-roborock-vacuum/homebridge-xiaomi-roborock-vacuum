import "./device_manager.test.mock";
import { getLoggerMock } from "../utils/logger.mock";
import { createHomebridgeMock, miio } from "../test.mocks";
import { DeviceManager } from "./device_manager";

describe("DeviceManager", () => {
  const log = getLoggerMock();

  beforeEach(() => {
    jest.clearAllMocks();
    miio.device.matches.mockReturnValue(false);
    miio.device.property.mockReturnValue(undefined);
    miio.device.poll.mockResolvedValue(undefined);
    miio.device.state.mockResolvedValue({});
  });

  describe("constructor", () => {
    test("Fails if no IP provided", () => {
      expect(
        () => new DeviceManager(createHomebridgeMock().hap, log, {})
      ).toThrow("You must provide an ip address of the vacuum cleaner.");
    });

    test("Fails if no token provided", () => {
      expect(
        () =>
          new DeviceManager(createHomebridgeMock().hap, log, {
            ip: "192.168.0.1",
          })
      ).toThrow("You must provide a token of the vacuum cleaner.");
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
    afterEach(() => {
      jest.useRealTimers();
    });

    test("fails when not connected yet", () => {
      const deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      expect(deviceManager.model).toStrictEqual("unknown model");
      expect(() => deviceManager.state).toThrow("Not connected yet");
      expect(() => deviceManager.isCleaning).toThrow("Not connected yet");
      expect(() => deviceManager.isPaused).toThrow("Not connected yet");
    });

    test("connects and loads", async () => {
      jest.useFakeTimers();
      miio.device.matches.mockReturnValue(true);
      miio.device.property.mockReturnValue("cleaning");
      const deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(deviceManager.model).toStrictEqual("test-model");
      expect(deviceManager.device).toStrictEqual(miio.device);
      expect(deviceManager.state).toStrictEqual("cleaning");
      expect(deviceManager.isCleaning).toStrictEqual(true);
      expect(deviceManager.isPaused).toStrictEqual(false);
    });
  });

  describe("state polling", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      miio.device.matches.mockReturnValue(true);
      miio.device.property.mockReturnValue("charging");
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const createConnectedDeviceManager = async () => {
      const deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      await Promise.resolve();
      await Promise.resolve();
      return deviceManager;
    };

    test("refreshes the device state every 30 seconds", async () => {
      await createConnectedDeviceManager();

      await jest.advanceTimersByTimeAsync(0);
      expect(miio.device.poll).toHaveBeenCalledTimes(1);
      expect(miio.device.state).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(29999);
      expect(miio.device.poll).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(miio.device.poll).toHaveBeenCalledTimes(2);
      expect(miio.device.state).toHaveBeenCalledTimes(2);
    });

    test("does not start another refresh while one is still running", async () => {
      let completePoll: (() => void) | undefined;
      miio.device.poll.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            completePoll = resolve;
          })
      );
      await createConnectedDeviceManager();

      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
      expect(miio.device.poll).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(90000);
      await Promise.resolve();
      expect(miio.device.poll).toHaveBeenCalledTimes(1);

      completePoll?.();
      await Promise.resolve();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(30000);
      expect(miio.device.poll).toHaveBeenCalledTimes(2);
    });

    test("replaces the polling timer when the device reconnects", async () => {
      const deviceManager = await createConnectedDeviceManager();
      await jest.advanceTimersByTimeAsync(0);

      await (
        deviceManager as unknown as { initializeDevice: () => Promise<void> }
      ).initializeDevice();
      await jest.advanceTimersByTimeAsync(0);
      expect(miio.device.poll).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(30000);
      expect(miio.device.poll).toHaveBeenCalledTimes(3);
    });
  });
});
