import type { MatterAccessory, MatterAPI } from "homebridge";
import { concatMap, type Observable, Subscription } from "rxjs";
import { ACCESSORY_NAME, PLUGIN_NAME } from "../constants";
import type { ModelDefinition } from "../models/types";
import type { Config } from "../services/config_service";
import type {
  DeviceManager,
  ErrorChangedEvent,
  StateChangedEvent,
} from "../services/device_manager";
import type { ResolvedRoom } from "../services/rooms_service";
import type { Logger } from "../utils/logger";
import { supports } from "../utils/supports";
import { buildCleanModes, type CleanMode, findCleanMode } from "./clean_modes";
import {
  ErrorState,
  OperationalState,
  PowerSource,
  RunMode,
  SUPPORTED_OPERATIONAL_STATES,
  SUPPORTED_RUN_MODES,
} from "./constants";
import {
  toBatChargeLevel,
  toBatChargeState,
  toErrorStateId,
  toOperationalState,
} from "./rvc_mappings";

export interface MatterVacuumOptions {
  matter: MatterAPI;
  log: Logger;
  config: Config;
  deviceManager: DeviceManager;
  /** The robot's serial number and firmware */
  serialNumber: string;
  firmware?: string;
  /** The robot's fan speeds and water levels */
  speedModes: ModelDefinition;
  /** The rooms (from `rooms` or `autoroom`), exposed as Matter service areas */
  rooms: ResolvedRoom[];
  /** The room the robot is in (from the Xiaomi Cloud's map, when enabled) */
  currentRoom$?: Observable<string | undefined>;
}

interface Area {
  areaId: number;
  /** The name shown in the controller (unique, as Matter requires) */
  name: string;
  room: ResolvedRoom;
}

/**
 * Room IDs are numbers on most models, but Matter area IDs must be: the others are numbered by position.
 * Matter also rejects rooms without a name, or with the same name: they get their ID.
 */
function toAreas(rooms: ResolvedRoom[]): Area[] {
  const allNumeric = rooms.every(({ id }) => /^\d+$/.test(`${id}`));
  const names = new Set<string>();
  return rooms.map((room, index) => {
    let name = `${room.name ?? ""}`.trim().slice(0, 128) || `Room ${room.id}`;
    if (names.has(name)) name = `${name} (${room.id})`.slice(0, 128);
    names.add(name);
    return { areaId: allNumeric ? Number(room.id) : index + 1, name, room };
  });
}

/** The room IDs as the robot takes them: numeric IDs as numbers (#1032) */
function toDeviceRoomIds(areas: Area[]): number[] {
  return areas.map(({ room }) =>
    /^\d+$/.test(`${room.id}`) ? Number(room.id) : room.id
  ) as number[];
}

/**
 * The vacuum as a Matter Robotic Vacuum Cleaner (`serviceType: "vacuum"`), the native robot vacuum of Apple Home and
 * the other Matter controllers: start/stop, pause/resume, go to the dock, the clean modes (fan speed and water
 * level), the rooms, the battery and the errors.
 *
 * Homebridge publishes it on its own Matter server, with its own pairing code (as Apple Home requires for robot
 * vacuums). It's registered on every start: Homebridge can't restore the handlers from its cache.
 */
export class MatterVacuum {
  public readonly uuid: string;
  private readonly matter: MatterAPI;
  private readonly log: Logger;
  private readonly deviceManager: DeviceManager;
  private readonly cleanModes: CleanMode[];
  private readonly areas: Area[];
  private readonly subscriptions = new Subscription();
  /** The areas selected in the controller for the next cleaning (empty: everywhere) */
  private selectedAreas: number[] = [];
  /**
   * The areas of the current room cleaning (to resume it).
   *
   * Skipping an area (`skipArea`) isn't supported: Homebridge (2.5) answers it with matter.js's base implementation,
   * which always fails, even after the plugin's handler.
   */
  private activeAreas: number[] = [];
  private currentRoom?: string;
  private registered = false;

  constructor(private readonly options: MatterVacuumOptions) {
    this.matter = options.matter;
    this.log = options.log;
    this.deviceManager = options.deviceManager;
    this.uuid = this.matter.uuid.generate(
      `${PLUGIN_NAME}-matter-${options.config.did ?? options.config.name}`
    );
    this.cleanModes = buildCleanModes(options.speedModes);
    this.areas = toAreas(options.rooms);
  }

