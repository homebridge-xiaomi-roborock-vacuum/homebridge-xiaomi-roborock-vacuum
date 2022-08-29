import { HAP } from "homebridge";
import { distinct, exhaustMap, Subject, timer } from "rxjs";
import miio from "../miio";
import { Logger } from "../utils/logger";
import { MiioDevice } from "../utils/miio_types";

export interface DeviceManagerConfig {
  ip?: string;
  token?: string;
}

export interface ErrorChangedEvent {
  id: string;
  description: unknown;
}

export interface StateChangedEvent {
  key: string;
  value: unknown;
}

const GET_STATE_INTERVAL_MS = 30000; // 30s

export class DeviceManager {
  public internalDevice?: MiioDevice;

  private readonly ip: string;
  private readonly token: string;

  private readonly internalErrorChanged$ = new Subject<ErrorChangedEvent>();
  private readonly internalStateChanged$ = new Subject<StateChangedEvent>();
  public readonly errorChanged$ = this.internalErrorChanged$.pipe(distinct());
  public readonly stateChanged$ = this.internalStateChanged$.asObservable();

  private connectingPromise: Promise<void> | null = null;
  private connectRetry = setTimeout(() => void 0, 100); // Noop timeout only to initialise the property
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    config: DeviceManagerConfig
  ) {
    if (!config.ip) {
      throw new Error("You must provide an ip address of the vacuum cleaner.");
    }
    this.ip = config.ip;

    if (!config.token) {
      throw new Error("You must provide a token of the vacuum cleaner.");
    }
    this.token = config.token;

    this.connect().catch(() => {
      // Do nothing in the catch because this function already logs the error internally and retries after 2 minutes.
    });
  }

  public get model() {
    return this.internalDevice?.miioModel || "unknown model";
  }

  public get device() {
    if (!this.internalDevice) {
      throw new Error("Not connected yet");
    }
    return this.internalDevice;
  }

  public property<T>(propertyName: string) {
    return this.device.property<T>(propertyName);
  }

  public async ensureDevice(callingMethod: string) {
    try {
      if (!this.internalDevice) {
        const errMsg = `${callingMethod} | No vacuum cleaner is discovered yet.`;
        this.log.error(errMsg);
        throw new Error(errMsg);
      }

      // checking if the device has an open socket it will fail retrieving it if not
      // https://github.com/aholstenson/miio/blob/master/lib/network.js#L227
      const socket = this.internalDevice.handle.api.parent.socket;
      this.log.debug(
        `DEB ensureDevice | ${this.model} | The socket is still on. Reusing it.`
      );
    } catch (error) {
      const err = error as Error;
      if (
        /destroyed/i.test(err.message) ||
        /No vacuum cleaner is discovered yet/.test(err.message)
      ) {
        this.log.info(
          `INF ensureDevice | ${this.model} | The socket was destroyed or not initialised, initialising the device`
        );
        await this.connect();
      } else {
        this.log.error(err.message, err);
        throw err;
      }
    }
  }

  private async connect() {
    if (this.connectingPromise === null) {
      // if already trying to connect, don't trigger yet another one
      this.connectingPromise = this.initializeDevice().catch((error) => {
        this.log.error(
          `ERR connect | miio.device, next try in 2 minutes | ${error}`
        );
        clearTimeout(this.connectRetry);
        // Using setTimeout instead of holding the promise. This way we'll keep retrying but not holding the other actions
        this.connectRetry = setTimeout(
          () => this.connect().catch(() => {}),
          120000
        );
        throw error;
      });
    }
    try {
      await this.connectingPromise;
      clearTimeout(this.connectRetry);
    } finally {
      this.connectingPromise = null;
    }
  }

  private async initializeDevice() {
    this.log.debug("DEB getDevice | Discovering vacuum cleaner");

    const device = await miio.device({ address: this.ip, token: this.token });

    if (device.matches("type:vaccuum")) {
      this.internalDevice = device;

      this.log.setModel(this.model);

      // this.services.info.setCharacteristic(Characteristic.Model, this.model);

      this.log.info("STA getDevice | Connected to: %s", this.ip);
      this.log.info("STA getDevice | Model: " + this.model);
      this.log.info("STA getDevice | State: " + this.property("state"));
      this.log.info("STA getDevice | FanSpeed: " + this.property("fanSpeed"));
      this.log.info(
        "STA getDevice | BatteryLevel: " + this.property("batteryLevel")
      );

      // try {
      //   const serial = await this.getSerialNumber();
      //   this.services.info.setCharacteristic(
      //     Characteristic.SerialNumber,
      //     `${serial}`
      //   );
      //   this.log.info(`STA getDevice | Serialnumber: ${serial}`);
      // } catch (err) {
      //   this.log.error(`ERR getDevice | get_serial_number | ${err}`);
      // }

      // try {
      //   const firmware = await this.getFirmware();
      //   this.firmware = firmware;
      //   this.services.info.setCharacteristic(
      //     Characteristic.FirmwareRevision,
      //     `${firmware}`
      //   );
      //   this.log.info(`STA getDevice | Firmwareversion: ${firmware}`);
      // } catch (err) {
      //   this.log.error(`ERR getDevice | miIO.info | ${err}`);
      // }

      this.device.on<ErrorChangedEvent>("errorChanged", (error) =>
        this.internalErrorChanged$.next(error)
      );
      this.device.on<StateChangedEvent>("stateChanged", (state) =>
        this.internalStateChanged$.next(state)
      );

      //   // Now that we know the model, amend the steps in the Rotation speed (for better usability)
      //   const minStep = 100 / (this.findSpeedModes().speed.length - 1);
      //   this.services.fan
      //     .getCharacteristic(Characteristic.RotationSpeed)
      //     .setProps({ minStep: minStep });
      //
      // Refresh the state every 30s so miio maintains a fresh connection (or recovers connection if lost until we fix https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/81)
      timer(0, GET_STATE_INTERVAL_MS).pipe(exhaustMap(() => this.getState()));
    } else {
      const model = (device || {}).miioModel;
      this.log.error(
        `Device "${model}" is not registered as a vacuum cleaner! If you think it should be, please open an issue at https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/new and provide this line.`
      );
      this.log.debug(device);
      device.destroy();
    }
  }

  private async getState() {
    try {
      await this.ensureDevice("getState");
      await this.device.poll();
      const state = await this.device.state();
      this.log.debug(
        `DEB getState | ${this.model} | State %j | Props %j`,
        state,
        this.device.properties
      );

      for (const key in state) {
        if (key === "error") {
          this.internalErrorChanged$.next(state[key]);
        } else {
          this.internalStateChanged$.next({ key, value: state[key] });
        }
      }
    } catch (err) {
      this.log.error(`getState | %j`, err);
    }
  }
}
