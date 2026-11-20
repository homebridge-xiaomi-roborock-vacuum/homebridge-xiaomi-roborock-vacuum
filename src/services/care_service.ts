import { CharacteristicValue, Service } from "homebridge";
import { auditTime } from "rxjs";
import { CoreContext } from "./types";
import { createCareServicesClasses } from "./custom_care_service";
import { MainService } from "./main_service";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";
import { supports } from "../utils/supports";

export interface CareConfig {
  disableCareServices?: boolean;
  legacyCareSensors?: boolean;
  /**
   * Show an occupancy sensor, detected when a consumable (brushes, filter, sensors) needs maintenance (#651): to
   * trigger automations and notifications.
   */
  maintenanceSensor?: boolean;
}

interface Consumable {
  /** The name for `resetConsumable` (node-miio, Roborock) */
  id:
    | "sensor_dirty_time"
    | "filter_work_time"
    | "side_brush_work_time"
    | "main_brush_work_time";
  /** The robot's property (seconds of use) */
  property: string;
  /** Seconds of use before it needs maintenance */
  lifetime: number;
  name: string;
  /** The HomeKit service's name and subtype (kept as they were: they identify the cached services) */
  serviceName: string;
  subtype: string;
}

const CONSUMABLES: Consumable[] = [
  {
    id: "sensor_dirty_time",
    property: "sensorDirtyTime",
    lifetime: 108000, // 30h
    name: "sensors",
    serviceName: "Care indicator sensors",
    subtype: "sensors",
  },
  {
    id: "filter_work_time",
    property: "filterWorkTime",
    lifetime: 540000, // 150h
    name: "filter",
    serviceName: "Care indicator filter",
    subtype: "filter",
  },
  {
    id: "side_brush_work_time",
    property: "sideBrushWorkTime",
    lifetime: 720000, // 200h
    name: "side brush",
    serviceName: "Care indicator side brush",
    subtype: "side brush",
  },
  {
    id: "main_brush_work_time",
    property: "mainBrushWorkTime",
    lifetime: 1080000, // 300h
    name: "main brush",
    serviceName: "Care indicator main brush",
    subtype: "main brush",
  },
];

/** How long to wait for the rest of a poll's changes before updating HomeKit */
const UPDATE_DELAY_MS = 1000;

export class CareService extends PluginServiceClass {
  public readonly services: Service[];
  /** The FilterMaintenance services, by consumable (native care sensors only) */
  private readonly filterServices = new Map<Consumable, Service>();
  private readonly maintenanceSensor?: Service;
  private needsMaintenance = false;

  constructor(
    coreContext: CoreContext,
    private readonly mainService: MainService,
    /** Whether to show the care sensors (otherwise, only the `maintenanceSensor`) */
    private readonly showCareSensors = true
  ) {
    super(coreContext);
    this.services = !showCareSensors
      ? []
      : this.config.legacyCareSensors
        ? this.registerLegacyCustomCareService()
        : this.registerNativeCareServices();

    if (this.config.maintenanceSensor) {
      const name = `${this.config.name} needs maintenance`;
      this.maintenanceSensor = new this.hap.Service.OccupancySensor(
        name,
        "maintenance"
      );
      ensureName(this.hap, this.maintenanceSensor, name);
      this.maintenanceSensor
        .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
        .onGet(() => this.dueConsumables().length > 0);
      this.services.push(this.maintenanceSensor);
    }
  }

  public async init(): Promise<void> {
    // The robot's counters are polled with its state: update HomeKit once per poll, so its notifications and
    // automations don't wait for the Home app to read them
    this.deviceManager.stateChanged$
      .pipe(auditTime(UPDATE_DELAY_MS))
      .subscribe(() => this.updateAll());
  }

  /**
   * @param consumable The consumable
   * @returns How much of its lifetime is used (0-100%)
   */
  private usedPercent({ property, lifetime }: Consumable) {
    const used = this.deviceManager.property<number>(property);
    // Models that don't report it, or -1 (unknown)
    if (typeof used !== "number" || !Number.isFinite(used)) return 0;
    return Math.max(0, Math.min(100, (used / lifetime) * 100));
  }

  private dueConsumables() {
    return CONSUMABLES.filter(
      (consumable) => this.usedPercent(consumable) >= 100
    );
  }

  private getUsedPercent(consumable: Consumable) {
    const percent = this.usedPercent(consumable);
    this.log.debug(
      `DEB care | The ${consumable.name} have used ${percent.toFixed(2)}% of their lifetime.`
    );
    return percent;
  }

