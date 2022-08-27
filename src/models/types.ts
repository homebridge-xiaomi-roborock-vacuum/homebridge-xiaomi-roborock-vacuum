import { speedmodes } from "./speedmodes";
import { watermodes } from "./watermodes";

export type SpeedModes = Record<string, ModesHomekitVsMiLevel[]>;

export interface ModesHomekitVsMiLevel {
  homekitTopLevel: number;
  miLevel: number;
  name: string;
}

export interface ModelDefinition {
  speed: typeof speedmodes[string];
  waterspeed?: typeof watermodes[string];
  firmware?: string;
}
