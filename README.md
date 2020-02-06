[![PayPal Donate](https://img.shields.io/badge/PayPal-Donate-blue.svg)](https://www.paypal.me/nh88)
[![GitHub last commit](https://img.shields.io/github/last-commit/nicoh88/homebridge-xiaomi-roborock-vacuum.svg)](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum)
[![npm](https://img.shields.io/npm/dt/homebridge-xiaomi-roborock-vacuum.svg)](https://www.npmjs.com/package/homebridge-xiaomi-roborock-vacuum)
[![npm version](https://badge.fury.io/js/homebridge-xiaomi-roborock-vacuum.svg)](https://badge.fury.io/js/homebridge-xiaomi-roborock-vacuum)
[![dependencies Status](https://david-dm.org/nicoh88/homebridge-xiaomi-roborock-vacuum/status.svg)](https://david-dm.org/nicoh88/homebridge-xiaomi-roborock-vacuum)

# homebridge-xiaomi-roborock-vacuum

## Homebridge plugin for Xiaomi / Roborock Vacuum Cleaner's
With this [homebridge](https://github.com/nfarina/homebridge) plugin can you control the xiaomi vacuum robots as fan in your Apple Home App (HomeKit).

Thus plugin use the new [miio](https://github.com/aholstenson/miio) version 0.15.6 or newer, not like the old ones 0.14.1. Timeouts and API errors are a thing of the past!

<img src="https://raw.githubusercontent.com/nicoh88/homebridge-xiaomi-roborock-vacuum/master/rockrobo.vacuum.v1.jpg" style="border:1px solid lightgray" alt="Xiaomi Mi Robot 1st Generation (Roborock Vacuum V1)" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/nicoh88/homebridge-xiaomi-roborock-vacuum/master/roborock.vacuum.s5.jpg" style="border:1px solid lightgray" alt="Roborock S50 2nd Generation" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/nicoh88/homebridge-xiaomi-roborock-vacuum/master/roborock.vacuum.s55.jpg" style="border:1px solid lightgray" alt="Roborock S55 2nd Generation Black" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/nicoh88/homebridge-xiaomi-roborock-vacuum/master/roborock.vacuum.s6.jpg" style="border:1px solid lightgray" alt="Roborock S6/T6 3nd Generation" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/nicoh88/homebridge-xiaomi-roborock-vacuum/master/roborock.vacuum.c10.jpg" style="border:1px solid lightgray" alt="Roborock Xiaowa Lite C10" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/nicoh88/homebridge-xiaomi-roborock-vacuum/master/roborock.vacuum.s5.max.jpg" style="border:1px solid lightgray" alt="Roborock S5 Max" width="300">


## Features
* **Fan** as On-/Off-Switch. When switching off, directly back to the charging station.
* [Fanspeed levels](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/blob/master/models/speedmodes.js) adjustable via 3D Touch / Force Touch.
* Battery status and condition in the device details. Low battery alert.
* Pause switch (optional).
* Occupancy sensor (similar to motion sensor) for dock status (optional).
* Seconds Fan for water box modes (optional).

<img src="https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/blob/master/screenshot1.jpg?raw=true" alt="Screenshot Apple HomeKit with homebridge-xiaomi-roborock-vacuum" width="350">
<img src="https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/blob/master/screenshot2.jpg?raw=true" alt="Screenshot Elgato Eve App with homebridge-xiaomi-roborock-vacuum" width="350">


## Instructions
1. Install git packages first with `sudo apt install git`.
2. Install the plugin as `root` (`sudo su -`) with `npm install -g homebridge-xiaomi-roborock-vacuum@latest --unsafe-perm`.
3. Customize you homebridge configuration `config.json`.
4. Restart homebridge, ggf. `service homebridge restart`.

- Example `config.json` with one vacuum:

```
"accessories": [
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Mi Robot Vaccum 1st Generation",
  "ip": "192.168.1.150",
  "token": "abcdef1234567890abcdef1234567890",
  "pause": false,
  "dock": true,
  "waterBox": false
 }
],
```

- Example `config.json` with two vacuums:

```
"accessories": [
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Mi Robot Vaccum 1st Generation",
  "ip": "192.168.1.150",
  "token": "abcdef1234567890abcdef1234567890",
  "pause": false,
  "dock": true,
  "waterBox": false
 },
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Roborock S50 Vaccum 2nd Generation",
  "ip": "192.168.1.151",
  "token": "1234567890abcdef1234567890abcdef",
  "pause": false,
  "dock": true,
  "waterBox": false
 }
],
```


## Optional parameters
| Name of parameter | Default value | Notes |
|---|---|---|
| `pause` | false | when set to true, HomeKit shows an additional switch for "pause" - switch is on, when pause is possible |
| `dock` | false |  when set to true, HomeKit shows an occupancy sensor, if robot is in the charging dock |
| `waterBox` | false | when set to true, HomeKit shows an additional slider to control the amount of water released by the robot (only selected models like S5-Max). Currently in a beta state. |


## Xiaomi Token
To use this plugin, you have to read the "token" of the xiaomi vacuum robots. Here are some detailed instructions:
- :us::gb: - [python-miio - Getting started](https://python-miio.readthedocs.io/en/latest/discovery.html)
- :de: - [Apple HomeKit Forum - HomeKit.Community](https://forum.smartapfel.de/forum/thread/370-xiaomi-token-auslesen/)
- :de: - [Homematic-Guru.de](https://homematic-guru.de/xiaomi-vacuum-staubsauger-roboter-mit-homematic-steuern)


## Changes
#### 0.6.7
- Bugfix: Readme fix

#### 0.6.6
- Feature: Support the new WaterBox property (S5 Max)
- Improve: Reduce changed logs by only logging when the value is actually new
- Improve: Vacuum error handling
- Improve: Fanspeed / Fanmode handling
- Improve: miio library accept all "WORD.vacuum.*"
- Bugfix: Fix the unhandled promises

#### 0.6.5
- Feature: Add support for Roborock S5 Max
- Improve: Refresh the state every 30s to ensure miio is still properly connected
- Bugfix: Battery level
- Bugfix: UnhandledPromiseRejectionWarning on startup when it fails to connect

#### 0.6.4
- Feature: Add support for Roborock Xiaowa E20

#### 0.6.3
- Improve: roborock.vacuum.t6 fanSpeed not supported issue [PR](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/pull/70)

#### 0.6.2
- Feature: Add support for Mi Robot 1S
- Improve: Controlled Connection Retries [PR](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/pull/66)

#### 0.6.1
- Feature: Add support for Roborock T6

#### 0.6.0
- Improve: Support for Roborock S6
- Improve: More generic logic on the different model's speed modes definition

#### 0.5.1
- Feature: Add support for Roborock S6

#### 0.5.0
- Refactoring by @afharo
  - re-connection mechanism
  - javascript promises (async/await)

#### 0.4.2
- Feature: Add support for homebridge-config-ui-x - thx @pisikaki

#### 0.4.1
- Update engine versions from homebridge and node

#### 0.4.0
- Feature: Mopping is now supported. [#31](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/31)
- Feature: Slightly different Speedmodes between Gen1 and Gen2 considered.
- Bugfix: Initializing status values to variables at startup, there were problems when the robot was not docked when starting homebridge. [#15](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/15) & [#30](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/30)
- Bugfix: `pause` functionality improved. [#15](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/15) & [#30](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/30)
- Bugfix: Logging improved.

#### 0.3.2
- Bugfix: "Unknown error" with meaningful error message.

#### 0.3.1
- README customized (`root` with `sudo su -`).

#### 0.3.0
- Feature: Additional characteristics (4) for care indicator of sensors, side brush, main brush and filter added (Eve App).

#### 0.2.2
- Bugfix: Own Fork from "miio" with fixed for [#5](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/5), [#6](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/6) and [#7](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/7).

#### 0.2.1
- Bugfix: Fanspeed levels over HomeKit improved.

#### 0.2.0
- Rewrite plugin, changed logic.
- Bugfix: Connection establishment improved.
- Bugfix: `UnhandledPromiseRejectionWarning`

#### 0.1.5
- Feature: ERRORs from miio-API added.

#### 0.1.4
- Bugfix: If `pause` / `dock` in `config.json` enabled.
- Bugfix: `cannot read property getCharacteristic of undefined`.

#### 0.1.3
- Feature: Logging added.
- Bugfix: `UnhandledPromiseRejectionWarning`.
- README customized.

#### 0.1.2
- Feature: Deviceinfos (model, serial and firmware version) shows at startup.
- Bugfix: `UnhandledPromiseRejectionWarning`.
- README customized.

#### 0.1.1
- README typo.

#### 0.1.0
- First version.
