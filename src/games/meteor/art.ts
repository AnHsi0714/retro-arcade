import { Baked, mirrorRows, sprite } from "../../art/baked";
import { TAU } from "../../engine/math";

export type MeteorKind = "rock" | "blast" | "ice";

/** Edge color of each meteor kind. The how-to legend uses the same values. */
export const METEOR_COLORS: Record<MeteorKind, string> = { rock: "#d8d8e8", blast: "#ff8a3a", ice: "#7ae8ff" };
const METEOR_FILL: Record<MeteorKind, string> = { rock: "#34344c", blast: "#4e2412", ice: "#16465c" };

/** Flying saucer, 19 x 10, two frames with chasing rim lights. */
export const UFO: Baked[] = [
  sprite(mirrorRows([".......ccu", "......cuuu", ".....cuuuc", "..RRRRRRRR", ".RrrrrrrrR", "Rrykrykryk", ".RRRRRRRRR", "...RR.RR..", "..R......."], true)),
  sprite(mirrorRows([".......ccu", "......cuuu", ".....cuuuc", "..RRRRRRRR", ".RrrrrrrrR", "Rrkyrkyrky", ".RRRRRRRRR", "...RR.RR..", "..R......."], true)),
];

/** Paints a deterministic starfield and two faint nebulae. */
export function meteorBackdrop(w: number, h: number): Baked {
  return new Baked(w, h, (g) => {
    g.fillStyle = "#07071a";
    g.fillRect(0, 0, w, h);
    for (const [cx, cy, r, color] of [
      [w * 0.2, h * 0.3, 110, "rgba(90, 50, 160, 0.16)"],
      [w * 0.8, h * 0.7, 130, "rgba(30, 80, 160, 0.14)"],
    ] as Array<[number, number, number, string]>) {
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      glow.addColorStop(0, color);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
    }
    // small linear congruential generator so the sky is the same every time
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 90; i++) {
      const bright = next();
      g.fillStyle = bright > 0.9 ? "#c4c4f0" : bright > 0.6 ? "#6a6aa8" : "#33335a";
      g.fillRect(Math.floor(next() * w), Math.floor(next() * h), 1, 1);
    }
  });
}

export function drawShip(g: CanvasRenderingContext2D, x: number, y: number, angle: number, radius: number, frozen: boolean, thrust: boolean): void {
  const point = (a: number, r: number): [number, number] => [x + Math.cos(angle + a) * r, y + Math.sin(angle + a) * r];
  const edge = frozen ? "#aef0ff" : "#4ad7ff";

  if (thrust) {
    g.fillStyle = "#ff9a3a";
    g.beginPath();
    g.moveTo(...point(2.7, radius * 0.6));
    g.lineTo(...point(Math.PI, radius + 5));
    g.lineTo(...point(-2.7, radius * 0.6));
    g.closePath();
    g.fill();
    g.fillStyle = "#ffe36a";
    g.beginPath();
    g.moveTo(...point(2.9, radius * 0.45));
    g.lineTo(...point(Math.PI, radius + 1.5));
    g.lineTo(...point(-2.9, radius * 0.45));
    g.closePath();
    g.fill();
  }

  g.beginPath();
  g.moveTo(...point(0, radius + 2));
  g.lineTo(...point(2.5, radius));
  g.lineTo(...point(Math.PI, radius * 0.4));
  g.lineTo(...point(-2.5, radius));
  g.closePath();
  g.fillStyle = frozen ? "#2c6a86" : "#143e5e";
  g.fill();
  g.strokeStyle = edge;
  g.lineWidth = 1;
  g.stroke();

  // cockpit and a stripe along each wing
  g.fillStyle = "#e6fbff";
  const [cx, cy] = point(0, radius * 0.25);
  g.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
  g.strokeStyle = "rgba(174, 240, 255, 0.55)";
  g.beginPath();
  g.moveTo(...point(0.55, radius * 0.7));
  g.lineTo(...point(2.35, radius * 0.9));
  g.moveTo(...point(-0.55, radius * 0.7));
  g.lineTo(...point(-2.35, radius * 0.9));
  g.stroke();
}

