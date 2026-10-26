import { Baked, paintRows, sprite } from "../art/baked";
import { drawPixelText } from "../art/font";
import { darken, lighten, mix } from "../art/palette";
import { createSky, drawScrolling, SKYLINE_FAR, SKYLINE_NEAR, seeded } from "../art/skyline";
import { HEIGHT, WIDTH } from "../engine/constants";
import { PREVIEW_H, PREVIEW_W, type GameInfo } from "../engine/game";

export const FLOOR_Y = 220;
export const CEILING_H = 18;
/** The glass wall runs from the ceiling beam down to the wainscot panel. */
const GLASS_TOP = CEILING_H + 4;
const GLASS_BOTTOM = FLOOR_Y - 24;

export const CABINET_W = 64;
export const CABINET_H = 88;
const SCREEN_X = 10;
const SCREEN_Y = 20;

// --- backdrop -------------------------------------------------------------

/** Night sky behind the glass wall. Fixed on screen. */
const SKY = createSky(GLASS_BOTTOM - GLASS_TOP);

export const PILLAR_SPACING = 120;
export const PILLAR_W = 10;

/** A steel window mullion with a neon edge, full height of the glass. */
export const PILLAR = new Baked(PILLAR_W, GLASS_BOTTOM - GLASS_TOP, (g) => {
  const h = GLASS_BOTTOM - GLASS_TOP;
  g.fillStyle = "#16162c";
  g.fillRect(0, 0, PILLAR_W, h);
  g.fillStyle = "#26264a";
  g.fillRect(1, 0, 2, h);
  g.fillStyle = "#0c0c1c";
  g.fillRect(PILLAR_W - 2, 0, 2, h);
  g.fillStyle = "#4ad7ff";
  g.fillRect(PILLAR_W - 3, 0, 1, h);
});

/** Wainscot panel under the glass, repeating in world space. */
export const WAINSCOT = new Baked(32, FLOOR_Y - GLASS_BOTTOM, (g) => {
  const h = FLOOR_Y - GLASS_BOTTOM;
  g.fillStyle = "#1a1832";
  g.fillRect(0, 0, 32, h);
  g.fillStyle = "#ff7ab8";
  g.fillRect(0, 0, 32, 1);
  g.fillStyle = "#0e0e22";
  g.fillRect(0, 1, 32, 2);
  g.fillStyle = "#262248";
  g.fillRect(3, 6, 26, h - 10);
  g.fillStyle = "#14122a";
  g.fillRect(3, 6, 26, 1);
  g.fillRect(3, 6, 1, h - 10);
  g.fillStyle = "#322c5c";
  g.fillRect(3, h - 5, 26, 1);
  g.fillRect(28, 6, 1, h - 10);
});

/** Ceiling band and the beam above the glass. */
export function drawCeiling(g: CanvasRenderingContext2D): void {
  g.fillStyle = "#0a0a18";
  g.fillRect(0, 0, WIDTH, CEILING_H);
  g.fillStyle = "#14142a";
  g.fillRect(0, CEILING_H - 4, WIDTH, 4);
  g.fillStyle = "#26264a";
  g.fillRect(0, CEILING_H, WIDTH, 1);
  g.fillStyle = "#0c0c1c";
  g.fillRect(0, CEILING_H + 1, WIDTH, 3);
}

/** A ceiling lamp over a cabinet, with a faint cone of light. */
export function drawLamp(g: CanvasRenderingContext2D, x: number, color: string): void {
  g.fillStyle = "#26264a";
  g.fillRect(x - 15, CEILING_H - 1, 30, 4);
  g.fillStyle = lighten(color, 0.7);
  g.fillRect(x - 12, CEILING_H + 3, 24, 2);
  const cone = g.createLinearGradient(0, CEILING_H + 5, 0, FLOOR_Y);
  cone.addColorStop(0, hexAlpha(color, 0.2));
  cone.addColorStop(1, hexAlpha(color, 0));
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(x - 12, CEILING_H + 5);
  g.lineTo(x + 12, CEILING_H + 5);
  g.lineTo(x + 46, FLOOR_Y);
  g.lineTo(x - 46, FLOOR_Y);
  g.closePath();
  g.fill();
}

function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// --- floor ----------------------------------------------------------------

export const CARPET_W = 64;

