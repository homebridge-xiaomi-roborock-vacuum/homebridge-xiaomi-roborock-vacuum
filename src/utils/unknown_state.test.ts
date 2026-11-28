import { describe, test, expect } from "vitest";
import { unknownStateCode, unknownStateIssueUrl } from "./unknown_state.js";

describe("unknownStateCode", () => {
  test.each([
    ["unknown-31", 31],
    ["unknown--1", -1],
    ["charging", undefined],
    ["unknown-", undefined],
    [undefined, undefined],
    [31, undefined],
  ])("%p → %p", (state, code) => {
    expect(unknownStateCode(state)).toBe(code);
  });
});

describe("unknownStateIssueUrl", () => {
  test("without a description (legacy models)", () => {
    const url = new URL(
      unknownStateIssueUrl({ model: "roborock.vacuum.a75", code: 40 })
    );
    expect(url.searchParams.get("title")).toBe(
      "Unknown status 40 on roborock.vacuum.a75"
    );
    expect(url.searchParams.get("description")).toContain(
      "reports an unknown status: 40."
    );
  });
});
