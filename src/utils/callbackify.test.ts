import { callbackify } from "./callbackify";

describe("callbackify", () => {
  test("resolves the callback with the value from the promise", (done) => {
    const fn = jest.fn().mockResolvedValue("some_value");
    callbackify(fn, (err, value) => {
      expect(value).toBe("some_value");
      expect(err).toBeNull();
      done();
    });
  });
  test("resolves the callback with the value from the promise", (done) => {
    const error = new Error("something went terribly wrong");
    const fn = jest.fn().mockRejectedValue(error);
    callbackify(fn, (err, value) => {
      expect(value).toBeUndefined();
      expect(err).toStrictEqual(error);
      done();
    });
  });
});
