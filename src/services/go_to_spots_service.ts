import { Service } from "homebridge";
import { filter } from "rxjs";
import { CoreContext } from "./types";
import { PluginServiceClass } from "./plugin_service_class";
import { ensureName } from "../utils/ensure_name";
import { supports } from "../utils/supports";

export interface GoToSpot {
  name: string;
  /** The robot's coordinates (mm), e.g. picked on the map in the plugin's settings */
  x: number;
  y: number;
}

export interface GoToSpotsConfig {
  /** A "go to …" switch per spot */
  goToSpots?: GoToSpot[];
  /** The first word(s) of the spots' switches: "go to Kitchen door" (default "go to") */
  goToSpotWord: string;
}

type SpotSwitch = Service & { spot: GoToSpot };

/**
 * A switch per spot: on sends the robot there, off sends it back to the dock. Like the `goTo` switch, but for as many
 * spots as needed.
 */
export class GoToSpotsService extends PluginServiceClass {
  private readonly switches: SpotSwitch[] = [];
  /** The spot the robot was sent to (the switch that shows as on while it goes there) */
  private activeSpot?: GoToSpot;
  /** Whether the robot was seen going there (a state reported right after sending it may still be the previous one) */
  private moving = false;

  constructor(coreContext: CoreContext) {
    super(coreContext);
    for (const [index, spot] of (this.config.goToSpots ?? []).entries()) {
      if (!spot?.name || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) {
        this.log.warn(
          `WAR GoToSpotsService | Ignoring the spot #${index + 1}: it needs a "name", "x" and "y".`
        );
        continue;
      }
      const name = `${this.config.goToSpotWord} ${spot.name}`;
      const service = Object.assign(
        new this.hap.Service.Switch(name, `goToSpot${index}`),
        { spot }
      );
      ensureName(this.hap, service, name);
      service
        .getCharacteristic(this.hap.Characteristic.On)
        .onGet(() => this.isGoingTo(spot))
        .onSet((on) => this.goTo(spot, on === true));
      this.switches.push(service);
    }
  }

  public async init(): Promise<void> {
    // Once the robot gets there (or is sent elsewhere), the switch turns off
    this.deviceManager.stateChanged$
      .pipe(filter(({ key }) => key === "state"))
      .subscribe(() => {
        const moving = this.isMoving();
        if (this.activeSpot && this.moving && !moving) {
          this.activeSpot = undefined;
        }
        this.moving = moving;
        this.refresh();
      });
  }

  public get services(): Service[] {
    return this.switches;
  }

  private isMoving() {
    return this.deviceManager.state === "going-to-location";
  }

  private isGoingTo(spot: GoToSpot) {
    return this.activeSpot === spot;
  }

  private refresh() {
    for (const service of this.switches) {
      service
        .getCharacteristic(this.hap.Characteristic.On)
        .updateValue(this.activeSpot === service.spot);
    }
  }

  private async goTo(spot: GoToSpot, on: boolean) {
    await this.deviceManager.ensureDevice("goToSpot");
    const { device } = this.deviceManager;
    try {
      if (on) {
        if (!supports(device, "sendToLocation")) {
          this.log.warn(
            `goToSpot | ${this.deviceManager.model} doesn't support going to a location.`
          );
          return;
        }
        this.log.info(
          `ACT goToSpot | Going to "${spot.name}" (x=${spot.x}, y=${spot.y})`
        );
        this.activeSpot = spot;
        this.moving = false;
        this.refresh();
        await device.sendToLocation(spot.x, spot.y);
      } else if (this.activeSpot === spot) {
        this.log.info(`ACT goToSpot | Back to the dock`);
        this.activeSpot = undefined;
        await device.activateCharging();
      }
    } catch (err) {
      this.activeSpot = undefined;
      this.refresh();
      this.log.error(`goToSpot | `, err);
      throw err;
    }
  }
}
