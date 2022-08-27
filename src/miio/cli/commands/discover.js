"use strict";

const log = require("../log");
const deviceFinder = require("../device-finder");

exports.command = "discover";
exports.description = "Discover devices on the local network";
exports.builder = {
  token: {
    type: "string",
    description: "The known token of the device in the local network",
  },
};

exports.handler = function (argv) {
  log.info("Discovering devices. Press Ctrl+C to stop.");
  log.plain();

  const browser = deviceFinder({ token: argv.token });
  browser.on("available", (device) => {
    try {
      log.device(device);
    } catch (ex) {
      log.error(ex);
    }
  });
};
