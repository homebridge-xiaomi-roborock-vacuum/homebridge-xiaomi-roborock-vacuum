import type { MatterAccessory, MatterAPI } from "homebridge";
import { Subject } from "rxjs";
import { createDeviceManagerMock } from "../services/device_manager.mock";
import { applyConfigDefaults } from "../services/config_service";
import { findSpeedModes } from "../utils/find_speed_modes";
import { getLoggerMock } from "../utils/logger.mock";
import type {
  ErrorChangedEvent,
  StateChangedEvent,
} from "../services/device_manager";
import { MatterVacuum } from "./matter_vacuum";
import {
  ErrorState,
  OperationalState,
  PowerSource,
  RunMode,
} from "./constants";

class StatusError extends Error {}

const createMatterMock = () =>
  ({
    uuid: { generate: jest.fn((id: string) => `uuid:${id}`) },
    deviceTypes: { RoboticVacuumCleaner: { name: "RoboticVacuumCleaner" } },
    status: {
      ConstraintError: class extends StatusError {},
      InvalidInState: class extends StatusError {},
    },
    registerPlatformAccessories: jest.fn().mockResolvedValue(undefined),
    updateAccessoryState: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<MatterAPI>;

type Handlers = Required<NonNullable<MatterAccessory["handlers"]>>;

describe("MatterVacuum", () => {
  let matter: jest.Mocked<MatterAPI>;
  let deviceManager: ReturnType<typeof createDeviceManagerMock>;
  let properties: Record<string, unknown>;
  let currentRoom$: Subject<string | undefined>;
  let stateChanged$: Subject<StateChangedEvent>;
  let errorChanged$: Subject<ErrorChangedEvent>;

  const log = getLoggerMock();

  const createVacuum = (
    rooms = [
      { id: "16", name: "Kitchen" },
      { id: "17", name: "Living room" },
      { id: "18", name: "Bedroom" },
    ]
  ) =>
    new MatterVacuum({
      matter,
      log,
      config: applyConfigDefaults({ name: "Robot", did: "123" }),
      deviceManager,
      serialNumber: "SN1",
      firmware: "3.5.8",
      speedModes: findSpeedModes("roborock.vacuum.a15"),
      rooms,
      currentRoom$,
    });

  const handlersOf = (vacuum: MatterVacuum) =>
    vacuum.build().handlers as unknown as Handlers;

  /** The last update of the cluster */
  const lastUpdate = (cluster: string) =>
    matter.updateAccessoryState.mock.calls
      .filter(([, name]) => name === cluster)
      .at(-1)?.[2];

  beforeEach(() => {
    jest.clearAllMocks();
    matter = createMatterMock();
    deviceManager = createDeviceManagerMock();
    stateChanged$ = new Subject();
    errorChanged$ = new Subject();
    Object.assign(deviceManager, {
      model: "roborock.vacuum.a15",
      isCleaning: false,
      stateChanged$,
      errorChanged$,
    });
    properties = {
      state: "charging",
      batteryLevel: 80,
      fanSpeed: 102,
      waterBoxMode: 200,
    };
    deviceManager.property.mockImplementation(
      (name: string) => properties[name] as never
    );
    currentRoom$ = new Subject();
  });

  describe("build", () => {
    test("a robot of a Roborock app account is a Roborock", () => {
      const vacuum = new MatterVacuum({
        matter,
        log,
        config: applyConfigDefaults({ name: "Saros", duid: "duid-1" }),
        deviceManager,
        serialNumber: "SN1",
        firmware: "02.32.54",
        speedModes: findSpeedModes("roborock.vacuum.a15"),
        rooms: [],
        currentRoom$,
      });
      expect(vacuum.build()).toMatchObject({
        displayName: "Saros",
        manufacturer: "Roborock",
        model: "Saros",
      });
    });

    test("a robot vacuum with the robot's current state", () => {
      const accessory = createVacuum().build();
      expect(accessory).toMatchObject({
        UUID: "uuid:homebridge-xiaomi-roborock-vacuum-matter-123",
        displayName: "Robot",
        deviceType: matter.deviceTypes.RoboticVacuumCleaner,
        serialNumber: "SN1",
        manufacturer: "Xiaomi",
        // Apple Home names the accessory after it
        model: "Robot",
        firmwareRevision: "3.5.8",
      });
      const { clusters } = accessory;
      expect(clusters?.rvcRunMode).toMatchObject({
        currentMode: RunMode.Idle,
      });
      // "Balanced Vacuum": fan 102, water off
      expect(clusters?.rvcCleanMode?.currentMode).toBe(2);
      expect(clusters?.rvcCleanMode?.supportedModes).toHaveLength(12);
      expect(clusters?.rvcOperationalState?.operationalState).toBe(
        OperationalState.Charging
      );
      expect(clusters?.powerSource).toMatchObject({
        batPercentRemaining: 160,
        batChargeLevel: PowerSource.BatChargeLevel.Ok,
        batChargeState: PowerSource.BatChargeState.IsCharging,
      });
      expect(clusters?.serviceArea?.supportedAreas).toStrictEqual([
        {
          areaId: 16,
          mapId: null,
          areaInfo: {
            locationInfo: {
              locationName: "Kitchen",
              floorNumber: null,
              areaType: null,
            },
            landmarkInfo: null,
          },
        },
        expect.objectContaining({ areaId: 17 }),
        expect.objectContaining({ areaId: 18 }),
      ]);
    });

    test("non-numeric room IDs are numbered by position", () => {
      const accessory = createVacuum([
        { id: "a", name: "Kitchen" },
        { id: "b", name: "Hall" },
      ]).build();
      expect(
        accessory.clusters?.serviceArea?.supportedAreas?.map(
          ({ areaId }) => areaId
        )
      ).toStrictEqual([1, 2]);
    });

    test("rooms without a name, or with the same name, get their ID (Matter requires unique names)", () => {
      const accessory = createVacuum([
        { id: "16", name: "" },
        { id: "17", name: "Bedroom" },
        { id: "18", name: "Bedroom" },
      ]).build();
      expect(
        accessory.clusters?.serviceArea?.supportedAreas?.map(
          ({ areaInfo }) => areaInfo.locationInfo?.locationName
        )
      ).toStrictEqual(["Room 16", "Bedroom", "Bedroom (18)"]);
    });

    test("without rooms", () => {
      const accessory = createVacuum([]).build();
      expect(accessory.clusters?.serviceArea?.supportedAreas).toStrictEqual([]);
    });
  });

  describe("commands", () => {
    test("start: everywhere when no room is selected", async () => {
      const handlers = handlersOf(createVacuum());
      await handlers.rvcRunMode.changeToMode!({ newMode: RunMode.Cleaning });
      expect(deviceManager.device.activateCleaning).toHaveBeenCalledTimes(1);
      expect(deviceManager.device.cleanRooms).not.toHaveBeenCalled();
    });

    test("start: the selected rooms, in the robot's order, with numeric IDs", async () => {
      const vacuum = createVacuum();
      await vacuum.register();
      const handlers = handlersOf(vacuum);
      await handlers.serviceArea.selectAreas!({ newAreas: [18, 16] });
      await handlers.rvcRunMode.changeToMode!({ newMode: RunMode.Cleaning });
      expect(deviceManager.device.cleanRooms).toHaveBeenCalledWith([16, 18]);
      // Until the Xiaomi Cloud says otherwise: the first room
      expect(lastUpdate("serviceArea")).toStrictEqual({ currentArea: 16 });
    });

    test("start: all the rooms selected is everywhere", async () => {
      const handlers = handlersOf(createVacuum());
      await handlers.serviceArea.selectAreas!({ newAreas: [16, 17, 18] });
      await handlers.rvcRunMode.changeToMode!({ newMode: RunMode.Cleaning });
      expect(deviceManager.device.activateCleaning).toHaveBeenCalledTimes(1);
    });

    test("selecting an unknown room fails", async () => {
      const handlers = handlersOf(createVacuum());
      await expect(
        handlers.serviceArea.selectAreas!({ newAreas: [99] })
      ).rejects.toThrow("Unknown areas: 99");
    });

    test("idle: stops and goes to the dock", async () => {
      const handlers = handlersOf(createVacuum());
      await handlers.rvcRunMode.changeToMode!({ newMode: RunMode.Idle });
      expect(deviceManager.device.activateCharging).toHaveBeenCalledTimes(1);
    });

    test("pause, go home and identify", async () => {
      const handlers = handlersOf(createVacuum());
      await handlers.rvcOperationalState.pause!(undefined);
      await handlers.rvcOperationalState.goHome!(undefined);
      await handlers.identify.identify!({ identifyTime: 5 });
      expect(deviceManager.device.pause).toHaveBeenCalledTimes(1);
      expect(deviceManager.device.activateCharging).toHaveBeenCalledTimes(1);
      expect(deviceManager.device.find).toHaveBeenCalledTimes(1);
    });

    test("resume: the room cleaning it was doing", async () => {
      const handlers = handlersOf(createVacuum());
      await handlers.serviceArea.selectAreas!({ newAreas: [17] });
      await handlers.rvcRunMode.changeToMode!({ newMode: RunMode.Cleaning });
      await handlers.rvcOperationalState.resume!(undefined);
      expect(deviceManager.device.resumeCleanRooms).toHaveBeenCalledWith([17]);
      expect(deviceManager.device.activateCleaning).not.toHaveBeenCalled();
    });

    test("resume: a full cleaning", async () => {
      const handlers = handlersOf(createVacuum());
      await handlers.rvcOperationalState.resume!(undefined);
      expect(deviceManager.device.activateCleaning).toHaveBeenCalledTimes(1);
    });

    test("clean mode: sets the fan speed and the water level", async () => {
      const handlers = handlersOf(createVacuum());
      // "High Mop": no suction (105), high water level (203)
      await handlers.rvcCleanMode.changeToMode!({ newMode: 8 });
      expect(deviceManager.device.changeFanSpeed).toHaveBeenCalledWith(105);
      expect(deviceManager.device.setWaterBoxMode).toHaveBeenCalledWith(203);
    });

    test("clean mode: the robot's SmartPlan preset sets the 3 settings at once", async () => {
      deviceManager.reportedModes = {
        fanSpeeds: [],
        waterBoxModes: [],
        presets: [
          {
            name: "SmartPlan",
            fanSpeed: 110,
            waterBoxMode: 209,
            mopRoute: 306,
          },
        ],
      };
      const vacuum = createVacuum();
      const { supportedModes } = vacuum.build().clusters?.rvcCleanMode ?? {};
      const smartPlan = (
        supportedModes as { label: string; mode: number }[]
      ).find(({ label }) => label === "SmartPlan");
      expect(smartPlan).toBeDefined();
      await handlersOf(vacuum).rvcCleanMode.changeToMode!({
        newMode: smartPlan!.mode,
      });
      expect(deviceManager.device.setCleanMotorMode).toHaveBeenCalledWith({
        fanSpeed: 110,
        waterBoxMode: 209,
        mopRoute: 306,
      });
      expect(deviceManager.device.changeFanSpeed).not.toHaveBeenCalled();

      await vacuum.register();
      // Picked in the Roborock app: it's the current mode
      Object.assign(properties, {
        fanSpeed: 110,
        waterBoxMode: 209,
        mopRoute: 306,
      });
      stateChanged$.next({ key: "mopRoute", value: 306 });
      await new Promise(setImmediate);
      expect(lastUpdate("rvcCleanMode")).toStrictEqual({
        currentMode: smartPlan!.mode,
      });
      vacuum.stop();
    });

    test("clean mode: unknown mode", async () => {
      const handlers = handlersOf(createVacuum());
      await expect(
        handlers.rvcCleanMode.changeToMode!({ newMode: 99 })
      ).rejects.toThrow("Unknown clean mode 99");
    });

    test("a failing command is rethrown (Homebridge reports it to the controller)", async () => {
      deviceManager.device.pause.mockRejectedValueOnce(new Error("timeout"));
      const handlers = handlersOf(createVacuum());
      await expect(
        handlers.rvcOperationalState.pause!(undefined)
      ).rejects.toThrow("timeout");
    });
  });

  describe("state", () => {
    let vacuum: MatterVacuum;
    beforeEach(async () => {
      vacuum = createVacuum();
      await vacuum.register();
    });
    afterEach(() => vacuum.stop());

    test("registers the accessory", () => {
      expect(matter.registerPlatformAccessories).toHaveBeenCalledWith(
        "homebridge-xiaomi-roborock-vacuum",
        "XiaomiRoborockVacuum",
        [expect.objectContaining({ UUID: vacuum.uuid })]
      );
    });

    test("replaces the cached state with the robot's (e.g. a run mode left in Cleaning)", () => {
      expect(lastUpdate("rvcRunMode")).toStrictEqual({
        currentMode: RunMode.Idle,
      });
      expect(lastUpdate("rvcOperationalState")).toStrictEqual({
        operationalState: OperationalState.Charging,
      });
      expect(lastUpdate("rvcCleanMode")).toStrictEqual({
        supportedModes: vacuum.build().clusters!.rvcCleanMode!.supportedModes,
        currentMode: vacuum.build().clusters!.rvcCleanMode!.currentMode,
      });
      expect(matter.updateAccessoryState).toHaveBeenCalledWith(
        vacuum.uuid,
        "serviceArea",
        expect.objectContaining({ selectedAreas: [], currentArea: null })
      );
      expect(lastUpdate("powerSource")).toStrictEqual({
        batPercentRemaining: 160,
        batChargeLevel: PowerSource.BatChargeLevel.Ok,
        batChargeState: PowerSource.BatChargeState.IsCharging,
      });
    });

    test("the changes that come during the sync are applied after it", async () => {
      matter.updateAccessoryState.mockClear();
      const sync = createVacuum();
      await sync.register();
      properties.state = "cleaning";
      stateChanged$.next({ key: "state", value: "cleaning" });
      await new Promise(setImmediate);
      expect(lastUpdate("rvcRunMode")).toStrictEqual({
        currentMode: RunMode.Cleaning,
      });
      sync.stop();
    });

    test("cleaning", async () => {
      properties.state = "room-cleaning";
      stateChanged$.next({ key: "state", value: "room-cleaning" });
      await new Promise(setImmediate);
      expect(lastUpdate("rvcOperationalState")).toStrictEqual({
        operationalState: OperationalState.Running,
      });
      expect(lastUpdate("rvcRunMode")).toStrictEqual({
        currentMode: RunMode.Cleaning,
      });
    });

    test("docked: the current room is cleared", async () => {
      properties.batteryLevel = 100;
      stateChanged$.next({ key: "state", value: "charging" });
      await new Promise(setImmediate);
      expect(lastUpdate("rvcOperationalState")).toStrictEqual({
        operationalState: OperationalState.Docked,
      });
      expect(lastUpdate("rvcRunMode")).toStrictEqual({
        currentMode: RunMode.Idle,
      });
      expect(lastUpdate("serviceArea")).toStrictEqual({ currentArea: null });
    });

    test("battery", async () => {
      stateChanged$.next({ key: "batteryLevel", value: 15 });
      await new Promise(setImmediate);
      expect(lastUpdate("powerSource")).toStrictEqual({
        batPercentRemaining: 30,
        batChargeLevel: PowerSource.BatChargeLevel.Warning,
        batChargeState: PowerSource.BatChargeState.IsCharging,
      });
    });

    test("fan speed and water level changed from the app", async () => {
      properties.fanSpeed = 105;
      properties.waterBoxMode = 201;
      stateChanged$.next({ key: "waterBoxMode", value: 201 });
      await new Promise(setImmediate);
      // "Light Mop"
      expect(lastUpdate("rvcCleanMode")).toStrictEqual({ currentMode: 6 });
    });

    test("errors, and when they're cleared", async () => {
      errorChanged$.next({ id: 5, description: "Main brush" });
      await new Promise(setImmediate);
      expect(lastUpdate("rvcOperationalState")).toStrictEqual({
        operationalState: OperationalState.Error,
        operationalError: {
          errorStateId: ErrorState.BrushJammed,
          errorStateDetails: "Main brush",
        },
      });
      errorChanged$.next(null);
      await new Promise(setImmediate);
      expect(matter.updateAccessoryState).toHaveBeenCalledWith(
        vacuum.uuid,
        "rvcOperationalState",
        { operationalError: { errorStateId: ErrorState.NoError } }
      );
      // Back to what the robot is doing
      expect(lastUpdate("rvcOperationalState")).toStrictEqual({
        operationalState: OperationalState.Charging,
      });
    });

    test("the room it's in (Xiaomi Cloud)", async () => {
      currentRoom$.next("17");
      await new Promise(setImmediate);
      expect(lastUpdate("serviceArea")).toStrictEqual({ currentArea: 17 });
      currentRoom$.next(undefined);
      await new Promise(setImmediate);
      expect(lastUpdate("serviceArea")).toStrictEqual({ currentArea: null });
    });

    test("a failing update doesn't stop the next ones", async () => {
      matter.updateAccessoryState.mockRejectedValueOnce(new Error("not ready"));
      stateChanged$.next({ key: "batteryLevel", value: 50 });
      stateChanged$.next({ key: "batteryLevel", value: 40 });
      await new Promise(setImmediate);
      expect(lastUpdate("powerSource")).toMatchObject({
        batPercentRemaining: 80,
      });
    });

    test("stops following the robot", async () => {
      vacuum.stop();
      matter.updateAccessoryState.mockClear();
      stateChanged$.next({ key: "batteryLevel", value: 50 });
      await new Promise(setImmediate);
      expect(matter.updateAccessoryState).not.toHaveBeenCalled();
    });
  });
});
