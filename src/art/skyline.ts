import { Baked } from "./baked";
import { darken } from "./palette";
import { WIDTH } from "../engine/constants";

/** Small deterministic random numbers so baked art is the same on every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MOON = { x: 424, y: 40 };

/** Night sky: dusk gradient, stars and a moon. `h` is the height of the area to fill. */
export function createSky(h: number): Baked {
  return new Baked(WIDTH, h, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#080820");
    sky.addColorStop(0.6, "#1e1448");
    sky.addColorStop(1, "#4a2466");
    g.fillStyle = sky;
    g.fillRect(0, 0, WIDTH, h);
    const rand = seeded(7);
    for (let i = 0; i < 60; i++) {
      const bright = rand();
      g.fillStyle = bright > 0.85 ? "#f4f4ff" : bright > 0.5 ? "#9a9ad0" : "#5a5a98";
      g.fillRect(Math.floor(rand() * WIDTH), Math.floor(rand() * h * 0.7), 1, 1);
    }
    // moon with a soft halo
    const halo = g.createRadialGradient(MOON.x, MOON.y, 4, MOON.x, MOON.y, 48);
    halo.addColorStop(0, "rgba(255, 240, 200, 0.35)");
    halo.addColorStop(1, "rgba(255, 240, 200, 0)");
    g.fillStyle = halo;
    g.fillRect(MOON.x - 60, 0, 120, 100);
    g.fillStyle = "#fff0c8";
    g.beginPath();
    g.arc(MOON.x, MOON.y, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e0cfa0";
    g.beginPath();
    g.arc(MOON.x + 5, MOON.y - 4, 3, 0, Math.PI * 2);
    g.arc(MOON.x - 6, MOON.y + 6, 2, 0, Math.PI * 2);
    g.fill();
  });
}

export const SKYLINE_TILE_W = 480;

/** A seamless strip of buildings with lit windows. */
function skyline(seed: number, minH: number, maxH: number, body: string, windows: string, lit: number): Baked {
  const h = maxH + 6;
  return new Baked(SKYLINE_TILE_W, h, (g) => {
    const rand = seeded(seed);
    let x = 0;
    while (x < SKYLINE_TILE_W) {
      let w = 14 + Math.floor(rand() * 22);
      if (SKYLINE_TILE_W - x - w < 14) w = SKYLINE_TILE_W - x;
      const bh = minH + Math.floor(rand() * (maxH - minH));
      g.fillStyle = body;
      g.fillRect(x, h - bh, w, bh);
      g.fillStyle = darken(body, 0.25);
      g.fillRect(x + w - 2, h - bh, 2, bh);
      for (let wy = h - bh + 4; wy < h - 3; wy += 5) {
        for (let wx = x + 3; wx < x + w - 4; wx += 5) {
          if (rand() < lit) {
            g.fillStyle = windows;
            g.fillRect(wx, wy, 2, 2);
          }
        }
      }
      if (rand() < 0.3) {
        g.fillStyle = body;
        g.fillRect(x + Math.floor(w / 2), h - bh - 6, 1, 6);
        g.fillStyle = "#ff5a5a";
        g.fillRect(x + Math.floor(w / 2), h - bh - 7, 1, 1);
      }
      x += w;
    }
  });
}

export const SKYLINE_FAR = skyline(11, 40, 90, "#2a1a52", "#8a6ad0", 0.16);
export const SKYLINE_NEAR = skyline(23, 30, 70, "#140e30", "#ffd84a", 0.22);

/** Draws a strip that repeats forever, scrolling at `factor` times the camera speed. */
export function drawScrolling(g: CanvasRenderingContext2D, tile: Baked, camX: number, factor: number, y: number): void {
  const offset = camX * factor;
  const first = Math.floor(offset / tile.w);
  for (let i = first; i * tile.w - offset < WIDTH; i++) tile.draw(g, i * tile.w - offset, y);
}
