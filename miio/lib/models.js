"use strict";

/**
 * Mapping from models into high-level devices.
 */
const Vacuum = require("./devices/vacuum");
const ViomiVacuum = require("./devices/viomivacuum");

module.exports = {
  "rockrobo.vacuum.v1": Vacuum,
  "roborock.vacuum.s5": Vacuum,
  "roborock.vacuum.s5e": Vacuum,
  "roborock.vacuum.c1": Vacuum,
  "roborock.vacuum.s6": Vacuum,
  "roborock.vacuum.t6": Vacuum,
  "roborock.vacuum.m1s": Vacuum,
  "roborock.vacuum.e2": Vacuum,
  "roborock.vacuum.s4": Vacuum,

  "dreame.vacuum.mc1808": ViomiVacuum,
  "viomi.vacuum.v7": ViomiVacuum,
  "viomi.vacuum.v8": ViomiVacuum,
};
