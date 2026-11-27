import { describe, test, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import {
  CloudSessionExpiredError,
  type CloudDevice,
  type MapWatcher,
} from "node-miio";
import { CloudService, type CloudServiceDeps } from "./cloud_service";

const session = {
  userId: "1",
  ssecurity: "ssecurity",
  serviceToken: "token",
};
const roborock = { getCloudMap: vi.fn() };
const cloudDevice = (overrides: Partial<CloudDevice>) =>
  ({
    did: "1",
    name: "Robot",
    model: "roborock.vacuum.s5",
    token: "abc",
    localip: "192.168.1.2",
    server: "de",
    ...overrides,
  }) as CloudDevice;

function setup(
  options: {
    session?: typeof session | undefined;
    devices?: CloudDevice[];
    server?: string;
  } = {}
) {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const cloud = {
    getDevices: vi.fn(async () => options.devices ?? [cloudDevice({})]),
    getMapFileUrl: vi.fn(),
    download: vi.fn(),
    runScene: vi.fn(),
  };
  const watcher = new EventEmitter() as unknown as MapWatcher;
  const deps = {
    loadSession: vi.fn(async () =>
      "session" in options ? options.session : session
    ),
    createCloud: vi.fn(() => cloud),
    createWatcher: vi.fn(() => watcher),
  };
  const service = new CloudService(
    log,
    { enabled: true, server: options.server, sessionFile: "/miio.json" },
    deps as unknown as CloudServiceDeps
  );
  return { log, cloud, watcher, deps, service };
}

describe("CloudService", () => {
  test("finds the robot by token (case-insensitive) and watches its map in its server", async () => {
    const { service, deps, cloud } = setup({
      devices: [
        cloudDevice({ token: "other", server: "us" }),
        cloudDevice({ token: "ABC", server: "sg" }),
      ],
    });
    await expect(
      service.createMapWatcher(roborock, { ip: "10.0.0.1", token: "abc" })
    ).resolves.toBeDefined();
    expect(deps.loadSession).toHaveBeenCalledWith("/miio.json");
    expect(deps.createWatcher).toHaveBeenCalledWith(roborock, cloud, "sg");
  });

  test("falls back to the IP, and lists the devices only once for all the robots", async () => {
    const { service, deps, cloud } = setup({
      devices: [
        cloudDevice({ token: "other", localip: "10.0.0.1", server: "us" }),
      ],
    });
    await service.createMapWatcher(roborock, { ip: "10.0.0.1", token: "a" });
    await service.createMapWatcher(roborock, { ip: "10.0.0.1", token: "b" });
    expect(deps.createWatcher).toHaveBeenNthCalledWith(
      1,
      roborock,
      cloud,
      "us"
    );
    expect(deps.createWatcher).toHaveBeenCalledTimes(2);
    expect(cloud.getDevices).toHaveBeenCalledTimes(1);
    expect(deps.loadSession).toHaveBeenCalledTimes(1);
  });

  test("uses the configured server without listing the devices", async () => {
    const { service, deps, cloud } = setup({ server: "de" });
    await service.createMapWatcher(roborock, { ip: "10.0.0.1" });
    expect(cloud.getDevices).not.toHaveBeenCalled();
    expect(deps.createWatcher).toHaveBeenCalledWith(roborock, cloud, "de");
  });

  test("robots without a cloud map are skipped", async () => {
    const { service, deps, log } = setup();
    await expect(
      service.createMapWatcher({}, { ip: "10.0.0.1" })
    ).resolves.toBeUndefined();
    expect(deps.loadSession).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("does not support the cloud map")
    );
  });

  test("without a saved session, it explains how to log in", async () => {
    const { service, deps, log } = setup({ session: undefined });
    await expect(
      service.createMapWatcher(roborock, { ip: "10.0.0.1" })
    ).resolves.toBeUndefined();
    expect(deps.createWatcher).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("npx node-miio cloud login --qr")
    );
  });

  test("a robot that's not in the account is skipped", async () => {
    const { service, deps, log } = setup({ devices: [] });
    await expect(
      service.createMapWatcher(roborock, { ip: "10.0.0.1", token: "abc" })
    ).resolves.toBeUndefined();
    expect(deps.createWatcher).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("is not in your Xiaomi account")
    );
  });

  test("an expired session is reported once; other failures only in the debug logs", async () => {
    const { service, watcher, log, cloud } = setup();
    cloud.getDevices.mockRejectedValueOnce(new CloudSessionExpiredError());
    await expect(
      service.createMapWatcher(roborock, { token: "abc" })
    ).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledTimes(1);

    // The device list is requested again after a failure
    await service.createMapWatcher(roborock, { token: "abc" });
    watcher.emit("failed", new CloudSessionExpiredError());
    watcher.emit("failed", new Error("network"));
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("the session expired")
    );
    expect(log.debug).toHaveBeenCalledWith(expect.stringContaining("network"));
  });

  describe("locate", () => {
    const devices = [
      cloudDevice({ did: "1", localip: "10.0.0.1", token: "tok1" }),
      cloudDevice({ did: "2", localip: "10.0.0.2", token: "tok2" }),
    ];

    test("finds a robot by its IP, listing the devices once for all the robots", async () => {
      const { service, cloud, log } = setup({ devices });
      await expect(service.locate({ ip: "10.0.0.1" })).resolves.toEqual({
        ip: "10.0.0.1",
        token: "tok1",
      });
      await expect(service.locate({ ip: "10.0.0.2" })).resolves.toEqual({
        ip: "10.0.0.2",
        token: "tok2",
      });
      expect(cloud.getDevices).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(
        'Xiaomi Cloud: found "Robot" (did 1) at 10.0.0.1.'
      );
    });

    test("the did wins over the IP", async () => {
      const { service, log } = setup({ devices });
      await expect(
        service.locate({ did: "2", ip: "10.0.0.1" })
      ).resolves.toEqual({ ip: "10.0.0.2", token: "tok2" });
      expect(log.info).toHaveBeenCalledWith(
        'Xiaomi Cloud: found "Robot" (did 2) at 10.0.0.2.'
      );
    });

    test("fresh: lists the devices again, e.g. to find a robot's new IP by its token", async () => {
      const { service, cloud, log } = setup({ devices });
      await service.locate({ ip: "10.0.0.1" });
      cloud.getDevices.mockResolvedValueOnce([
        cloudDevice({ did: "1", localip: "10.0.0.7", token: "tok1" }),
      ]);
      await expect(
        service.locate({ ip: "10.0.0.1", token: "tok1" }, { fresh: true })
      ).resolves.toEqual({ ip: "10.0.0.7", token: "tok1" });
      expect(cloud.getDevices).toHaveBeenCalledTimes(2);
      expect(log.info).toHaveBeenCalledTimes(1);
    });

    test("lists only the configured server", async () => {
      const { service, cloud } = setup({ server: "sg", devices });
      await service.locate({ ip: "10.0.0.1" });
      expect(cloud.getDevices).toHaveBeenCalledWith({ servers: ["sg"] });
    });

    test("a robot that's not in the account isn't found (a warning, or a debug log when fresh)", async () => {
      const { service, log } = setup({ devices });
      await expect(service.locate({ did: "9" })).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('no robot "9" in your Xiaomi account')
      );
      await expect(
        service.locate({ ip: "10.0.0.9" }, { fresh: true })
      ).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining("no robot at 10.0.0.9")
      );
    });

    test("a robot without an IP (offline) isn't found", async () => {
      const { service, log } = setup({
        devices: [cloudDevice({ did: "1", localip: "" })],
      });
      await expect(service.locate({ did: "1" })).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("has no IP or token")
      );
    });

    test("without a saved session, it explains how to log in", async () => {
      const { service, log } = setup({ session: undefined });
      await expect(service.locate({ ip: "10.0.0.1" })).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("npx node-miio cloud login --qr")
      );
    });

    test("a failure to list the devices is reported, and retried for the next robot", async () => {
      const { service, cloud, log } = setup({ devices });
      cloud.getDevices.mockRejectedValueOnce(new Error("network"));
      await expect(service.locate({ ip: "10.0.0.1" })).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "failed to list the devices of your Xiaomi account: Error: network"
        )
      );
      await expect(service.locate({ ip: "10.0.0.1" })).resolves.toEqual({
        ip: "10.0.0.1",
        token: "tok1",
      });
    });
  });

  describe("runScene", () => {
    test("runs it in the robot's server", async () => {
      const { service, cloud } = setup({
        devices: [cloudDevice({ did: "7", server: "sg" })],
      });
      await service.runScene("2075", { did: "7" });
      expect(cloud.runScene).toHaveBeenCalledWith("sg", "2075");
    });

    test("the configured server is used as is", async () => {
      const { service, cloud } = setup({ server: "de" });
      await service.runScene("2075", { did: "404" });
      expect(cloud.runScene).toHaveBeenCalledWith("de", "2075");
      expect(cloud.getDevices).not.toHaveBeenCalled();
    });

    test("fails without a session, or when the robot isn't in the account", async () => {
      await expect(
        setup({ session: undefined }).service.runScene("1", { did: "1" })
      ).rejects.toThrow("the account isn't available");
      await expect(
        setup().service.runScene("1", { did: "404" })
      ).rejects.toThrow("the robot is not in your Xiaomi account");
    });
  });
});
