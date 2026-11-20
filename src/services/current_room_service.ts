import type { Service } from "homebridge";
import type { MapPoint, MapWatcher } from "node-miio";
import { Observable, Subscription, switchMap } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";
import type { CloudService } from "./cloud_service";
import type { RoomsService } from "./rooms_service";

export interface CurrentRoomConfig {
  /**
   * Show an occupancy sensor per room, detected while the robot is in it (needs the platform's `cloud` option).
   */
  roomSensors?: boolean;
}

type RoomSensor = Service & { roomId: string };

/**
 * Follows the robot's map in the Xiaomi Cloud while it cleans: the room it's in (an occupancy sensor per room, with
 * `roomSensors`), and its position in the logs (#1020), e.g. to find the `goToX` / `goToY` coordinates.
 */
export class CurrentRoomService extends PluginServiceClass {
  private readonly sensors = new Map<string, RoomSensor>();
  private currentRoom?: string;
  private position?: MapPoint;
  private watcher?: MapWatcher;
  private subscription?: Subscription;

  constructor(
    coreContext: CoreContext,
    private readonly rooms: RoomsService,
    private readonly cloud?: CloudService
  ) {
    super(coreContext);
    if (this.config.roomSensors && !this.cloud) {
      this.log.warn(
        `WAR CurrentRoomService | "roomSensors" needs the Xiaomi Cloud: enable the platform's "cloud" option.`
      );
    }
  }

  public async init(): Promise<void> {
    const { cloud } = this;
    if (!cloud) return;
    this.subscription = this.deviceManager.deviceConnected$
      .pipe(
        // A new watcher every time the robot (re)connects
        switchMap(
          (device) =>
            new Observable<void>(() => {
              let closed = false;
              let watcher: MapWatcher | undefined;
              const follow = async () => {
                const created = await cloud.createMapWatcher(device, {
                  did: this.config.did,
                  ip: this.config.ip,
                  token: this.config.token,
                });
                if (!created || closed) return;
                watcher = created;
                this.watcher = watcher;
                watcher.on("currentRoom", (room) => this.updateRoom(room));
                watcher.on("position", (position) => {
                  this.position = position;
                  this.log.debug(
                    `DEB CurrentRoomService | Robot position: ${formatPosition(position)}`
                  );
                });
                await watcher.start();
              };
              follow().catch((error) =>
                this.log.debug(
                  `DEB CurrentRoomService | Failed to follow the robot's map: ${error}`
                )
              );
              return () => {
                closed = true;
                watcher?.stop();
                if (this.watcher === watcher) this.watcher = undefined;
              };
            })
        )
      )
      .subscribe();
  }

  /** Stops following the robot's map */
  public stop() {
    this.subscription?.unsubscribe();
  }

  /**
   * The occupancy sensors, one per room. They're created on the first call: the rooms may be resolved from the
   * robot (`autoroom`), so they're only known once it's connected.
   */
  public get services(): Service[] {
    if (!this.config.roomSensors || !this.cloud) return [];
    for (const { id, name } of this.rooms.roomList) {
      const roomId = `${id}`;
      if (!this.sensors.has(roomId)) this.createSensor(roomId, name);
    }
    return [...this.sensors.values()];
  }

  /**
   * Downloads the map once, and logs the robot's position (e.g. after driving it with the remote control in the
   * app, to know the coordinates of a spot for the "go to" switch).
   */
  public async logPosition() {
    if (!this.watcher) return;
    const map = await this.watcher.refresh();
    if (map?.robot) {
      this.log.info(
        `INF CurrentRoomService | The robot is at ${formatPosition(map.robot)} (use them as "goToX" and "goToY")`
      );
    }
  }

  private createSensor(roomId: string, roomName: string) {
    const name = `${this.config.name} in ${roomName}`;
    const sensor = Object.assign(
      new this.hap.Service.OccupancySensor(name, `roomSensor${roomId}`),
      { roomId }
    );
    ensureName(this.hap, sensor, name);
    sensor
      .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
      .onGet(() => this.currentRoom === roomId);
    this.sensors.set(roomId, sensor);
  }

  private updateRoom(room: number | undefined) {
    const roomId = room === undefined ? undefined : `${room}`;
    if (roomId === undefined) {
      if (this.position) {
        this.log.info(
          `INF CurrentRoomService | The robot stopped at ${formatPosition(this.position)}`
        );
      }
    } else {
      const name = this.rooms.roomList.find(
        ({ id }) => `${id}` === roomId
      )?.name;
      this.log.info(
        `INF CurrentRoomService | The robot is in ${name ? `"${name}"` : `room ${roomId}`}`
      );
    }
    this.currentRoom = roomId;
    for (const sensor of this.sensors.values()) {
      sensor
        .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
        .updateValue(sensor.roomId === roomId);
    }
  }
}

/**
 * @param position The robot's position in the map
 * @returns The coordinates, as the robot understands them (mm)
 */
function formatPosition(position: MapPoint | undefined) {
  return position ? `x=${position.x}, y=${position.y}` : "unknown";
}