/** Arcade carpet: dark base scattered with neon shapes. */
export const CARPET = new Baked(CARPET_W, HEIGHT - FLOOR_Y, (g) => {
  const h = HEIGHT - FLOOR_Y;
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#2a2448");
  base.addColorStop(1, "#16142c");
  g.fillStyle = base;
  g.fillRect(0, 0, CARPET_W, h);
  const rand = seeded(99);
  const colors = ["#4ad7ff", "#ff7ab8", "#ffd84a", "#c06cff", "#6cff7a"];
  for (let i = 0; i < 16; i++) {
    const x = 3 + Math.floor(rand() * (CARPET_W - 9));
    const y = 6 + Math.floor(rand() * (h - 14));
    g.fillStyle = hexAlpha(colors[Math.floor(rand() * colors.length)], 0.55);
    switch (Math.floor(rand() * 4)) {
      case 0:
        g.fillRect(x, y, 3, 3);
        break;
      case 1:
        g.fillRect(x + 1, y, 1, 3);
        g.fillRect(x, y + 1, 3, 1);
        break;
      case 2:
        g.fillRect(x, y + 2, 1, 1);
        g.fillRect(x + 1, y + 1, 1, 1);
        g.fillRect(x + 2, y, 1, 1);
        g.fillRect(x + 3, y + 1, 1, 1);
        g.fillRect(x + 4, y + 2, 1, 1);
        break;
      default:
        g.fillRect(x, y, 4, 1);
        g.fillRect(x, y + 2, 4, 1);
    }
  }
  // baseboard where the floor meets the wall
  g.fillStyle = "#4a4a78";
  g.fillRect(0, 0, CARPET_W, 1);
  g.fillStyle = "#12122a";
  g.fillRect(0, 1, CARPET_W, 3);
});

// --- the player -----------------------------------------------------------

export const PLAYER_W = 14;
export const PLAYER_H = 24;

const HEAD_AND_BODY: string[] = [
  "....kkkkkk....",
  "...kyyyyyyk...",
  "..kyyyyyyyyk..",
  "..kyyyyyykkkk.",
  "..kTaaaaaak...",
  "..kTaaaakaak..",
  "...kaaaaaak...",
  "....kaaaak....",
  "...kkccccckk..",
  "..kccccccccck.",
  ".kcccwwcccccck",
  ".kccwwwwcccaak",
  ".kcccwwcccaak.",
  "..kccccccccck.",
  "..kccccccccck.",
  "..kkcccccckk..",
];

const LEGS: string[][] = [
  // standing
  ["...kBBBBBBk...", "...kBBkkBBk...", "...kBBk.kBBk..", "...kBBk.kBBk..", "..kwwwk.kwwwk.", "..kkkkk.kkkkk."],
  // left foot forward
  ["...kBBBBBBk...", "..kBBBkkBBBk..", "..kBBk..kBBk..", ".kBBk....kBBk.", ".kwwwk...kwwwk", ".kkkkk...kkkkk"],
  // right foot forward
  ["...kBBBBBBk...", "...kBBkkBBBk..", "...kBBk.kBBk..", "..kBBk...kBBk.", "..kwwwk..kwwwk", "..kkkkk..kkkkk"],
];

export const PLAYER_FRAMES: Baked[] = LEGS.map((legs) => {
  const rows = [...HEAD_AND_BODY, ...legs];
  const width = Math.max(...rows.map((r) => r.length));
  return new Baked(width, rows.length, (g) => paintRows(g, rows.map((r) => r.padEnd(width, "."))));
});
export const PLAYER_FRAMES_LEFT: Baked[] = PLAYER_FRAMES.map((f) => f.mirrored());

// --- cabinets -------------------------------------------------------------

const bodies = new Map<string, Baked>();

