import { speedmodes } from "./speedmodes";
import { watermodes } from "./watermodes";
import type { ModelDefinition } from "./types";

export const MODELS: Record<string, ModelDefinition[]> = {
  default: [
    {
      speed: speedmodes.gen4,
    },
  ],
  "rockrobo.vacuum.v1": [
    {
      speed: speedmodes["gen2-no_mop"],
    },
  ],
  "roborock.vacuum.c1": [
    {
      speed: speedmodes.gen1,
    },
  ],
  "roborock.vacuum.m1s": [
    {
      speed: speedmodes.gen3,
    },
  ],
  "roborock.vacuum.s5": [
    {
      speed: speedmodes.gen2,
    },
    {
      firmware: ">=3.5.7",
      speed: speedmodes.gen4,
    },
  ],
  "roborock.vacuum.s5e": [
    {
      speed: speedmodes["gen4+custom"],
      waterspeed: watermodes.gen1,
    },
  ],
  "roborock.vacuum.s6": [
    {
      speed: speedmodes.gen4,
    },
  ],
  "roborock.vacuum.t6": [
    {
      speed: speedmodes.gen3,
    },
  ],
  "roborock.vacuum.t4": [
    {
      speed: speedmodes.gen3,
    },
  ],
  "roborock.vacuum.e2": [
    {
      speed: speedmodes["xiaowa-e202-02"],
    },
  ],
  "roborock.vacuum.a08": [
    {
      speed: speedmodes.gen3,
    },
  ],
  "roborock.vacuum.a09": [
    {
      speed: speedmodes["gen4+custom"],
      waterspeed: watermodes["gen1+custom"],
    },
  ],
  // S6 MaxV
  "roborock.vacuum.a10": [
    {
      speed: speedmodes["gen4+custom"],
      waterspeed: watermodes["gen1+custom"],
    },
  ],
  "roborock.vacuum.a11": [
    {
      speed: speedmodes["gen4+custom"],
      waterspeed: watermodes["gen1+custom"],
    },
  ],

  // Viomi
  viomi: [
    {
      speed: speedmodes.viomi,
    },
  ],
  "dreame.vacuum.mc1808": [
    {
      speed: speedmodes.viomi,
    },
  ],
  "viomi.vacuum.v7": [
    {
      speed: speedmodes.viomi,
    },
  ],
  "viomi.vacuum.v8": [
    {
      speed: speedmodes.viomi,
    },
  ],
};
