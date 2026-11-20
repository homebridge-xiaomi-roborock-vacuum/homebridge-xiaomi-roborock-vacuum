import { Service } from "homebridge";
import { filter, firstValueFrom } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";
import type { RoomMapping, TimerResponse } from "../utils/miio_responses";

export interface RoomsConfig {
  cleanword: string;
  autoroom?: boolean | string[];
  rooms?: unknown;
  roomTimeout: number;
  /**
   * Internal (platform mode only): the rooms resolved in a previous run, used as a fallback when they
   * can't be retrieved from the device. When defined, the rooms are persisted automatically.
   */
  cachedRooms?: ResolvedRoom[];
}

export interface ResolvedRoom {
  id: string;
  name: string;
}

interface Room extends Service {
  roomId: string;
}

export class RoomsService extends PluginServiceClass {
  public readonly roomIdsToClean = new Set<string>();

  /**
   * The room IDs to send to the device: numeric IDs must be sent as numbers, otherwise some models (e.g. S5)
   * fail to start the room cleaning (#1032).
   */
  public get roomIdsForDevice(): Array<number | string> {
    return Array.from(this.roomIdsToClean, (id) =>
      /^\d+$/.test(`${id}`) ? Number(id) : id
    );
  }
  private readonly rooms: Record<string, Room> = {};
  private roomTimeout = setTimeout(() => {}, 0);
  /** The rooms resolved from the device (when using `autoroom`) */
  public resolvedRooms: ResolvedRoom[] = [];

  constructor(
    coreContext: CoreContext,
    private readonly setCleaning: (clean: boolean) => Promise<void>
  ) {
    super(coreContext);
    if (this.config.rooms && this.config.autoroom) {
      throw new Error(`Both "autoroom" and "rooms" config options can't be used at the same time.\n
      Please, use "autoroom" to retrieve the "rooms" config and remove it when not needed.`);
    }

    if (this.config.rooms && !this.config.autoroom) {
      for (const i in this.config.rooms) {
        this.createRoom(this.config.rooms[i].id, this.config.rooms[i].name);
      }
    }

    // Declare services for rooms in advance, so HomeKit can create the switches
    if (this.config.autoroom && Array.isArray(this.config.autoroom)) {
      for (const i in this.config.autoroom) {
        // Index will be overwritten, when robot is available
        this.createRoom(i, this.config.autoroom[i]);
      }
    }
  }

  public async init() {
    this.deviceManager.stateChanged$
      .pipe(filter(({ key }) => key === "cleaning"))
      .subscribe(({ value }) => {
        const isCleaning = value === true;
        if (!isCleaning) {
          this.services.forEach((room) => {
            room
              .getCharacteristic(this.hap.Characteristic.On)
              .updateValue(false);
          });
          this.roomIdsToClean.clear();
        }
      });

    if (this.config.autoroom) {
      // Await for the device to be connected
      await firstValueFrom(this.deviceManager.deviceConnected$);

      try {
        if (Array.isArray(this.config.autoroom)) {
          await this.getRoomList();
        } else {
          await this.getRoomMap();
        }
      } catch {
        // Already logged by getRoomList/getRoomMap: fall back to the cached rooms (if any)
      }

      if (this.resolvedRooms.length === 0 && this.config.cachedRooms?.length) {
        this.log.info(
          `INF init | Using the rooms resolved in a previous run: ${JSON.stringify(
            this.config.cachedRooms
          )}`
        );
        this.applyCachedRooms(this.config.cachedRooms);
      }
    }
  }

  private applyCachedRooms(cachedRooms: ResolvedRoom[]) {
    for (const { id, name } of cachedRooms) {
      if (this.rooms[name]) {
        this.rooms[name].roomId = id;
      } else if (!Array.isArray(this.config.autoroom)) {
        this.createRoom(id, name);
      }
    }
    this.resolvedRooms = cachedRooms.filter(({ name }) => this.rooms[name]);
  }

  public get services(): Service[] {
    return [...Object.values(this.rooms)];
  }

  /** The rooms with a switch, and their current IDs */
  public get roomList(): ResolvedRoom[] {
    return Object.entries(this.rooms).map(([name, room]) => ({
      id: room.roomId,
      name,
    }));
  }

  private createRoom(roomId: string, roomName: string) {
    this.log.info(`INF createRoom | Room ${roomName} (${roomId})`);

    const switchName = `${this.config.cleanword} ${roomName}`;
    const room = Object.assign(
      new this.hap.Service.Switch(switchName, "roomService" + roomId),
      { roomId }
    );

    ensureName(this.hap, room, switchName);

    room
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(() => this.getCleaningRoom(room.roomId))
      .onSet((newState) => this.setCleaningRoom(newState, room.roomId));

    this.rooms[roomName] = room;
  }