export function drawMeteor(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rot: number,
  shape: number[],
  kind: MeteorKind,
  time: number,
): void {
  const outline = (): void => {
    g.beginPath();
    shape.forEach((k, i) => {
      const a = rot + (i / shape.length) * TAU;
      const px = x + Math.cos(a) * radius * k;
      const py = y + Math.sin(a) * radius * k;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
  };

  outline();
  g.fillStyle = METEOR_FILL[kind];
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = METEOR_COLORS[kind];
  g.stroke();

  // craters, placed from the shape numbers so each rock keeps its own pattern
  if (radius >= 10) {
    g.fillStyle = "rgba(0, 0, 0, 0.32)";
    for (let i = 0; i < 3; i++) {
      const a = rot + shape[i] * TAU;
      const d = radius * 0.42 * shape[i + 3];
      g.beginPath();
      g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, radius * (0.12 + 0.08 * shape[i + 6]), 0, TAU);
      g.fill();
    }
  }
  if (kind === "blast") {
    // glowing cracks that pulse
    g.strokeStyle = `rgba(255, 190, 70, ${0.55 + 0.4 * Math.sin(time * 8)})`;
    g.beginPath();
    g.moveTo(x - radius * 0.5, y - radius * 0.1);
    g.lineTo(x - radius * 0.1, y + radius * 0.15);
    g.lineTo(x + radius * 0.3, y - radius * 0.1);
    g.lineTo(x + radius * 0.55, y + radius * 0.25);
    g.stroke();
  } else if (kind === "ice") {
    g.strokeStyle = "rgba(220, 250, 255, 0.7)";
    g.beginPath();
    g.moveTo(x - radius * 0.55, y - radius * 0.25);
    g.lineTo(x - radius * 0.2, y - radius * 0.5);
    g.stroke();
  }
}

export function drawWell(g: CanvasRenderingContext2D, x: number, y: number, core: number, time: number): void {
  // slowly turning spiral arms
  for (let arm = 0; arm < 3; arm++) {
    const start = time * 1.5 + (arm * TAU) / 3;
    g.strokeStyle = `rgba(150, 100, 230, ${0.55 - arm * 0.1})`;
    g.beginPath();
    g.arc(x, y, core + 12 + arm * 8, start, start + Math.PI * 0.9);
    g.stroke();
  }
  // contracting rings show the pull
  g.strokeStyle = "#5a3a9a";
  for (let i = 0; i < 3; i++) {
    const r = core + 36 - ((time * 20 + i * 12) % 36);
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.stroke();
  }
  const glow = g.createRadialGradient(x, y, 0, x, y, core + 4);
  glow.addColorStop(0, "#f4eaff");
  glow.addColorStop(0.45, "#b07aff");
  glow.addColorStop(1, "rgba(120, 70, 200, 0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(x, y, core + 4, 0, TAU);
  g.fill();
  g.fillStyle = "#1a0a30";
  g.beginPath();
  g.arc(x, y, core * 0.45, 0, TAU);
  g.fill();
}

const PREVIEW_ROCK = [1, 0.9, 1.05, 0.8, 1, 0.95, 0.85, 1.05, 0.9];

/** Demo for the hallway cabinet: a ship turning between two drifting rocks. */
export function drawMeteorPreview(g: CanvasRenderingContext2D, time: number): void {
  g.fillStyle = "#07071a";
  g.fillRect(0, 0, 44, 32);
  g.fillStyle = "#6a6aa8";
  for (const [x, y] of [[6, 4], [30, 6], [14, 27], [40, 20], [24, 29]]) g.fillRect(x, y, 1, 1);
  drawMeteor(g, 9 + 2 * Math.sin(time), 10 + 2 * Math.cos(time * 0.8), 9, time * 0.5, PREVIEW_ROCK, "rock", time);
  drawMeteor(g, 36 - 2 * Math.cos(time), 23 + 2 * Math.sin(time * 0.7), 6, -time * 0.8, PREVIEW_ROCK, "blast", time);
  drawShip(g, 22, 17, time * 0.9, 6, false, Math.floor(time * 2) % 2 === 0);
}
