import { describe, test, expect, vi } from "vitest";
import { safeCall } from "./safeCall.js";

describe("safeCall", () => {
  test("call the method if the value is defined", () => {
    const fn = vi.fn();
    safeCall("some_value", fn);
    expect(fn).toHaveBeenCalledWith("some_value");
  });
  test("does not call the method when the value is not defined", () => {
    const fn = vi.fn();
    safeCall(undefined, fn);
    expect(fn).not.toHaveBeenCalled();
  });
});
