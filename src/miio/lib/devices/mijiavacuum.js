"use strict";

const Vacuum = require("./vacuum");
const checkResult = require("../checkResult");

module.exports = class extends Vacuum {
  async cleanRooms(listOfRooms) {
    try {
      await super.cleanRooms(listOfRooms);
    } catch (err) {
      // From https://github.com/rytilahti/python-miio/issues/550#issuecomment-552780952
      return this.call(
        "set_mode_withroom",
        [0, 1, listOfRooms.length].concat(listOfRooms),
        {
          refresh: ["state"],
          refreshDelay: 1000,
        }
      ).then(checkResult);
    }
  }
};
