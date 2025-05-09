[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![GitHub last commit](https://img.shields.io/github/last-commit/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum.svg)](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum)
[![npm](https://img.shields.io/npm/dt/homebridge-xiaomi-roborock-vacuum.svg)](https://www.npmjs.com/package/homebridge-xiaomi-roborock-vacuum)
[![npm version](https://badge.fury.io/js/homebridge-xiaomi-roborock-vacuum.svg)](https://badge.fury.io/js/homebridge-xiaomi-roborock-vacuum)
[![dependencies Status](https://david-dm.org/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/status.svg)](https://david-dm.org/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum)
[![codecov](https://codecov.io/gh/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/branch/master/graph/badge.svg?token=1VW1RV7MCT)](https://codecov.io/gh/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum)

<!-- prettier-ignore -->
> [!NOTE]
> **Maintainer's pledge:**
> This plugin is "sort of" stable in what it does. There are many improvements that I'd like to include and that the community is asking for. And I can't wait to solve them all. However, I'm a father of 2 kids (1 and 3 y/o), so my availability is spare (apologies for not being as active as I'd love to).
>
> I prioritize hot-fixes and compatibility issues (like the recent [Homebridge v2 upgrade works](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/958)). My "closer" roadmap is detailed in [#966](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/966).
>
> I'm happy to review any contributions. So **PRs are more than welcome**.

# homebridge-xiaomi-roborock-vacuum

> [!IMPORTANT]  
> This plugin is only able to integrate with devices linked to the Mi Home app.
> Devices controlled via the Roborock app change their authentication and methods and are currently not supported by this plugin. Refer to [#104](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/104) for more information.

## Homebridge plugin for Xiaomi / Roborock Vacuum Cleaner's

This [homebridge](https://github.com/homebridge/homebridge) plugin allows you to control the Xiaomi vacuum robots in your Apple Home App (HomeKit).

It is currently presented in the Home App in the form of a Fan because Apple doesn't officially support Vacuums in Homekit (we can't wait for this moment to arrive)! Refer to [#934](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/934) to know more about that.

<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/master/images/rockrobo.vacuum.v1.jpg" style="border:1px solid lightgray" alt="Xiaomi Mi Robot 1st Generation (Roborock Vacuum V1)" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/master/images/roborock.vacuum.s5.jpg" style="border:1px solid lightgray" alt="Roborock S50 2nd Generation" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/master/images/roborock.vacuum.s55.jpg" style="border:1px solid lightgray" alt="Roborock S55 2nd Generation Black" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/master/images/roborock.vacuum.s6.jpg" style="border:1px solid lightgray" alt="Roborock S6/T6 3nd Generation" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/master/images/roborock.vacuum.c10.jpg" style="border:1px solid lightgray" alt="Roborock Xiaowa Lite C10" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/master/images/roborock.vacuum.s5.max.jpg" style="border:1px solid lightgray" alt="Roborock S5 Max" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/master/images/roborock.vacuum.s6.maxv.jpg" style="border:1px solid lightgray" alt="Roborock S6 MaxV" width="300">

For the underlying communication layer, it uses a port of the no-longer maintained library [miio](https://github.com/aholstenson/miio). You'll find the code in the directory [./miio](./miio).

## Features

- **Fan** as On-/Off-Switch. When switching off, directly back to the charging station.
  - [Fanspeed levels](./src/models/speedmodes.ts) adjustable via 3D Touch / Force Touch.
- Battery status and condition in the device details. Low battery alert.
- Pause switch (optional).
- Room cleaning (optional): Read [Room cleaning](#room-cleaning) to understand how it works.
- Zone cleaning (optional): Read [Zone cleaning](#zone-cleaning) to understand how it works.
- Occupancy sensor (similar to motion sensor) for dock status (optional).
- Second Fan for water box modes (optional).
  - [Watermode levels](./src/models/watermodes.ts) only when enabled in config, and the device supports it.

<img src="https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/blob/master/images/screenshot1.jpg?raw=true" alt="Screenshot Apple HomeKit with homebridge-xiaomi-roborock-vacuum" width="350">
<img src="https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/blob/master/images/screenshot2.jpg?raw=true" alt="Screenshot Elgato Eve App with homebridge-xiaomi-roborock-vacuum" width="350">

## Instructions

1. Install the plugin as `root` (`sudo su -`) with `npm install -g homebridge-xiaomi-roborock-vacuum@latest --unsafe-perm`.
2. Customize you homebridge configuration `config.json`.
3. Restart homebridge, ggf. `service homebridge restart`.

- Example `config.json` with one vacuum and room cleaning:

```
"accessories": [
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Mi Robot Vacuum 1st Generation",
  "ip": "192.168.1.150",
  "token": "abcdef1234567890abcdef1234567890",
  "serviceType": "fan",
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
      "name":"Family Room (x2)",
      "zone":[[25000,25000,32000,32000,2]]
    },
    {
      "name":"Bedroom",
      "zone":[[21000,32000,24000,37000,1]]
    },
    {
      "name":"Bedroom & Family Room",
      "zone":[ [21000,32000,24000,37000,1],  [25000,25000,32000,32000,1]]
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
  "name": "Xiaomi Mi Robot Vacuum 1st Generation",
  "ip": "192.168.1.150",
  "token": "abcdef1234567890abcdef1234567890",
  "pause": false,
  "dock": true,
  "waterBox": false
 },
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Roborock S50 Vacuum 2nd Generation",
  "ip": "192.168.1.151",
  "token": "1234567890abcdef1234567890abcdef",
  "pause": false,
  "dock": true,
  "waterBox": false
 }
],
```

## Optional parameters

| Name of parameter     | Default value         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `silent`              | `false`               | when set to true, it will log only warning and error messages (hiding info and debug messages even when running homebridge -D                                                                                                                                                                                                                                                                                                                                                               |
| `serviceType`         | `"fan"`               | Defines the type of service of how the accessory is exposed. <br />When set to `"fan"` (default), ON/OFF controls and speed selection can be controlled by sliding the fan speed in the Home app. <br />When set to `"switch"`, only ON/OFF controls are allowed (no speed selection).                                                                                                                                                                                                      |
| `pause`               | `false`               | when set to `true`, HomeKit shows an additional switch for "pause" - switch is on, when pause is possible                                                                                                                                                                                                                                                                                                                                                                                   |
| `pauseWord`           | `"pause"`             | used for naming the Pause comment                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `findMe`              | `false`               | when set to true, HomeKit shows an additional switch for "find me" - if switched on, the vacuum will say "Hi, I am over here"                                                                                                                                                                                                                                                                                                                                                               |
| `findMeWord`          | `"where are you"`     | used for autonaming the "find me" command. E.g: Hey Siri, NameOfYourVacuum where are you                                                                                                                                                                                                                                                                                                                                                                                                    |
| `goTo`                | `false`               | when set to true, HomeKit shows an additional switch for "go to" - if switched on, you will be able to send your vacuum to the specified location                                                                                                                                                                                                                                                                                                                                           |
| `goToWord`            | `"go to coordinates"` | used for autonaming the "go to" command. E.g: Hey Siri, NameOfYourVacuum to to coordinates                                                                                                                                                                                                                                                                                                                                                                                                  |
| `goToX`               | `25500`               | x-coordinate of the specified location                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `goToY`               | `25500`               | y-coordinate of the specified location                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `dock`                | `false`               | when set to true, HomeKit shows an occupancy sensor, if robot is in the charging dock                                                                                                                                                                                                                                                                                                                                                                                                       |
| `waterBox`            | `false`               | when set to true, HomeKit shows an additional slider to control the amount of water released by the robot (only selected models like S5-Max). Currently in a beta state                                                                                                                                                                                                                                                                                                                     |
| `dustBin`             | `false`               | when set to true, HomeKit shows a lock that is _secured_ whenever the robot throws the dust-bin full error. Currently in a beta state.                                                                                                                                                                                                                                                                                                                                                      |
| `dustCollection`      | `false`               | when set to true, HomeKit shows an additional switch to control the dust collection with the auto-empty dock (only selected models like S7+ or S7 with additional dock). Currently in a beta state                                                                                                                                                                                                                                                                                          |
| `disableCareServices` | `false`               | when set to true, HomeKit doesn't shows additional Care Services                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `cleanword`           | `"cleaning"`          | used for autonaming the Roomselectors                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `rooms`               | `[]`                  | Array of ID / Name for a single Room. If set you have another switch for cleaning only this room                                                                                                                                                                                                                                                                                                                                                                                            |
| `zones`               | `[]`                  | Array of name / zone coordinates for a single zone group. A zone group may contain multiple zone squares, each with its own value for number of cleanings. Coordinates are laid out as bottom-left-x, bottom-left-y, top-right-x, top-right-y, number-of-cleanings. A separate tile in Home will be created for each zone group. Figuring out coordinates will take some trial and error. Each zone should be surrounded by brackets: [], with the entire value also surrounded by brackets |
| `autoroom`            | `false`               | set to `true` to generate rooms from robot (only S6) or set to array of room name strings (see semi automatic below)                                                                                                                                                                                                                                                                                                                                                                        |
| `roomTimeout`         | `0`                   | when set to anything above `0` - will initiate room cleaning for multiple rooms automatically after the given time in seconds                                                                                                                                                                                                                                                                                                                                                               |

## Room cleaning

This plugin supports Room cleaning (only models that support room cleaning via the Xiaomi Mi Home app). Keep reading to understand how it works and how to set it up.

### How it works

To start the Room Clean Mode, you can enable/disable the room switches in the
order that they need to be cleaned. Then turn on the main Fan switch to start
the actual cleaning.

If you want your robot to start cleaning after you enable/disable the room switches, use the config parameter `roomTimeout` to set the number of seconds the robot should wait before starting (this is to allow you to find the other rooms you want to set ON/OFF).

### How can I set it up

#### Semi automatic

This feature seems to work with all models which offer room cleaning, but may not work on newer firmware versions (3.5.8_0358 or newer). To use it:

1. Set the `autoroom` property in the config to an array of room names (`["my room 1", "my room 2", "my room 3"]`.
2. In the Xiaomi Mi app, setup a timer at midnight (00:00 or 12:00am).
3. Enable `Select a room to divide`.
4. On the map select the rooms in the order as they appear in the config set in step 1. The order is important as this is how the plugin maps the room names to IDs.
5. Submit the timer and make sure it's deactivated.
6. Restart `homebridge`.

#### Fully automatic

This feature seems to be working on models that support naming the rooms in the Xiaomi / Roborock App. This is known to include the Roborock S6 as well as the S4 with firmware version 3.5.8_0358 or newer.

Even if you have one of these models but you haven't named the Rooms in your App yet, this function will not work! Thanks @domeOo

## Zone cleaning

This plugin supports Zone cleaning (only models that support zone cleaning via the Xiaomi Mi Home app). Keep reading to understand how it works and how to set it up.

### How it works

To start the Zone Clean Mode, you can enable the zone switch for the zone to be cleaned.

### How can I set it up

Open terminal and run:
`pip install python-miio`
After proper installation run:
`mirobo --ip 192.168.1.XX --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx goto X_COORD Y_COORD`
repeat the goto command until you figure out the bottom-left and top-right position of the zone.

when you have your zone. Go back to the JSON configuration in homberidge and add this lines.</br>
zone: [[bottom-left X, bottom-left Y, top-right X, top-right Y, # of cleanings]]

```
"zones": [
  {
    "name": "Bed room",
    "zone": [
      [
        24500,
        27000,
        28000,
        30000,
        1
      ]
    ]
  }
]
```

<img src="https://github.com/user-attachments/assets/33176d50-ccc2-4c29-97db-4a63e7ab3a92" alt="drawing" width="200"/>

Additional hint:

- The position near the docking station is 25500 25500 (X/Y)
- Driving downwards the map is possible by decreasing Y (i.e. 25000)
- Driving upwards the map is possible by increasing Y (i.e. 26000)
- Driving left of the map is possible by decreasing X (i.e. 25000)
- Driving right the map is possible by increasing X (i.e. 26000)
- If you prefer not to install python-miio or encounter issues during installation, you can configure your vacuum directly in Homebridge. Go to the JSON Config section, find your vacuum settings, and add or modify goToX and goToY with different values. Then, toggle the switch in your Home app. Repeat this until you determine the correct values for your zone.

  `"goToX": 24500, "goToY": 29000`

  <img width="291" alt="Screenshot 2025-02-14 at 22 16 23" src="https://github.com/user-attachments/assets/55f74a41-e45e-4828-a063-d804c7b2d16b" />

## Go to Location

This plugin allows you to send your vacuum to a specific point on the map. As there is no easy way of figuring out the coordinates of your desired location, here are some steps to help you find the right spot.

1. The base location (typically the position of the dock when the map was created) is at `[25500,25500]` where these values are in the format `[x-axis/horizontal, y-axis/vertical]`.
2. Increasing the first value results in going to the top of the map, increasing the second value results in going to the right of the map (as displayed inside the app). The value seems to be in Millimeters.
3. Knowing this you can approximate the desired location and change it as follows. In our example we want to go one meter up and three meters to the right: `[25500,25500]` --> `[26500,28500]`.
4. While testing this location you can review the position in your app under `Go To` to fine tune it.

## Xiaomi Token

To use this plugin, you have to read the "token" of the xiaomi vacuum robots. Here are some detailed instructions:

- :us::gb: - [Xiaomi cloud tokens extractor](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor)
- :us::gb: - [python-miio - Getting started](https://python-miio.readthedocs.io/en/latest/discovery.html)
- :de: - [Apple HomeKit Forum - HomeKit.Community](https://forum.smartapfel.de/forum/thread/370-xiaomi-token-auslesen/)
- :de: - [Homematic-Guru.de](https://homematic-guru.de/xiaomi-vacuum-staubsauger-roboter-mit-homematic-steuern)
- :de: - [Tutorial with token extractor - simon42.com](https://www.simon42.com/roborock-homekit-token-einfach/)

NOTE: We are not currently aware of how to retrieve the token from the Roborock App. Please, share any findings in the issue [#104](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/104).

## Is my model supported?

As new users join our community, and use this plugin, we try to learn from their device, and keep up with the new devices Xiaomi releases. However, the main developer @afharo, only owns the model S5, and he can't test the features on other models. If you wonder whether your device is supported, please:

1. Check the [models.ts](./src/models/models.ts) file to see if your device is already in the explicit list.
2. If not, maybe it matches the _default_ behaviour (just try running the plugin and see if it works).
   1. If it works, but the vacuum modes (aka speeds) are wrong: add your model to the list in 1 with the right mapping.
   2. If it doesn't work, please, try making sure the IP and token are correct, by running the command `miio-vacuum inspect id-or-address --token tokenAsHex`.  
      HINT: Try a couple of times, just in case there's a network glitch.
   3. If you can connect and see the details of your robot, try running the manual commands like explained in [here](./src/miio/docs/protocol.md#testing-commands).  
      HINT: You can find the list of commands for your device in the Python project [python-miio](https://github.com/rytilahti/python-miio).

## My model is, allegedly, supported, but it fails to connect

Run the command `miio-vacuum inspect id-or-address --token tokenAsHex`, replacing `id-or-address` with your vacuum's IP address and the `tokenAsHex` with a HEX representation of the token obtained [earlier](#xiaomi-token).