  private updateAll() {
    for (const [consumable, service] of this.filterServices) {
      const used = this.usedPercent(consumable);
      service.updateCharacteristic(
        this.hap.Characteristic.FilterChangeIndication,
        used >= 100 ? 1 : 0
      );
      service.updateCharacteristic(
        this.hap.Characteristic.FilterLifeLevel,
        100 - used
      );
    }
    if (this.filterServices.size > 0) {
      const used = Math.max(...CONSUMABLES.map((c) => this.usedPercent(c)));
      const mainService = this.mainService.services[0];
      mainService.updateCharacteristic(
        this.hap.Characteristic.FilterChangeIndication,
        used >= 100 ? 1 : 0
      );
      mainService.updateCharacteristic(
        this.hap.Characteristic.FilterLifeLevel,
        100 - used
      );
    }
    if (this.maintenanceSensor) {
      const due = this.dueConsumables();
      if (due.length > 0 !== this.needsMaintenance) {
        this.needsMaintenance = due.length > 0;
        this.log.info(
          this.needsMaintenance
            ? `INF care | Maintenance needed: ${due.map(({ name }) => name).join(", ")}.`
            : `INF care | No maintenance needed anymore.`
        );
      }
      this.maintenanceSensor.updateCharacteristic(
        this.hap.Characteristic.OccupancyDetected,
        this.needsMaintenance ? 1 : 0
      );
    }
  }

  /**
   * Resets the consumable's counter, after replacing or cleaning it (Roborock only).
   */
  private async reset(consumable: Consumable, value: CharacteristicValue) {
    if (!value) return;
    await this.deviceManager.ensureDevice("resetConsumable");
    const { device } = this.deviceManager;
    if (!supports(device, "resetConsumable")) {
      this.log.warn(
        `resetConsumable | ${this.deviceManager.model} doesn't support resetting the ${consumable.name}.`
      );
      return;
    }
    try {
      this.log.info(`ACT resetConsumable | Resetting the ${consumable.name}.`);
      await device.resetConsumable(consumable.id);
      this.updateAll();
    } catch (err) {
      this.log.error(
        `resetConsumable | Failed to reset the ${consumable.name}.`,
        err
      );
      throw err;
    }
  }

  private registerLegacyCustomCareService(): Service[] {
    const { Care, Characteristic } = createCareServicesClasses(this.hap);
    const [sensors, filter, sideBrush, mainBrush] = CONSUMABLES;
    const service = new Care(`${this.config.name} Care`);
    service
      .getCharacteristic(Characteristic.CareSensors)
      .onGet(async () => this.getUsedPercent(sensors));
    service
      .getCharacteristic(Characteristic.CareFilter)
      .onGet(async () => this.getUsedPercent(filter));
    service
      .getCharacteristic(Characteristic.CareSideBrush)
      .onGet(async () => this.getUsedPercent(sideBrush));
    service
      .getCharacteristic(Characteristic.CareMainBrush)
      .onGet(async () => this.getUsedPercent(mainBrush));

    return [service];
  }

  private registerNativeCareServices(): Service[] {
    const mainService = this.mainService.services[0]; // Hack for now

    // Register the high-level state of the filters to the main device's Characteristics
    const mostUsed = () =>
      Math.max(...CONSUMABLES.map((c) => this.getUsedPercent(c)));
    mainService
      .getCharacteristic(this.hap.Characteristic.FilterChangeIndication)
      .onGet(async () => mostUsed() >= 100);
    mainService
      .getCharacteristic(this.hap.Characteristic.FilterLifeLevel)
      .onGet(async () => 100 - mostUsed());

    // Use Homekit's native FilterMaintenance Service, with a reset (after replacing or cleaning it)
    return CONSUMABLES.map((consumable) => {
      const service = new this.hap.Service.FilterMaintenance(
        consumable.serviceName,
        consumable.subtype
      );
      service
        .getCharacteristic(this.hap.Characteristic.FilterChangeIndication)
        .onGet(async () => this.getUsedPercent(consumable) >= 100);
      service
        .getCharacteristic(this.hap.Characteristic.FilterLifeLevel)
        .onGet(async () => 100 - this.getUsedPercent(consumable));
      service
        .getCharacteristic(this.hap.Characteristic.ResetFilterIndication)
        .onSet((value) => this.reset(consumable, value));
      this.filterServices.set(consumable, service);
      return service;
    });
  }
}