function paintCabinet(g: CanvasRenderingContext2D, info: GameInfo): void {
  const base = info.color;
  const body = darken(base, 0.6);
  const dark = "#05050f";
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };

  // silhouette: sign on top, cabinet body, wider control deck, lower body
  fill(dark, 3, 0, 58, 14);
  fill(dark, 2, 13, 60, 75);
  fill(dark, 0, 58, 64, 15);
  fill(body, 3, 14, 58, 44);
  fill(body, 3, 73, 58, 14);
  // side art stripes in the game's color
  for (const [x, y, h] of [[3, 14, 44], [59, 14, 44], [3, 73, 14], [59, 73, 14]] as Array<[number, number, number]>) {
    fill(base, x, y, 2, h);
    fill(lighten(base, 0.45), x, y, 1, h);
  }

  // sign panel
  fill(darken(base, 0.88), 5, 2, 54, 10);
  fill(darken(base, 0.4), 5, 2, 54, 1);
  const name = (info.marquee ?? info.title.split(" ")[0]).toUpperCase();
  drawPixelText(g, name, 32, 3, { color: lighten(base, 0.78), align: "center" });

  // bezel
  fill("#1a1a2e", 7, 16, 50, 40);
  fill("#0a0a14", 8, 17, 48, 38);
  fill("#26264a", 7, 16, 50, 1);
  fill("#0a0a14", SCREEN_X - 1, SCREEN_Y - 1, PREVIEW_W + 2, PREVIEW_H + 2);

  // control deck: lit top face, then the front edge
  fill(lighten(body, 0.22), 1, 59, 62, 8);
  fill(lighten(body, 0.5), 1, 59, 62, 1);
  fill(body, 1, 67, 62, 5);
  fill(darken(body, 0.4), 1, 71, 62, 1);
  // joystick
  fill("#1a1a2e", 12, 63, 9, 3);
  fill("#4a4a78", 13, 63, 7, 1);
  fill("#c4c4da", 16, 60, 2, 4);
  fill("#ff5a5a", 14, 56, 6, 5);
  fill("#ffa0a0", 15, 57, 2, 2);
  fill("#a8283c", 14, 60, 6, 1);
  // buttons
  for (const [x, color] of [[34, "#ff5a5a"], [42, "#ffd84a"], [50, "#4ad7ff"]] as Array<[number, string]>) {
    fill(dark, x - 1, 60, 6, 6);
    fill(color, x, 61, 4, 4);
    fill(lighten(color, 0.6), x, 61, 2, 1);
  }

  // lower body: coin door and an emblem on each side
  fill("#10101c", 20, 76, 24, 10);
  fill("#4a4a78", 20, 76, 24, 1);
  fill("#4a4a78", 20, 76, 1, 10);
  fill("#26264a", 43, 76, 1, 10);
  fill("#5a4a10", 24, 79, 6, 2);
  fill("#5a4a10", 34, 79, 6, 2);
  fill("#05050f", 28, 83, 8, 2);
  for (const x of [6, 48]) {
    fill(dark, x, 76, 10, 10);
    fill(darken(base, 0.3), x + 1, 77, 8, 8);
    drawPixelText(g, name[0], x + 5, 78, { color: lighten(base, 0.8), align: "center" });
  }
  fill(dark, 2, 86, 60, 2);
}

function cabinetBody(info: GameInfo): Baked {
  let b = bodies.get(info.id);
  if (!b) {
    b = new Baked(CABINET_W, CABINET_H, (g) => paintCabinet(g, info));
    bodies.set(info.id, b);
  }
  return b;
}

/** Glass shine over the screen. */
const GLASS = new Baked(PREVIEW_W, PREVIEW_H, (g) => {
  g.fillStyle = "rgba(255, 255, 255, 0.1)";
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(18, 0);
  g.lineTo(0, 18);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(0, 0, 0, 0.18)";
  for (let y = 1; y < PREVIEW_H; y += 2) g.fillRect(0, y, PREVIEW_W, 1);
});

/**
 * Draws a cabinet with its left edge at `x` and feet on FLOOR_Y. When lit (the
 * player is close) the screen runs its demo, the sign glows and the outline shows.
 */
export function drawCabinet(g: CanvasRenderingContext2D, info: GameInfo, x: number, time: number, lit: boolean): void {
  const y = FLOOR_Y - CABINET_H;
  // shadow and the glow of the screen on the carpet
  g.fillStyle = "rgba(0, 0, 0, 0.35)";
  g.fillRect(x - 2, FLOOR_Y - 2, CABINET_W + 4, 5);
  const glow = g.createRadialGradient(x + CABINET_W / 2, FLOOR_Y + 14, 2, x + CABINET_W / 2, FLOOR_Y + 14, 46);
  glow.addColorStop(0, hexAlpha(info.color, lit ? 0.32 : 0.14));
  glow.addColorStop(1, hexAlpha(info.color, 0));
  g.fillStyle = glow;
  g.fillRect(x - 40, FLOOR_Y, CABINET_W + 80, HEIGHT - FLOOR_Y);

  cabinetBody(info).draw(g, x, y);

  // screen: a demo when lit, the same picture dimmed otherwise
  g.save();
  g.translate(x + SCREEN_X, y + SCREEN_Y);
  g.beginPath();
  g.rect(0, 0, PREVIEW_W, PREVIEW_H);
  g.clip();
  if (info.preview) info.preview(g, lit ? time : 0.4);
  else {
    g.fillStyle = "#05050f";
    g.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
  }
  if (!lit) {
    g.fillStyle = "rgba(5, 5, 15, 0.5)";
    g.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
  }
  GLASS.draw(g, 0, 0);
  g.restore();

  // sign bulbs chase around the sign; coin slots glow when lit
  const bulbs: Array<[number, number]> = [[6, 3], [56, 3], [6, 9], [56, 9]];
  bulbs.forEach(([bx, by], i) => {
    const on = lit ? Math.floor(time * 4) % 4 === i : false;
    g.fillStyle = on ? "#fff0a0" : mix(info.color, "#05050f", 0.55);
    g.fillRect(x + bx, y + by, 2, 2);
  });
  if (lit) {
    g.fillStyle = Math.floor(time * 3) % 2 === 0 ? "#ffd84a" : "#a8841c";
    g.fillRect(x + 24, y + 79, 6, 2);
    g.fillRect(x + 34, y + 79, 6, 2);
    g.strokeStyle = "#ffd84a";
    g.lineWidth = 1;
    g.strokeRect(x - 1.5, y - 1.5, CABINET_W + 3, CABINET_H + 3);
  }
}

