import { Baked } from "./baked";

/**
 * A 5x7 pixel font drawn for this project, used for logos and cabinet signs.
 * Regular interface text still goes through drawText() in engine/ui.ts, which
 * keeps its size and contrast rules and can show Chinese.
 */
const GLYPHS: Record<string, readonly string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** Space between letters. */
const GAP = 1;

export interface PixelTextOptions {
  color: string;
  /** Whole-number magnification. */
  scale?: number;
  /** Solid shadow drawn half a scaled pixel (at least one pixel) down and to the right. */
  shadow?: string;
}

/** Width in pixels of a string at the given scale. */
export function pixelTextWidth(text: string, scale = 1): number {
  return Math.max(0, text.length * (GLYPH_W + GAP) - GAP) * scale;
}

const cache = new Map<string, Baked>();

function textSprite(text: string, opts: PixelTextOptions): Baked {
  const scale = opts.scale ?? 1;
  const key = `${text}|${opts.color}|${scale}|${opts.shadow ?? ""}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const shadowPad = opts.shadow ? Math.ceil(scale / 2) : 0;
    sprite = new Baked(pixelTextWidth(text, scale) + shadowPad, GLYPH_H * scale + shadowPad, (g) => {
      const paint = (color: string, offset: number) => {
        g.fillStyle = color;
        [...text.toUpperCase()].forEach((ch, i) => {
          const glyph = GLYPHS[ch];
          if (!glyph) throw new Error(`Pixel font has no glyph for "${ch}"`);
          const left = i * (GLYPH_W + GAP) * scale + offset;
          glyph.forEach((row, y) => {
            for (let x = 0; x < GLYPH_W; x++) if (row[x] === "#") g.fillRect(left + x * scale, y * scale + offset, scale, scale);
          });
        });
      };
      if (opts.shadow) paint(opts.shadow, shadowPad);
      paint(opts.color, 0);
    });
    cache.set(key, sprite);
  }
  return sprite;
}

/** Draws text in the pixel font. `x` is the left edge, or the center with align "center". */
export function drawPixelText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: PixelTextOptions & { align?: "left" | "center" | "right" },
): void {
  const sprite = textSprite(text, opts);
  const left = opts.align === "center" ? x - sprite.w / 2 : opts.align === "right" ? x - sprite.w : x;
  sprite.draw(g, left, y);
}
