import { safeCall } from "./safeCall";

describe("safeCall", () => {
  test("call the method if the value is defined", () => {
    const fn = jest.fn();
    safeCall("some_value", fn);
    expect(fn).toBeCalledWith("some_value");
  });
  test("does not call the method when the value is not defined", () => {
    const fn = jest.fn();
    safeCall(undefined, fn);
    expect(fn).not.toBeCalled();
  });
});
