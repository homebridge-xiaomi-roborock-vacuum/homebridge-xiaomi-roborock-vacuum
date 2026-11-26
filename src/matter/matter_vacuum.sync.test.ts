import type { MatterAPI } from "homebridge";
import type { MiotSpec } from "node-miio";
import type { Subscription } from "rxjs";
import { applyConfigDefaults } from "../services/config_service";
import { DeviceManager } from "../services/device_manager";
import { createHomebridgeMock } from "../test.mocks";
import { findSpeedModes } from "../utils/find_speed_modes";
import { getLoggerMock } from "../utils/logger.mock";
import { OperationalState, RunMode } from "./constants";
import { MatterVacuum } from "./matter_vacuum";

// The real node-miio, except for the connection: `device()` returns a MIoT vacuum that answers from `robot`
jest.mock("node-miio", () => ({
  ...jest.requireActual<typeof import("node-miio")>("node-miio"),
  device: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const miio = require("node-miio") as jest.Mocked<typeof import("node-miio")>;

/** The robot's MIoT properties, by `siid.piid` */
const robot: Record<string, unknown> = {};

/** A minimal MIoT spec: the status and the battery (like xiaomi.vacuum.d101's) */
const spec = {
  type: "urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-d101:3",
  description: "Robot Cleaner",
  services: [
    {
      iid: 2,
      type: "urn:miot-spec-v2:service:vacuum:00007810:xiaomi-d101:1",
      description: "Robot Cleaner",
      properties: [
        {
          iid: 2,
          type: "urn:miot-spec-v2:property:status:00000007:xiaomi-d101:1",
          description: "Status",
          format: "uint8",
          access: ["read", "notify"],
          "value-list": [
            { value: 1, description: "Idle" },
            { value: 2, description: "Charging" },
            { value: 4, description: "Sweeping" },
            { value: 14, description: "StationWorking" },
          ],
        },
      ],
      actions: [
        {
          iid: 1,
          type: "urn:miot-spec-v2:action:start-sweep:00002804:xiaomi-d101:1",
          description: "Start Sweep",
          in: [],
          out: [],
        },
      ],
    },
    {
      iid: 3,
      type: "urn:miot-spec-v2:service:battery:00007805:xiaomi-d101:1",
      description: "Battery",
      properties: [
        {
          iid: 1,
          type: "urn:miot-spec-v2:property:battery-level:00000014:xiaomi-d101:1",
          description: "Battery Level",
          format: "uint8",
          access: ["read", "notify"],
          unit: "percentage",
          "value-range": [0, 100, 1],
        },
      ],
    },
  ],
} as unknown as MiotSpec;

function createRobot() {
  const call = jest.fn(async (method: string, params: unknown) => {
    if (method !== "get_properties") {
      throw new Error(`Unexpected call to "${method}"`);
    }
    return (params as Array<{ did: string; siid: number; piid: number }>).map(
      (p) => {
        const value = robot[`${p.siid}.${p.piid}`];
        return value === undefined
          ? { ...p, code: -4001 }
          : { ...p, code: 0, value };
      }
    );
  });
  const handle = {
    ref: { release: jest.fn() },
    // `connected`: otherwise the device manager reconnects on every poll
    api: { id: 1234, model: "xiaomi.vacuum.d101", call, connected: true },
  };
  return new miio.MiotVacuum(handle as never, spec);
}

describe("MatterVacuum, following a real node-miio vacuum", () => {
  const log = getLoggerMock();
  let matter: jest.Mocked<MatterAPI>;
  let deviceManager: DeviceManager;
  let vacuum: MatterVacuum;

  /** What the device manager does every 30s (called directly: the test doesn't wait for the timer) */
  const poll = () =>
    (deviceManager as unknown as { getState(): Promise<void> }).getState();

  /** The last operational state sent to Matter */
  const operationalState = () =>
    matter.updateAccessoryState.mock.calls
      .filter(
        ([, cluster, attributes]) =>
          cluster === "rvcOperationalState" && "operationalState" in attributes
      )
      .at(-1)?.[2].operationalState;

  beforeEach(async () => {
    Object.assign(robot, { "2.2": 14, "3.1": 80 });
    miio.device.mockResolvedValue(createRobot() as never);
    matter = {
      uuid: { generate: jest.fn((id: string) => `uuid:${id}`) },
      deviceTypes: { RoboticVacuumCleaner: { name: "RoboticVacuumCleaner" } },
      status: {},
      registerPlatformAccessories: jest.fn().mockResolvedValue(undefined),
      updateAccessoryState: jest.fn().mockResolvedValue(undefined),
      getAccessoryState: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatterAPI>;

    deviceManager = new DeviceManager(createHomebridgeMock().hap, log, {
      ip: "192.168.0.1",
      token: "token",
    });
    // Connected (and polled once)
    await new Promise(setImmediate);
    // Its 30s polling: the test polls by itself
    (
      deviceManager as unknown as { statePollingSubscription?: Subscription }
    ).statePollingSubscription?.unsubscribe();
    await poll();
    vacuum = new MatterVacuum({
      matter,
      log,
      config: applyConfigDefaults({ name: "Robot", did: "123" }),
      deviceManager,
      serialNumber: "SN1",
      firmware: "1.0.0",
      speedModes: findSpeedModes("xiaomi.vacuum.d101"),
      rooms: [],
    });
    await vacuum.register();
    await new Promise(setImmediate);
  });

  afterEach(() => vacuum.stop());

  test("follows the robot's state, also when it's changed from the robot's app (#1314)", async () => {
    expect(operationalState()).toBe(OperationalState.CleaningMop);

    // The mop washing is stopped from the Mijia app
    robot["2.2"] = 2;
    await poll();
    await new Promise(setImmediate);
    expect(operationalState()).toBe(OperationalState.Charging);
    expect(
      matter.updateAccessoryState.mock.calls
        .filter(([, cluster]) => cluster === "rvcRunMode")
        .at(-1)?.[2]
    ).toStrictEqual({ currentMode: RunMode.Idle });

    robot["2.2"] = 4;
    await poll();
    await new Promise(setImmediate);
    expect(operationalState()).toBe(OperationalState.Running);
  });

  test("resends the state on every poll, even when it doesn't change", async () => {
    matter.updateAccessoryState.mockClear();
    await poll();
    await new Promise(setImmediate);
    expect(operationalState()).toBe(OperationalState.CleaningMop);
  });
});
