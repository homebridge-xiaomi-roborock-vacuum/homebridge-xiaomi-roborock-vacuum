import type { Logging, API, Service } from "homebridge";
import { Subject, first } from "rxjs";
import { type CloudService, type Config, DeviceManager } from "../services";
import { findSpeedModes } from "../utils/find_speed_modes";
import { type Logger, getLogger } from "../utils/logger";
import { supports } from "../utils/supports";
import { MatterVacuum } from "../matter/matter_vacuum";
import { XiaomiRoborockVacuumAccessory } from "./accessory";
import type { XiaomiRoborockVacuumPlatformAccessory } from "./platform";

/** How long to wait for the rooms to be resolved before registering the services */
const ROOMS_TIMEOUT_MS = 30_000;

/**
 * Waits for the promise, but not longer than `timeoutMs`.
 * @param promise The promise to wait for
 * @param timeoutMs The maximum time to wait
 */
async function waitAtMost(promise: Promise<unknown>, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([
    promise,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
}

/**
 * Dynamic Device Accessory:
 *
 * It should:
 * 1. Connect first
 * 2. Figure out the model
 * 3. Reuse cached accessory or create a new one
 * 4. Assign the listeners and services to the accessory
 */
export class XiaomiRoborockVacuumPlatformAccessoryInitializer {
  /**
   * Emits once the services are set up: whether the HomeKit accessory has any (with `serviceType: "vacuum"`, it only
   * exists for the extras that the Matter vacuum doesn't cover).
   */
  public readonly initialized$ = new Subject<boolean>();
  /** The Matter robot vacuum (`serviceType: "vacuum"`) */
  public matterVacuum?: MatterVacuum;
  private readonly log: Logger;

  constructor(
    log: Logging,
    config: Partial<Config>,
    api: API,
    private readonly accessory: XiaomiRoborockVacuumPlatformAccessory,
    private readonly cloud?: CloudService
  ) {
    this.log = getLogger(log, config);
    if (
      config.serviceType === "vacuum" &&
      !(api.isMatterEnabled() && api.matter)
    ) {
      this.log.warn(
        `WARN init | "serviceType": "vacuum" needs Matter: enable it in the settings of the bridge that runs this plugin ` +
          `(see the README). Using "fan" until then.`
      );
      config = { ...config, serviceType: "fan" };
    }
    const deviceManager = new DeviceManager(
      api.hap,
      this.log,
      config,
      cloud &&
        ((current) =>
          cloud.locate({ did: config.did, ...current }, { fresh: true }))
    );
    deviceManager.deviceConnected$.pipe(first()).subscribe(() => {
      this.initialize(config, api, deviceManager).catch((err) =>
        this.log.error("Failed to initialize the accessory", err)
      );
    });
  }

  private async initialize(
    config: Partial<Config>,
    api: API,
    deviceManager: DeviceManager
  ) {
    // The firmware picks the fan speeds of some models (and the Matter vacuum reports it)
    const firmware =
      config.serviceType === "vacuum"
        ? await deviceManager.device
            .getDeviceInfo()
            .then(({ fw_ver }) => `${fw_ver}`)
            .catch(() => undefined)
        : undefined;

    // For now, let's simply reuse the accessory class to bootstrap the services.
    const vacuumService = new XiaomiRoborockVacuumAccessory(
      this.log,
      {
        ...this.applyDefaultsBasedOnModel(config, deviceManager),
        // Platform mode: the resolved rooms are persisted in the accessory's context
        cachedRooms: this.accessory.context.rooms ?? [],
      },
      api,
      deviceManager,
      this.cloud
    );

    // Wait for the rooms to be resolved (autoroom), so their switches are registered too
    await waitAtMost(vacuumService.roomsReady, ROOMS_TIMEOUT_MS);
    if (vacuumService.resolvedRooms.length > 0) {
      this.accessory.context.rooms = vacuumService.resolvedRooms;
    }

    // Loop through the services in `vacuumService.getServices()`
    // and attach them to the accessory with
    // https://developers.homebridge.io/#/api/platform-plugins#platformaccessoryaddservice
    const services = vacuumService.getServices();
    services.forEach((service) => {
      let svc: Service | undefined;

      if (service.subtype) {
        svc = this.accessory.getServiceById(
          service.getServiceId(),
          service.subtype
        );
      }

      if (!svc) {
        // Hack to cover those services that do not declare a subtype
        svc = this.accessory.services.find(
          (cachedSvc) =>
            cachedSvc.UUID === service.UUID &&
            cachedSvc.subtype === service.subtype
        );
      }

      if (svc) {
        // Cached service, we need to copy the listeners
        this.log.info("Copying services...");
        if (svc instanceof api.hap.Service.AccessoryInformation) {
          svc.replaceCharacteristicsFromService(service);
        } else {
          svc.characteristics = service.characteristics;
          svc.optionalCharacteristics = service.optionalCharacteristics;
          svc.setPrimaryService(service.isPrimaryService);
        }
      } else {
        // New service to add to the accessory
        this.log.info("Adding new service...");
        svc = this.accessory.addService(service);
      }
    });

    // Remove the cached services that are no longer exposed (e.g. a room that was removed)
    const exposed = new Set(services.map((s) => `${s.UUID}/${s.subtype}`));
    [...this.accessory.services]
      .filter(
        (cachedSvc) =>
          !(cachedSvc instanceof api.hap.Service.AccessoryInformation) &&
          !exposed.has(`${cachedSvc.UUID}/${cachedSvc.subtype}`)
      )
      .forEach((staleSvc) => {
        this.log.info(
          `Removing the service "${staleSvc.displayName}" that is no longer exposed`
        );
        this.accessory.removeService(staleSvc);
      });

    if (config.serviceType === "vacuum" && api.matter) {
      const serialNumber = await deviceManager.device
        .getSerialNumber()
        .then((serial) => `${serial}`)
        .catch(() => "Unknown");
      this.matterVacuum = new MatterVacuum({
        matter: api.matter,
        log: this.log,
        config: { ...config, name: this.accessory.context.name } as Config,
        deviceManager,
        serialNumber,
        firmware,
        speedModes: findSpeedModes(
          deviceManager.model,
          firmware,
          deviceManager.reportedModes
        ),
        rooms: vacuumService.roomList,
        currentRoom$: vacuumService.currentRoom$,
      });
      // A failure must not prevent the HomeKit extras from being registered
      await this.matterVacuum
        .register()
        .catch((err) =>
          this.log.error("Failed to register the Matter robot vacuum", err)
        );
    }

    this.initialized$.next(services.length > 0);
  }

  private applyDefaultsBasedOnModel(
    config: Partial<Config>,
    deviceManager: DeviceManager
  ): Partial<Config> {
    const { model, reportedModes } = deviceManager;
    // At this point, we can apply any defaults depending on the model...
    return {
      // like enabling the waterbox mode if the model supports it
      waterBox: !!findSpeedModes(model, undefined, reportedModes).waterspeed,
      // The Matter vacuum shows the rooms: read them from the robot, unless they're configured
      ...(config.serviceType === "vacuum" &&
      !config.rooms &&
      supports(deviceManager.device, "getRoomMap")
        ? { autoroom: true }
        : {}),
      ...config,
    };
  }
}
