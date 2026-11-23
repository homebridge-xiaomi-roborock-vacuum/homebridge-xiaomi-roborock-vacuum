import fs from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { resolveVacuumModes, vacuumModels } from "node-miio";
import { FIRMWARE_VARIANTS, renderSpeedsDoc } from "./speeds_doc";

describe("docs/speeds-and-modes.md", () => {
  test("is up to date with the code (run `npm run docs:speeds` after changing the speeds or the clean modes)", async () => {
    const file = path.join(__dirname, "../../docs/speeds-and-modes.md");
    const expected = await format(renderSpeedsDoc(), { parser: "markdown" });
    expect(fs.readFileSync(file, "utf8")).toBe(expected);
  });

  test("shows the HomeKit slider ranges and the Matter modes (e.g. the Saros 20's SmartPlan)", () => {
    const doc = renderSpeedsDoc();
    expect(doc).toContain("## roborock.vacuum.a296 — Roborock Saros 20 Neo");
    expect(doc.match(/^## dreame\.vacuum\.mc1808/gm)).toHaveLength(1);
    expect(doc).toMatch(
      /\| SmartPlan \| Auto, Vacuum, Mop \| 110 \| 209 \| 306 \|/
    );
    // The S5 changed its fan speeds with firmware 3.5.7
    expect(doc).toContain("**With firmware >=3.5.7**");
  });

  // The page lists the firmware variants from FIRMWARE_VARIANTS: they must match node-miio's table
  describe("firmware variants", () => {
    const fanSpeeds = (model: string, firmware?: string) =>
      JSON.stringify(resolveVacuumModes(model, firmware).fanSpeeds);
    const versionBefore = (version: string) => {
      const [major, minor, patch] = version.split(".").map(Number);
      return patch > 0
        ? `${major}.${minor}.${patch - 1}`
        : `${major}.${Math.max(minor - 1, 0)}.99`;
    };

    test.each(Object.entries(FIRMWARE_VARIANTS))(
      "%s changes its fan speeds at firmware %s",
      (model, firmware) => {
        expect(fanSpeeds(model, firmware)).not.toBe(
          fanSpeeds(model, versionBefore(firmware))
        );
      }
    );

    test("no other model changes its fan speeds with the firmware", () => {
      const changing = vacuumModels().filter(
        (model) => fanSpeeds(model) !== fanSpeeds(model, "99.0.0")
      );
      expect(changing).toEqual(Object.keys(FIRMWARE_VARIANTS));
    });
  });
});
