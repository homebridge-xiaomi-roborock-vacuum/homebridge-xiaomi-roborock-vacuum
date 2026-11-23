# Troubleshooting

[← Back to the README](../README.md)

**Is my model supported?** Check [models.ts](../src/models/models.ts). If it's not listed, it likely works with the
default behaviour: try it. The newer (MIoT) models are driven by their spec from
[miot-spec.org](https://home.miot-spec.com), with their fan speeds and water levels: `npx node-miio spec your.model.id`
shows what it resolves for your model. If the fan speeds or water levels are wrong, open an issue (or a PR in
[node-miio](https://github.com/afharo/node-miio)) with the right ones.

**It doesn't connect.** Check the IP and the token: this asks the robot for its model and firmware.

```sh
npx node-miio protocol call 192.168.1.150 miIO.info --token abcdef1234567890abcdef1234567890
```

Try a couple of times, in case of a network glitch. If it answers, try other commands as explained in
[node-miio's docs](https://github.com/afharo/node-miio/blob/main/docs/protocol.md#testing-commands).

## Matter

With `"serviceType": "vacuum"`, the plugin logs a warning at startup for these:

- **Matter doesn't start** (`Cannot bind to {::}:5353 (code EAFNOSUPPORT)`): Matter needs IPv6, and it's disabled on the
  host. On a Raspberry Pi, remove `ipv6.disable=1` from `/boot/firmware/cmdline.txt` and reboot. If another plugin
  had issues with IPv6, set `NODE_OPTIONS=--dns-result-order=ipv4first` on its own child bridge.
- **Two accessories under "Add Accessory → Nearby"**, one of them "Not Supported" once added: it's the child bridge's
  Matter bridge, empty because the vacuum is paired on its own. Set `"externalsOnly": true` in the child bridge's
  `matter` settings ([how](how-it-shows-up.md#robot-vacuum-matter)), and remove that accessory from the Home app.
- **`Cannot find module …/@matter/…`**: Homebridge's Matter packages are incomplete (e.g. after an interrupted update
  or a backup restore). Reinstall Homebridge.

**Reporting an issue**: enable `debug` on the vacuum, and attach the logs. See [CONTRIBUTING.md](../CONTRIBUTING.md)
for what to share when requesting a model or a feature.
