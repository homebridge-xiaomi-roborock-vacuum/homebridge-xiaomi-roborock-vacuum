import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  convertLegacyBlocks,
  isLegacyBlock,
  readLegacyConfig,
  removeLegacyBlocks,
} from "./legacy";
import { createHandlers } from "./handlers";

const bridge = { username: "0E:AA:BB:CC:DD:01", port: 51900 };

describe("legacy accessories", () => {
  describe("isLegacyBlock", () => {
    test("matches this plugin's accessories, with or without the plugin name", () => {
      expect(isLegacyBlock({ accessory: "XiaomiRoborockVacuum" })).toBe(true);
      expect(
        isLegacyBlock({
          accessory: "homebridge-xiaomi-roborock-vacuum.XiaomiRoborockVacuum",
        })
      ).toBe(true);
      expect(isLegacyBlock({ accessory: "Other" })).toBe(false);
      expect(isLegacyBlock(null)).toBe(false);
    });
  });

  describe("convertLegacyBlocks", () => {
    test("each block becomes a device with all its options, and the child bridge moves to the platform", () => {
      expect(
        convertLegacyBlocks([
          {
            accessory: "XiaomiRoborockVacuum",
            name: "Robot",
            ip: "192.168.1.2",
            token: "abc",
            waterBox: true,
            _bridge: bridge,
          },
          {
            accessory: "XiaomiRoborockVacuum",
            name: "Upstairs",
            ip: "192.168.1.3",
            token: "def",
          },
        ])
      ).toEqual({
        blocks: 2,
        devices: [
          { name: "Robot", ip: "192.168.1.2", token: "abc", waterBox: true },
          { name: "Upstairs", ip: "192.168.1.3", token: "def" },
        ],
        bridge,
        bridges: 1,
        cloud: undefined,
      });
    });

    test("blocks saved by the UI's platform form (#1248) keep all their devices and the cloud option", () => {
      expect(
        convertLegacyBlocks([
          {
            accessory: "XiaomiRoborockVacuum",
            cloud: { enabled: true },
            devices: [
              { name: "A", ip: "1.1.1.1", token: "a" },
              { name: "B", ip: "2.2.2.2", token: "b" },
            ],
          },
        ])
      ).toMatchObject({
        blocks: 1,
        devices: [
          { name: "A", ip: "1.1.1.1", token: "a" },
          { name: "B", ip: "2.2.2.2", token: "b" },
        ],
        cloud: { enabled: true },
        bridges: 0,
      });
    });

    test("counts the different child bridges (only the first is kept)", () => {
      const result = convertLegacyBlocks([
        { accessory: "XiaomiRoborockVacuum", name: "A", _bridge: bridge },
        {
          accessory: "XiaomiRoborockVacuum",
          name: "B",
          _bridge: { username: "0E:AA:BB:CC:DD:02" },
        },
        { accessory: "XiaomiRoborockVacuum", name: "C", _bridge: bridge },
      ]);
      expect(result.bridge).toBe(bridge);
      expect(result.bridges).toBe(2);
    });
  });

  describe("config file", () => {
    let dir: string;
    let configPath: string;
    const config = {
      bridge: { name: "Homebridge" },
      accessories: [
        { accessory: "XiaomiRoborockVacuum", name: "Robot", ip: "1.1.1.1" },
        { accessory: "SomethingElse", name: "Lamp" },
      ],
      platforms: [{ platform: "config" }],
    };

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), "xrv-legacy-"));
      configPath = join(dir, "config.json");
      await writeFile(configPath, JSON.stringify(config));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    test("reads the legacy vacuums", async () => {
      await expect(readLegacyConfig(configPath)).resolves.toMatchObject({
        blocks: 1,
        devices: [{ name: "Robot", ip: "1.1.1.1" }],
      });
    });

    test("a config without accessories has none", async () => {
      await writeFile(configPath, JSON.stringify({ platforms: [] }));
      await expect(readLegacyConfig(configPath)).resolves.toMatchObject({
        blocks: 0,
        devices: [],
      });
    });

    test("removes only this plugin's blocks, after a backup in the UI's backups folder", async () => {
      const { removed, backup } = await removeLegacyBlocks(
        configPath,
        1,
        1700000000000
      );
      expect(removed).toBe(1);
      expect(backup).toBe(
        join(dir, "backups", "config-backups", "config.json.1700000000000")
      );
      expect(JSON.parse(await readFile(backup, "utf8"))).toEqual(config);
      expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
        ...config,
        accessories: [{ accessory: "SomethingElse", name: "Lamp" }],
      });
      // No temporary file left behind
      expect(await readdir(dir)).toEqual(["backups", "config.json"]);
    });

    test("doesn't touch the config if it changed in the meantime", async () => {
      await expect(removeLegacyBlocks(configPath, 2)).rejects.toThrow(
        "The config changed in the meantime"
      );
      expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual(config);
    });

    test("the settings page's requests", async () => {
      const handlers = createHandlers(jest.fn(), undefined, configPath);
      await expect(handlers["/legacy"]()).resolves.toMatchObject({
        blocks: 1,
      });
      await expect(
        handlers["/legacy/remove"]({ blocks: 1 })
      ).resolves.toMatchObject({ removed: 1 });
      await expect(handlers["/legacy"]()).resolves.toMatchObject({
        blocks: 0,
      });
    });

    test("without the config's path, the requests fail", async () => {
      const handlers = createHandlers(jest.fn());
      expect(() => handlers["/legacy"]()).toThrow(
        "Homebridge's config file is unknown."
      );
    });
  });
});
