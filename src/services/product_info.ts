import { HAP, Service } from "homebridge";
import { Logger } from "../utils/logger";
import { callbackify } from "../utils/callbackify";
import { PluginService } from "./types";
import { DeviceManager } from "./device_manager";

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

  public async init(): Promise<void> {}

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
