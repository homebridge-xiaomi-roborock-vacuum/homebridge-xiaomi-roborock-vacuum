import { HAP } from "homebridge";
import {
  BehaviorSubject,
  distinctUntilChanged,
  exhaustMap,
  filter,
  Subscription,
  Subject,
  timer,
} from "rxjs";
import * as miio from "node-miio";
import {
  isCleaningState,
  isVacuum,
  type ErrorChangedEvent,
  type StateChangedEvent,
  type VacuumDevice,
} from "node-miio";
import { Logger } from "../utils/logger";
import { supports } from "../utils/supports";
import { unknownStateCode, unknownStateIssueUrl } from "../utils/unknown_state";
import type { ReportedModes } from "../utils/find_speed_modes";

export interface DeviceManagerConfig {
  ip?: string;
  token?: string;
  /** The device ID in the Xiaomi account: its IP and token are read from there (needs the platform's `cloud` option) */
  did?: string;
  /** The robot's ID in a Roborock app account (needs the platform's `roborock` option): no token needed, the IP is optional */
  duid?: string;
}

/** Where the robot is, and how to talk to it */
export interface DeviceLocation {
  ip: string;
  token: string;
}

/**
 * Looks for the robot again (in the Xiaomi Cloud), e.g. when its IP changed.
 *
 * @param current Where the robot was
 * @returns Where it is now, or `undefined` if unknown
 */
export type DeviceLocator = (
  current: DeviceLocation
) => Promise<DeviceLocation | undefined>;

/** `null` when the error is cleared (node-miio >= 0.5.0) */
export type { ErrorChangedEvent, StateChangedEvent };

/** A robot connected another way than miIO (e.g. a Roborock-app robot) */
export interface ConnectedDevice {
  device: unknown;
  /** The names of the rooms, by the ID in the 2nd item of `get_room_mapping` */
  roomNames?: Map<string, string>;
}

/**
 * Connects to the robot without miIO (e.g. through a Roborock app account).
 *
 * @param logger Where node-miio's debug messages go
 * @returns The device
 */
export type DeviceConnector = (
  logger: miio.MiioLogger
) => Promise<ConnectedDevice | undefined>;

const GET_STATE_INTERVAL_MS = 30000; // 30s
const RECONNECT_INTERVAL_MS = 120000; // 2 minutes
/** Consecutive failed state requests before looking for the robot again (~1.5 minutes) */
const FAILED_POLLS_BEFORE_LOCATING = 3;
/** Don't ask the Xiaomi Cloud more often than this (e.g. while the robot is unplugged) */
const LOCATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/** The id of an error, or `null` when there's no error */
const errorId = (error: ErrorChangedEvent) =>
  error === null || error === undefined ? null : String(error.id);

export class DeviceManager {
  private readonly internalDevice$ = new BehaviorSubject<
    VacuumDevice | undefined
  >(undefined);

  private ip: string;
  private token: string;
  private roomNames = new Map<string, string>();
  /** The unknown status codes already reported (see {@link reportUnknownState}) */
  private readonly reportedUnknownStates = new Set<number>();
  private failedPolls = 0;
  private lastLocatedAt = 0;

  private readonly internalErrorChanged$ = new Subject<ErrorChangedEvent>();
  private readonly internalStateChanged$ = new Subject<StateChangedEvent>();
  /**
   * The robot's error, when it changes (`null`: cleared). The state is polled: the same error is reported on every poll,
   * so only the changes are emitted (by id). Not `distinct()`, which would never emit an already seen value again
   * (e.g. the second time an error is cleared).
   */
  public readonly errorChanged$ = this.internalErrorChanged$.pipe(
    distinctUntilChanged(
      (previous, current) => errorId(previous) === errorId(current)
    )
  );
  public readonly stateChanged$ = this.internalStateChanged$.asObservable();
  public readonly deviceConnected$ = this.internalDevice$.pipe(filter(Boolean));

