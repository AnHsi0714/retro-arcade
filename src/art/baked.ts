import { PALETTE } from "./palette";

/** Rows of palette characters; "." is transparent. */
export type Rows = readonly string[];

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * A picture painted once, on first use, into its own small canvas and then
 * stamped with drawImage. Used for pixel-art sprites and for pre-drawn pieces
 * such as walls and cabinets. Nothing runs at import time, so modules that only
 * describe art stay usable without a DOM.
 */
export class Baked {
  private cache: HTMLCanvasElement | null = null;

  constructor(
    readonly w: number,
    readonly h: number,
    private readonly paint: (g: CanvasRenderingContext2D) => void,
  ) {}

  get canvas(): HTMLCanvasElement {
    if (!this.cache) {
      const canvas = createCanvas(this.w, this.h);
      const g = canvas.getContext("2d");
      if (!g) throw new Error("Canvas 2D context is not available");
      g.imageSmoothingEnabled = false;
      this.paint(g);
      this.cache = canvas;
    }
    return this.cache;
  }

  /** Stamps the picture with its top-left corner at (x, y), on whole pixels. */
  draw(g: CanvasRenderingContext2D, x: number, y: number): void {
    g.drawImage(this.canvas, Math.round(x), Math.round(y));
  }

  /** Stamps the picture centered on (x, y). */
  drawCentered(g: CanvasRenderingContext2D, x: number, y: number): void {
    g.drawImage(this.canvas, Math.round(x - this.w / 2), Math.round(y - this.h / 2));
  }

  mirrored(): Baked {
    return new Baked(this.w, this.h, (g) => {
      g.translate(this.w, 0);
      g.scale(-1, 1);
      g.drawImage(this.canvas, 0, 0);
    });
  }
}

/** Paints rows of palette characters; `swap` replaces characters (e.g. to recolor a sprite). */
export function paintRows(g: CanvasRenderingContext2D, rows: Rows, swap: Record<string, string> = {}, ox = 0, oy = 0): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = swap[row[x]] ?? row[x];
      if (ch === "." || ch === " ") continue;
      const color = PALETTE[ch];
      if (!color) throw new Error(`Unknown palette character "${ch}"`);
      g.fillStyle = color;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

/** Builds a sprite from rows of palette characters. Mistakes are reported here, not when it is first drawn. */
export function sprite(rows: Rows, swap: Record<string, string> = {}): Baked {
  const w = Math.max(...rows.map((r) => r.length));
  for (const row of rows) {
    if (row.length !== w) throw new Error(`Sprite rows differ in width: "${row}" is not ${w} wide`);
    for (const ch of row) {
      const mapped = swap[ch] ?? ch;
      if (mapped !== "." && !PALETTE[mapped]) throw new Error(`Unknown palette character "${mapped}" in "${row}"`);
    }
  }
  return new Baked(w, rows.length, (g) => paintRows(g, rows, swap));
}

/** Rotates a picture clockwise by quarter turns (works on rows, so it stays pixel exact). */
export function rotateRows(rows: Rows, turns: number): string[] {
  let current = [...rows];
  for (let t = ((turns % 4) + 4) % 4; t > 0; t--) {
    const h = current.length;
    const w = current[0].length;
    const next: string[] = [];
    for (let x = 0; x < w; x++) {
      let line = "";
      for (let y = h - 1; y >= 0; y--) line += current[y][x];
      next.push(line);
    }
    current = next;
  }
  return current;
}

/** Index into sprite arrays drawn facing right, then rotated clockwise: right 0, down 1, left 2, up 3. */
export function dirIndex(dx: number, dy: number): number {
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}

/** Builds a symmetric picture from its left half; `center` means the last column is shared (odd widths). */
export function mirrorRows(half: Rows, center = false): string[] {
  return half.map((row) => {
    const rest = center ? row.slice(0, -1) : row;
    return row + [...rest].reverse().join("");
  });
}
