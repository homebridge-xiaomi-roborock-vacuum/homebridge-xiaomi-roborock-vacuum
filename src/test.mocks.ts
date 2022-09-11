// ============= MIIO MOCKS ================

import { API } from "homebridge";
import { Characteristic } from "hap-nodejs";

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
      onGet: createGetCharacteristicMock(),
      onSet: createGetCharacteristicMock(),
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
  LockMechanism: createServiceMock(),
});
export const createHomebridgeMock = () =>
  ({
    registerAccessory: jest.fn(),
    hap: { Characteristic, Service },
  } as unknown as jest.Mocked<API>);
