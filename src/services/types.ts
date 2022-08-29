import { Service } from "homebridge";

export interface PluginService {
  init(): Promise<void>;
  get services(): Service[];
}
