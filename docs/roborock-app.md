# Roborock app (experimental)

[← Back to the README](../README.md)

<img src="https://raw.githubusercontent.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/master/src/homebridge-ui/public/images/roborock.png" alt="Roborock app" width="20" height="20" align="absmiddle"> Robots paired with the **Roborock app** (instead of Mi Home) aren't in the Xiaomi account, and their miIO token doesn't
work. With the platform's `roborock` option, the plugin uses your Roborock account instead: it talks to the robot in
your local network when possible, and through Roborock's cloud otherwise. No token is needed, and the IP is optional.
With `"autoroom": true`, the rooms get the names given in the Roborock app.
With `roomSensors` (and the Matter vacuum), the room the robot is cleaning comes from the robot itself: no map downloads.

To set it up:

1. Log in once: in the [settings page](settings-page.md), enter the email of your Roborock account, click "Send me a
   code", and enter the code Roborock emails you. Then "Find my vacuums" and "Add" adds them with their `duid` (and
   enables the `roborock` option). Without the Homebridge UI, run this as the same user that runs Homebridge:

   ```sh
   npx node-miio roborock login
   npx node-miio roborock devices   # each robot's name, model, protocol and ID (duid)
   ```

   The session is saved in [node-miio's config directory](https://github.com/afharo/node-miio/blob/main/docs/roborock.md).
   If Homebridge runs as another user, copy that file where Homebridge can read it, and set its path in
   `roborock.sessionFile`.

2. Enable it in the platform (in the Homebridge UI: "Roborock app account"), and add each robot with its `duid`:

   ```json
   {
     "platform": "XiaomiRoborockVacuum",
     "roborock": { "enabled": true },
     "devices": [
       { "name": "Vacuum", "duid": "k6AlzxZ1vy6Xcr0gLlEyh", "autoroom": true }
     ]
   }
   ```

   Optionally, set the robot's `ip` to skip asking it through Roborock's cloud.

Supported: the robots whose protocol (in `roborock devices`) is `1.0` or `L01`, which covers most S, Q and Saros
robots. The Q7/Q10 series (`B01`) isn't supported yet. If the session expires, the plugin logs a warning: log in
again, and restart Homebridge.
