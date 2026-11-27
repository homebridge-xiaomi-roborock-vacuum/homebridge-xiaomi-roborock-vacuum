import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import "./device_manager.test.mock";
import * as miioModule from "node-miio";
import { getLoggerMock } from "../utils/logger.mock";
import { createHomebridgeMock, miio } from "../test.mocks";
import { DeviceManager } from "./device_manager";

/** The `node-miio` module, as `device_manager.test.mock.ts` mocks it */
type MiioModuleMock = Awaited<ReturnType<typeof miio.createMock>>;

describe("DeviceManager", () => {
  const log = getLoggerMock();

  beforeEach(() => {
    vi.clearAllMocks();
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
      const nodeMiio = miioModule as unknown as MiioModuleMock;
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
      vi.useRealTimers();
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
      vi.useFakeTimers();
      miio.device.matches.mockReturnValue(true);
      miio.device.property.mockReturnValue("cleaning");
      const deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      await vi.advanceTimersByTimeAsync(0);
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
      vi.useRealTimers();
    });

    const connect = async () => {
      vi.useFakeTimers();
      miio.device.matches.mockReturnValue(true);
      const deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
        ip: "192.168.0.1",
        token: "token",
      });
      await vi.advanceTimersByTimeAsync(0);
      return deviceManager;
    };

    test("loads the fan speeds and water levels from node-miio", async () => {
      const fanSpeeds = [{ value: 1, name: "Quiet" }];
      const waterBoxModes = [{ value: 200, name: "Off" }];
      miio.device.fanSpeeds = vi.fn().mockResolvedValue(fanSpeeds);
      const presets = [
        { name: "SmartPlan", fanSpeed: 110, waterBoxMode: 209, mopRoute: 306 },
      ];
      miio.device.cleanPresets.mockResolvedValue(presets);
      miio.device.waterBoxModes = vi.fn().mockResolvedValue(waterBoxModes);
      const deviceManager = await connect();
      expect(deviceManager.reportedModes).toStrictEqual({
        fanSpeeds,
        waterBoxModes,
        presets,
      });
    });

    test("is undefined when node-miio fails", async () => {
      miio.device.fanSpeeds = vi.fn().mockRejectedValue(new Error("timeout"));
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
      vi.useFakeTimers();
      miio.device.matches.mockReturnValue(true);
      miio.device.property.mockReturnValue("charging");
    });

    afterEach(() => {
      vi.useRealTimers();
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

      await vi.advanceTimersByTimeAsync(0);
      expect(miio.device.poll).toHaveBeenCalledTimes(1);
      expect(miio.device.state).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(29999);
      expect(miio.device.poll).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
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

      vi.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
      expect(miio.device.poll).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(90000);
      await Promise.resolve();
      expect(miio.device.poll).toHaveBeenCalledTimes(1);

      completePoll?.();
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30000);
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
        await vi.advanceTimersByTimeAsync(poll === 0 ? 0 : 30000);
      }
      expect(errors).toStrictEqual([5, null, 5, null, 8]);
    });

    test("warns once about each status node-miio can't translate, with a link to report it", async () => {
      const describeStatus = vi.fn().mockReturnValue("New Station Mode");
      Object.assign(miio.device, { describeStatus });
      try {
        await createConnectedDeviceManager();
        const onStateChanged = miio.device.on.mock.calls.find(
          ([event]) => event === "stateChanged"
        )?.[1] as (change: { key: string; value: unknown }) => void;
        onStateChanged({ key: "state", value: "unknown-31" });
        onStateChanged({ key: "state", value: "charging" });
        onStateChanged({ key: "state", value: "unknown-31" });
        onStateChanged({ key: "batteryLevel", value: "unknown-5" });

        expect(describeStatus).toHaveBeenCalledWith(31);
        expect(log.warn).toHaveBeenCalledTimes(1);
        const message = log.warn.mock.calls[0][0] as string;
        expect(message).toContain(
          `doesn't know: 31 ("New Station Mode"). Please report it`
        );
        const url = new URL(message.slice(message.indexOf("https://")));
        expect(url.pathname).toBe(
          "/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/new"
        );
        expect(Object.fromEntries(url.searchParams)).toStrictEqual({
          template: "bug_report.yml",
          title: `Unknown status 31 ("New Station Mode") on test-model`,
          model: "test-model",
          version: expect.stringMatching(/^\d+\.\d+\.\d+/),
          description: expect.stringContaining(
            "What was the robot doing when it reported it"
          ),
        });
      } finally {
        delete (miio.device as { describeStatus?: unknown }).describeStatus;
      }
    });

    test("replaces the polling timer when the device reconnects", async () => {
      const deviceManager = await createConnectedDeviceManager();
      await vi.advanceTimersByTimeAsync(0);

      await (
        deviceManager as unknown as { initializeDevice: () => Promise<void> }
      ).initializeDevice();
      await vi.advanceTimersByTimeAsync(0);
      expect(miio.device.poll).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(30000);
      expect(miio.device.poll).toHaveBeenCalledTimes(3);
    });
  });

  describe("finding the robot again (Xiaomi Cloud)", () => {
    const nodeMiio = miioModule as unknown as MiioModuleMock;

    beforeEach(() => {
      vi.useFakeTimers();
      miio.device.matches.mockReturnValue(true);
      miio.device.property.mockReturnValue("charging");
    });

    afterEach(() => {
      vi.useRealTimers();
      nodeMiio.device.mockImplementation(() => miio.device);
    });

    const addresses = () =>
      nodeMiio.device.mock.calls.map(
        ([options]: { address: string; token: string }[]) =>
          `${options.address}/${options.token}`
      );

    test("when it can't connect, it asks where the robot is, and connects there right away", async () => {
      nodeMiio.device.mockRejectedValueOnce(new Error("timeout"));
      const locate = vi
        .fn()
        .mockResolvedValue({ ip: "192.168.0.7", token: "new-token" });
      new DeviceManager(
        createHomebridgeMock().hap,
        log,
        { ip: "192.168.0.1", token: "token" },
        locate
      );
      await vi.advanceTimersByTimeAsync(0);
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
      const locate = vi
        .fn()
        .mockResolvedValue({ ip: "192.168.0.1", token: "token" });
      new DeviceManager(
        createHomebridgeMock().hap,
        log,
        { ip: "192.168.0.1", token: "token" },
        locate
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(nodeMiio.device).toHaveBeenCalledTimes(1);
      expect(locate).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(120000);
      expect(nodeMiio.device).toHaveBeenCalledTimes(2);
      expect(locate).toHaveBeenCalledTimes(1);

      // 18 minutes: 8 more retries, and the cloud asked again after 10 minutes
      await vi.advanceTimersByTimeAsync(8 * 120000);
      expect(nodeMiio.device).toHaveBeenCalledTimes(10);
      expect(locate).toHaveBeenCalledTimes(2);
    });

    test("when it stops answering, it reconnects at the robot's new IP", async () => {
      const locate = vi
        .fn()
        .mockResolvedValue({ ip: "192.168.0.7", token: "token" });
      new DeviceManager(
        createHomebridgeMock().hap,
        log,
        { ip: "192.168.0.1", token: "token" },
        locate
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(addresses()).toEqual(["192.168.0.1/token"]);

      miio.device.poll.mockRejectedValue(new Error("timeout"));
      await vi.advanceTimersByTimeAsync(30000);
      await vi.advanceTimersByTimeAsync(30000);
      expect(locate).not.toHaveBeenCalled();

      // The 3rd failure in a row
      await vi.advanceTimersByTimeAsync(30000);
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
      await vi.advanceTimersByTimeAsync(0);
      expect(nodeMiio.device).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(120000);
      expect(addresses()).toEqual(["192.168.0.1/token", "192.168.0.1/token"]);
    });
  });
});

