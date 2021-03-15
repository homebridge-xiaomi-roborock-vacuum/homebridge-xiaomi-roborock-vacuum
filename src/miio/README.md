# miIO Device Library

This is a copy of the repo https://github.com/homebridge-xiaomi-roborock-vacuum/miio, a forked version of the _currently
unmaintained_ original project https://github.com/aholstenson/miio.

The reason for moving it to this parent project is that the development is so tightly linked we constantly had to change
both libraries at the same time and since the original project is no longer maintained, it's not worth going through the
pain of maintaining 2 repos, plus the additional complexity of making clear we were using the forked version.

If it makes sense at any point to roll back and move it to the standalone library, we'll def do that :)

## Usage

```javascript
const miio = require("./miio");
```

Resolve a handle to the device:

```javascript
// Resolve a device, specifying the token (see below for how to get the token)
miio
  .device({ address: "192.168.100.8", token: "token-as-hex" })
  .then((device) => console.log("Connected to", device))
  .catch((err) => handleErrorHere);
```

Call methods to interact with the device:

```javascript
// Switch the power of the device
device
  .togglePower()
  .then((on) => console.log("Power is now", on))
  .catch((err) => handleErrorHere);

// Using async/await
await device.togglePower();
```

Listen to events such as property changes and actions:

```javascript
// Listen for power changes
device.on("power", (power) => console.log("Power changed to", power));

// The device is available for event handlers
const handler = ({ action }, device) =>
  console.log("Action", action, "performed on", device);
device1.on("action", handler);
device2.on("action", handler);
```

Capabilities and types are used to hint about what a device can do:

```javascript
if (device.matches("cap:temperature")) {
  console.log(await device.temperature());
}

if (device.matches("cap:switchable-power")) {
  device.setPower(false).then(console.log).catch(console.error);
}
```

If you are done with the device call `destroy` to stop all network traffic:

```javascript
device.destroy();
```

## Tokens and device management

A few miIO devices send back their token during a handshake and can be used without figuring out the token. Most devices
hide their token, such as Yeelights and the Mi Robot Vacuum.

There is a command line tool named `miio` that helps with finding and storing tokens.
See [Device management](docs/management.md) for details and common use cases.

## Discovering devices

Use `miio.devices()` to look for and connect to devices on the local network. This method of discovery will tell you
directly if a device reveals its token and can be auto-connected to. If you do not want to automatically connect to
devices you can use `miio.browse()` instead.

Example using `miio.devices()`:

```javascript
const devices = miio.devices({
  cacheTime: 300, // 5 minutes. Default is 1800 seconds (30 minutes)
});

devices.on("available", (device) => {
  if (device.matches("placeholder")) {
    // This device is either missing a token or could not be connected to
  } else {
    // Do something useful with device
  }
});

devices.on("unavailable", (device) => {
  // Device is no longer available and is destroyed
});
```

`miio.devices()` supports these options:

- `cacheTime`, the maximum amount of seconds a device can be unreachable before it becomes unavailable. Default: `1800`
- `filter`, function used to filter what devices are connected to. Default: `reg => true`
- `skipSubDevices`, if sub devices on Aqara gateways should be skipped. Default: `false`
- `tokens`, object with manual mapping between ids and tokens (advanced, use [Device management](docs/management.md) if
  possible)

See [Advanced API](docs/advanced-api.md) for details about `miio.browse()`.

## Device API

Check [documentation for devices](docs/devices/README.md) for details about the API for supported devices. Detailed
documentation of the core API is available in the
section [Using things in the abstract-things documentation](http://abstract-things.readthedocs.io/en/latest/using-things.html)
.

## Library versioning and API stability

This library uses [semantic versioning](http://semver.org/) with an exception being that the API for devices is based on
their type and capabilities and not their model.

This means that a device can have methods removed if its type or capabilities change, which can happen if a better
implementation is made available for the model. When working with the library implement checks against type and
capabilities for future compatibility within the same major version of `miio`.

Capabilities can be considered stable across major versions, if a device supports `power` no minor or patch version will
introduce `power-mega` and replace `power`. If new functionality is needed the new capability will be added along side
the older one.

## Reporting issues

[Reporting issues](docs/reporting-issues.md) contains information that is useful for making any issue you want to report
easier to fix.

## Debugging

The library uses [debug](https://github.com/visionmedia/debug) with two namespaces, `miio` is used for packet details
and network discovery and devices use the `thing:miio` namespace. These are controlled via the `DEBUG`
environment flag. The flag can be set while running the miio command or any NodeJS script:

Show debug info about devices during discovery:

```
$ DEBUG=thing\* miio discover
```

To activate both namespaces set `DEBUG` to both:

```
$ DEBUG=miio\*,thing\* miio discover
```

## Protocol documentation

This library is based on the documentation provided by OpenMiHome.
See https://github.com/OpenMiHome/mihome-binary-protocol for details. For details about how to figure out the commands
for new devices look at the
[documentation for protocol and commands](docs/protocol.md).
