import { Baked, dirIndex, mirrorRows, rotateRows, sprite } from "../../art/baked";
import { PALETTE } from "../../art/palette";
import { MAZE, MAZE_H, MAZE_W, TUNNEL_ROW } from "./maze";

export const TILE = 8;

/** Chomper is a little top-down fish. Drawn facing right, mirrored top to bottom, mouth shut / open. */
const FISH_TOP_CLOSED = ["...OOO....", "O.OOooOO..", "OOooooooO.", "OoaaoowkoO", "OooaaooooO"];
const FISH_TOP_OPEN = ["...OOO....", "O.OOooOO..", "OOooooooO.", "OoaaoowkO.", "Ooooaoo.k."];
const fishRows = (top: string[]): string[] => [...top, ...[...top].reverse()];
const FISH = [fishRows(FISH_TOP_CLOSED), fishRows(FISH_TOP_OPEN)];

/** Chomper pictures by direction (right, down, left, up) and mouth (shut, open), 10 x 10. */
export const CHOMPER: Baked[][] = [0, 1, 2, 3].map((turns) => FISH.map((rows) => sprite(rotateRows(rows, turns))));

/** Chaser bodies, two frames each, 10 x 10. Eyes are drawn separately so they can look around. */
const BODIES: string[][][] = [
  // Blaze: a flame
  [
    ["....o", "...oo", "..oor", ".orrr", ".rrrr", "rrrry", "rrryy", "rrryy", ".rrry", "..r.r"],
    ["....o", "...oo", "..oor", ".orrr", ".rrrr", "rrrry", "rrryy", "rrryy", ".rrry", "...r."],
  ],
  // Pinch: a horned beetle with pincers
  [
    ["..mm.", ".mmM.", ".mmmm", "mmmmm", "mmmmm", "mmmmm", "mmmmm", ".mmmm", ".M.M.", "M...M"],
    ["...mm", "..mmM", ".mmmm", "mmmmm", "mmmmm", "mmmmm", "mmmmm", ".mmmm", "..M.M", ".M..M"],
  ],
  // Echo: a bat
  [
    ["..c..", "c.ccc", "ccccc", "ccCcc", "ccccc", "c.ccc", "..ccc", "...cc", "...cC", "....C"],
    ["..c..", "..ccc", "c.ccc", "cccCc", "ccccc", "ccccc", ".cccc", "...cc", "...cC", "....C"],
  ],
  // Wisp: a floating orb with a trailing tail
  [
    ["..ooo", ".ooaa", "oooaa", "ooooo", "ooooo", "ooooo", ".oooo", "..ooO", "...Oo", "....O"],
    ["..ooo", ".ooaa", "oooaa", "ooooo", "ooooo", "ooooo", ".oooo", "..ooO", "....O", "...Oo"],
  ],
];

const SCARED: Record<string, string> = {
  r: "b", R: "B", o: "b", O: "B", a: "l", y: "l", m: "b", M: "B", c: "b", C: "B", u: "l",
};
const FLASH: Record<string, string> = {
  r: "w", R: "S", o: "w", O: "S", a: "w", y: "w", m: "w", M: "S", c: "w", C: "S", u: "w",
};
const STUNNED: Record<string, string> = {
  r: "s", R: "N", o: "s", O: "N", a: "S", y: "S", m: "s", M: "N", c: "s", C: "N", u: "S",
};

export type ChaserTint = "normal" | "scared" | "flash" | "stunned";

const SWAPS: Record<ChaserTint, Record<string, string>> = { normal: {}, scared: SCARED, flash: FLASH, stunned: STUNNED };

/** Chaser pictures: [chaser][tint][frame]. */
export const CHASERS_ART: Record<ChaserTint, Baked[]>[] = BODIES.map((frames) => {
  const make = (tint: ChaserTint) => frames.map((half) => sprite(mirrorRows(half), SWAPS[tint]));
  return { normal: make("normal"), scared: make("scared"), flash: make("flash"), stunned: make("stunned") };
});

export const POWER_ORB = sprite([".xxxx.", "xxxxxy", "xxxxxy", "xxxxxy", "xxxxyy", ".yyyy."]);
export const TRAP = sprite(["........", ".gggggg.", ".g....g.", ".g.ee.g.", ".g.ee.g.", ".g....g.", ".gggggg.", "........"]);

const WALL_FILL = "#0c1250";
const WALL_EDGE = "#4a6bdc";
const WALL_FLASH_FILL = "#3a4aa8";
const WALL_FLASH_EDGE = "#f4f4f4";

