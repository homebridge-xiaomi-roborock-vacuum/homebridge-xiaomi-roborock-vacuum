import { Service } from "hap-nodejs";

export class RoomSwitch extends Service.Switch {
  constructor(
    public roomId: string,
    public readonly roomName: string,
    cleanWord: string
  ) {
    super(`${cleanWord} ${roomName}`, "roomService" + roomId);
  }
}
