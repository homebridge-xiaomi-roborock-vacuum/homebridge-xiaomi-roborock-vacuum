# Device types and capabilities

To make it easier to work with different devices this library normalizes different models into types. These device types
have their own API to match what the actual device can actually do. In addition each device also has a set of
capabilities, that are used to flag that a device can do something extra on top of its type API.

## Types

| Name                | Description    | Devices         |
| ------------------- | -------------- | --------------- |
| [Vacuum](vacuum.md) | Robot vacuums. | Mi Robot Vacuum |

## Models

The tables below indicates how well different devices are supported. The support column can be one of the following:

- ❓ Unknown - support for this device is unknown, you can help test it if you have access to it
- ❌ None - this device is not a miIO-device or has some quirk making it unusable
- ⚠️ Generic - this device is supported via the generic API but does not have a high-level API
- ⚠️ Untested - this device has an implementation but needs testing with a real device
- ✅ Basic - the basic functionality of the device is implemented, but more advanced features are missing
- ✅ Good - most of the functionality is available including some more advanced features such as settings
- ✅ Excellent - as close to complete support as possible

If your device:

- Is not in this list, it might still be a miIO-device and at least have generic support.
  See [Missing devices](../missing-devices.md) for information about how to find out.
- Needs a manual token and the table says it should not, something has probably changed in the firmware, please open an
  issue so the table can be adjusted.
- Is marked as Untested you can help by testing the implementation is this library and opening an issue with information
  about the result.

TODO: Populate these tables accordingly

### Models by name

| Name            | Type   | Auto-token | Support  | Note                                                |
| --------------- | ------ | ---------- | -------- | --------------------------------------------------- |
| Mi Robot Vacuum | Vacuum | No         | ✅ Basic | DND, timers and mapping features are not supported. |

### Models by identifier

**Note:** This table does not include Aqara (Smart Home Gateway) devices as their model identifier is set based on the
type of the device.

| Id                   | Type   | Auto-token | Support  | Note                                                |
| -------------------- | ------ | ---------- | -------- | --------------------------------------------------- |
| `rockrobo.vaccum.v1` | Vacuum | No         | ✅ Basic | DND, timers and mapping features are not supported. |
| `rockrobo.vaccum.s5` | Vacuum | No         | ✅ Basic | DND, timers and mapping features are not supported. |
