"use strict";

const network = require("./network");

const Device = require("./device");
const Placeholder = require("./placeholder");
const models = require("./models");

const Vacuum = require("./devices/vacuum");
const ViomiVacuum = require("./devices/viomivacuum");

module.exports = function (options) {
  let handle = network.ref();

  // Connecting to a device via IP, ask the network if it knows about it
  return network
    .findDeviceViaAddress(options)
    .then((device) => {
      const deviceHandle = {
        ref: network.ref(),
        api: device,
      };

      // Try to resolve the correct model, otherwise use the generic device
      let d = models[device.model];

      // Hack to accept any vaccuum in the form of 'WORD.vacuum.*'
      if (!d && device.model.match(/^\w+\.vacuum\./)) {
        d = Vacuum;
        if (device.model.startsWith("viomi")) {
          d = ViomiVacuum;
        }
      }

      if (!d) {
        return new Device(deviceHandle);
      } else {
        return new d(deviceHandle);
      }
    })
    .catch((e) => {
      if (
        (e.code === "missing-token" || e.code === "connection-failure") &&
        options.withPlaceholder
      ) {
        const deviceHandle = {
          ref: network.ref(),
          api: e.device,
        };

        return new Placeholder(deviceHandle);
      }

      // Error handling - make sure to always release the handle
      handle.release();

      e.device = null;
      throw e;
    })
    .then((device) => {
      // Make sure to release the handle
      handle.release();

      return device.init();
    });
};
