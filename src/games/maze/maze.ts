/**
 * Original maze layout, 28 x 31 tiles. Legend:
 *   #  wall
 *   .  dot
 *   o  power orb
 *   (space) empty floor
 *   -  chaser house door (no one walks through it; chasers are placed outside)
 *   G  gate: alternates between wall and open floor over time
 * Row 14 wraps around through the side tunnels.
 */
export const MAZE: readonly string[] = [
  "############################",
  "#............##............#",
  "#.##.###.###.##.###.###.##.#",
  "#o##.###.###.##.###.###.##o#",
  "#.##.###.###.##.###.###.##.#",
  "#..........................#",
  "#.##.#######.##.#######.##.#",
  "#.##.#######.##.#######.##.#",
  "#....GGG.....##.....GGG....#",
  "#.######.###.##.###.######.#",
  "#.######.###.##.###.######.#",
  "#.##....................##.#",
  "#.##.###.####--####.###.##.#",
  "#.##.###.##      ##.###.##.#",
  " ........##      ##........ ",
  "#.##.###.##      ##.###.##.#",
  "#.##.###.##########.###.##.#",
  "#.##....................##.#",
  "#.##.###.###.##.###.###.##.#",
  "#.##.###.###.##.###.###.##.#",
  "#............##............#",
  "#G######.###.##.###.######G#",
  "#G######.###.##.###.######G#",
  "#....###............###....#",
  "#.##.#######.##.#######.##.#",
  "#o##.#######.##.#######.##o#",
  "#............##............#",
  "#.##.###.##########.###.##.#",
  "#.##.###.##########.###.##.#",
  "#..........................#",
  "############################",
];

export const MAZE_W = 28;
export const MAZE_H = 31;
export const TUNNEL_ROW = 14;

/** Where the player starts. */
export const PLAYER_START = { x: 13, y: 17 };
/** Tile just outside the house door, where chasers enter the maze. */
export const HOUSE_EXIT = { x: 13, y: 11 };
/** Waiting spots inside the house (pixel-free tile coords, drawn only). */
export const HOUSE_SLOTS = [
  { x: 13.5, y: 14 },
  { x: 11.5, y: 14 },
  { x: 15.5, y: 14 },
  { x: 13.5, y: 13 },
];
