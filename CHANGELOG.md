# Changes

## 0.7.7

- [Models] Add "Mop" mode for model S6 (#144)
- [Models] Add "Custom" mode for model S5-Max (#110)
- [Fix] Move `system-sleep` to optional dependencies to fix installation errors that fail to compile it (#151)

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

- Improve: roborock.vacuum.t6 fanSpeed not supported issue [PR](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/pull/70)

## 0.6.2

- Feature: Add support for Mi Robot 1S
- Improve: Controlled Connection Retries [PR](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/pull/66)

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

- Feature: Mopping is now supported. [#31](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/31)
- Feature: Slightly different Speedmodes between Gen1 and Gen2 considered.
- Bugfix: Initializing status values to variables at startup, there were problems when the robot was not docked when starting homebridge. [#15](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/15) & [#30](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/30)
- Bugfix: `pause` functionality improved. [#15](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/15) & [#30](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/30)
- Bugfix: Logging improved.

## 0.3.2

- Bugfix: "Unknown error" with meaningful error message.

## 0.3.1

- README customized (`root` with `sudo su -`).

## 0.3.0

- Feature: Additional characteristics (4) for care indicator of sensors, side brush, main brush and filter added (Eve App).

## 0.2.2

- Bugfix: Own Fork from "miio" with fixed for [#5](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/5), [#6](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/6) and [#7](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/7).

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