  private async getCleaningRoom(roomId: string) {
    await this.deviceManager.ensureDevice("getCleaningRoom");
    return this.roomIdsToClean.has(roomId);
  }

  private async setCleaningRoom<T>(state: T, roomId: string) {
    await this.deviceManager.ensureDevice("setCleaning");

    try {
      if (
        state &&
        !this.deviceManager.isCleaning &&
        !this.deviceManager.isPaused
      ) {
        this.log.info(
          `ACT setCleaningRoom | Enable cleaning Room ID ${roomId}.`
        );
        // Delete then add, to maintain the correct order.
        this.roomIdsToClean.delete(roomId);
        this.roomIdsToClean.add(roomId);
        this.checkRoomTimeout();
      } else if (
        !state &&
        !this.deviceManager.isCleaning &&
        !this.deviceManager.isPaused
      ) {
        this.log.info(
          `ACT setCleaningRoom | Disable cleaning Room ID ${roomId}.`
        );
        this.roomIdsToClean.delete(roomId);
        this.checkRoomTimeout();
      }
    } catch (err) {
      this.log.error(
        `ERR setCleaningRoom | Failed to set cleaning to ${state}`,
        err
      );
      throw err;
    }
  }

  private checkRoomTimeout() {
    if (this.config.roomTimeout > 0) {
      this.log.info(`ACT setCleaningRoom | Start timeout to clean rooms`);
      clearTimeout(this.roomTimeout);
      if (this.roomIdsToClean.size > 0) {
        this.roomTimeout = setTimeout(
          () => this.setCleaning(true),
          this.config.roomTimeout * 1000
        );
      }
    }
  }

  private async getRoomList() {
    await this.deviceManager.ensureDevice("getRoomList");

    try {
      const timers =
        (await this.deviceManager.device.getTimer()) as TimerResponse[];

      // Find specific timer containing the room order
      // Timer needs to be scheduled for 00:00 and inactive
      let leetTimer = timers.find(
        (x) => x[2][0].startsWith("0 0") && x[1] == "off"
      );
      if (typeof leetTimer === "undefined") {
        this.log.error(`getRoomList | Could not find a timer for autoroom`);
        throw new Error("Could not find a timer for autoroom");
      }

      let roomIds = (leetTimer[2][1][1].segments ?? "")
        .split(`,`)
        .map((x) => +x);
      this.log.debug(`getRoomList | Room IDs are ${roomIds}`);

      const autoroom: string[] = this.config.autoroom as string[];

      if (roomIds.length !== autoroom.length) {
        this.log.error(
          `getRoomList | Number of rooms in config does not match number of rooms in the timer`
        );
        throw new Error(
          "Number of rooms in config does not match number of rooms in the timer"
        );
      }
      let roomMap: ResolvedRoom[] = [];
      for (const [i, roomId] of roomIds.entries()) {
        // The timer's IDs have always been stored as numbers (the persisted rooms rely on it): keep them as they are
        const id = roomId as unknown as string;
        this.rooms[autoroom[i]].roomId = id;
        roomMap.push({ id, name: autoroom[i] });
      }
      this.resolvedRooms = roomMap;
      if (this.config.cachedRooms) {
        // Platform mode: the rooms are persisted automatically, no need to update the config
        this.log.info(
          `getRoomList | Resolved "rooms": ${JSON.stringify(roomMap)}`
        );
      } else {
        this.log.info(
          `getRoomList | Created "rooms": ${JSON.stringify(
            roomMap
          )}. Update your 'rooms' config, remove autoroom, and restart homebridge.`
        );
      }
    } catch (err) {
      this.log.error(`getRoomList | Failed getting the Room List.`, err);
      throw err;
    }
  }

  private async getRoomMap() {
    await this.deviceManager.ensureDevice("getRoomMap");

    try {
      const map = (await this.deviceManager.device.getRoomMap()) as RoomMapping;
      this.log.info(`INF getRoomMap | Map is ${map}`);
      for (let val of map) {
        this.createRoom(val[0], val[1]);
      }
      this.resolvedRooms = map.map(([id, name]) => ({ id, name }));
    } catch (err) {
      this.log.error(`ERR getRoomMap | Failed getting the Room Map.`, err);
      throw err;
    }
  }
}
