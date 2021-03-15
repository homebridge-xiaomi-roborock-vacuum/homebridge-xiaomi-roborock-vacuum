# Device management

The `miio-vacuum` command line utility supports many device operations, including discovering and configuring devices.

## Install the command line tool

You can install the command line tool with:

`npm install -g homebridge-xiaomi-roborock-vacuum`

## Discovering devices on current network

`miio-vacuum discover`

This will list devices that are connected to the same network as your computer. Let it run for a while so it has a
chance to reach all devices, as it might take a minute or two for all devices to answer.

The commands outputs each device on this format:

```
Device ID: 48765421
Model info: zhimi.airpurifier.m1
Address: 192.168.100.9
Token: token-as-hex-here via auto-token
Support: At least basic
```

The information output is:

- **Device ID** - the unique identifier of the device, does not change if the device is reset.
- **Model ID** - the model id if it could be determined, this indicates what type of device it is
- **Address** - the IP that the device has on the network
- **Token** - the token of the device or ??? if it could not be automatically determined (Xiaomi vacuums do not support
  this feature, so you'll want to use `miio-vacuum discover --token tokenAsHex` for your device's details to appear in
  the list.
