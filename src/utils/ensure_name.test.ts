import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import * as hap from "@homebridge/hap-nodejs";
import { ensureName } from "./ensure_name";

describe("ensureName", () => {
  const getItemSpy = vi.spyOn(hap.HAPStorage.storage(), "getItem");
  const setItemSpy = vi.spyOn(hap.HAPStorage.storage(), "setItemSync");

  const service = new hap.Service.Switch("test", "test");

  beforeEach(() => {
    vi.resetAllMocks();
    // Nothing is stored: a reset spy calls the real storage again (unlike Jest)
    getItemSpy.mockReturnValue(undefined);
    setItemSpy.mockReturnValue(undefined);
  });

  afterEach(() => {
    service
      .getCharacteristic(hap.Characteristic.ConfiguredName)
      .removeAllListeners("change");
  });

  test("sets the default name", () => {
    const setCharacteristicSpy = vi.spyOn(service, "setCharacteristic");
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
    const setCharacteristicSpy = vi.spyOn(service, "setCharacteristic");
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
