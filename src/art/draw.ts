import { Baked } from "./baked";
import { darken, lighten } from "./palette";
import { drawPixelText } from "./font";

/** A rectangle with its four corner pixels cut off. */
export function pixelRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
}

const capsules = new Map<string, Baked>();

/** A rounded power-up capsule with a letter on it. Drawn 16x11; hit areas stay smaller. */
export function capsule(letter: string, color: string): Baked {
  const key = `${letter}${color}`;
  let c = capsules.get(key);
  if (!c) {
    c = new Baked(16, 11, (g) => {
      g.fillStyle = darken(color, 0.65);
      pixelRect(g, 0, 0, 16, 11);
      g.fillRect(2, 0, 12, 11);
      g.fillStyle = color;
      pixelRect(g, 1, 1, 14, 9);
      g.fillStyle = lighten(color, 0.55);
      g.fillRect(3, 1, 10, 1);
      g.fillStyle = darken(color, 0.25);
      g.fillRect(3, 9, 10, 1);
      drawPixelText(g, letter, 8, 2, { color: "#05050f", align: "center" });
    });
    capsules.set(key, c);
  }
  return c;
}
