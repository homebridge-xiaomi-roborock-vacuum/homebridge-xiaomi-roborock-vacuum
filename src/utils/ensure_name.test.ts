import * as hap from "hap-nodejs";
import { ensureName } from "./ensure_name";

describe("ensureName", () => {
  const getItemSpy = jest.spyOn(hap.HAPStorage.storage(), "getItemSync");
  const setItemSpy = jest.spyOn(hap.HAPStorage.storage(), "setItemSync");

  const service = new hap.Service.Switch("test", "test");

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    service
      .getCharacteristic(hap.Characteristic.ConfiguredName)
      .removeAllListeners("change");
  });

  test("sets the default name", () => {
    const setCharacteristicSpy = jest.spyOn(service, "setCharacteristic");
    ensureName(hap, service, "custom test");
    expect(setCharacteristicSpy).toHaveBeenCalledTimes(1);
    expect(setCharacteristicSpy).toHaveBeenCalledWith(
      hap.Characteristic.ConfiguredName,
      "custom test"
    );
    expect(setItemSpy).toHaveBeenCalledTimes(0);
  });

  test("does not set the default name", () => {
    getItemSpy.mockReturnValueOnce("hi there!");
    const setCharacteristicSpy = jest.spyOn(service, "setCharacteristic");
    ensureName(hap, service, "custom test");
    expect(setCharacteristicSpy).toHaveBeenCalledTimes(0);
    expect(setItemSpy).toHaveBeenCalledTimes(0);
  });

  test("stores a custom name in cache", () => {
    getItemSpy.mockReturnValueOnce("hi there!");
    ensureName(hap, service, "custom test");
    service.updateCharacteristic(
      hap.Characteristic.ConfiguredName,
      "changed name"
    );
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(
      "homebridge-xiaomi-roborock-vacuum-configured-name-custom_test",
      "changed name"
    );
  });
});
