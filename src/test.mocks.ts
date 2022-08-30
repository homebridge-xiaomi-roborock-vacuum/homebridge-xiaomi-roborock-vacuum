// ============= MIIO MOCKS ================

import { API } from "homebridge";

const miioDevice = {
  miioModel: "test-model",
  matches: jest.fn(),
  destroy: jest.fn(),
  property: jest.fn(),
  on: jest.fn(),
  handle: { api: { parent: { socket: {} } } },
  poll: jest.fn(),
  state: jest.fn().mockReturnValue({}),
};

export const miio = {
  device: miioDevice,
  createMock: () => ({
    device: jest.fn().mockImplementation(() => miioDevice),
  }),
};

jest.doMock("./miio", () => miio.createMock());

// ============= HOMEBRIDGE MOCKS ================

const createGetCharacteristicMock = () =>
  jest.fn().mockImplementation(() =>
    Object.assign({}, createChainableServiceMethodsMock(), {
      setProps: jest.fn(),
      on: createGetCharacteristicMock(),
      updateValue: jest.fn(),
    })
  );

const createChainableServiceMethodsMock = () => ({
  addLinkedService: jest.fn(),
  getCharacteristic: createGetCharacteristicMock(),
  setCharacteristic: jest
    .fn()
    .mockImplementation(createChainableServiceMethodsMock),
});

const createServiceMock = () =>
  jest
    .fn()
    .mockImplementation((name, type) =>
      Object.assign({ name, type }, createChainableServiceMethodsMock())
    );

const Service = Object.assign(createServiceMock(), {
  Switch: createServiceMock(),
  FilterMaintenance: createServiceMock(),
  AccessoryInformation: createServiceMock(),
  Fan: createServiceMock(),
  BatteryService: createServiceMock(),
  OccupancySensor: createServiceMock(),
});

const Characteristic = Object.assign(jest.fn(), {
  Formats: { FLOAT: 1 },
  Perms: { READ: 1, NOTIFY: 2 },
  BatteryLevel: jest.fn(),
  StatusLowBattery: Object.assign(jest.fn(), {
    BATTERY_LEVEL_LOW: "BATTERY_LEVEL_LOW",
    BATTERY_LEVEL_NORMAL: "BATTERY_LEVEL_NORMAL",
  }),
  ChargingState: Object.assign(jest.fn(), {
    CHARGING: "CHARGING",
    NOT_CHARGING: "NOT_CHARGING",
  }),
  OccupancyDetected: jest.fn(),
  On: jest.fn(),
  RotationSpeed: jest.fn(),
  FilterChangeIndication: jest.fn(),
  FilterLifeLevel: jest.fn(),
  Manufacturer: jest.fn(),
  Model: jest.fn(),
  FirmwareRevision: jest.fn(),
  SerialNumber: jest.fn(),
});

export const createHomebridgeMock = () =>
  ({
    registerAccessory: jest.fn(),
    hap: { Characteristic, Service },
  } as unknown as jest.Mocked<API>);
