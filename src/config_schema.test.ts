import { describe, test, expect } from "vitest";
import schema from "../config.schema.json";
import { ACCESSORY_NAME } from "./constants";

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};
type LayoutItem = string | { key?: string; items?: LayoutItem[] };

/** Resolves a layout key like `devices[].rooms[].id` to its schema definition */
function resolve(root: JsonSchema, key: string): JsonSchema | undefined {
  let current: JsonSchema | undefined = root;
  for (const part of key.split(".")) {
    const name = part.replace(/\[\]$/, "");
    current = current?.properties?.[name];
    if (part.endsWith("[]")) current = current?.items;
  }
  return current;
}

function layoutKeys(items: LayoutItem[]): string[] {
  return items.flatMap((item) =>
    typeof item === "string"
      ? [item]
      : [...(item.key ? [item.key] : []), ...layoutKeys(item.items ?? [])]
  );
}

describe("config.schema.json", () => {
  test("is registered as a singular platform", () => {
    expect(schema.pluginAlias).toBe(ACCESSORY_NAME);
    expect(schema.pluginType).toBe("platform");
    expect(schema.singular).toBe(true);
  });

  test("every layout key exists in the schema", () => {
    const keys = layoutKeys(schema.layout as LayoutItem[]);
    expect(keys.length).toBeGreaterThan(20);
    const missing = keys.filter((key) => !resolve(schema.schema, key));
    expect(missing).toEqual([]);
  });

  test("every device property is in the layout", () => {
    const keys = new Set(layoutKeys(schema.layout as LayoutItem[]));
    const properties = Object.keys(
      schema.schema.properties.devices.items.properties
    );
    // Fields intentionally hidden from the UI
    const hidden = ["disableCareServices"];
    const missing = properties.filter(
      (name) => !keys.has(`devices[].${name}`) && !hidden.includes(name)
    );
    expect(missing).toEqual([]);
  });

  test("waterBox has no default, so it can be auto-detected", () => {
    expect(
      schema.schema.properties.devices.items.properties.waterBox
    ).not.toHaveProperty("default");
  });
});
