/**
 * Vacuums still configured as pre-1.0 accessories (`"accessories": [{ "accessory": "XiaomiRoborockVacuum", … }]`).
 *
 * The Homebridge UI only shows (and saves) the blocks of the plugin's type in `config.schema.json` (`platform`), so
 * these blocks are invisible in the plugin's settings. The settings page moves them to the platform's `devices`.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ALIASES = [
  "XiaomiRoborockVacuum",
  "homebridge-xiaomi-roborock-vacuum.XiaomiRoborockVacuum",
];

type Block = Record<string, unknown>;

/** What moving the legacy blocks to the platform involves */
export interface LegacyConfig {
  /** How many `accessories` blocks are legacy ones (removed once moved) */
  blocks: number;
  /** Their vacuums, as the platform's `devices` */
  devices: Block[];
  /** The child bridge of the first block that runs in one (`_bridge`): it moves to the platform block */
  bridge?: Block;
  /** How many different child bridges the blocks run in (only one can be kept) */
  bridges: number;
  /** A `cloud` option, saved by the Homebridge UI in a legacy block (#1248) */
  cloud?: Block;
}

/**
 * @param block A block of `accessories`
 * @returns Whether it's one of this plugin's
 */
export function isLegacyBlock(block: unknown): block is Block {
  return (
    typeof block === "object" &&
    block !== null &&
    ALIASES.includes((block as Block).accessory as string)
  );
}

/**
 * @param blocks The plugin's `accessories` blocks
 * @returns Their vacuums as platform devices, and the platform options they had
 */
export function convertLegacyBlocks(blocks: Block[]): LegacyConfig {
  const devices: Block[] = [];
  const bridges: Block[] = [];
  let cloud: Block | undefined;
  for (const block of blocks) {
    const { _bridge, devices: uiDevices, ...rest } = block;
    delete rest.accessory;
    if (Array.isArray(uiDevices) && uiDevices.length > 0 && !rest.ip) {
      // Saved by the Homebridge UI's platform form (#1248): the devices, and maybe some platform options
      devices.push(...(uiDevices as Block[]).map((device) => ({ ...device })));
      if (rest.cloud && !cloud) cloud = rest.cloud as Block;
    } else {
      devices.push(rest);
    }
    if (_bridge) bridges.push(_bridge as Block);
  }
  return {
    blocks: blocks.length,
    devices,
    bridge: bridges[0],
    bridges: new Set(bridges.map((bridge) => bridge.username)).size,
    cloud,
  };
}

async function readConfig(configPath: string) {
  return JSON.parse(await readFile(configPath, "utf8")) as Block & {
    accessories?: unknown[];
  };
}

/**
 * @param configPath Homebridge's `config.json`
 * @returns The legacy vacuums, converted
 */
export async function readLegacyConfig(
  configPath: string
): Promise<LegacyConfig> {
  const config = await readConfig(configPath);
  return convertLegacyBlocks((config.accessories ?? []).filter(isLegacyBlock));
}

/**
 * Removes the legacy blocks, once they're in the platform. Saves a backup first, where the Homebridge UI keeps its own
 * (Settings → Backup → Config backups), so it can be restored from there.
 *
 * @param configPath Homebridge's `config.json`
 * @param expectedBlocks How many legacy blocks were moved: if the config has a different number, it changed in the
 * meantime, and nothing is removed
 * @param now The time, for the backup's name
 * @returns How many blocks were removed, and the backup's path
 */
export async function removeLegacyBlocks(
  configPath: string,
  expectedBlocks: number,
  now = Date.now()
): Promise<{ removed: number; backup: string }> {
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw) as Block & { accessories?: unknown[] };
  const accessories = config.accessories ?? [];
  const legacy = accessories.filter(isLegacyBlock);
  if (legacy.length !== expectedBlocks) {
    throw new Error(
      "The config changed in the meantime: reload the settings, and try again."
    );
  }

  const backupDir = join(dirname(configPath), "backups", "config-backups");
  await mkdir(backupDir, { recursive: true });
  const backup = join(backupDir, `config.json.${now}`);
  await writeFile(backup, raw);

  config.accessories = accessories.filter((block) => !isLegacyBlock(block));
  const tmp = `${configPath}.${now}.tmp`;
  await writeFile(tmp, `${JSON.stringify(config, null, 4)}\n`);
  await rename(tmp, configPath);
  return { removed: legacy.length, backup };
}
