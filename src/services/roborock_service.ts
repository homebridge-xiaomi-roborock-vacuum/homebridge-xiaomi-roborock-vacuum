import {
  loadRoborockSession,
  roborockDevice,
  RoborockMqttSession,
  RoborockSessionExpiredError,
  RoborockWebApi,
  toDevices,
  type MiioLogger,
  type RoborockDevice,
  type RoborockDeviceOptions,
  type RoborockHomeData,
  type RoborockSession,
} from "node-miio";

/** The `roborock` section of the platform config */
export interface RoborockConfig {
  /**
   * Use a Roborock app account: for the robots paired with the Roborock app (instead of Mi Home). Configure them with
   * their `duid`. Off by default.
   */
  enabled?: boolean;
  /** The session saved by `npx node-miio roborock login` (defaults to node-miio's config directory) */
  sessionFile?: string;
}

/** The logger methods used by the service */
export interface RoborockLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
}

/** What the service uses from node-miio (replaced in the tests) */
export interface RoborockServiceDeps {
  loadSession(file?: string): Promise<RoborockSession | undefined>;
  getHomeData(session: RoborockSession): Promise<RoborockHomeData>;
  createMqtt(session: RoborockSession): RoborockMqttSession;
  connect(options: RoborockDeviceOptions): Promise<unknown>;
  runRoutine(session: RoborockSession, id: number): Promise<void>;
}

const defaultDeps: RoborockServiceDeps = {
  loadSession: loadRoborockSession,
  getHomeData: (session) => new RoborockWebApi(session).getHomeData(),
  createMqtt: (session) => new RoborockMqttSession(session.userData.rriot),
  connect: roborockDevice,
  runRoutine: (session, id) => new RoborockWebApi(session).runRoutine(id),
};

export const ROBOROCK_LOGIN_HINT =
  "Log in with `npx node-miio roborock login`, as the same user that runs Homebridge (or set `roborock.sessionFile` to the session it saves), then restart Homebridge.";

/** What's needed to connect to a robot of the Roborock account */
export interface RoborockRobotConfig {
  /** The robot's ID (`npx node-miio roborock devices`) */
  duid: string;
  /** The robot's IP: optional (asked to the robot through Roborock's cloud) */
  ip?: string;
}

/** A connected robot */
export interface RoborockConnection {
  device: unknown;
  /** The names of the rooms, by their ID in the account (the 2nd item of `get_room_mapping`) */
  roomNames: Map<string, string>;
}

/**
 * A Roborock app account, shared by all the robots of the platform: the session and the home data are loaded only
 * once, and they share one MQTT connection.
 */
export class RoborockService {
  private session?: Promise<RoborockSession | undefined>;
  private home?: Promise<RoborockHomeData | undefined>;
  private mqtt?: RoborockMqttSession;

  constructor(
    private readonly log: RoborockLogger,
    private readonly config: RoborockConfig,
    private readonly deps: RoborockServiceDeps = defaultDeps
  ) {}

  private getSession() {
    this.session ??= this.deps.loadSession(this.config.sessionFile).then(
      (session) => {
        if (!session) {
          this.log.warn(
            `Roborock: no saved session found. ${ROBOROCK_LOGIN_HINT}`
          );
        }
        return session;
      },
      (error) => {
        this.log.warn(
          `Roborock: failed to load the session: ${error}. ${ROBOROCK_LOGIN_HINT}`
        );
        return undefined;
      }
    );
    return this.session;
  }

  /**
   * @returns The account's home data (robots, their local keys and models, rooms), loaded once
   */
  private getHome() {
    this.home ??= this.getSession().then(async (session) => {
      if (!session) return undefined;
      try {
        return await this.deps.getHomeData(session);
      } catch (error) {
        this.home = undefined; // Try again next time
        this.log.warn(
          error instanceof RoborockSessionExpiredError
            ? `Roborock: the session expired. ${ROBOROCK_LOGIN_HINT}`
            : `Roborock: failed to get the robots of your account: ${error}`
        );
        return undefined;
      }
    });
    return this.home;
  }

  /**
   * Connects to a robot of the account: locally when possible, else through Roborock's cloud.
   *
   * @param config The robot's `duid` (and IP, optional)
   * @param logger Where node-miio's debug messages go
   * @returns The device, or `undefined` if the robot isn't in the account (the reason is logged)
   * @throws If the robot can't be reached
   */
  async connect(
    config: RoborockRobotConfig,
    logger?: MiioLogger
  ): Promise<RoborockConnection | undefined> {
    const session = await this.getSession();
    const home = await this.getHome();
    if (!session || !home) {
      throw new Error(
        "Roborock: the account isn't available (see the warning above)"
      );
    }
    const robot: RoborockDevice | undefined = toDevices(home).find(
      (r) => r.duid === config.duid
    );
    if (!robot) {
      const known = toDevices(home)
        .map((r) => `"${r.name}" (${r.duid})`)
        .join(", ");
      throw new Error(
        `Roborock: no robot "${config.duid}" in your account. Its robots: ${known || "none"} (see \`npx node-miio roborock devices\`).`
      );
    }
    if (!robot.model) {
      throw new Error(`Roborock: unknown model for "${robot.name}"`);
    }
    if (!/^(1\.0|L01)$/.test(robot.protocolVersion)) {
      throw new Error(
        `Roborock: "${robot.name}" (${robot.model}) uses protocol ${robot.protocolVersion}, which isn't supported yet. Please open an issue.`
      );
    }
    this.mqtt ??= this.deps.createMqtt(session);
    const device = await this.deps.connect({
      duid: robot.duid,
      localKey: robot.localKey,
      model: robot.model,
      firmwareVersion: robot.firmwareVersion,
      address: config.ip,
      mqtt: this.mqtt,
      logger,
    });
    return {
      device,
      roomNames: new Map(
        home.rooms.map((room) => [String(room.id), room.name])
      ),
    };
  }

  /**
   * Runs a routine of the Roborock app.
   *
   * @param id The routine (from the plugin's settings)
   * @throws If the account isn't available, or the routine didn't run
   */
  async runRoutine(id: number) {
    const session = await this.getSession();
    if (!session) {
      throw new Error(
        "Roborock: the account isn't available (see the warning above)"
      );
    }
    try {
      await this.deps.runRoutine(session, id);
    } catch (error) {
      if (error instanceof RoborockSessionExpiredError) {
        this.log.warn(`Roborock: the session expired. ${ROBOROCK_LOGIN_HINT}`);
      }
      throw error;
    }
  }
}
