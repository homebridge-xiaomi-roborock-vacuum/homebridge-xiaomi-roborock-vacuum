import { MODELS } from "./models";

describe("Ensure speed tests", () => {
  describe("rockrobo.vacuum.v1", () => {
    const { speed } = MODELS["rockrobo.vacuum.v1"][0];
    test("ensure miLevels are consistent", () => {
      const miLevels = speed.map(({ miLevel }) => miLevel);
      expect(miLevels).toStrictEqual([-1, 38, 60, 75, 100]);
    });
  });
});
