import {
  CloudDeviceCache,
  CloudSessionExpiredError,
  loadSession,
  MapWatcher,
  XiaomiCloud,
  type CloudDeviceMatch,
  type CloudServer,
  type CloudSession,
  type MapWatcherDevice,
} from "node-miio";

/** The `cloud` section of the platform config */
export interface CloudConfig {
  /**
   * Use the Xiaomi Cloud: to get the robots' tokens (so only their IP is needed), and to know which room the robot is
   * cleaning (Roborock only). Off by default.
   */
  enabled?: boolean;
  /** The session saved by `npx node-miio cloud login` (defaults to node-miio's config directory) */
  sessionFile?: string;
  /** The server the robots are registered in (`de`, `us`, `cn`…). Found automatically when missing. */
  server?: string;
}

/** The logger methods used by the service */
export interface CloudLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
}

type Cloud = Pick<
  XiaomiCloud,
  "getDevices" | "getMapFileUrl" | "download" | "runScene"
>;

/** What the service uses from node-miio (replaced in the tests) */
export interface CloudServiceDeps {
  loadSession(file?: string): Promise<CloudSession | undefined>;
  createCloud(session: CloudSession): Cloud;
  createWatcher(
    device: MapWatcherDevice,
    cloud: Pick<XiaomiCloud, "getMapFileUrl" | "download">,
    server: string
  ): MapWatcher;
}

const defaultDeps: CloudServiceDeps = {
  loadSession,
  createCloud: (session) => new XiaomiCloud(session),
  createWatcher: (device, cloud, server) =>
    new MapWatcher(device, cloud, { server }),
};

export const LOGIN_HINT =
  "Log in with `npx node-miio cloud login --qr`, as the same user that runs Homebridge (or set `cloud.sessionFile` to the session it saves), then restart Homebridge.";

/**
 * The Xiaomi Cloud, shared by all the robots of the platform: the session is loaded, and the account's devices
 * listed, only once.
 */
export class CloudService {
  private cloud?: Promise<Cloud | undefined>;
  private devices?: CloudDeviceCache;
  private expiredWarningShown = false;

  constructor(
    private readonly log: CloudLogger,
    private readonly config: CloudConfig,
    private readonly deps: CloudServiceDeps = defaultDeps
  ) {}

  private getCloud() {
    this.cloud ??= this.deps.loadSession(this.config.sessionFile).then(
      (session) => {
        if (!session) {
          this.log.warn(`Xiaomi Cloud: no saved session found. ${LOGIN_HINT}`);
          return undefined;
        }
        return this.deps.createCloud(session);
      },
      (error) => {
        this.log.warn(
          `Xiaomi Cloud: failed to load the session: ${error}. ${LOGIN_HINT}`
        );
        return undefined;
      }
    );
    return this.cloud;
  }

  /**
   * @returns The account's devices, listed once for all the robots
   */
  private async getDevices() {
    const cloud = await this.getCloud();
    if (!cloud) return undefined;
    this.devices ??= new CloudDeviceCache(
      cloud,
      this.config.server ? { servers: [this.config.server as CloudServer] } : {}
    );
    return this.devices;
  }

  /**
   * @param match The robot's IP and token
   * @returns The server the robot is registered in
   */
  private async serverOf(match: CloudDeviceMatch) {
    if (this.config.server) return this.config.server;
    return (await (await this.getDevices())?.find(match))?.server;
  }

