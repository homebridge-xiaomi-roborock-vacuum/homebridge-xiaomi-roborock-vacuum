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
      ).toThrow("You must provide an ip address of the vacuum cleaner");
    });

    test("Fails if no token provided", () => {
      expect(
        () =>
          new DeviceManager(createHomebridgeMock().hap, log, {
            ip: "192.168.0.1",
          })
      ).toThrow("You must provide a token of the vacuum cleaner");
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

  describe("node-miio logger", () => {
    test("passes the plugin's logger to node-miio", async () => {
      const nodeMiio = jest.requireMock("node-miio");
      new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      await new Promise(process.nextTick);
      expect(nodeMiio.device).toHaveBeenCalledWith({
        address: "192.168.0.1",
        token: "token",
        logger: { debug: expect.any(Function) },
      });
      expect(nodeMiio.configureLogging).toHaveBeenCalledWith({
        logger: { debug: expect.any(Function) },
      });

      const [{ logger }] = nodeMiio.device.mock.calls[0];
      logger.debug("[thing:miio:1234] <- Message");
      expect(log.debug).toHaveBeenCalledWith("[thing:miio:1234] <- Message");
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

  describe("reported modes", () => {
    afterEach(() => {
      delete (miio.device as Partial<typeof miio.device>).fanSpeeds;
      delete (miio.device as Partial<typeof miio.device>).waterBoxModes;
      jest.useRealTimers();
    });

    const connect = async () => {
      jest.useFakeTimers();
      miio.device.matches.mockReturnValue(true);
      const deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      await jest.advanceTimersByTimeAsync(0);
      return deviceManager;
    };

    test("loads the fan speeds and water levels from node-miio", async () => {
      const fanSpeeds = [{ value: 1, name: "Quiet" }];
      const waterBoxModes = [{ value: 200, name: "Off" }];
      miio.device.fanSpeeds = jest.fn().mockResolvedValue(fanSpeeds);
      miio.device.waterBoxModes = jest.fn().mockResolvedValue(waterBoxModes);
      const deviceManager = await connect();
      expect(deviceManager.reportedModes).toStrictEqual({
        fanSpeeds,
        waterBoxModes,
      });
    });

    test("is undefined when node-miio fails", async () => {
      miio.device.fanSpeeds = jest.fn().mockRejectedValue(new Error("timeout"));
      const deviceManager = await connect();
      expect(deviceManager.device).toBe(miio.device);
      expect(deviceManager.reportedModes).toBeUndefined();
    });

    test("is undefined with older node-miio versions", async () => {
      const deviceManager = await connect();
      expect(deviceManager.reportedModes).toBeUndefined();
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

    test("errorChanged$ emits the changes of the robot's error, every time (not only the first one)", async () => {
      const brush = { id: 5, description: "Main brush blocked" };
      // The state of each poll: the same error is reported on every poll while it lasts
      for (const error of [
        brush,
        { ...brush }, // the same error again
        null,
        null,
        { ...brush }, // the same error, after it was cleared
        null,
        { id: 8, description: "Device stuck" },
      ]) {
        miio.device.state.mockResolvedValueOnce({ error } as never);
      }
      const deviceManager = await createConnectedDeviceManager();
      const errors: unknown[] = [];
      deviceManager.errorChanged$.subscribe((error) =>
        errors.push(error === null ? null : (error as { id: number }).id)
      );
      for (let poll = 0; poll < 7; poll++) {
        await jest.advanceTimersByTimeAsync(poll === 0 ? 0 : 30000);
      }
      expect(errors).toStrictEqual([5, null, 5, null, 8]);
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

  describe("finding the robot again (Xiaomi Cloud)", () => {
    const nodeMiio = jest.requireMock("node-miio");

    beforeEach(() => {
      jest.useFakeTimers();
      miio.device.matches.mockReturnValue(true);
      miio.device.property.mockReturnValue("charging");
    });

    afterEach(() => {
      jest.useRealTimers();
      nodeMiio.device.mockImplementation(() => miio.device);
    });

    const addresses = () =>
      nodeMiio.device.mock.calls.map(
        ([options]: [{ address: string; token: string }]) =>
          `${options.address}/${options.token}`
      );

    test("when it can't connect, it asks where the robot is, and connects there right away", async () => {
      nodeMiio.device.mockRejectedValueOnce(new Error("timeout"));
      const locate = jest
        .fn()
        .mockResolvedValue({ ip: "192.168.0.7", token: "new-token" });
      new DeviceManager(
        createHomebridgeMock().hap,
        log,
        { ip: "192.168.0.1", token: "token" },
        locate
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(locate).toHaveBeenCalledWith({
        ip: "192.168.0.1",
        token: "token",
      });
      expect(addresses()).toEqual([
        "192.168.0.1/token",
        "192.168.0.7/new-token",
      ]);
      expect(log.info).toHaveBeenCalledWith(
        "INF relocate | The robot's IP changed from 192.168.0.1 to 192.168.0.7"
      );
      expect(log.info).toHaveBeenCalledWith(
        "INF relocate | The robot has a new token"
      );
    });

    test("an unplugged robot (same location) is retried every 2 minutes, asking the cloud at most every 10 minutes", async () => {
      nodeMiio.device.mockRejectedValue(new Error("timeout"));
      const locate = jest
        .fn()
        .mockResolvedValue({ ip: "192.168.0.1", token: "token" });
      new DeviceManager(
        createHomebridgeMock().hap,
        log,
        { ip: "192.168.0.1", token: "token" },
        locate
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(nodeMiio.device).toHaveBeenCalledTimes(1);
      expect(locate).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(120000);
      expect(nodeMiio.device).toHaveBeenCalledTimes(2);
      expect(locate).toHaveBeenCalledTimes(1);

      // 18 minutes: 8 more retries, and the cloud asked again after 10 minutes
      await jest.advanceTimersByTimeAsync(8 * 120000);
      expect(nodeMiio.device).toHaveBeenCalledTimes(10);
      expect(locate).toHaveBeenCalledTimes(2);
    });

    test("when it stops answering, it reconnects at the robot's new IP", async () => {
      const locate = jest
        .fn()
        .mockResolvedValue({ ip: "192.168.0.7", token: "token" });
      new DeviceManager(
        createHomebridgeMock().hap,
        log,
        { ip: "192.168.0.1", token: "token" },
        locate
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(addresses()).toEqual(["192.168.0.1/token"]);

      miio.device.poll.mockRejectedValue(new Error("timeout"));
      await jest.advanceTimersByTimeAsync(30000);
      await jest.advanceTimersByTimeAsync(30000);
      expect(locate).not.toHaveBeenCalled();

      // The 3rd failure in a row
      await jest.advanceTimersByTimeAsync(30000);
      expect(locate).toHaveBeenCalledTimes(1);
      expect(miio.device.destroy).toHaveBeenCalled();
      expect(addresses()).toEqual(["192.168.0.1/token", "192.168.0.7/token"]);
      miio.device.poll.mockResolvedValue(undefined);
    });

    test("without the cloud, it keeps retrying the configured IP", async () => {
      nodeMiio.device.mockRejectedValueOnce(new Error("timeout"));
      new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(nodeMiio.device).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(120000);
      expect(addresses()).toEqual(["192.168.0.1/token", "192.168.0.1/token"]);
    });
  });
});
