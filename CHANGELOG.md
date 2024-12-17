# Changelog

## Next

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
