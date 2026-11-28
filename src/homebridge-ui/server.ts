/**
 * The server of the plugin's custom UI (see `config.schema.json`'s `customUiPath`), run by the Homebridge UI.
 * It runs as the same user as Homebridge, so the Xiaomi Cloud session it saves is the one the plugin reads.
 */
import {
  HomebridgePluginUiServer,
  RequestError,
} from "@homebridge/plugin-ui-utils";

import { createHandlers } from "./handlers.js";

function start() {
  class XiaomiRoborockVacuumUiServer extends HomebridgePluginUiServer {
    constructor() {
      super();
      const handlers = createHandlers(
        (event, data) => this.pushEvent(event, data),
        undefined,
        this.homebridgeConfigPath
      );
      for (const [path, handler] of Object.entries(handlers)) {
        this.onRequest(path, async (payload) => {
          try {
            return await (handler as (payload: unknown) => unknown)(payload);
          } catch (err) {
            throw new RequestError((err as Error).message, {});
          }
        });
      }
      this.ready();
    }
  }

  return new XiaomiRoborockVacuumUiServer();
}

start();
