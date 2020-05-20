# homebridge-roborock
This plugin is a fork of homebridge-xiaomi-roborock-vacuum (thanks to Nico Hartung) with the following changes:
1) Changed the logic to periodically pull status from the device, make the accessories more responsive 
2) Added support for go to target function 
3) The room switches can be used to select multiple rooms before start cleaning. When cleaning fan is powered on, it automatically detects if the device should do a full house clean or room clean based on if any room is enabled for cleaning
4) Fixed the resume function so now it's possible to resume from room cleaning mode
5) More validation logic added together with some other small improvements
6) Fixed no gentle mode for Roborock S5
7) Auto configure the minimal step for fan service so for models with 4 speeds it will be 25% each level and for models with 5 speeds it will be 20% each level. It is no longer possible to choose other percentages. 

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
  "accessory": "RoborockVacuum",
  "name": "My Roborock Cleaner",
  "ip": "192.168.1.150",
  "token": "abcdef1234567890abcdef1234567890",
  "pause": true,
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
  ]
 },
 "gotoTarget": {
    "name": "Go to Bin",
    "target": [
          21659,
          33063
    ]
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
| `rooms` | null | Array of ID / Name for a single Room. If set you have another switch for cleaning only this room |
| `autoroom` | false | when set to true, Rooms will be generated from Robot. (only S6) |
| `gotoTarget` | null | Configure a switch to allow the device to go to target specified by the coordinates |

## AutoRoom Generation
This feature seems to be working only on the S6 Model.
We figured out this is why the Api call only delivers the mapping when the Rooms are named in the Xioami / Roborock App.

So when you have an S6 but not named the Rooms in your App this function will not work! Thanks @domeOo

## Xiaomi Token
To use this plugin, you have to read the "token" of the xiaomi vacuum robots. Here are some detailed instructions:
- :us::gb: - [python-miio - Getting started](https://python-miio.readthedocs.io/en/latest/discovery.html)
- :de: - [Apple HomeKit Forum - HomeKit.Community](https://forum.smartapfel.de/forum/thread/370-xiaomi-token-auslesen/)
- :de: - [Homematic-Guru.de](https://homematic-guru.de/xiaomi-vacuum-staubsauger-roboter-mit-homematic-steuern)


