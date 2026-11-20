/**
 * Responses of the legacy Roborock commands that node-miio returns untyped (`unknown[]` on the other vacuum classes).
 */

/** `get_room_mapping`: `[roomId, roomName]` pairs */
export type RoomMapping = Array<[string, string]>;

/** `get_timer`: `[id, status, [cron, [method, params]]]` */
export type TimerResponse = [
  string,
  string,
  [string, [string, { segments?: string } & Record<string, unknown>]],
];
