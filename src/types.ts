export interface Config {
  name: string;
  ip: string;
  token: string;
  waterBox: boolean;
  silent: boolean;
  pause: boolean;
  pauseWord: string;
  findMe: boolean;
  findMeWord: string;
  dock: boolean;
  cleanword: string;
  roomTimeout: number;
  autoroom: boolean | string[];
  rooms: ConfigRoom[];
  zones: ConfigZone[];
}

export interface ConfigRoom {
  name: string;
  id: string;
}

export interface ConfigZone {
  name: string;
  zone: Array<
    [number, number, number, number] | [number, number, number, number, number]
  >;
}