  private connectingPromise: Promise<void> | null = null;
  private statePollingSubscription: Subscription | null = null;
  private connectRetry = setTimeout(() => void 0, 100); // Noop timeout only to initialise the property
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    config: DeviceManagerConfig,
    /** Finds the robot again when it stops answering (with the platform's `cloud` option) */
    private readonly locate?: DeviceLocator,
    /** Connects without miIO (with the platform's `roborock` option) */
    private readonly connector?: DeviceConnector
  ) {
    if (connector) {
      this.ip = config.ip ?? "";
      this.token = "";
      this.connect().catch(() => {});
      return;
    }
    if (!config.ip) {
      throw new Error(
        "You must provide an ip address of the vacuum cleaner (or its `did`, with the platform's `cloud` option)."
      );
    }
    this.ip = config.ip;

    if (!config.token) {
      throw new Error(
        "You must provide a token of the vacuum cleaner (or enable the platform's `cloud` option, to get it from your Xiaomi account)."
      );
    }
    this.token = config.token;

    this.connect().catch(() => {
      // Do nothing in the catch because this function already logs the error internally and retries after 2 minutes.
    });
  }

  public get model() {
    return this.internalDevice$.value?.miioModel || "unknown model";
  }

  public get state() {
    return this.property("state") as string;
  }

  /**
   * @param roomId The room ID of `get_room_mapping` (its 2nd item)
   * @returns The room's name in the robot's app, if known (Roborock app accounts)
   */
  public roomName(roomId: string | number): string | undefined {
    return this.roomNames.get(String(roomId));
  }

  /**
   * Warns about a status that node-miio can't translate (`unknown-<code>`), once per status, with a link to report it.
   *
   * @param state The vacuum's `state` property
   */
  private reportUnknownState(state: unknown) {
    const code = unknownStateCode(state);
    if (code === undefined || this.reportedUnknownStates.has(code)) return;
    this.reportedUnknownStates.add(code);
    const device = this.internalDevice$.value as
      { describeStatus?: (code: number) => string | undefined } | undefined;
    const description = device?.describeStatus?.(code);
    const url = unknownStateIssueUrl({ model: this.model, code, description });
    this.log.warn(
      `WAR getState | The robot reports a status the plugin doesn't know: ${code}` +
        (description ? ` ("${description}")` : "") +
        `. Please report it, saying what the robot was doing: ${url}`
    );
  }

  public get isCleaning() {
    return isCleaningState(this.state);
  }

  public get isPaused() {
    return this.state === "paused";
  }

  public get device() {
    if (!this.internalDevice$.value) {
      throw new Error("Not connected yet");
    }
    return this.internalDevice$.value;
  }

  public property<T>(propertyName: string) {
    return this.device.property<T>(propertyName);
  }

  public async ensureDevice(callingMethod: string) {
    try {
      if (!this.internalDevice$.value) {
        const errMsg = `${callingMethod} | No vacuum cleaner is discovered yet.`;
        this.log.error(errMsg);
        throw new Error(errMsg);
      }

      if (!this.internalDevice$.value.connected) {
        throw new Error("The socket was destroyed");
      }
      this.log.debug(
        `DEB ensureDevice | ${this.model} | The socket is still on. Reusing it.`
      );
    } catch (error) {
      const err = error as Error;
      if (
        /destroyed/i.test(err.message) ||
        /No vacuum cleaner is discovered yet/.test(err.message)
      ) {
        this.log.info(
          `INF ensureDevice | ${this.model} | The socket was destroyed or not initialised, initialising the device`
        );
        await this.connect();
      } else {
        this.log.error(err.message, err);
        throw err;
      }
    }
  }

  private async connect() {
    if (this.connectingPromise === null) {
      // if already trying to connect, don't trigger yet another one
      this.connectingPromise = this.initializeDevice().catch(async (error) => {
        // Maybe it's somewhere else now (new IP), or it has a new token (its Wi-Fi was reset)
        const moved = await this.relocate();
        this.log.error(
          `ERR connect | miio.device, next try ${moved ? "now, at its new location" : "in 2 minutes"} | ${error}`
        );
        clearTimeout(this.connectRetry);
        // Using setTimeout instead of holding the promise. This way we'll keep retrying but not holding the other actions
        this.connectRetry = setTimeout(
          () => this.connect().catch(() => {}),
          moved ? 0 : RECONNECT_INTERVAL_MS
        );
        throw error;
      });
    }
    try {
      await this.connectingPromise;
      clearTimeout(this.connectRetry);
    } finally {
      this.connectingPromise = null;
    }
  }

  /**
   * Asks where the robot is now (at most every 10 minutes).
   *
   * @returns Whether its IP or token changed
   */
  private async relocate(): Promise<boolean> {
    if (!this.locate || Date.now() - this.lastLocatedAt < LOCATE_INTERVAL_MS) {
      return false;
    }
    this.lastLocatedAt = Date.now();
    let found: DeviceLocation | undefined;
    try {
      found = await this.locate({ ip: this.ip, token: this.token });
    } catch (error) {
      this.log.debug(`DEB relocate | Failed to locate the robot: ${error}`);
      return false;
    }
    if (!found || (found.ip === this.ip && found.token === this.token)) {
      return false;
    }
    if (found.ip !== this.ip) {
      this.log.info(
        `INF relocate | The robot's IP changed from ${this.ip} to ${found.ip}`
      );
    }
    if (found.token !== this.token) {
      this.log.info("INF relocate | The robot has a new token");
    }
    this.ip = found.ip;
    this.token = found.token;
    return true;
  }

  private async initializeDevice() {
    this.log.debug("DEB getDevice | Discovering vacuum cleaner");

    // node-miio's debug messages go to the plugin's logger (shown with the `debug` option or Homebridge's `-D`)
    const miioLogger = { debug: (msg: string) => this.log.debug(msg) };
    // Messages not tied to a device (network, MIoT specs…).
    // With several vacuums, the last one to connect wins: it's only used for debugging.
    miio.configureLogging({ logger: miioLogger });
    let device: unknown;
    if (this.connector) {
      const connected = await this.connector(miioLogger);
      if (!connected) throw new Error("The robot couldn't be found");
      device = connected.device;
      this.roomNames = connected.roomNames ?? new Map();
      this.ip = miio.roborockApiOf(device)?.address ?? this.ip;
    } else {
      device = await miio.device({
        address: this.ip,
        token: this.token,
        logger: miioLogger,
      });
    }

    if (isVacuum(device)) {
      this.reportedModes = await this.loadReportedModes(device);
      this.internalDevice$.next(device);

      this.log.setModel(this.model);

      this.log.info("STA getDevice | Connected to: %s", this.ip);
      this.log.info("STA getDevice | Model: " + this.model);
      this.log.info("STA getDevice | State: " + this.property("state"));
      this.reportUnknownState(this.property("state"));
      this.log.info("STA getDevice | FanSpeed: " + this.property("fanSpeed"));
      this.log.info(
        "STA getDevice | BatteryLevel: " + this.property("batteryLevel")
      );

      this.device.on("errorChanged", (error: ErrorChangedEvent) =>
        this.internalErrorChanged$.next(error)
      );
      this.device.on("stateChanged", (state: StateChangedEvent) => {
        if (state.key === "state") this.reportUnknownState(state.value);
        this.internalStateChanged$.next(state);
      });

      // Refresh the state every 30s so miio maintains a fresh connection (or recovers connection if lost until we fix https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/81)
      this.statePollingSubscription?.unsubscribe();
      this.statePollingSubscription = timer(0, GET_STATE_INTERVAL_MS)
        .pipe(exhaustMap(() => this.getState()))
        .subscribe();
    } else {
      const other = device as
        { miioModel?: string; destroy?: () => unknown } | undefined;
      const model = other?.miioModel;
      this.log.error(
        `Device "${model}" is not registered as a vacuum cleaner! If you think it should be, please open an issue at https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/new and provide this line.`
      );
      this.log.debug("DEB getDevice | %o", device);
      other?.destroy?.();
    }
  }

  /**
   * Fan speeds and water levels reported by node-miio (e.g. from the MIoT spec). `undefined` if not available.
   */
  public reportedModes?: ReportedModes;

  private async loadReportedModes(
    device: VacuumDevice
  ): Promise<ReportedModes | undefined> {
    if (typeof device.fanSpeeds !== "function") return undefined;
    try {
      const [fanSpeeds, waterBoxModes, presets] = await Promise.all([
        device.fanSpeeds(),
        device.waterBoxModes ? device.waterBoxModes() : [],
        supports(device, "cleanPresets") ? device.cleanPresets() : [],
      ]);
      this.log.debug(`DEB getDevice | Modes reported by node-miio: %j`, {
        fanSpeeds,
        waterBoxModes,
        presets,
      });
      return { fanSpeeds, waterBoxModes, presets };
    } catch (err) {
      this.log.debug(
        `DEB getDevice | Failed to load the reported modes: ${err}`
      );
      return undefined;
    }
  }

  private async getState() {
    try {
      await this.ensureDevice("getState");
      await this.device.poll();
      const state = await this.device.state();
      this.log.debug(
        `DEB getState | ${this.model} | State %j | Props %j`,
        state,
        this.device.properties
      );

      this.failedPolls = 0;
      for (const key in state) {
        if (key === "error") {
          this.internalErrorChanged$.next(state[key] as ErrorChangedEvent);
        } else {
          this.internalStateChanged$.next({ key, value: state[key] });
        }
      }
    } catch (err) {
      this.log.error(`getState | %j`, err);
      await this.reconnectIfMoved();
    }
  }

  /**
   * The robot doesn't answer anymore: if it's somewhere else now, connect to it there.
   */
  private async reconnectIfMoved() {
    this.failedPolls += 1;
    if (this.failedPolls < FAILED_POLLS_BEFORE_LOCATING) return;
    this.failedPolls = 0;
    if (!(await this.relocate())) return;
    this.internalDevice$.value?.destroy();
    await this.connect().catch(() => {
      // Already logged, and retried later
    });
  }
}