/** Everything behind the cabinets: sky, skyline, window frames, wainscot and the ceiling. */
export function drawBackdrop(g: CanvasRenderingContext2D, camX: number): void {
  SKY.draw(g, 0, GLASS_TOP);
  drawScrolling(g, SKYLINE_FAR, camX, 0.12, GLASS_BOTTOM - SKYLINE_FAR.h);
  drawScrolling(g, SKYLINE_NEAR, camX, 0.25, GLASS_BOTTOM - SKYLINE_NEAR.h);
  const offset = camX * 0.6;
  for (let i = Math.floor(offset / PILLAR_SPACING); i * PILLAR_SPACING - offset < WIDTH; i++) {
    PILLAR.draw(g, i * PILLAR_SPACING - offset, GLASS_TOP);
  }
  drawCeiling(g);
  drawScrolling(g, WAINSCOT, camX, 1, GLASS_BOTTOM);
}

export function drawFloor(g: CanvasRenderingContext2D, camX: number): void {
  drawScrolling(g, CARPET, camX, 1, FLOOR_Y);
}

// --- foreground and ends ---------------------------------------------------

/** A velvet-rope post for the foreground. */
export const POST = sprite([
  "..yy..",
  ".yxxy.",
  "..kk..",
  "..kk..",
  "..kk..",
  "..kk..",
  "..kk..",
  "..kk..",
  "..kk..",
  "..kk..",
  ".kkkk.",
  "kkkkkk",
]);

/** Straight run of w x w pixels between two points. */
function pixelLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    g.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** A potted fern for the foreground: dark fronds so it never competes with the cabinets. */
export const PLANT = new Baked(32, 36, (g) => {
  const fronds: Array<[number, number, number, number]> = [
    [4, 8, 8, 17],
    [9, 1, 11, 14],
    [16, 0, 16, 12],
    [23, 1, 21, 14],
    [27, 8, 24, 17],
    [1, 18, 8, 22],
    [30, 18, 24, 22],
  ];
  for (const [tx, ty, mx, my] of fronds) {
    g.fillStyle = "#0c2a1c";
    pixelLine(g, 16, 26, mx, my, 2);
    pixelLine(g, mx, my, tx, ty, 2);
    g.fillStyle = "#1a5a3a";
    pixelLine(g, mx + 1, my, tx + 1, ty + 1, 1);
  }
  g.fillStyle = "#05050f";
  g.fillRect(9, 26, 14, 10);
  g.fillStyle = "#1a1636";
  g.fillRect(10, 27, 12, 3);
  g.fillStyle = "#2a2450";
  g.fillRect(10, 27, 12, 1);
});

/** A doorway on the back wall at either end of the hall, with a sign. */
export function drawDoor(g: CanvasRenderingContext2D, x: number, label: string, color: string): void {
  const w = 40;
  const h = 74;
  const y = FLOOR_Y - h;
  g.fillStyle = "#05050f";
  g.fillRect(x - 2, y - 2, w + 4, h + 2);
  g.fillStyle = "#0e0e22";
  g.fillRect(x, y, w, h);
  g.fillStyle = "#1a1a38";
  g.fillRect(x + 3, y + 3, w / 2 - 4, h - 6);
  g.fillRect(x + w / 2 + 1, y + 3, w / 2 - 4, h - 6);
  g.fillStyle = "#26264a";
  g.fillRect(x + 3, y + 3, w / 2 - 4, 1);
  g.fillRect(x + w / 2 + 1, y + 3, w / 2 - 4, 1);
  g.fillStyle = color;
  g.fillRect(x + w / 2 - 4, y + h / 2, 2, 8);
  g.fillRect(x + w / 2 + 2, y + h / 2, 2, 8);
  // sign above the door
  g.fillStyle = "#05050f";
  g.fillRect(x - 2, y - 14, w + 4, 11);
  g.fillStyle = color;
  g.fillRect(x - 2, y - 14, w + 4, 1);
  g.fillRect(x - 2, y - 4, w + 4, 1);
  drawPixelText(g, label, x + w / 2, y - 12, { color: lighten(color, 0.3), align: "center" });
}

