// ============= MIIO MOCKS ================

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

const miio = {
  device: miioDevice,
  createMock: () => ({
    device: jest.fn().mockImplementation(() => miioDevice),
  }),
};

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

const Service = createServiceMock();
Service.Switch = createServiceMock();
Service.FilterMaintenance = createServiceMock();
Service.AccessoryInformation = createServiceMock();
Service.Fan = createServiceMock();
Service.BatteryService = createServiceMock();
Service.OccupancySensor = createServiceMock();

const Characteristic = jest.fn();
Characteristic.Formats = { FLOAT: 1 };
Characteristic.Perms = { READ: 1, NOTIFY: 2 };
Characteristic.BatteryLevel = jest.fn();
Characteristic.StatusLowBattery = jest.fn();
Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW = "BATTERY_LEVEL_LOW";
Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL = "BATTERY_LEVEL_NORMAL";
Characteristic.ChargingState = jest.fn();
Characteristic.ChargingState.CHARGING = "CHARGING";
Characteristic.ChargingState.NOT_CHARGING = "NOT_CHARGING";
Characteristic.OccupancyDetected = jest.fn();
Characteristic.On = jest.fn();
Characteristic.RotationSpeed = jest.fn();
Characteristic.FilterChangeIndication = jest.fn();
Characteristic.FilterLifeLevel = jest.fn();
Characteristic.Manufacturer = jest.fn();
Characteristic.Model = jest.fn();
Characteristic.FirmwareRevision = jest.fn();
Characteristic.SerialNumber = jest.fn();

const createHomebridgeMock = () => ({
  registerAccessory: jest.fn(),
  hap: { Characteristic, Service },
});

module.exports = {
  createHomebridgeMock,
  miio,
};
