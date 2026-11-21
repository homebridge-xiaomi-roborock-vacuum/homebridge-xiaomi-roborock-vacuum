# Changelog

## Next

## 1.5.0

- [Feature] **Roborock app account in the settings page**: log in with a code sent by email (no terminal needed), list the robots of the account, and add them in one click (with their `duid`, `autoroom`, and the platform's `roborock` option). The Xiaomi and Roborock sections show their app's icon ([#1292](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1292)).
- [Feature] **The room a Roborock-app robot is cleaning**: `roomSensors` and the Matter vacuum's current area follow it, as the robot reports it in its status, without the Xiaomi Cloud nor downloading the map ([#1290](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1290), [#1293](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1293)).
- [Bug] Matter vacuum: Apple Home named it after its model (e.g. `roborock.vacuum.a296`) instead of its `name`. Vacuums paired before keep their name: rename them in the Home app. The robots of a Roborock app account report "Roborock" as the manufacturer ([#1291](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1291)).
- [Chore] Update node-miio to `0.10.0`: the room being cleaned, from the robot's status ([afharo/node-miio#53](https://github.com/afharo/node-miio/pull/53), [#1293](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1293)).
- [Chore] README: a header with the Homebridge, Xiaomi Home and Roborock logos, the apps' icons in their sections, and a Trademarks section ([#1292](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1292)).

## 1.4.0

- [Feature] **Robots paired with the Roborock app** (experimental): with the platform's new `roborock` option, after a one-off `npx node-miio roborock login` (a code is sent to your email), configure a robot with its `duid` (`npx node-miio roborock devices`). No token is needed, and the IP is optional: the plugin talks to the robot in your local network when possible, and through Roborock's cloud otherwise. With `"autoroom": true`, the rooms get the names given in the Roborock app. Supported: the robots with protocol `1.0` or `L01` (most S, Q and Saros robots). Read [Roborock app](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum#roborock-app-experimental) ([#104](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/104), [#387](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/387), [#1283](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1283)).
- [Feature] **SmartPlan** in the Matter robot vacuum (`"serviceType": "vacuum"`): on the robots that have it (e.g. Saros 20), the robot's SmartPlan replaces the "Automatic" clean mode, and it's shown as the current mode when it's picked in the Roborock app. The HomeKit fan and water box log "SmartPlan is on" instead of warning about an unsupported speed ([#1285](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1285)).
- [Bug] The water level didn't follow the robot: the plugin read it as `water_box_mode`, but node-miio's property is `waterBoxMode`. With the Matter vacuum, the current clean mode now follows the water level, and the HomeKit water level follows the changes made in the robot's app ([#1285](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1285)).
- [Bug] Matter vacuum: robots with a water slider (30 levels on the Saros 20) got one mop mode per level (37 clean modes in Apple Home). They now get Light, Medium and High Mop, and the vacuum & mop presets use the slider's low, middle and high levels ([#1286](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1286)).
- [Bug] Matter vacuum: changing the clean mode while the robot was on SmartPlan failed ("the operation couldn't be completed"): the robot refuses to change only the fan speed then (node-miio 0.9.1, [afharo/node-miio#52](https://github.com/afharo/node-miio/pull/52), [#1287](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1287)).
- [Chore] Update node-miio to `0.9.1`: Roborock app accounts (login, local and cloud connections, maps), the water level of newer firmwares, the mop-washing dock states, the robot's presets ([#1265](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1265), [#1288](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1288), [#1287](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1287)).
- [Chore] README restructured ([#1282](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1282)).

## 1.3.0

- [Feature] **The vacuum as Apple Home's native robot vacuum** (iOS 18.4+), with the new `"serviceType": "vacuum"` (platform only): start, stop and go to the dock, pause and resume, the rooms (read from the robot by default), the clean modes (one per fan speed, mop-only, and vacuum & mop presets), the battery, the dock states and the errors. It's a Matter accessory: enable Matter in the bridge that runs the plugin, and pair the vacuum with its own code. The HomeKit switches it replaces are hidden. The extras Matter doesn't cover (zones, spots, dust bin, mop dock, water tank, Do Not Disturb, the error and maintenance sensors) stay in HomeKit when enabled, and the care sensors are opt-in. Read [Robot vacuum (Matter)](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum#robot-vacuum-matter) ([#934](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/934), [#1275](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1275)).
- [Feature] Do Not Disturb switch (`doNotDisturb`, Roborock): no voice, dimmed lights, and the dock doesn't empty the dust bin, e.g. while someone is home. It turns the app's schedule back on, or sets `doNotDisturbStart` / `doNotDisturbEnd` ([#1136](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1136), [#1276](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1276)).
- [Feature] Clean several zones in one run with `zoneTimeout` (like `roomTimeout`), and only the switches of the zones being cleaned are on ([#594](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/594), [#1277](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1277)).
- [Feature] Maintenance: a "needs maintenance" sensor (`maintenanceSensor`) for notifications and automations, a reset of the brushes, filter and sensors from HomeKit after replacing them (Roborock), and their remaining life is updated after each poll ([#651](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/651), [#1278](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1278)).
- [Feature] Error sensor (`errorSensor`): detected while the robot reports an error (e.g. stuck), for notifications and automations ([#232](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/232), [#1280](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1280)).
- [Feature] Fan speed and water level per zone: `speed` and `waterSpeed` in a zone set them before cleaning it, e.g. one switch to vacuum a zone and another one to mop it ([#1028](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1028), [#1273](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1273)).
- [Feature] Mop-only cleaning on the S7 and newer (S7, S7 MaxV, S8, S7 Max Ultra, Q8 Max, Q Revo): the lowest fan speed is now "Mop" (no suction, with the mop attached) instead of "Soft" ([#791](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/791), [#1273](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1273)).
- [Bug] Every change of the robot's state and errors is reported, not only the first one: the mop drying switch, the water tank sensor, the pause switch, the water box, the dust bin lock and the errors stopped following the robot after their first cycle, until Homebridge restarted ([#1279](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1279)).
- [Chore] Build with TypeScript 7 (the compiled code is the same) ([#1213](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1213)).

## 1.2.0

- [Feature] Configure a robot by its device ID (`did`) instead of its IP and token, with the platform's `cloud` option: they're read from your Xiaomi account. When the robot stops answering, the plugin looks for it again in the account, so a new IP (or a new token, after resetting its Wi-Fi) doesn't break it anymore. Robots configured with an IP and token benefit too, when the `cloud` option is enabled. The settings page saves the `did` when adding a vacuum (or with "Save its device ID" for the ones already configured), and the form flags a vacuum with neither `did` nor `ip`.
- [Feature] Plugin settings page in the Homebridge UI ([#309](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/309)), above the usual form ([screenshot](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/blob/master/images/settings-page.png)):
  - **Log in to the Xiaomi Cloud** by scanning a QR code with the Mi Home app (no password, no terminal needed).
  - **Find your vacuums** in the account, and add them (name, IP and token) or update their token in one click.
  - **Move the vacuums still configured as accessories** (the format before 1.0, which the UI can't show) to the platform format, in one click: with all their options and their child bridge, after a backup of the config.
  - **See the map** of a Roborock vacuum, and name its rooms by clicking on them, even if the app doesn't let you name them. The names become the room cleaning switches (`rooms`). Tick 2x / 3x to also get "clean it 2 or 3 times" switches.
  - **Pick "go to" spots and draw zones on the map**: no more guessing coordinates.
- [Feature] Clean a room 2 or 3 times: `repeats: [2, 3]` in a room adds "Kitchen 2x" / "Kitchen 3x" switches ([#859](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/859)). The robot takes one count per run: the highest of the selected switches wins.
- [Feature] Several "go to" spots: `goToSpots: [{ "name", "x", "y" }]` adds a "go to …" switch per spot (the first words are configurable with `goToSpotWord`). The single `goTo` switch keeps working.
- [Feature] The room the robot is in, from its map in the Xiaomi Cloud (opt-in, Roborock only, platform mode). With the new platform option `cloud` and the vacuum's `roomSensors`, HomeKit shows an occupancy sensor per room, detected while the robot is in it. It needs a one-off `npx node-miio cloud login --qr`; your password is never stored.
- [Feature] No more token extraction: with the platform's `cloud` option, a robot configured with only its `ip` gets its token from your Xiaomi account when Homebridge starts. The token is now optional in the config.
- [Feature] The robot's position in the logs, to find the `goToX` / `goToY` coordinates: where it stops after each cleaning, and where it is when you turn on the "find me" switch ([#1020](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1020)).
- [Chore] Update node-miio to `0.7.0`: the robots share a single list of the Xiaomi account's devices ([afharo/node-miio#41](https://github.com/afharo/node-miio/pull/41)).

## 1.1.0

- [Feature] New optional `goToDock` switch (named with `goToDockWord`, `"go to dock"` by default) that sends the robot back to the dock. It's on while the robot is on its way, and turning it off stops the robot ([#322](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/322), [#1256](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1256)).
- [Feature] New optional `mopWash` button and `mopDrying` switch to wash and dry the mop in docks that support it (S7 MaxV Ultra, S8 Pro Ultra, Q Revo…). The drying switch also shows when the dock dries the mop on its own ([#752](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/752), [#1257](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1257)).
- [Feature] New optional `waterTankEmpty` occupancy sensor, detected when the clean water tank is empty. Only for models that report it, usually the ones with a self-refilling dock ([#1169](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1169), [#1258](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1258)).
- [Chore] Update node-miio to `0.4.0`, which adds the mop drying commands and the water tank / dock status ([#1259](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1259)).

## 1.0.1

- [Bug] An `accessories` block edited in the Homebridge UI (which saves the new `devices: [...]` platform format into it) works again: the accessory uses its first device, and the log explains how to move the block to `platforms` ([#1248](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1248)).
- [Bug] Room cleaning: send numeric room IDs as numbers. Some models (e.g. the S5) failed to start the room cleaning when they received them as strings ([#1032](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1032)).

## 1.0.0

> [!WARNING]
> **Potentially breaking changes.** This version is built around registering the plugin as a **platform** instead of an accessory.
> The legacy accessory mode **still works**, but it's no longer the recommended (or the UI-supported) way to configure the plugin. Please read the notes below before upgrading.

### ⚠️ Breaking changes

- **The Homebridge UI now configures the plugin as a platform** (`config.schema.json`). Your existing `accessories` config keeps working as it is, but the UI can no longer edit it. You'll need to edit it in the JSON config, or move it to the `platforms` section.
- **Moving a vacuum from `accessories` to `platforms` creates a new accessory in HomeKit.** You'll need to assign it to its room again, and re-create the scenes and automations that used it. In platform mode, the accessory is identified by its `name`, so **renaming it creates a new accessory too**.
- In platform mode, the accessory is only published once the plugin has connected to the robot. After the first run, it's cached.
- In platform mode, the exposed services may change after an upgrade, because they now depend on what the robot supports:
  - `waterBox` is enabled automatically on the models that support it, unless you set it explicitly. Set `"waterBox": false` to keep it disabled.
  - Switches that are no longer exposed (e.g. removed rooms) are removed from the accessory.

### Migrating from accessory to platform

1. Move each entry from `accessories` to a `devices` array inside a new `platforms` entry, and replace `"accessory": "XiaomiRoborockVacuum"` with a single `"platform": "XiaomiRoborockVacuum"` (see the README for a full example):
   ```jsonc
   "platforms": [
     {
       "platform": "XiaomiRoborockVacuum",
       "devices": [{ "name": "Vacuum", "ip": "192.168.1.150", "token": "…" }]
     }
   ]
   ```
2. Optional: if you copied the `rooms` config from the logs (semi-automatic rooms), you can replace it with `autoroom` again. The rooms are now resolved and saved automatically. Don't set both `rooms` and `autoroom`.
3. Restart Homebridge, then add the new accessory to its room and to your scenes and automations in the Home app.

### Enhancements

- Register as a platform, to add services dynamically after connecting to the robot ([#855](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/855), [#1037](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1037)).
- Rooms (`autoroom`) are resolved before registering the services in platform mode, so their switches show up without restarting. The resolved rooms are saved automatically and used as a fallback if they can't be retrieved (e.g. the timer was deleted) ([#1238](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1238)).
- In platform mode, `waterBox` is enabled automatically on the models that support it (using the water levels reported by [node-miio](https://github.com/afharo/node-miio)), unless set explicitly.
- In accessory mode, the logs suggest moving to the platform format.

## 0.37.0

> [!IMPORTANT]
> **Looking for a new maintainer**: I no longer own a supported device, so I can't test changes against real hardware. Fixes are now validated by automated tests and your feedback. Interested in taking over? Comment on [#1232](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1232).

- [Breaking] Requires Node.js 22.12+, 24 or 26 (Node.js 20 is EOL).
- [Feature] The plugin now uses [node-miio](https://github.com/afharo/node-miio) (`0.3.0-beta.4`) instead of its bundled copy of `miio` ([#1235](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1235)):
  - Support for **any MIoT vacuum** (Xiaomi, Dreame, Mijia, ijai, newer Viomi like the S9 and V13…), driven by its spec from [miot-spec.org](https://home.miot-spec.com). Specs are cached on disk, and a snapshot of every vacuum spec is bundled for offline setups. Previously, these models received Roborock commands and timed out (e.g. [#443](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/443), [#328](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/328)).
  - Models that are not listed in `models.ts` now use the fan speeds and water levels reported by node-miio (e.g. from their MIoT spec), instead of the Roborock defaults.
  - New CLI command: `miio-vacuum spec <model>` shows the spec node-miio resolves for a model. Please include its output when reporting issues about a new model.
- [Bug] The dock sensor now reports the robot as docked when its battery is fully charged.
- [Chore] Fewer runtime dependencies: only `node-miio`, `rxjs` and `semver`.
- [Chore] Dependency updates.

## 0.36.0

- [Bug] Restore periodic vacuum state polling and connection recovery.
- [Bug] Fix incompatibility issue with Homebridge v2.3.0 ([#1217](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1217))

## 0.35.0

- [New Model] Add support for Roborock Q5 Pro. Thank you @kirylvolkau ([#1178](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1178))

## 0.34.1

- [Chore] Releasing a new version to show the callout to the [new Matterbridge alternative](https://github.com/afharo/matterbridge-xiaomi-roborock).

## 0.34.0

- [New Model] Add waterbox support for Roborock S7 Max Ultra. ([#1027](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1027))

## 0.33.0

- [New Model] Add waterbox support for Roborock Q8 Max+. Thank you, @jmago17 ([#1026](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/1026))

## 0.32.1

- [Chore] Prepare for Homebridge v2 ([#958](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/958)) - Explicitly claim the compatiblity.

## 0.32.0

- [Chore] Prepare for Homebridge v2 ([#958](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/958))
  - It ensures compatibility with the upcoming v2 version of Homebridge.
- [Chore] Exclude test and mock files from the final NPM package ([#856](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/856))

## 0.31.1

- [Bug] Fix iOS16 naming issues but preserving user overrides ([#845](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/845))

## 0.31.0

- [Bug] Fixed: push room names from settings to homekit ([#829](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/829)) (thank you, @YoeriVD)

## 0.30.0

- [New Model] Add support for Roborock Q Revo ([#790](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/790))

## 0.29.1

- [Bug] Allow turning off the Waterbox ([#788](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/788))

## 0.29.0

- [New Model] Added support for Roborock S8. Thank you @Gundika ([#696](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/696))

## 0.28.1

- [Bug] Room Service: Wait for connection before applying the auto-room discovery ([#618](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/618))

## 0.28.0

- [New Model] Improved support to Viomi models based on the implementation from `python-miio` ([#580](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/580))
- [tech debt] Improved code coverage ([#171](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/171))

## 0.27.0

- [Bug] Remove peer dependency on `hap-nodejs` as some folks had issues ([#558](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/558))
- [Bug] Accessories are randomly presented so the main service loses the primary status ([#542](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/542))
- [Bug] Reset cleaning status of Rooms and Zones after cleaning is completed ([#546](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/546))

## 0.26.5

- [Bug] `goTo` now shows on "waiting". Disabling sends it back to the dock. Thank you @luc-ass ([#544](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/544))

## 0.26.4

- [Bug] `dustBin` config not showing on the Config UI. Thank you @luc-ass ([#535](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/535))

## 0.26.3

- [Bug] Fix warning _The plugin "\*" defines 'homebridge' and/or 'hap-nodejs' in their 'dependencies'..._ ([#533](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/533))

## 0.26.2

- [Bug] Fix warning _SET handler returned write response value_ ([#529](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/529))

## 0.26.1

- [Bug] Add dependency to `hap-nodejs` ([#531](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/531)).

## 0.26.0

- [Enhancement] Add Dust Bin needs to be emptied indicator ([#111](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/111)).

## 0.25.1

- [Bug] Handle negative responses for the Maintenance indicators of Sensors & Brushes ([#366](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/366))

## 0.25.0

- [Enhancement] Add `serviceType: "switch"` config to expose the main service as a switch (only ON/OFF capabilities) instead of a fan (ON/OFF + speed control). ([#458](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/458))
- [tech debt] Main file broken down into sub-services for better code maintainability and testability. ([#517](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/517))
- [tech debt] Improved test code coverage. (WIP #171)

## 0.24.1

- [Bug] Broken import after moving to TS fixed ([#519](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/519))

## 0.24.0

- [Enhancement] Add support for Max+ speed mode (S7 MaxV). Thank you @nicolasbigot! ([#515](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/515))
- [tech debt] Initial migration to Typescript ([#514](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/514))

## 0.23.0

- [Enhancement] Add Go To Button. Thank you @luc-ass! ([#511](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/511))

## 0.22.0

- [Enhancement] Add support for S7 MaxV. Thank you @khad! ([#508](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/508))
- [Bug] Fixed typo `Hight` to `High`. Thank you @khad! ([#507](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/507))

## 0.21.0

- [Enhancement] Add toggle to disable Care Services. Thank you @jasper-seinhorst! ([#501](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/501))

## 0.20.1

- [Bug] Viomi fails to retrieve the SerialNumber ([#456](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/456))

## 0.20.0

- [Enhancement] Roborock S7 Auto-Empty-Dock Support. Thank you @Skjall! ([#438](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/438))

## 0.19.0

- [New model] Added support for `roborock.vacuum.a15`. Thank you @Baggns! ([#423](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/423))

## 0.18.1

- [Bug] Private methods starting with `#` do not work in Node.js v12 ([#382](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/382))

## 0.18.0

- [Enhancement] Reduce NPM bundle size ([#376](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/376))
- [Enhancement] Revisit `miio` connection layer ([#334](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/334))  
  This is an attempt to fix the reconnection issues ([#367](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/367), [#299](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/299), [#227](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/227)).

## 0.17.1

- [Bug] Percentages could be over 100% when maintenance is long overdue, returning `Filter Life Level` below 0 ([#366](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/366)).

## 0.17.0

- **[Breaking change]** Delete the `delay` option. The reasoning: it slows down the start and `homebridge@1.3.0` marks this plugin as slow ([#361](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/361)). Also, it doesn't work as expected in all the OSs.
- [Bug] Ensure SerialNumber is returned as string ([#373](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/373))

## 0.16.2

- [Bug] Fix `pause` option not returning a state in some cases ([#359](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/359)).

## 0.16.1

- [Bug] Fix `rockrobo.vacuum.v1` speeds ([#311](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/311)) (reverting the changes in #296 because it's breaking some everyone else).

## 0.16.0

- [Enhancement] Add the config option `roomTimeout` so the plugin auto-starts the cleaning after the specified number of seconds when a Room switch has been enabled/disabled ([#326](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/326))

Thank you to @normen for this release!

## 0.15.2

- [Bug] Refer to the services' attached `.roomId` property ([#327](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/327))

## 0.15.1

- [Bug] Fix `autoroom` bug after rooms Services renamed ([#324](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/324))

## 0.15.0

- **[Breaking change]** You can now enable multiple rooms at once! This is a breaking change for users that already used the old behaviour (one room at a time). Read more in the PR that introduced the changes ([#317](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/317))
- [Models] Model `roborock.vacuum.a9` is renamed to `roborock.vacuum.a09` ([#314](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/314))
- [Bug] Fix bug introduced in 0.14.1 that printed `undefined` at the end of the logs ([#316](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/316))

Thank you to @ileodo por this release!

## 0.14.1

- [Bug] Fix bug in 0.14.0

## 0.14.0 - Broken

- [Enhancement] Add `silent` log config to stop logging `info` and `debug` messages ([#307](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/307))

## 0.13.6

- [Bug] Fix speed mappings for rockrobo.vacuum.v1 ([#296](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/296))

## 0.13.5

- [Bug] WaterMode doesn't register OFF requests ([#284](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/284))

## 0.13.4

- [Enhancement] Validate if autoroom and rooms are used at the same time ([#270](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/270))

## 0.13.3

- [Models] Add `roborock.vacuum.a9`

## 0.13.2

- [Models] Add Roborock T7 ([#265](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/265))

## 0.13.1

- [Enhancement] Add support for token in the params of the CLI `miio-vacuum` ([#262](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/262))

## 0.13.0

- [Enhancement] Add "find me" switch to locate Roborock
- [Enhancement] Add configuration for "find me" word
- [Enhancement] Add configuration for "pause" word
- [Bug] Waterbox speed is reported, even if no cleaning is active

Thank you @L-C-P for all these additions.

## 0.12.2

- [Bug] Callbackify is missing ([#254](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/254))

## 0.12.1

- [Bug] Avoid services requests while the device is not connected yet ([#251](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/251))

## 0.12.0

- [Models] Add Roborock S6 MaxV to list of models
- [Bug] Roborock S6 MaxV | Model report 106% FanSpeed ([#235](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/235))
- [Bug] Roborock S6 MaxV | Model stop cleaning is throwing an error ([#236](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/236))
- [Bug] Xiaomi App modesetting update is wrong, if only fan speed or water speed is changed from custom to fixed value or vice versa ([#238](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/238))
- [Bug] Install binary as `miio-vacuum` to avoid clashing with the deprecated `miio` library ([#222](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/222))

## 0.11.9

- [Bug] `config.schema.json`: remove "\*" because it shows duplicated entries

## 0.11.8

- [Bug] Fix zones layout in `config.schema.json` ([#218](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/218))

## 0.11.7

- [Bug] Fix zones definition in `config.schema.json` ([#218](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/218))

## 0.11.6

- [Bug] Viomi: Add consumable status (main/side brush lives) ([#216](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/216))

## 0.11.5

- [Bug] Viomi: Fix charging state and battery level ([#216](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/216))

## 0.11.4

- [Bug] Only show errors the first time they happen ([#162](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/162))

## 0.11.3

- [Bug] Some `roborock.vacuum.m1s` require Viomi command to clean rooms and some others Roborock's way :scream: (#141 & #215)

## 0.11.2

- [Bug] Remove `homebridge` from `peerDependencies` as it fails some installations

## 0.11.1

- [Bug] Viomi models class can't be created as an extension of Roborock

## 0.11.0

- [Models] S5 should use the gen4 speeds ([#131](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/131))
- [Models] Add support for Viomi models (#100 #199 #150)
- [Models] Some Mijia models use a mix of a set of commands of Viomi and Roborock :scream: ([#141](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/141))
- [Bug] Set `error_code` to `0` after logging it to clear it up ([#193](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/193))

## 0.10.1

- [Enhancement] Updated internal dependencies and removed vulnerability warnings

## 0.10.0

- [Enhancement] Move `nicoh88-miio` library to this module ([#196](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/196))
- [Feature] Provide aggregated `FilterLifeLevel` characteristic in the fan service ([#145](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/145))

## 0.9.0

- [Bug] Xiaowa E202-02 fails to go back to the dock ([#181](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/181)) - Thanks @bedrin
- [Bug] Xiaowa E202-02 successful response is upper-cased "OK" - Thanks @bedrin
- [Bug] Pause before going to dock ([#180](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/180)) - Thanks @bedrin
- [Bug] Fixes connection drops and outdated statuses ([#146](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/146)) - Thanks @bedrin

## 0.8.4

- [Models] `rockrobo.vacuum.v1` now supports new speed modes - Thank you @mrreview

## 0.8.3

- [Bug] Fix the `minStep` maths ([#190](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/190)) - Thank you @bedrin

## 0.8.2

- [Models] Fix Xiaowa E202-02 modes ([#179](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/179)) - Thank you @bedrin
- [Bug] Fix Xiaowa E202-02 fail to go to the dock ([#180](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/180))
- [Bug] Fix stalled updates ([#146](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/146))

## 0.8.1

- [Bug] Avoid calling `homebridge@1.x.x` new methods if they are not available ([#185](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/185))

## 0.8.0

- **[Breaking Change]** The fan speeds are now evenly distributed. So the speeds follow a step-based pattern:
  - If 5 possible states => 0%, 25%, 50%, 75% and 100%
  - If 6 possible states => 0%, 20%, 40%, 60%, 80% and 100%
  - If 7 possible states => 0%, 16%, 32%, 48%, 64%, 80% and 96%
- [Models] Add Roborock S6 Pure to list of models ([#176](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/176))
- [Feature] Report native `FilterMaintenance` services for the care indicators
- [Bug] Fix error duplication in logs ([#162](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/162))

## 0.7.7

- [Models] Add "Mop" mode for model S6 ([#144](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/144))
- [Models] Add "Custom" mode for model S5-Max ([#110](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/110))
- [Fix] Move `system-sleep` to optional dependencies to fix installation errors that fail to compile it ([#151](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/151))

## 0.7.6

- [Feature] Semiautomatic determination of room ids ([read the README for usage](./README.md#semi-automatic))
- [Fix] Log errors when not an error from the protocol

## 0.7.5

- Bugfix: Move "miio" lib git-package to npm-package "miio-nicoh88"

## 0.7.3

- Feature: Add support for Roborock T4 with gen3 speeds
- Feature: AutoRoom Generation (only S6)
- Feature: Add support for Mi Vacuum Robot 1S
- Feature: Startdelay for testing

## 0.7.2

- Bugfix: Stop cleaning, go to dock

## 0.7.1

- Bugfix: config.schema.json update for homebridge-config-ui-x
- Bugfix: config cleanword default "cleaning" if not sets in config.json
- Bugfix: Add subtype to the pause switch

## 0.7.0

- Feature: Room cleaning with separately switch for each room

## 0.6.8

- Bugfix: Going to dock on speed 0, not stop

## 0.6.7

- Bugfix: Readme fix

## 0.6.6

- Feature: Support the new WaterBox property (S5 Max)
- Improve: Reduce changed logs by only logging when the value is actually new
- Improve: Vacuum error handling
- Improve: Fanspeed / Fanmode handling
- Improve: miio library accept all "WORD.vacuum.\*"
- Bugfix: Fix the unhandled promises

## 0.6.5

- Feature: Add support for Roborock S5 Max
- Improve: Refresh the state every 30s to ensure miio is still properly connected
- Bugfix: Battery level
- Bugfix: UnhandledPromiseRejectionWarning on startup when it fails to connect

## 0.6.4

- Feature: Add support for Roborock Xiaowa E20

## 0.6.3

- Improve: roborock.vacuum.t6 fanSpeed not supported issue [PR](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/70)

## 0.6.2

- Feature: Add support for Mi Robot 1S
- Improve: Controlled Connection Retries [PR](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/pull/66)

## 0.6.1

- Feature: Add support for Roborock T6

## 0.6.0

- Improve: Support for Roborock S6
- Improve: More generic logic on the different model's speed modes definition

## 0.5.1

- Feature: Add support for Roborock S6

## 0.5.0

- Refactoring by @afharo
  - re-connection mechanism
  - javascript promises (async/await)

## 0.4.2

- Feature: Add support for homebridge-config-ui-x - thx @pisikaki

## 0.4.1

- Update engine versions from homebridge and node

## 0.4.0

- Feature: Mopping is now supported. [#31](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/31)
- Feature: Slightly different Speedmodes between Gen1 and Gen2 considered.
- Bugfix: Initializing status values to variables at startup, there were problems when the robot was not docked when starting homebridge. [#15](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/15) & [#30](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/30)
- Bugfix: `pause` functionality improved. [#15](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/15) & [#30](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/30)
- Bugfix: Logging improved.

## 0.3.2

- Bugfix: "Unknown error" with meaningful error message.

## 0.3.1

- README customized (`root` with `sudo su -`).

## 0.3.0

- Feature: Additional characteristics (4) for care indicator of sensors, side brush, main brush and filter added (Eve App).

## 0.2.2

- Bugfix: Own Fork from "miio" with fixed for [#5](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/5), [#6](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/6) and [#7](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/7).

## 0.2.1

- Bugfix: Fanspeed levels over HomeKit improved.

## 0.2.0

- Rewrite plugin, changed logic.
- Bugfix: Connection establishment improved.
- Bugfix: `UnhandledPromiseRejectionWarning`

## 0.1.5

- Feature: ERRORs from miio-API added.

## 0.1.4

- Bugfix: If `pause` / `dock` in `config.json` enabled.
- Bugfix: `cannot read property getCharacteristic of undefined`.

## 0.1.3

- Feature: Logging added.
- Bugfix: `UnhandledPromiseRejectionWarning`.
- README customized.

## 0.1.2

- Feature: Deviceinfos (model, serial and firmware version) shows at startup.
- Bugfix: `UnhandledPromiseRejectionWarning`.
- README customized.

## 0.1.1

- README typo.

## 0.1.0

- First version.
