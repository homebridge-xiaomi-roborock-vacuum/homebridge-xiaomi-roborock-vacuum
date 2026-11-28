import { Service } from "homebridge";
import { CoreContext } from "./types.js";
import { concatMap, distinctUntilChanged, filter, ReplaySubject } from "rxjs";
import { PluginServiceClass } from "./plugin_service_class.js";

export class ProductInfo extends PluginServiceClass {
  public firmware?: string;
  private readonly firmwareLoaded$ = new ReplaySubject<string | undefined>(1);
  /**
   * The firmware, once it's been read after connecting (`undefined` if it couldn't be read). The speed tables depend
   * on it, and the first state can arrive before it: wait for it to look the speeds up.
   */
  public readonly firmware$ = this.firmwareLoaded$.pipe(distinctUntilChanged());
  private readonly service: Service;
  constructor(coreContext: CoreContext) {
    super(coreContext);
    this.service = new this.hap.Service.AccessoryInformation(
      coreContext.config.name
    );
    this.service
      .setCharacteristic(this.hap.Characteristic.Manufacturer, "Xiaomi")
      .setCharacteristic(this.hap.Characteristic.Model, "Roborock");
    this.service
      .getCharacteristic(this.hap.Characteristic.FirmwareRevision)
      .onGet(() => this.getFirmware());
    this.service
      .getCharacteristic(this.hap.Characteristic.Model)
      .onGet(() => this.deviceManager.model);
    this.service
      .getCharacteristic(this.hap.Characteristic.SerialNumber)
      .onGet(() => this.getSerialNumber());
  }

  public async init(): Promise<void> {
    this.deviceManager.deviceConnected$ // Only run the below once the device is connected
      .pipe(
        filter(Boolean), // Make sure it does not trigger with `undefined`
        concatMap(async () => {
          this.service.updateCharacteristic(
            this.hap.Characteristic.Model,
            this.deviceManager.model
          );

          const serial = await this.getSerialNumber();
          this.service.updateCharacteristic(
            this.hap.Characteristic.SerialNumber,
            `${serial}`
          );
          this.log.info(`STA getDevice | Serial Number: ${serial}`);

          try {
            const firmware = await this.getFirmware();
            this.firmware = firmware;
            this.service.updateCharacteristic(
              this.hap.Characteristic.FirmwareRevision,
              `${firmware}`
            );
            this.log.info(`STA getDevice | Firmware Version: ${firmware}`);
          } catch (err) {
            this.log.error(`ERR getDevice | miIO.info | ${err}`);
          }
          this.firmwareLoaded$.next(this.firmware);
        })
      )
      .subscribe();
  }

  public get services() {
    return [this.service];
  }

  private async getFirmware() {
    await this.deviceManager.ensureDevice("getFirmware");

    try {
      const firmware = await this.deviceManager.device.getDeviceInfo();
      this.log.info(`getFirmware | FirmwareVersion is ${firmware.fw_ver}`);

      this.firmware = firmware.fw_ver;

      return firmware.fw_ver;
    } catch (err) {
      this.log.error(`getFirmware | Failed getting the firmware version.`, err);
      throw err;
    }
  }

  private async getSerialNumber() {
    await this.deviceManager.ensureDevice("getSerialNumber");

    try {
      const serialNumber = await this.deviceManager.device.getSerialNumber();
      this.log.info(`getSerialNumber | Serial Number is ${serialNumber}`);

      return `${serialNumber}`;
    } catch (err) {
      this.log.warn(`getSerialNumber | Failed getting the serial number.`, err);
      return `Unknown`;
    }
  }
}
