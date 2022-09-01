// From https://github.com/aholstenson/miio/blob/master/lib/devices/vacuum.js#L128
export const cleaningStatuses = [
  "cleaning",
  "spot-cleaning",
  "zone-cleaning",
  "room-cleaning",
];

export const errors = {
  id1: {
    description:
      "Try turning the orange laser-head to make sure it isn't blocked.",
  },
  id2: { description: "Clean and tap the bumpers lightly." },
  id3: { description: "Try moving the vacuum to a different place." },
  id4: {
    description:
      "Wipe the cliff sensor clean and move the vacuum to a different place.",
  },
  id5: { description: "Remove and clean the main brush." },
  id6: { description: "Remove and clean the side-brushes." },
  id7: {
    description:
      "Make sure the wheels arent blocked. Move the vacuum to a different place and try again.",
  },
  id8: {
    description: "Make sure there are no obstacles around the vacuum.",
  },
  id9: { description: "Install the dustbin and the filter." },
  id10: {
    description: "Make sure the filter has been tried or clean the filter.",
  },
  id11: {
    description:
      "Strong magnetic field detected. Move the device away from the virtual wall and try again",
  },
  id12: { description: "Battery is low, charge your vacuum." },
  id13: {
    description:
      "Couldn't charge properly. Make sure the charging surfaces are clean.",
  },
  id14: { description: "Battery malfunctioned." },
  id15: { description: "Wipe the wall sensor clean." },
  id16: { description: "Use the vacuum on a flat horizontal surface." },
  id17: { description: "Side-brushes malfunctioned. Reboot the system." },
  id18: { description: "Fan malfunctioned. Reboot the system." },
  id19: { description: "The docking station is not connected to power." },
  id20: { description: "unknown" },
  id21: {
    description:
      "Please make sure that the top cover of the laser distance sensor is not pinned.",
  },
  id22: { description: "Please wipe the dock sensor." },
  id23: {
    description: "Make sure the signal emission area of dock is clean.",
  },
  id24: {
    description:
      "Robot stuck in a blocked area. Manually move it and resume the cleaning.",
  },
};
