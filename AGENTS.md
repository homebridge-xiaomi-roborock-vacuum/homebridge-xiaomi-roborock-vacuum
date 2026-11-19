# AGENTS.md

Guidance for AI coding agents (and humans) working on `homebridge-xiaomi-roborock-vacuum`.

## Context

- Homebridge plugin that exposes Xiaomi / Roborock vacuums (paired in the Mi Home app) to HomeKit.
  The same author maintains a Matter alternative: [matterbridge-xiaomi-roborock](https://github.com/afharo/matterbridge-xiaomi-roborock).
- The device protocol lives in [node-miio](https://github.com/afharo/node-miio). Protocol and per-model fixes belong **there**:
  this plugin should only translate between node-miio and HomeKit.
- **The maintainer no longer owns test hardware** (see [#1232](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1232)).
  Every behavioural change must be covered by unit tests, and be validated by users on a beta release.

## Branches and PRs

- `master`: current stable line (0.x, registered as an _accessory_).
- `next`: v1 work (registered as a _platform_, PR #1037). **Changes must land on both branches**:
  one PR against `master`, and another one against `next`, which usually cherry-picks the same commits.
- PRs come from the maintainer's fork (`origin`) into the org repo (`upstream`).
- Label every PR when creating it: `enhancement`, `bug`, `dependencies` (and `New Model` when adding a device).
  This repo has no `documentation` label.

## Commands

```sh
npm ci
npm run lint    # prettier --check .
npm test        # jest (babel-jest: tests are not type-checked)
npm run build   # tsc (type-checks everything, tests included)
node dist/bin/miio-vacuum.js --help   # the CLI is a thin wrapper around node-miio's
```

## Layout

- `src/index.ts`: registers the plugin. `src/xiaomi_roborock_vacuum_accessory.ts` (master) or `src/homebridge_entities/` (next): the HomeKit entities.
- `src/services/device_manager.ts`: connects with `miio.device({ address, token })` from node-miio, polls the state and emits changes.
  - `device.matches("type:vaccuum")` is intentional: it's how abstract-things (used by node-miio) spells the type.
  - `reportedModes`: fan speeds / water levels from node-miio (`device.fanSpeeds()` / `waterBoxModes()`), loaded once after connecting.
- `src/services/*`: one HomeKit service each (main fan/switch, battery, dock, rooms, zones, water box, care…).
- `src/utils/find_speed_modes.ts`: models listed in `src/models/` keep the local tables. Any other model uses `reportedModes`
  (an "Off" -1 speed is prepended, which stops the cleaning). The plan is to remove `src/models/` once node-miio's lists are confirmed.
- `src/utils/miio_types.ts`: hand-written types for node-miio (it doesn't ship `.d.ts` files yet).
- State names come from node-miio. Notably for Roborock: state 2 = `sleeping`, 3 = `idle` (previously `waiting`), 100 = `fully-charged`.

## Tests

- `src/test.mocks.ts` mocks the node-miio device. `src/services/device_manager.test.mock.ts` mocks the `node-miio` module (`jest.doMock`).

## Dependencies

- `.npmrc` exempts `node-miio` from any `min-release-age` cooldown (`min-release-age-exclude`), so new betas can be picked up right away.
  Every other package still follows the cooldown.

## Licensing

MIT. Don't copy code from GPL projects (e.g. python-miio). Use them as behavioural references only.
