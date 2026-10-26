import { sprite } from "./baked";

/** Riveted metal panel used for the walls of the snake and breakout fields. */
export const WALL_ROWS: string[] = [
  "NNNNNNNN",
  "NnnnnnnK",
  "NnsnnsnK",
  "NnnnnnnK",
  "NnnnnnnK",
  "NnsnnsnK",
  "NnnnnnnK",
  "KKKKKKKK",
];

export const WALL_TILE = sprite(WALL_ROWS);
export const WALL_TILE_ICE = sprite(WALL_ROWS, { N: "C", n: "C", K: "k" });