  /** The Matter accessory to register */
  public build(): MatterAccessory {
    const { config, serialNumber, firmware } = this.options;
    const state = `${this.deviceManager.property("state") ?? ""}`;
    const battery = this.batteryLevel;
    const currentCleanMode =
      this.currentCleanMode ?? this.cleanModes[0]?.mode ?? 1;
    const operationalState =
      toOperationalState(state, battery) ?? OperationalState.Docked;

    return {
      UUID: this.uuid,
      displayName: config.name,
      deviceType: this.matter.deviceTypes.RoboticVacuumCleaner,
      serialNumber,
      manufacturer: "Xiaomi",
      model: this.deviceManager.model,
      firmwareRevision: firmware,
      context: {},
      clusters: {
        rvcRunMode: {
          supportedModes: SUPPORTED_RUN_MODES,
          currentMode: this.deviceManager.isCleaning
            ? RunMode.Cleaning
            : RunMode.Idle,
        },
        rvcCleanMode: {
          supportedModes: this.cleanModes.map(({ label, mode, modeTags }) => ({
            label,
            mode,
            modeTags,
          })),
          currentMode: currentCleanMode,
        },
        rvcOperationalState: {
          operationalStateList: SUPPORTED_OPERATIONAL_STATES,
          operationalState,
          operationalError: { errorStateId: ErrorState.NoError },
        },
        serviceArea: {
          supportedAreas: this.areas.map(({ areaId, name }) => ({
            areaId,
            mapId: null,
            areaInfo: {
              locationInfo: {
                locationName: name,
                floorNumber: null,
                areaType: null,
              },
              landmarkInfo: null,
            },
          })),
          selectedAreas: [],
          currentArea: null,
        },
        powerSource: {
          status: PowerSource.Status.Active,
          order: 0,
          description: "Battery",
          batPercentRemaining: battery === undefined ? null : battery * 2,
          batChargeLevel: toBatChargeLevel(battery ?? 100),
          batReplaceability: PowerSource.BatReplaceability.NotReplaceable,
          batChargeState: toBatChargeState(state === "charging", battery),
        },
      },
      handlers: {
        rvcRunMode: {
          changeToMode: ({ newMode }) => this.changeRunMode(newMode),
        },
        rvcCleanMode: {
          changeToMode: ({ newMode }) => this.changeCleanMode(newMode),
        },
        rvcOperationalState: {
          pause: () => this.run("pause", () => this.device.pause()),
          resume: () => this.resume(),
          goHome: () =>
            this.run("goHome", () => this.device.activateCharging()),
        },
        serviceArea: {
          selectAreas: ({ newAreas }) => this.selectAreas(newAreas),
        },
        identify: {
          identify: () => this.run("identify", () => this.device.find()),
        },
      },
    };
  }

  /** Registers the accessory, and keeps its state in sync with the robot */
  public async register() {
    const accessory = this.build();
    this.log.info(
      `INF matter | Registering the Matter robot vacuum (${this.cleanModes.length} clean modes, ${this.areas.length} rooms). ` +
        `Pair it with its own code, shown in the Homebridge UI and logs.`
    );
    await this.matter.registerPlatformAccessories(PLUGIN_NAME, ACCESSORY_NAME, [
      accessory,
    ]);
    this.registered = true;

    this.subscriptions.add(
      this.deviceManager.stateChanged$
        // One at a time, in order: a later change must not be overwritten by an earlier one
        .pipe(concatMap((change) => this.onStateChanged(change)))
        .subscribe()
    );
    this.subscriptions.add(
      this.deviceManager.errorChanged$
        .pipe(concatMap((error) => this.onErrorChanged(error)))
        .subscribe()
    );
    if (this.options.currentRoom$) {
      this.subscriptions.add(
        this.options.currentRoom$
          .pipe(concatMap((room) => this.onCurrentRoom(room)))
          .subscribe()
      );
    }
  }

  public stop() {
    this.subscriptions.unsubscribe();
  }

  private get device() {
    return this.deviceManager.device;
  }

  private get batteryLevel(): number | undefined {
    const level = this.deviceManager.property<number>("batteryLevel");
    return typeof level === "number" ? level : undefined;
  }

  private get currentCleanMode(): number | undefined {
    return findCleanMode(
      this.cleanModes,
      this.deviceManager.property<number>("fanSpeed"),
      this.deviceManager.property<number>("water_box_mode")
    )?.mode;
  }

  /**
   * Runs a command from the controller. Errors are logged and rethrown: Homebridge reports them to the controller.
   */
  private async run(name: string, command: () => Promise<unknown>) {
    this.log.info(`ACT matter | ${name}`);
    try {
      await this.deviceManager.ensureDevice(name);
      await command();
    } catch (error) {
      this.log.error(`ERR matter | ${name} failed`, error);
      throw error;
    }
  }

  private async changeRunMode(newMode: number) {
    if (newMode === RunMode.Idle) {
      await this.run("stop and go to the dock", () =>
        this.device.activateCharging()
      );
      return;
    }
    if (newMode !== RunMode.Cleaning) {
      throw new this.matter.status.ConstraintError(
        `Unknown run mode ${newMode}`
      );
    }
    const areas = this.areasToClean;
    if (areas.length === 0) {
      this.activeAreas = [];
      await this.run("clean everywhere", () => this.device.activateCleaning());
      return;
    }
    const names = areas.map(({ name }) => name).join(", ");
    await this.run(`clean ${names}`, () =>
      this.device.cleanRooms(toDeviceRoomIds(areas))
    );
    this.activeAreas = areas.map(({ areaId }) => areaId);
    // Until the Xiaomi Cloud tells which room it's in: the first one
    if (this.currentRoom === undefined) {
      await this.update("serviceArea", { currentArea: this.activeAreas[0] });
    }
  }

