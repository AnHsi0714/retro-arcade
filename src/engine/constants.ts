/** Fixed logical resolution. Everything is drawn in these units and scaled up. */
export const WIDTH = 480;
export const HEIGHT = 270;

/** Fixed simulation step (seconds). */
export const STEP = 1 / 60;

/** Height of the shared HUD bar drawn by the game host at the top of the screen. */
export const HUD_HEIGHT = 14;

/** Playfield available to games (below the HUD). */
export const FIELD = {
  x: 0,
  y: HUD_HEIGHT,
  w: WIDTH,
  h: HEIGHT - HUD_HEIGHT,
} as const;
