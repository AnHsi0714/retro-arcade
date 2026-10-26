import { Baked, sprite } from "../../art/baked";
import { darken, lighten } from "../../art/palette";
import { WALL_TILE } from "../../art/tiles";

export type BrickKind = "1" | "2" | "3" | "X" | "S" | "M";

/** Brick colors. The how-to legend uses the same values, so swatches match what is on screen. */
export const BRICK_COLORS: Record<BrickKind, string> = {
  "1": "#4fa3ff",
  "2": "#5fd36a",
  "3": "#e0c341",
  X: "#ff6a3a",
  S: "#9a9aae",
  M: "#d65cff",
};

const BRICK_W = 30;
const BRICK_H = 8;

function paintBrick(g: CanvasRenderingContext2D, kind: BrickKind, hp: number): void {
  const base = BRICK_COLORS[kind];
  const dark = darken(base, 0.62);
  const shade = darken(base, 0.3);
  const light = lighten(base, 0.55);
  const dot = (color: string, points: Array<[number, number]>) => {
    g.fillStyle = color;
    for (const [x, y] of points) g.fillRect(x, y, 1, 1);
  };

  g.fillStyle = dark;
  g.fillRect(0, 0, BRICK_W, BRICK_H);
  g.fillStyle = base;
  g.fillRect(1, 1, BRICK_W - 2, BRICK_H - 2);
  g.fillStyle = light;
  g.fillRect(1, 1, BRICK_W - 2, 1);
  g.fillRect(1, 1, 1, BRICK_H - 2);
  g.fillStyle = shade;
  g.fillRect(2, BRICK_H - 2, BRICK_W - 3, 1);
  g.fillRect(BRICK_W - 2, 2, 1, BRICK_H - 3);

  const plate = () => {
    g.fillStyle = shade;
    g.fillRect(4, 3, BRICK_W - 8, 2);
    g.fillStyle = light;
    g.fillRect(4, 2, BRICK_W - 8, 1);
  };
  const crack = (x: number) =>
    dot(dark, [
      [x, 1],
      [x + 1, 2],
      [x, 3],
      [x + 1, 4],
      [x + 2, 5],
      [x + 1, 6],
    ]);

  switch (kind) {
    case "1":
      g.fillStyle = lighten(base, 0.85);
      g.fillRect(4, 2, 6, 1);
      break;
    case "2":
      plate();
      if (hp <= 1) crack(12);
      break;
    case "3":
      plate();
      dot(dark, [
        [3, 2],
        [26, 2],
        [3, 5],
        [26, 5],
      ]);
      if (hp <= 2) crack(9);
      if (hp <= 1) crack(19);
      break;
    case "X": {
      // a little bomb with a lit fuse
      g.fillStyle = "#1a0a05";
      g.fillRect(12, 2, 6, 4);
      g.fillRect(13, 1, 4, 6);
      dot("#ff9a3a", [[13, 3]]);
      dot("#ffd84a", [
        [17, 1],
        [18, 0],
        [19, 1],
      ]);
      dot("#ff9a3a", [[18, 2]]);
      break;
    }
    case "S": {
      g.fillStyle = lighten(base, 0.35);
      for (let x = 3; x < BRICK_W - 3; x++) for (let y = 2; y < BRICK_H - 2; y++) if ((x + y) % 4 === 0) g.fillRect(x, y, 1, 1);
      dot(dark, [
        [2, 2],
        [27, 2],
        [2, 5],
        [27, 5],
      ]);
      break;
    }
    case "M": {
      // arrows pointing both ways: this row slides
      g.fillStyle = dark;
      for (const [x, ys] of [
        [5, [3, 4]],
        [6, [2, 3, 4, 5]],
        [7, [1, 2, 3, 4, 5, 6]],
      ] as Array<[number, number[]]>) {
        for (const y of ys) {
          g.fillRect(x, y, 1, 1);
          g.fillRect(BRICK_W - 1 - x, y, 1, 1);
        }
      }
      g.fillRect(11, 3, 8, 2);
      break;
    }
  }
}

const bricks = new Map<string, Baked>();

/** A brick picture for its kind and remaining hits (drawn at the brick's x + 1, y + 1). */
export function brickSprite(kind: BrickKind, hp: number): Baked {
  const key = `${kind}${Number.isFinite(hp) ? hp : 0}`;
  let b = bricks.get(key);
  if (!b) {
    b = new Baked(BRICK_W, BRICK_H, (g) => paintBrick(g, kind, hp));
    bricks.set(key, b);
  }
  return b;
}

export type PaddleMode = "normal" | "wide" | "stunned";

const PADDLE_H = 6;
const paddles = new Map<string, Baked>();

export function paddleSprite(width: number, mode: PaddleMode): Baked {
  const key = `${width}${mode}`;
  let p = paddles.get(key);
  if (!p) {
    const body = mode === "wide" ? "#6cff7a" : mode === "stunned" ? "#6a6a80" : "#c4c4da";
    const cap = mode === "wide" ? "#2f9a4a" : mode === "stunned" ? "#3a3a4e" : "#4ad7ff";
    p = new Baked(width, PADDLE_H, (g) => {
      g.fillStyle = darken(body, 0.55);
      g.fillRect(1, 5, width - 2, 1);
      g.fillStyle = body;
      g.fillRect(1, 1, width - 2, 4);
      g.fillStyle = lighten(body, 0.6);
      g.fillRect(1, 0, width - 2, 1);
      g.fillStyle = darken(body, 0.25);
      g.fillRect(1, 4, width - 2, 1);
      // end caps and a glowing strip down the middle
      g.fillStyle = cap;
      g.fillRect(0, 1, 4, 4);
      g.fillRect(width - 4, 1, 4, 4);
      g.fillStyle = lighten(cap, 0.5);
      g.fillRect(1, 1, 1, 1);
      g.fillRect(width - 2, 1, 1, 1);
      g.fillStyle = mode === "stunned" ? "#ff5a5a" : "#4ad7ff";
      g.fillRect(6, 2, width - 12, 1);
    });
    paddles.set(key, p);
  }
  return p;
}

