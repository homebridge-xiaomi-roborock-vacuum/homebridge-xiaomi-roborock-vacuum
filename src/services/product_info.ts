import { HAP, Service } from "homebridge";
import { Logger } from "../utils/logger";
import { callbackify } from "../utils/callbackify";
import { PluginService } from "./types";
import { DeviceManager } from "./device_manager";
import { concatMap } from "rxjs";

export class ProductInfo implements PluginService {
  public firmware?: string;
  private readonly service: Service;
  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly deviceManager: DeviceManager
  ) {
    this.service = new hap.Service.AccessoryInformation();
    this.service
      .setCharacteristic(hap.Characteristic.Manufacturer, "Xiaomi")
      .setCharacteristic(hap.Characteristic.Model, "Roborock");
    this.service
      .getCharacteristic(hap.Characteristic.FirmwareRevision)
      .on("get", (cb) => callbackify(() => this.getFirmware(), cb));
    this.service
      .getCharacteristic(hap.Characteristic.Model)
      .on("get", (cb) => callbackify(() => this.deviceManager.model, cb));
    this.service
      .getCharacteristic(hap.Characteristic.SerialNumber)
      .on("get", (cb) => callbackify(() => this.getSerialNumber(), cb));
  }

  public async init(): Promise<void> {
    this.deviceManager.deviceConnected$ // Only run the below once the device is connected
      .pipe(
        concatMap(async () => {
          try {
            const serial = await this.getSerialNumber();
            this.service.setCharacteristic(
              this.hap.Characteristic.SerialNumber,
              `${serial}`
            );
            this.log.info(`STA getDevice | Serial Number: ${serial}`);
          } catch (err) {
            this.log.error(`ERR getDevice | get_serial_number | ${err}`);
          }

          try {
            const firmware = await this.getFirmware();
            this.firmware = firmware;
            this.service.setCharacteristic(
              this.hap.Characteristic.FirmwareRevision,
              `${firmware}`
            );
            this.log.info(`STA getDevice | Firmware Version: ${firmware}`);
          } catch (err) {
            this.log.error(`ERR getDevice | miIO.info | ${err}`);
          }
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
