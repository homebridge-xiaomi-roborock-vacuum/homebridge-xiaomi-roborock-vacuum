"use strict";

/**
 * Mapping from models into high-level devices.
 */
const Vacuum = require("./devices/vacuum");
const MijiaVacuum = require("./devices/mijiavacuum");
const ViomiVacuum = require("./devices/viomivacuum");

module.exports = {
  "rockrobo.vacuum.v1": Vacuum,
  "roborock.vacuum.s5": Vacuum,
  "roborock.vacuum.s5e": Vacuum,
  "roborock.vacuum.c1": Vacuum,
  "roborock.vacuum.s6": Vacuum,
  "roborock.vacuum.t6": Vacuum,
  "roborock.vacuum.e2": Vacuum,
  "roborock.vacuum.s4": Vacuum,
  "roborock.vacuum.a10": Vacuum,

  "roborock.vacuum.m1s": MijiaVacuum,

  "dreame.vacuum.mc1808": ViomiVacuum,
  "viomi.vacuum.v7": ViomiVacuum,
  "viomi.vacuum.v8": ViomiVacuum,
};