function isWall(x: number, y: number): boolean {
  if (y < 0 || y >= MAZE_H) return false;
  if (x < 0 || x >= MAZE_W) return false;
  const ch = MAZE[y][x];
  return ch === "#";
}

/** All walls with glowing edges where they meet open floor, plus the house door. Painted once. */
export function mazeWalls(flash: boolean): Baked {
  return new Baked(MAZE_W * TILE, MAZE_H * TILE, (g) => {
    const fill = flash ? WALL_FLASH_FILL : WALL_FILL;
    const edge = flash ? WALL_FLASH_EDGE : WALL_EDGE;
    for (let y = 0; y < MAZE_H; y++) {
      for (let x = 0; x < MAZE_W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        const ch = MAZE[y][x];
        if (ch === "-") {
          g.fillStyle = PALETTE.m;
          g.fillRect(px, py + 3, TILE, 2);
          continue;
        }
        if (ch !== "#") continue;
        g.fillStyle = fill;
        g.fillRect(px, py, TILE, TILE);
        const open = (dx: number, dy: number) => !isWall(x + dx, y + dy);
        g.fillStyle = edge;
        // the tunnel row opens onto the screen edge, so no wall edge there
        if (open(0, -1)) g.fillRect(px, py, TILE, 1);
        if (open(0, 1)) g.fillRect(px, py + TILE - 1, TILE, 1);
        if (open(-1, 0) && !(y === TUNNEL_ROW && x === 0)) g.fillRect(px, py, 1, TILE);
        if (open(1, 0) && !(y === TUNNEL_ROW && x === MAZE_W - 1)) g.fillRect(px + TILE - 1, py, 1, TILE);
        // round the outside corners by removing the corner pixel
        const round = (cx: number, cy: number, ox: number, oy: number) => {
          if (open(cx, 0) && open(0, cy)) {
            g.fillStyle = "#0b0b1a";
            g.fillRect(px + ox, py + oy, 1, 1);
          }
        };
        round(-1, -1, 0, 0);
        round(1, -1, TILE - 1, 0);
        round(-1, 1, 0, TILE - 1);
        round(1, 1, TILE - 1, TILE - 1);
      }
    }
  });
}

/** A closed gate: a force field of bars. */
export const GATE = new Baked(TILE, TILE, (g) => {
  g.fillStyle = "#2a1f55";
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = "#7a5ad6";
  for (const x of [1, 3, 5]) g.fillRect(x, 0, 1, TILE);
  g.fillStyle = "#e0b0ff";
  g.fillRect(0, 0, TILE, 1);
  g.fillRect(0, TILE - 1, TILE, 1);
});

/** Demo for the hallway cabinet: the chomper circling a small corridor with a flame chaser behind it. */
export function drawMazePreview(g: CanvasRenderingContext2D, time: number): void {
  g.fillStyle = "#0b0b1a";
  g.fillRect(0, 0, 44, 32);
  g.fillStyle = WALL_FILL;
  g.fillRect(14, 10, 16, 12);
  g.fillStyle = WALL_EDGE;
  g.fillRect(14, 10, 16, 1);
  g.fillRect(14, 21, 16, 1);
  g.fillRect(14, 10, 1, 12);
  g.fillRect(29, 10, 1, 12);
  g.fillRect(0, 0, 44, 1);
  g.fillRect(0, 31, 44, 1);
  // a rectangular lap around the block: left to right along the top, then down, back along the bottom and up
  const lap = (p: number): [number, number, number, number] => {
    const u = ((p % 1) + 1) % 1;
    const w = 26;
    const h = 14;
    const per = 2 * (w + h);
    const d = u * per;
    if (d < w) return [9 + d, 5, 1, 0];
    if (d < w + h) return [9 + w, 5 + (d - w), 0, 1];
    if (d < 2 * w + h) return [9 + w - (d - w - h), 5 + h, -1, 0];
    return [9, 5 + h - (d - 2 * w - h), 0, -1];
  };
  const progress = time * 0.12;
  g.fillStyle = "#f4d9b0";
  for (let i = 0; i < 20; i++) {
    const [x, y] = lap(i / 20);
    if (((i / 20 - progress) % 1 + 1) % 1 > 0.5) g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  const [fx, fy, fdx, fdy] = lap(progress);
  CHOMPER[dirIndex(fdx, fdy)][Math.floor(time * 6) % 2].drawCentered(g, fx, fy);
  const [cx, cy] = lap(progress - 0.14);
  CHASERS_ART[0].normal[Math.floor(time * 6) % 2].drawCentered(g, cx, cy);
}
