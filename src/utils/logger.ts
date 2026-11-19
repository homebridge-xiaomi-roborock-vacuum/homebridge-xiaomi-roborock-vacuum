import { Logging } from "homebridge";

export interface CustomLoggerConfig {
  /**
   * When `true`, info and debug logs are silenced to avoid convoluted logs.
   */
  silent?: boolean;
  /**
   * When `true`, debug logs (including node-miio's) are shown as regular logs, without enabling Homebridge's debug
   * mode (`-D`) for every plugin.
   */
  debug?: boolean;
}

const noop = () => {};

export interface Logger extends Pick<
  Logging,
  "debug" | "info" | "warn" | "error"
> {
  setModel: (modelName: string) => void;
}

export function getLogger(
  log: Logging | Logger,
  config: CustomLoggerConfig
): Logger {
  if ("setModel" in log) {
    return log;
  }

  let model = "unknown";

  function buildMsg(message: string) {
    return `[Model=${model}] ${message}`;
  }

  return {
    debug: (msg, ...params) => {
      if (config.debug) {
        log.info(buildMsg(`[debug] ${msg}`), ...params);
      } else if (!config.silent) {
        log.debug(buildMsg(msg), ...params);
      }
    },
    info: (msg, ...params) =>
      config.silent ? noop() : log.info(buildMsg(msg), ...params),
    warn: (msg, ...params) => log.warn(buildMsg(msg), ...params),
    error: (msg, ...params) => log.error(buildMsg(msg), ...params),
    setModel: (modelName) => (model = modelName),
  };
}
