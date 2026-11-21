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

**Reporting an issue**: enable `debug` on the vacuum, and attach the logs. See [CONTRIBUTING.md](../CONTRIBUTING.md)
for what to share when requesting a model or a feature.
