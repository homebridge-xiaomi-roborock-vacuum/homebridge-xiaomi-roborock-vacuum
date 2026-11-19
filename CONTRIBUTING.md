# Contributing

Thank you for helping! The maintainer **doesn't own most of the supported vacuums**: changes are developed against
automated tests, and your device is the only way to know if they really work. So the most valuable contributions are
**testing betas** and **sharing what your vacuum reports**. No coding needed.

- [Become a beta tester](#become-a-beta-tester)
- [Request support for a model or a feature](#request-support-for-a-model-or-a-feature)
- [Report a bug](#report-a-bug)
- [How-to](#how-to): debug logs, raw captures with the `miio-vacuum` CLI, removing private data
- [Contributing code](#contributing-code)

## Become a beta tester

1. Comment on [#1232](https://github.com/homebridge-xiaomi-roborock-vacuum/homebridge-xiaomi-roborock-vacuum/issues/1232)
   with your **model** (e.g. `roborock.vacuum.a75`), your **firmware version** and your dock, if any (e.g. "auto-empty",
   "wash & dry"). You'll get a mention whenever a beta needs a device like yours.
2. When you're mentioned, install the beta:
   - Homebridge UI: _Plugins_ → this plugin → ⋮ → _Install Alternate Version_ → pick the `beta` version.
   - Or: `npm install -g homebridge-xiaomi-roborock-vacuum@beta`
3. Go through the test list in the mention (it's usually short: "turn on X, check that Y happens"), and reply with
   ✅ / ❌ for each item. For ❌, add the [debug logs](#debug-logs).
4. Go back to the `latest` version whenever you want, the same way.

You can stop at any time: just say so in #1232.

## Request support for a model or a feature

Open an issue with:

- [ ] Your **model** and **firmware version**. They're in the logs when the plugin starts:
      `STA getDevice | Model: roborock.vacuum.a75` and `STA getDevice | Firmware Version: ...`.
- [ ] What you'd like to do, and **how you do it in the Mi Home app** (screenshots help).
- [ ] The [raw status of your vacuum](#raw-captures): `get_status` for Roborock models, or the output of `spec` for any
      other brand. Ideally, capture `get_status` twice: before and after doing the action in the app (e.g. with the mop
      drying and without), so we can see which field changes.
- [ ] Whether you're happy to [test a beta](#become-a-beta-tester) (it can't be released without that).

## Report a bug

- [ ] Model, firmware version and plugin version.
- [ ] What you did, what you expected and what happened.
- [ ] The [debug logs](#debug-logs) around the time it happened.
- [ ] Your config for this device (**remove the token**).

## How-to

### Debug logs

1. In the plugin's settings for your vacuum, enable _Show debug logs_ (`"debug": true`), and restart Homebridge
   (or the plugin's child bridge).
2. Reproduce the problem.
3. Copy the lines of this plugin from the logs (they start with your vacuum's name). The `DEB getState` lines show
   everything the vacuum reports, every 30 seconds.

### Raw captures

The plugin ships the `miio-vacuum` CLI (from [node-miio](https://github.com/afharo/node-miio)). Run it on the machine
where Homebridge runs (in the Homebridge UI: ⋮ → _Terminal_), with your vacuum's IP and token:

```sh
# Roborock (roborock.vacuum.*, rockrobo.vacuum.*): the full status
miio-vacuum protocol call <ip> get_status --token <token>
miio-vacuum protocol call <ip> get_consumable --token <token>

# Any other brand (Dreame, Viomi, Xiaomi, ijai…): the spec describing what your model supports
miio-vacuum spec <model>
```

If `miio-vacuum` isn't found, run `npx miio-vacuum ...` from the Homebridge folder (usually `/var/lib/homebridge`), where the plugin is installed.

### Remove private data before posting

Logs and captures can contain private data. Replace these with `xxx`:

- the **token**, and any `ssecurity` / `serviceToken`;
- the **serial number**, **MAC address** and **IP address**;
- your Wi-Fi name (`ssid`) and anything else that identifies your home.

## Contributing code

Pull requests are very welcome, too.

- Read [AGENTS.md](./AGENTS.md): it describes the layout, the commands and the conventions (for humans as well).
- Open PRs against `master`. Every change needs **unit tests**, because most of them can't be tested on real hardware.
- The plugin only translates between node-miio and HomeKit. Protocol and per-model fixes belong in
  [node-miio](https://github.com/afharo/node-miio).
- Before pushing: `npm run lint` (Prettier), `npm test` and `npm run build`.
- Don't copy code from GPL projects (e.g. python-miio): this project is MIT. Using them as a reference for how a
  device behaves is fine.