describe("DeviceManager with a connector (Roborock app)", () => {
  const log = getLoggerMock();

  beforeEach(() => {
    vi.clearAllMocks();
    miio.device.matches.mockReturnValue(true);
    miio.device.property.mockReturnValue(undefined);
    miio.device.poll.mockResolvedValue(undefined);
    miio.device.state.mockResolvedValue({});
  });

  test("connects with it: no IP nor token needed, room names kept", async () => {
    const nodeMiio = miioModule as unknown as MiioModuleMock;
    nodeMiio.roborockApiOf.mockReturnValue({ address: "192.168.86.26" });
    const connector = vi.fn().mockResolvedValue({
      device: miio.device,
      roomNames: new Map([["50625967", "Cocina"]]),
    });
    const manager = new DeviceManager(
      createHomebridgeMock().hap,
      log,
      { duid: "k6Al" },
      undefined,
      connector
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(connector).toHaveBeenCalledWith({ debug: expect.any(Function) });
    expect(nodeMiio.device).not.toHaveBeenCalled();
    expect(manager.device).toBe(miio.device);
    expect(manager.roomName("50625967")).toBe("Cocina");
    expect(manager.roomName(50625967)).toBe("Cocina");
    expect(manager.roomName("1")).toBeUndefined();
    expect(log.info).toHaveBeenCalledWith(
      "STA getDevice | Connected to: %s",
      "192.168.86.26"
    );
    nodeMiio.roborockApiOf.mockReturnValue(undefined);
  });
});

describe("DeviceManager with a connector: failures", () => {
  const log = getLoggerMock();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("the robot isn't found: logged, and retried later", async () => {
    const connector = vi.fn().mockResolvedValue(undefined);
    new DeviceManager(
      createHomebridgeMock().hap,
      log,
      { duid: "nope" },
      undefined,
      connector
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("The robot couldn't be found")
    );
  });

  test("not a vacuum: reported and released", async () => {
    const other = { miioModel: "roborock.lawnmower.x", destroy: vi.fn() };
    const connector = vi.fn().mockResolvedValue({ device: other });
    new DeviceManager(
      createHomebridgeMock().hap,
      log,
      { duid: "mower" },
      undefined,
      connector
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Device "roborock.lawnmower.x" is not registered as a vacuum cleaner!'
      )
    );
    expect(other.destroy).toHaveBeenCalled();
  });
});
