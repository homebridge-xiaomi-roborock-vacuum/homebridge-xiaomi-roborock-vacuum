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
const roborock = { getCloudMap: jest.fn() };
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
  const log = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };
  const cloud = {
    getDevices: jest.fn(async () => options.devices ?? [cloudDevice({})]),
    getMapFileUrl: jest.fn(),
    download: jest.fn(),
  };
  const watcher = new EventEmitter() as unknown as MapWatcher;
  const deps = {
    loadSession: jest.fn(async () =>
      "session" in options ? options.session : session
    ),
    createCloud: jest.fn(() => cloud),
    createWatcher: jest.fn(() => watcher),
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
});
