const safeishJSON = require("./safeishJSON");

describe("safeishJSON", () => {
  test("parses a normal JSON", () => {
    expect(safeishJSON('{"test": 1}')).toStrictEqual({ test: 1 });
  });
  test("parses a JSON with empty values", () => {
    expect(safeishJSON('{"test": [,]}')).toStrictEqual({ test: [null, null] });
  });
});