  private async resume() {
    const areas = this.areas.filter(({ areaId }) =>
      this.activeAreas.includes(areaId)
    );
    const { device } = this;
    if (areas.length > 0 && supports(device, "resumeCleanRooms")) {
      await this.run("resume the room cleaning", () =>
        device.resumeCleanRooms(toDeviceRoomIds(areas))
      );
    } else {
      await this.run("resume", () => device.activateCleaning());
    }
  }

  private async changeCleanMode(newMode: number) {
    const cleanMode = this.cleanModes.find(({ mode }) => mode === newMode);
    if (!cleanMode) {
      throw new this.matter.status.ConstraintError(
        `Unknown clean mode ${newMode}`
      );
    }
    const { fan, water } = cleanMode.levels;
    await this.run(`clean mode "${cleanMode.label}"`, async () => {
      const { device } = this;
      if (fan !== undefined) await device.changeFanSpeed(fan);
      if (water !== undefined && supports(device, "setWaterBoxMode")) {
        await device.setWaterBoxMode(water);
      }
    });
  }

  private async selectAreas(newAreas: number[]) {
    const unknown = newAreas.filter(
      (areaId) => !this.areas.some((area) => area.areaId === areaId)
    );
    if (unknown.length > 0) {
      throw new this.matter.status.ConstraintError(
        `Unknown areas: ${unknown.join(", ")}`
      );
    }
    this.log.info(
      `INF matter | Selected rooms: ${
        newAreas.length === 0
          ? "everywhere"
          : this.areas
              .filter(({ areaId }) => newAreas.includes(areaId))
              .map(({ name }) => name)
              .join(", ")
      }`
    );
    this.selectedAreas = [...newAreas];
  }

  /** The selected areas, in the robot's order. All of them (or none) means everywhere. */
  private get areasToClean(): Area[] {
    const selected = this.areas.filter(({ areaId }) =>
      this.selectedAreas.includes(areaId)
    );
    return selected.length === this.areas.length ? [] : selected;
  }

  private async onStateChanged({ key, value }: StateChangedEvent) {
    switch (key) {
      case "state":
        await this.updateOperationalState(`${value}`);
        break;
      case "batteryLevel": {
        const level = Number(value);
        await this.update("powerSource", {
          batPercentRemaining: level * 2,
          batChargeLevel: toBatChargeLevel(level),
          batChargeState: toBatChargeState(
            this.deviceManager.property("state") === "charging",
            level
          ),
        });
        break;
      }
      case "fanSpeed":
      case "water_box_mode": {
        const mode = this.currentCleanMode;
        if (mode !== undefined) {
          await this.update("rvcCleanMode", { currentMode: mode });
        }
        break;
      }
    }
  }

  private async updateOperationalState(state: string) {
    const battery = this.batteryLevel;
    const operationalState = toOperationalState(state, battery);
    if (operationalState === undefined) {
      this.log.debug(`DEB matter | Unknown state "${state}"`);
      return;
    }
    const running =
      operationalState === OperationalState.Running ||
      operationalState === OperationalState.Paused;
    if (!running) {
      this.activeAreas = [];
    }
    await this.update("rvcOperationalState", { operationalState });
    await this.update("rvcRunMode", {
      currentMode: running ? RunMode.Cleaning : RunMode.Idle,
    });
    await this.update("powerSource", {
      batChargeState: toBatChargeState(state === "charging", battery),
    });
    if (!running && this.currentRoom === undefined) {
      await this.update("serviceArea", { currentArea: null });
    }
  }

  private async onErrorChanged(error: ErrorChangedEvent) {
    if (!error) {
      await this.update("rvcOperationalState", {
        operationalError: { errorStateId: ErrorState.NoError },
      });
      // Back to what the robot is doing (the state may not change when the error is cleared)
      await this.updateOperationalState(
        `${this.deviceManager.property("state") ?? ""}`
      );
      return;
    }
    const errorStateId = toErrorStateId(this.deviceManager.model, error);
    await this.update("rvcOperationalState", {
      operationalState: OperationalState.Error,
      operationalError: {
        errorStateId,
        ...(error.description
          ? { errorStateDetails: `${error.description}`.slice(0, 64) }
          : {}),
      },
    });
  }

  private async onCurrentRoom(room: string | undefined) {
    this.currentRoom = room;
    const area = this.areas.find(({ room: { id } }) => `${id}` === room);
    await this.update("serviceArea", { currentArea: area?.areaId ?? null });
  }

  /** Updates the Matter state. Failures are logged: they must not stop the updates that follow. */
  private async update(cluster: string, attributes: Record<string, unknown>) {
    if (!this.registered) return;
    try {
      await this.matter.updateAccessoryState(this.uuid, cluster, attributes);
    } catch (error) {
      this.log.debug(
        `DEB matter | Failed to update ${cluster} ${JSON.stringify(attributes)}: ${error}`
      );
    }
  }
}
