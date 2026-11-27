# Options

[← Back to the README](../README.md)

Each vacuum in `devices` takes these options. They're all in the Homebridge UI's form.

**Connection**

| Option   | Default | Description                                                                                                               |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `name`   |         | The name in the Home app. The switches and sensors are named after it                                                     |
| `ip`     |         | The robot's IP address (give it a fixed one in your router). Optional for the [Roborock app](roborock-app.md) vacuums     |
| `token`  |         | The robot's token. Optional with the [Xiaomi Cloud](xiaomi-cloud.md), not needed for the Roborock app vacuums             |
| `did`    |         | Instead of `ip` and `token`, with the [Xiaomi Cloud](xiaomi-cloud.md): the device ID, found again if they change          |
| `duid`   |         | Instead of `ip` and `token`, for a vacuum paired with the [Roborock app](roborock-app.md): its ID in the Roborock account |
| `debug`  | `false` | Show the debug logs (including what the robot answers) of this plugin only. Enable it when reporting an issue             |
| `silent` | `false` | Only log warnings and errors                                                                                              |

**How it shows up**

| Option        | Default                  | Description                                                                                                                                         |
| ------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serviceType` | `"fan"`                  | `"vacuum"`, `"fan"` or `"switch"`: see [How the vacuum shows up](how-it-shows-up.md)                                                                |
| `waterBox`    | `false` (platform: auto) | A second fan for the water level. Enabled automatically on the models with a water box (levels: [Fan speeds and water levels](speeds-and-modes.md)) |

**Switches**

| Option                                 | Default                        | Description                                                                                                                                |
| -------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pause`, `pauseWord`                   | `false`, `"Pause"`             | A pause switch: on while the robot cleans. Turning it off pauses it, and on resumes it                                                     |
| `findMe`, `findMeWord`                 | `false`, `"where are you"`     | A "find me" switch: the robot says "I'm here"                                                                                              |
| `goToDock`, `goToDockWord`             | `false`, `"go to dock"`        | Sends the robot to the dock. It's on while the robot is on its way, and turning it off stops it                                            |
| `goTo`, `goToWord`, `goToX`, `goToY`   | `false`, `"go to coordinates"` | Sends the robot to a spot (`goToX`, `goToY`, `25500` by default): see [Go to a spot](rooms-and-zones.md#go-to-a-spot)                      |
| `goToSpots`, `goToSpotWord`            | `[]`, `"go to"`                | A switch per spot, `[{ "name", "x", "y" }]`: on sends the robot there, off sends it to the dock                                            |
| `maps`, `mapWord`                      | `[]`, `"map"`                  | A switch per map, `[{ "name", "id" }]` (a floor) or `[{ "name", "savedAt" }]` (a backup): on loads it. See [Maps](rooms-and-zones.md#maps) |
| `dustCollection`                       | `false`                        | Empty the dust bin in the auto-empty dock (e.g. S7+)                                                                                       |
| `mopWash`                              | `false`                        | A button to wash the mop in the dock (e.g. S7 MaxV Ultra, S8 Pro Ultra)                                                                    |
| `mopDrying`                            | `false`                        | Dry the mop in the dock (e.g. S8 Pro Ultra). It's on while the mop dries                                                                   |
| `doNotDisturb`, `doNotDisturbWord`     | `false`, `"Do Not Disturb"`    | The robot's Do Not Disturb schedule (Roborock): no voice, dimmed lights, and the dock doesn't empty the dust bin                           |
| `doNotDisturbStart`, `doNotDisturbEnd` |                                | The schedule (`"HH:mm"`) set when the Do Not Disturb switch turns on, e.g. `"00:00"` to `"23:59"`. Without them, the app's schedule        |

**Sensors**

| Option                | Default | Description                                                                                                                                                        |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dock`                | `false` | Detected while the robot is in the dock                                                                                                                            |
| `roomSensors`         | `false` | One per room, detected while the robot is in it (Roborock, needs the [Xiaomi Cloud](xiaomi-cloud.md) or the [Roborock app](roborock-app.md))                       |
| `waterTankEmpty`      | `false` | Detected when the clean water tank is empty (the models that report it, usually with a self-refilling dock)                                                        |
| `errorSensor`         | `false` | Detected while the robot reports an error (e.g. stuck): for notifications and automations. The error is in the logs                                                |
| `maintenanceSensor`   | `false` | Detected when the brushes, the filter or the sensors need maintenance: for notifications and automations                                                           |
| `dustBin`             | `false` | A lock, secured when the robot reports that the dust bin is full                                                                                                   |
| `disableCareServices` | `false` | Hide the remaining life of the brushes, filter and sensors (they can be reset after replacing them, on Roborock). Hidden by default with `"serviceType": "vacuum"` |

**Rooms and zones**

| Option        | Default      | Description                                                                                                                          |
| ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `rooms`       | `[]`         | A switch per room, `[{ "id", "name" }]`, plus `"repeats": [2, 3]` for "clean it 2 or 3 times": see [Rooms](rooms-and-zones.md#rooms) |
| `autoroom`    | `false`      | Read the rooms from the robot: `true`, or the room names in the order of a timer: see [Rooms](rooms-and-zones.md#rooms)              |
| `roomTimeout` | `0`          | Above `0`: start cleaning the selected rooms this many seconds after the last switch change                                          |
| `zones`       | `[]`         | A switch per zone: see [Zones](rooms-and-zones.md#zones)                                                                             |
| `zoneTimeout` | `0`          | Above `0`: the zone switches select the zones, cleaned together this many seconds after the last change                              |
| `cleanword`   | `"cleaning"` | The first word of the room and zone switches, e.g. "cleaning Kitchen"                                                                |

The platform also takes `cloud` (the Xiaomi account, see [Xiaomi Cloud](xiaomi-cloud.md)) and `roborock` (the Roborock
account, see [Roborock app](roborock-app.md)).
