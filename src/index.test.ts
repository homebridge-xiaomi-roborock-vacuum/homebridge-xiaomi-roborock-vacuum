import { API } from 'homebridge';
import entrypoint from './index';

describe('entrypoint', () => {
  let api: jest.Mocked<API>;

  beforeEach(() => {
    api = {
      hap: {},
      registerAccessory: jest.fn(),
    } as unknown as jest.Mocked<API>; // No need to mock everything for these tests

    expect(() => entrypoint(api)).not.toThrow();
  });

  test('should register the accessory', () => {
    expect(api.registerAccessory).toHaveBeenCalledWith("homebridge-xiaomi-roborock-vacuum", "XiaomiRoborockVacuum", expect.any(Function))
  });
});