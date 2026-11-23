export interface ModesHomekitVsMiLevel {
  /** The top of the HomeKit slider's range that selects this mode (0-100) */
  homekitTopLevel: number;
  /** The value sent to the robot */
  miLevel: number;
  name: string;
}

/** A robot's fan speeds and water levels, with their HomeKit slider ranges (see `findSpeedModes`) */
export interface ModelDefinition {
  speed: ModesHomekitVsMiLevel[];
  waterspeed?: ModesHomekitVsMiLevel[];
}
