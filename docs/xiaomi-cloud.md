# Xiaomi Cloud

[← Back to the README](../README.md)

<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/main/src/homebridge-ui/public/images/xiaomi-home.png" alt="Xiaomi Home app" width="20" height="20" align="absmiddle"> The robot works in your local network, but the Xiaomi account knows its token, and its map (Roborock). With the
platform's `cloud` option, the plugin can:

- **Read the tokens**: configure a robot with only its `ip`, or with its device ID (`did`) instead of the IP and token.
  With the `did`, the plugin also **finds the robot again** when its IP or token change (a new IP from the router, or
  a reset Wi-Fi). A fixed IP in your router is still the most reliable.
- **Know the room the robot is in** (Roborock): the plugin downloads the map while it cleans (every 10 seconds), for
  `roomSensors` and the Matter vacuum's current room. Its position also goes to the logs.

To set it up:

1. Log in once: in the [settings page](settings-page.md), click "Log in with a QR code" and scan it with the Mi Home app.
   Without the Homebridge UI, run this as the same user that runs Homebridge:

   ```sh
   npx node-miio cloud login --qr   # scan the QR code with the Mi Home app
   ```

   The session is saved in [node-miio's config directory](https://github.com/afharo/node-miio/blob/main/docs/cloud.md)
   (your password is never stored). If Homebridge runs as another user, copy that file where Homebridge can read it,
   and set its path in `cloud.sessionFile`.

2. Enable it in the platform (in the Homebridge UI: "Xiaomi Cloud (optional)"):

   ```json
   {
     "platform": "XiaomiRoborockVacuum",
     "cloud": { "enabled": true },
     "devices": [{ "name": "Vacuum", "did": "123456789", "roomSensors": true }]
   }
   ```

   Optionally, set `cloud.server` (`de`, `us`, `cn`…) to skip looking for the robot in every server.

The `did` is in the logs (`Xiaomi Cloud: found "Vacuum" (did 123456789) at …`) and in `npx node-miio cloud devices`,
which also prints the IP and token of every device. If the session expires, the plugin logs a warning: log in again,
and restart Homebridge.

Other ways to get a token: the [Xiaomi cloud tokens extractor](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor),
or the guides in German on [smartapfel.de](https://forum.smartapfel.de/forum/thread/370-xiaomi-token-auslesen/) and
[simon42.com](https://www.simon42.com/roborock-homekit-token-einfach/).
