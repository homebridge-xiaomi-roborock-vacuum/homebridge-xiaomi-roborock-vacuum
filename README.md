[![PayPal Donate](https://img.shields.io/badge/PayPal-Donate-blue.svg)](https://www.paypal.me/nh88)
[![GitHub last commit](https://img.shields.io/github/last-commit/nicoh88/homebridge-xiaomi-roborock-vacuum.svg)](https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum)
[![npm](https://img.shields.io/npm/dt/homebridge-xiaomi-roborock-vacuum.svg)](https://www.npmjs.com/package/homebridge-xiaomi-roborock-vacuum)
[![npm version](https://badge.fury.io/js/homebridge-xiaomi-roborock-vacuum.svg)](https://badge.fury.io/js/homebridge-xiaomi-roborock-vacuum)
[![dependencies Status](https://david-dm.org/nicoh88/homebridge-xiaomi-roborock-vacuum/status.svg)](https://david-dm.org/nicoh88/homebridge-xiaomi-roborock-vacuum)

# homebridge-xiaomi-roborock-vacuum

## Homebridge plugin for Xiaomi / Roborock Vacuum Cleaner's
With this [homebridge](https://github.com/nfarina/homebridge) plugin can you control the xiaomi vacuum robots as fan in your Apple Home App (HomeKit).

This plugin use the new [miio](https://github.com/aholstenson/miio) version 0.15.6 or newer, not like the old ones 0.14.1. Timeouts and API errors are a thing of the past!

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

- Example `config.json` with one vacuum and room cleaning:

```
"accessories": [
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Mi Robot Vaccum 1st Generation",
  "ip": "192.168.1.150",
  "token": "abcdef1234567890abcdef1234567890",
  "pause": false,
  "dock": true,
  "waterBox": false,
  "cleanword": "cleaning",
  "rooms": [
    {
      "id": 16,
      "name": "Livingroom"
    },
    {
      "id": 17,
      "name": "Kitchen"
    }
  ],
  "zones": [
    {
      "name":"Family Room",
      "zone":[[25000,25000,32000,32000,2]]
    },
    {
      "name":"Bedroom",
      "zone":[[21000,32000,24000,37000,1]]
    }
  ]
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
| `cleanword` | cleaning | used for autonaming the Roomselectors |
| `rooms` | false | Array of ID / Name for a single Room. If set you have another switch for cleaning only this room |
| `zones` | false | Array of name / zone coordinates for a single zone. Coordinates are laid out as bottom-left-x, bottom-left-y, top-right-x, top-right-y, number-of-cleanings.  A separate tile in Home will be created for each zone.  Figuring out coordinates will take some trial and error.  Ensure this section is surrounded with double brackets: [[ ]]
| `autoroom` | false | set to true to generate rooms from robot (only S6) or set to array of room name strings (see semi automatic below) |

## AutoRoom Generation

### Fully automatic
This feature seems to be working only on the S6 Model.
We figured out this is why the Api call only delivers the mapping when the Rooms are named in the Xioami / Roborock App.

So when you have an S6 but not named the Rooms in your App this function will not work! Thanks @domeOo

### Semi automatic
This feature seems to work with all models which offer room cleaning. To use it, in the config set `autoroom` to an array of room names. Then in the app, setup a timer at midnight (00:00 or 12:00am). Enable `Select a room to divide`. Then on the map select the rooms in the order as they appear in the homebridge config. The order is important as this is how the plugin maps the room names to IDs. Finally submit the timer and deactivate it. Then restart homebridge.

## Xiaomi Token
To use this plugin, you have to read the "token" of the xiaomi vacuum robots. Here are some detailed instructions:
- :us::gb: - [python-miio - Getting started](https://python-miio.readthedocs.io/en/latest/discovery.html)
- :de: - [Apple HomeKit Forum - HomeKit.Community](https://forum.smartapfel.de/forum/thread/370-xiaomi-token-auslesen/)
- :de: - [Homematic-Guru.de](https://homematic-guru.de/xiaomi-vacuum-staubsauger-roboter-mit-homematic-steuern)