  /**
   * Finds a robot in the Xiaomi account: by its `did`, its token or its IP (in that order).
   *
   * @param match What's known about the robot
   * @param options.fresh List the account's devices again (e.g. the robot stopped answering): problems are only
   * logged in debug
   * @returns Its IP and token, or `undefined` if it can't be found (the reason is logged)
   */
  async locate(
    match: CloudDeviceMatch,
    { fresh = false }: { fresh?: boolean } = {}
  ): Promise<{ ip: string; token: string } | undefined> {
    const devices = await this.getDevices();
    if (!devices) return undefined;
    const report = (message: string) =>
      fresh ? this.log.debug(message) : this.log.warn(message);
    const robot = match.did ? `"${match.did}"` : `at ${match.ip}`;
    try {
      if (fresh) devices.clear();
      const device = await devices.find(match);
      if (device?.localip && device.token) {
        if (!fresh) {
          this.log.info(
            `Xiaomi Cloud: found "${device.name}" (did ${device.did}) at ${device.localip}.`
          );
        }
        return { ip: device.localip, token: device.token };
      }
      report(
        device
          ? `Xiaomi Cloud: the robot ${robot} ("${device.name}") has no IP or token in your Xiaomi account. Is it online?`
          : `Xiaomi Cloud: no robot ${robot} in your Xiaomi account. Check its ${match.did ? "did" : "IP (it must be the one the Mi Home app shows)"}, and that you logged in with the account that owns it.`
      );
    } catch (error) {
      report(
        `Xiaomi Cloud: failed to list the devices of your Xiaomi account: ${error}`
      );
    }
    return undefined;
  }

  /**
   * Runs a manual scene of the Xiaomi Home app.
   *
   * @param sceneId The scene (from the plugin's settings)
   * @param match The robot, to find the server its account is in
   * @throws If the account isn't available, or the scene didn't run
   */
  async runScene(sceneId: string, match: CloudDeviceMatch) {
    const cloud = await this.getCloud();
    if (!cloud) {
      throw new Error(
        "Xiaomi Cloud: the account isn't available (see the warning above)"
      );
    }
    const server = await this.serverOf(match);
    if (!server) {
      throw new Error(
        "Xiaomi Cloud: the robot is not in your Xiaomi account, so its server is unknown."
      );
    }
    await cloud.runScene(server, sceneId);
  }

  /**
   * Creates the watcher that downloads the robot's map while it cleans, to know the room it's in.
   *
   * @param device The connected robot
   * @param match The robot's IP and token, to find it in the Xiaomi account
   * @returns The watcher (not started), or `undefined` if the robot's map can't be followed
   */
  async createMapWatcher(
    device: object,
    match: CloudDeviceMatch
  ): Promise<MapWatcher | undefined> {
    if (!isMapWatcherDevice(device)) {
      this.log.info(
        "Xiaomi Cloud: this robot does not support the cloud map (only Roborock vacuums do, for now)."
      );
      return undefined;
    }
    const cloud = await this.getCloud();
    if (!cloud) return undefined;

    let server: string | undefined;
    try {
      server = await this.serverOf(match);
    } catch (error) {
      this.reportFailure(error);
      return undefined;
    }
    if (!server) {
      this.log.warn(
        `Xiaomi Cloud: the robot (${match.ip}) is not in your Xiaomi account. Check that you logged in with the account that owns it.`
      );
      return undefined;
    }
    this.log.info(
      `Xiaomi Cloud: following the robot's map (server "${server}") while it cleans.`
    );
    const watcher = this.deps.createWatcher(device, cloud, server);
    watcher.on("failed", (error) => this.reportFailure(error));
    return watcher;
  }

  private reportFailure(error: unknown) {
    if (error instanceof CloudSessionExpiredError) {
      if (!this.expiredWarningShown) {
        this.expiredWarningShown = true;
        this.log.warn(
          `Xiaomi Cloud: the session expired, so the robot's current room is not reported anymore. ${LOGIN_HINT}`
        );
      }
      return;
    }
    // The map is downloaded every few seconds while cleaning: don't flood the logs
    this.log.debug(`Xiaomi Cloud: failed to get the robot's map: ${error}`);
  }
}

/**
 * @param device A node-miio device
 * @returns Whether the device can download its map from the Xiaomi Cloud (Roborock)
 */
function isMapWatcherDevice(device: object): device is MapWatcherDevice {
  return "getCloudMap" in device && typeof device.getCloudMap === "function";
}
