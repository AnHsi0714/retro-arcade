/**
 * Brick layouts, 14 columns per row. Legend:
 *   .  empty
 *   1  normal brick
 *   2  takes 2 hits
 *   3  takes 3 hits
 *   X  explosive: destroys its neighbours, chaining through other X bricks
 *   S  steel: only explosions break it, not required to clear the stage
 *   M  moving: the whole row slides left and right (keep M rows free of other bricks)
 * A level with boss: true also spawns the boss above the bricks.
 */
export interface LevelDef {
  rows: string[];
  boss?: boolean;
}

export const LEVELS: LevelDef[] = [
  {
    rows: [
      "..............",
      "22222222222222",
      "11111111111111",
      "11111X11X11111",
      "11111111111111",
      "11111111111111",
    ],
  },
  {
    rows: [
      "3..3..33..3..3",
      "22222222222222",
      ".MMMM....MMMM.",
      "1X1111SS1111X1",
      "11111111111111",
      "..1111111111..",
    ],
  },
  {
    rows: [
      "S2S2S2S2S2S2S2",
      "1X1X1X1X1X1X1X",
      "MMM....MMM....",
      "22222222222222",
      "1111..11..1111",
      "XXXX......XXXX",
    ],
  },
  {
    boss: true,
    rows: [
      "..............",
      "..............",
      "..............",
      "S..2222222...S",
      "...1X1111X1...",
      "..............",
    ],
  },
];
