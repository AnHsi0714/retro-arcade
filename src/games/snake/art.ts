import { Baked, dirIndex, rotateRows, sprite } from "../../art/baked";
import { PALETTE } from "../../art/palette";
import { WALL_ROWS } from "../../art/tiles";

/** Head facing right: two eyes, a forked tongue. */
const HEAD: string[] = [
  "..GGGG..",
  ".GggggG.",
  "Gggggwk.",
  "Gggggggr",
  "Gggggggr",
  "Gggggwk.",
  ".GggggG.",
  "..GGGG..",
];

const BODY_A: string[] = [
  ".GGGGGG.",
  "GeeggeeG",
  "GegggeeG",
  "GeegggeG",
  "GeeeeeeG",
  "GeeeeeeG",
  "GeeeeeeG",
  ".GGGGGG.",
];

const BODY_B: string[] = [
  ".GGGGGG.",
  "GeeeeeeG",
  "GeeeeeeG",
  "GeeeeeeG",
  "GeeggeeG",
  "GegggeeG",
  "GeegeeeG",
  ".GGGGGG.",
];

/** Tail tapering to the left; the body joins on the right. */
const TAIL: string[] = [
  "........",
  "....GGG.",
  "..GGeeeG",
  "GGeeggeG",
  "GGeeggeG",
  "..GGeeeG",
  "....GGG.",
  "........",
];

const APPLE: string[] = [
  "...tg...",
  ".rrrtrr.",
  "rqqrrrrR",
  "rqrrrrrR",
  "rrrrrrrR",
  "rrrrrrRR",
  ".rrrrRR.",
  "..RRRR..",
];

const POWER_SPEED: string[] = [
  "..yyyy..",
  ".yyyykY.",
  "yyyykyyY",
  "yyykkkyY",
  "yyyykyyY",
  "yyykyyyY",
  ".yyyyyY.",
  "..YYYY..",
];

const POWER_GHOST: string[] = [
  "..cccc..",
  ".cuuuccC",
  "cuuccccC",
  "cukcckcC",
  "cucccccC",
  "cucccccC",
  ".ccCcCcC",
  "..C.C.C.",
];

const POWER_SHRINK: string[] = [
  "..pppp..",
  ".pvvvppP",
  "pvvppppP",
  "pwwwwwwP",
  "pwwwwwwP",
  "pppppppP",
  ".pppppP.",
  "..PPPP..",
];

const BLOCK: string[] = [
  "SSSSSSSN",
  "SssssssN",
  "SssNsssN",
  "SsssNssN",
  "SssssssN",
  "SsNssssN",
  "SssssssN",
  "NNNNNNNN",
];

export type SnakeTint = "normal" | "speed" | "ghost";

const SWAPS: Record<SnakeTint, Record<string, string>> = {
  normal: {},
  speed: { e: "y", g: "x", G: "Y", h: "x" },
  ghost: { e: "c", g: "u", G: "C", h: "u" },
};

function tinted(tint: SnakeTint) {
  const swap = SWAPS[tint];
  return {
    head: [sprite(HEAD, swap), sprite(rotateRows(HEAD, 1), swap), sprite(rotateRows(HEAD, 2), swap), sprite(rotateRows(HEAD, 3), swap)],
    body: [sprite(BODY_A, swap), sprite(BODY_B, swap)],
    tail: [sprite(TAIL, swap), sprite(rotateRows(TAIL, 1), swap), sprite(rotateRows(TAIL, 2), swap), sprite(rotateRows(TAIL, 3), swap)],
  };
}

export const SNAKE_SPRITES = {
  normal: tinted("normal"),
  speed: tinted("speed"),
  ghost: tinted("ghost"),
  apple: sprite(APPLE),
  power: { speed: sprite(POWER_SPEED), ghost: sprite(POWER_GHOST), shrink: sprite(POWER_SHRINK) },
  block: sprite(BLOCK),
};

const TILE = 8;

/** Wall border plus a checkered floor, painted once for a field of cols x rows tiles. */
export function snakeBoard(cols: number, rows: number, ghost: boolean): Baked {
  const wall = sprite(WALL_ROWS, ghost ? { N: "C", n: "C", K: "k" } : {});
  return new Baked(cols * TILE, rows * TILE, (g) => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        g.fillStyle = (x + y) % 2 === 0 ? "#0b0b1a" : "#0e0e22";
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    for (let x = 0; x < cols; x++) {
      wall.draw(g, x * TILE, 0);
      wall.draw(g, x * TILE, (rows - 1) * TILE);
    }
    for (let y = 1; y < rows - 1; y++) {
      wall.draw(g, 0, y * TILE);
      wall.draw(g, (cols - 1) * TILE, y * TILE);
    }
    // bright lip on the inner edge so the boundary stands out from the floor
    g.fillStyle = PALETTE.S;
    g.fillRect(TILE, TILE - 1, (cols - 2) * TILE, 1);
    g.fillRect(TILE, (rows - 1) * TILE, (cols - 2) * TILE, 1);
    g.fillRect(TILE - 1, TILE, 1, (rows - 2) * TILE);
    g.fillRect((cols - 1) * TILE, TILE, 1, (rows - 2) * TILE);
  });
}


/** The path the demo snake follows: round the edge of a 5 x 4 board. */
const LOOP: Array<[number, number]> = [];
for (let x = 0; x < 5; x++) LOOP.push([x, 0]);
for (let y = 1; y < 4; y++) LOOP.push([4, y]);
for (let x = 3; x >= 0; x--) LOOP.push([x, 3]);
for (let y = 2; y >= 1; y--) LOOP.push([0, y]);

/** Demo for the hallway cabinet: a four-segment snake circling an apple on a 5 x 4 board. */
export function drawSnakePreview(g: CanvasRenderingContext2D, time: number): void {
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 5; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#0b0b1a" : "#0e0e22";
      g.fillRect(2 + x * TILE, y * TILE, TILE, TILE);
    }
  }
  const head = Math.floor(time * 4);
  /** Cell of segment i, counting back from the head. */
  const cell = (i: number) => LOOP[(((head - i) % LOOP.length) + LOOP.length) % LOOP.length];
  SNAKE_SPRITES.apple.draw(g, 2 + 2 * TILE, TILE + (Math.floor(time * 3) % 2));
  const length = 4;
  const set = SNAKE_SPRITES.normal;
  for (let i = length - 1; i >= 0; i--) {
    const [cx, cy] = cell(i);
    const x = 2 + cx * TILE;
    const y = cy * TILE;
    if (i === 0) {
      const [bx, by] = cell(1);
      set.head[dirIndex(cx - bx, cy - by)].draw(g, x, y);
    } else if (i === length - 1) {
      const [nx, ny] = cell(i - 1);
      set.tail[dirIndex(nx - cx, ny - cy)].draw(g, x, y);
    } else {
      set.body[i % 2].draw(g, x, y);
    }
  }
}
