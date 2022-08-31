import { HAP, Service } from "homebridge";
import { CoreContext } from "./types";
import { callbackify } from "../utils/callbackify";
import { Care, Characteristic } from "./custom_care_service";
import { MainService } from "./main_service";
import { PluginServiceClass } from "./plugin_service_class";

export interface CareConfig {
  disableCareServices?: boolean;
  legacyCareSensors?: boolean;
}

export class CareService extends PluginServiceClass {
  public readonly services: Service[];
  constructor(
    coreContext: CoreContext,
    private readonly mainService: MainService
  ) {
    super(coreContext);
    this.services = this.config.legacyCareSensors
      ? this.registerLegacyCustomCareService()
      : this.registerNativeCareServices();
  }

  public async init(): Promise<void> {}

  private async getCareSensors() {
    // 30h = sensor_dirty_time
    const lifetime = 108000;
    const sensorDirtyTime =
      this.deviceManager.property<number>("sensorDirtyTime")!;
    const lifetimePercent = (sensorDirtyTime / lifetime) * 100;
    this.log.info(
      `getCareSensors | Sensors dirtyTime is ${sensorDirtyTime} seconds / ${lifetimePercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimePercent);
  }

  private async getCareFilter() {
    // 150h = filter_work_time
    const lifetime = 540000;
    const filterWorkTime =
      this.deviceManager.property<number>("filterWorkTime")!;
    const lifetimePercent = (filterWorkTime / lifetime) * 100;
    this.log.info(
      `getCareFilter | Filter workTime is ${filterWorkTime} seconds / ${lifetimePercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimePercent);
  }

  private async getCareSideBrush() {
    // 200h = side_brush_work_time
    const lifetime = 720000;
    const sideBrushWorkTime =
      this.deviceManager.property<number>("sideBrushWorkTime")!;
    const lifetimePercent = (sideBrushWorkTime / lifetime) * 100;
    this.log.info(
      `getCareSideBrush | SideBrush workTime is ${sideBrushWorkTime} seconds / ${lifetimePercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimePercent);
  }

  private async getCareMainBrush() {
    // 300h = main_brush_work_time
    const lifetime = 1080000;
    const mainBrushWorkTime =
      this.deviceManager.property<number>("mainBrushWorkTime")!;
    const lifetimePercent = (mainBrushWorkTime / lifetime) * 100;
    this.log.info(
      `getCareMainBrush | MainBrush workTime is ${mainBrushWorkTime} seconds / ${lifetimePercent.toFixed(
        2
      )}%.`
    );
    return Math.min(100, lifetimePercent);
  }

  private registerLegacyCustomCareService(): Service[] {
    const service = new Care(`${this.config.name} Care`);
    service
      .getCharacteristic(Characteristic.CareSensors)
      .on("get", (cb) => callbackify(() => this.getCareSensors(), cb));
    service
      .getCharacteristic(Characteristic.CareFilter)
      .on("get", (cb) => callbackify(() => this.getCareFilter(), cb));
    service
      .getCharacteristic(Characteristic.CareSideBrush)
      .on("get", (cb) => callbackify(() => this.getCareSideBrush(), cb));
    service
      .getCharacteristic(Characteristic.CareMainBrush)
      .on("get", (cb) => callbackify(() => this.getCareMainBrush(), cb));

    return [service];
  }

  private registerNativeCareServices(): Service[] {
    const mainService = this.mainService.services[0]; // Hack for now

    // Register the high-level state of the filters to the main device's Characteristics
    mainService
      .getCharacteristic(this.hap.Characteristic.FilterChangeIndication)
      .on("get", (cb) =>
        callbackify(async () => {
          const carePercentages = await Promise.all([
            this.getCareSensors(),
            this.getCareFilter(),
            this.getCareSideBrush(),
            this.getCareMainBrush(),
          ]);
          return carePercentages.some((item) => item >= 100);
        }, cb)
      );
    mainService
      .getCharacteristic(this.hap.Characteristic.FilterLifeLevel)
      .on("get", (cb) =>
        callbackify(async () => {
          const carePercentages = await Promise.all([
            this.getCareSensors(),
            this.getCareFilter(),
            this.getCareSideBrush(),
            this.getCareMainBrush(),
          ]);
          return 100 - Math.max(...carePercentages);
        }, cb)
      );

    // Use Homekit's native FilterMaintenance Service
    const careSensorsService = new this.hap.Service.FilterMaintenance(
      "Care indicator sensors",
      "sensors"
    );
    careSensorsService
      .getCharacteristic(this.hap.Characteristic.FilterChangeIndication)
      .on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareSensors()) >= 100;
        }, cb)
      );
    careSensorsService
      .getCharacteristic(this.hap.Characteristic.FilterLifeLevel)
      .on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareSensors()), cb)
      );

    const careFilterService = new this.hap.Service.FilterMaintenance(
      "Care indicator filter",
      "filter"
    );
    careFilterService
      .getCharacteristic(this.hap.Characteristic.FilterChangeIndication)
      .on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareFilter()) >= 100;
        }, cb)
      );
    careFilterService
      .getCharacteristic(this.hap.Characteristic.FilterLifeLevel)
      .on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareFilter()), cb)
      );

    const careSideBrushService = new this.hap.Service.FilterMaintenance(
      "Care indicator side brush",
      "side brush"
    );
    careSideBrushService
      .getCharacteristic(this.hap.Characteristic.FilterChangeIndication)
      .on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareSideBrush()) >= 100;
        }, cb)
      );
    careSideBrushService
      .getCharacteristic(this.hap.Characteristic.FilterLifeLevel)
      .on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareSideBrush()), cb)
      );

    const careMainBrushService = new this.hap.Service.FilterMaintenance(
      "Care indicator main brush",
      "main brush"
    );
    careMainBrushService
      .getCharacteristic(this.hap.Characteristic.FilterChangeIndication)
      .on("get", (cb) =>
        callbackify(async () => {
          return (await this.getCareMainBrush()) >= 100;
        }, cb)
      );
    careMainBrushService
      .getCharacteristic(this.hap.Characteristic.FilterLifeLevel)
      .on("get", (cb) =>
        callbackify(async () => 100 - (await this.getCareMainBrush()), cb)
      );

    return [
      careSensorsService,
      careFilterService,
      careSideBrushService,
      careMainBrushService,
    ];
  }
}
