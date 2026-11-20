/**
 * The server of the plugin's custom UI (see `config.schema.json`'s `customUiPath`), run by the Homebridge UI.
 * It runs as the same user as Homebridge, so the Xiaomi Cloud session it saves is the one the plugin reads.
 */
import { createHandlers } from "./handlers";

async function start() {
  // ESM-only package: loaded with a dynamic import from this CommonJS module
  const { HomebridgePluginUiServer, RequestError } =
    await import("@homebridge/plugin-ui-utils");

  class XiaomiRoborockVacuumUiServer extends HomebridgePluginUiServer {
    constructor() {
      super();
      const handlers = createHandlers((event, data) =>
        this.pushEvent(event, data)
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

void start();
