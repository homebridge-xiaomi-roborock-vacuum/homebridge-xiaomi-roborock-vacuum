import { describe, test, expect, vi } from "vitest";
import { callbackify } from "./callbackify";

/** Runs `callbackify` and resolves with the arguments of its callback */
function callbackArgs<T>(fn: () => T | Promise<T>) {
  return new Promise<[Error | null, T | undefined]>((resolve) => {
    void callbackify(fn, (err, value) => resolve([err, value]));
  });
}

describe("callbackify", () => {
  test("resolves the callback with the value from the promise", async () => {
    const fn = vi.fn().mockResolvedValue("some_value");
    await expect(callbackArgs(fn)).resolves.toStrictEqual([null, "some_value"]);
  });

  test("calls the callback with the error when the promise rejects", async () => {
    const error = new Error("something went terribly wrong");
    const fn = vi.fn().mockRejectedValue(error);
    await expect(callbackArgs(fn)).resolves.toStrictEqual([error, undefined]);
  });
});