export const BALL = sprite(["..ww..", ".wwwwS", "wwwwwS", "wwwwSS", ".SSSS.", "..SS.."]);

export const BOSS_SHOT = sprite([".rr.", "rqqr", "rqqr", "rrrr", ".rr.", "..R."]);

export const BOSS_W = 80;
export const BOSS_H = 20;

function paintBoss(g: CanvasRenderingContext2D, flash: boolean): void {
  const tone = (hex: string) => (flash ? lighten(hex, 0.8) : hex);
  const body = tone("#b13a6a");
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  // horns
  for (const x of [10, 62]) {
    fill(tone("#6a1f40"), x + 2, 0, 4, 4);
    fill(tone("#6a1f40"), x, 2, 8, 2);
  }
  // body
  fill(tone("#4a1430"), 1, 3, BOSS_W - 2, 15);
  fill(body, 2, 4, BOSS_W - 4, 13);
  fill(tone("#ff7ab8"), 2, 4, BOSS_W - 4, 1);
  fill(tone("#d4538a"), 2, 5, BOSS_W - 4, 1);
  fill(tone("#7a2650"), 2, 15, BOSS_W - 4, 2);
  // panel seams and rivets
  fill(tone("#7a2650"), 6, 9, 24, 1);
  fill(tone("#7a2650"), 50, 9, 24, 1);
  for (const x of [5, 20, 36, 44, 59, 74]) fill(tone("#ffc0dc"), x, 6, 1, 1);
  // eye socket and eye
  fill(tone("#2a0a1c"), 33, 5, 14, 12);
  fill(tone("#2a0a1c"), 32, 7, 16, 8);
  fill(tone("#f4f4f4"), 34, 6, 12, 10);
  fill(tone("#f4f4f4"), 33, 8, 14, 6);
  fill(tone("#ff5a5a"), 37, 8, 6, 6);
  // cannons
  for (const x of [8, 66]) {
    fill(tone("#4a4a78"), x, 14, 7, 6);
    fill(tone("#8a8aa6"), x + 1, 14, 5, 5);
    fill(tone("#05050f"), x + 2, 18, 3, 2);
  }
  // teeth
  g.fillStyle = tone("#f4f4f4");
  for (let x = 18; x < 62; x += 4) {
    if (x > 30 && x < 46) continue;
    g.fillRect(x, 15, 3, 2);
    g.fillRect(x + 1, 17, 1, 1);
  }
}

export const BOSS = new Baked(BOSS_W, BOSS_H, (g) => paintBoss(g, false));
export const BOSS_FLASH = new Baked(BOSS_W, BOSS_H, (g) => paintBoss(g, true));

/** Where the boss's pupil sits at rest, relative to the boss sprite. */
export const BOSS_EYE = { x: 40, y: 11 };

export function breakoutBoard(width: number, height: number, wall: number): Baked {
  return new Baked(width, height, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#0b0b1a");
    sky.addColorStop(1, "#14143a");
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);
    // faint grid
    g.fillStyle = "rgba(120, 120, 220, 0.07)";
    for (let x = wall; x < width - wall; x += 16) g.fillRect(x, 0, 1, height);
    for (let y = wall; y < height; y += 16) g.fillRect(0, y, width, 1);
    for (let x = 0; x < width; x += 8) {
      WALL_TILE.draw(g, x, 0);
    }
    for (let y = 0; y < height; y += 8) {
      WALL_TILE.draw(g, 0, y);
      WALL_TILE.draw(g, width - wall, y);
    }
    g.fillStyle = "#c4c4da";
    g.fillRect(wall, wall - 1, width - wall * 2, 1);
    g.fillRect(wall - 1, wall, 1, height - wall);
    g.fillRect(width - wall, wall, 1, height - wall);
  });
}

/** Triangle wave: 0 to 1 and back, once per 2 units of x. */
const tri = (x: number): number => Math.abs((((x % 2) + 2) % 2) - 1);

/** Demo for the hallway cabinet: three rows of bricks, a ball and a paddle that follows it. */
export function drawBreakoutPreview(g: CanvasRenderingContext2D, time: number): void {
  g.fillStyle = "#0b0b1a";
  g.fillRect(0, 0, 44, 32);
  const rows: BrickKind[] = ["3", "2", "1"];
  rows.forEach((kind, row) => {
    for (let col = 0; col < 4; col++) {
      g.fillStyle = BRICK_COLORS[kind];
      g.fillRect(2 + col * 10, 3 + row * 5, 9, 4);
      g.fillStyle = lighten(BRICK_COLORS[kind], 0.55);
      g.fillRect(2 + col * 10, 3 + row * 5, 9, 1);
    }
  });
  const bx = 4 + 36 * tri(time * 0.55);
  const by = 19 + 7 * tri(time * 1.1);
  g.fillStyle = "#fff";
  g.fillRect(Math.round(bx), Math.round(by), 2, 2);
  g.fillStyle = "#c4c4da";
  const px = Math.min(32, Math.max(0, Math.round(bx) - 5));
  g.fillRect(px, 29, 12, 2);
  g.fillStyle = "#4ad7ff";
  g.fillRect(px, 29, 2, 2);
  g.fillRect(px + 10, 29, 2, 2);
}
