import fs from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { renderSpeedsDoc } from "./speeds_doc";

describe("docs/speeds-and-modes.md", () => {
  test("is up to date with the code (run `npm run docs:speeds` after changing the speeds or the clean modes)", async () => {
    const file = path.join(__dirname, "../../docs/speeds-and-modes.md");
    const expected = await format(renderSpeedsDoc(), { parser: "markdown" });
    expect(fs.readFileSync(file, "utf8")).toBe(expected);
  });

  test("shows the HomeKit slider ranges and the Matter modes (e.g. the Saros 20's SmartPlan)", () => {
    const doc = renderSpeedsDoc();
    expect(doc).toContain(
      "## roborock.vacuum.a296 — Roborock Saros 20 (Roborock app)"
    );
    expect(doc.match(/^## dreame\.vacuum\.mc1808/gm)).toHaveLength(1);
    expect(doc).toMatch(
      /\| SmartPlan \| Auto, Vacuum, Mop \| 110 \| 209 \| 306 \|/
    );
    // The S5 changed its fan speeds with firmware 3.5.7
    expect(doc).toContain("**With firmware >=3.5.7**");
  });
});
