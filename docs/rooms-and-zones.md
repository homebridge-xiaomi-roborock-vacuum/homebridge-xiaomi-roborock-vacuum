# Rooms, zones and spots

[← Back to the README](../README.md)

## Rooms

Turn on the room switches in the order they should be cleaned, then start the cleaning (the fan, or the Home app's
vacuum). With `roomTimeout`, the cleaning starts on its own after the last change. With the Matter vacuum, pick the
rooms in the Home app instead.

There are three ways to get the room IDs:

- **From the map**, in the [settings page](settings-page.md): click each room to name it. It's saved as `rooms`.
- **Read from the robot** (`"autoroom": true`, platform only): the models that name their rooms in the app, like the
  S6, or the S4 with firmware 3.5.8_0358 or later. The rooms must be named in the app.
  With the [Roborock app](roborock-app.md), the rooms get the names given in the app.
- **From a timer** (`"autoroom": ["Room 1", "Room 2", …]`), for the other models with room cleaning (it may not work
  with firmware 3.5.8_0358 or later):
  1. In the Mi Home app, set up a timer at midnight (00:00), and enable "Select a room to divide".
  2. Select the rooms on the map, in the same order as the names in `autoroom`.
  3. Save the timer, turn it off, and restart Homebridge.

  With the platform, the room IDs are saved automatically. In the old `accessories` format, the logs show the `rooms`
  to copy to the config instead.

## Zones

Each zone is a switch that cleans one or more rectangles of the map:

```json
"zones": [
  { "name": "Bedroom", "zone": [[24500, 27000, 28000, 30000, 1]] },
  { "name": "Bedroom & hall", "zone": [[24500, 27000, 28000, 30000, 1], [21000, 32000, 24000, 37000, 2]] },
  { "name": "Kitchen mop", "zone": [[25000, 25000, 27000, 28000, 1]], "speed": "Mop", "waterSpeed": "High" }
]
```

- Each rectangle is `[bottom-left x, bottom-left y, top-right x, top-right y, times to clean it]`, in millimetres.
  The easiest way to get them is to draw them on the map in the [settings page](settings-page.md).
- `speed` and `waterSpeed` (optional) set the fan speed and the water level before cleaning the zone: the names of
  your model's [fan speeds and water levels](speeds-and-modes.md). `"Mop"` turns
  the suction off on the S7 and newer (with the mop attached). `waterSpeed` needs `waterBox`.
- Only the switches of the zones being cleaned are on. To clean several zones in one run, set `zoneTimeout`: turning
  a zone on selects it, and the selected zones are cleaned together after that many seconds. The robot takes one fan
  speed per run: the first zone's.

## Go to a spot

`goTo` sends the robot to `goToX`, `goToY`, and `goToSpots` adds a switch per spot. The coordinates are in
millimetres, and the dock is usually near `25500, 25500` (where the robot was when it created the map).

To find a spot's coordinates:

- Click on the map in the [settings page](settings-page.md).
- Or, with the [Xiaomi Cloud](xiaomi-cloud.md): drive the robot there (e.g. with the remote control in the app), and
  turn on the "find me" switch. The logs show `The robot is at x=…, y=…`. They also show where the robot stops after
  each cleaning.
