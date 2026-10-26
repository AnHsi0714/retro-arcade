/**
 * Cabinets placed along the hallway, left to right. Adding a machine means
 * registering the game in games/registry.ts and adding a line here.
 */
export interface MachineDef {
  gameId: string;
  /** World x of the cabinet's center. */
  x: number;
}

export const MACHINES: MachineDef[] = [
  { gameId: "test", x: 220 },
  { gameId: "snake", x: 360 },
  { gameId: "breakout", x: 500 },
  { gameId: "defender", x: 640 },
  { gameId: "meteor", x: 780 },
  { gameId: "maze", x: 920 },
];

/** Space after the last cabinet before the right wall. */
export const HALL_END_PADDING = 160;
