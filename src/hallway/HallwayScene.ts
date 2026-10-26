import { HEIGHT, WIDTH } from "../engine/constants";
import type { GameInfo, GameResult, GameServices } from "../engine/game";
import { Keys } from "../engine/input";
import { clamp } from "../engine/math";
import type { Scene } from "../engine/scene";
import { getHighScore } from "../engine/storage";
import { blink, COLORS, drawPanel, drawText, padScore } from "../engine/ui";
import { getGame } from "../games/registry";
import { HALL_END_PADDING, MACHINES } from "./machines";

const FLOOR_Y = 220;
const WALL_THICKNESS = 16;
const PLAYER_W = 12;
const PLAYER_H = 24;
const PLAYER_SPEED = 110;
const PLAYER_ACCEL = 900;
const CABINET_W = 56;
const CABINET_H = 76;
/** How close (px, center to center) the player must be to use a cabinet. */
const USE_RANGE = 22;
const START_X = 80;

interface Machine {
  info: GameInfo;
  x: number;
  best: number;
}

/** A parallax layer of repeating placeholder shapes. */
interface ParallaxLayer {
  factor: number;
  spacing: number;
  draw: (g: CanvasRenderingContext2D, screenX: number, index: number) => void;
}

/** Cheap deterministic hash so parallax decorations vary per tile but stay stable. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const LAYERS: ParallaxLayer[] = [
  {
    // far: distant neon signs
    factor: 0.25,
    spacing: 90,
    draw: (g, x, i) => {
      const h = hash(i);
      g.fillStyle = h > 0.5 ? "#2a1846" : "#16264a";
      g.fillRect(x, 40 + h * 30, 50, 18);
      g.fillStyle = h > 0.5 ? "#7a3bd1" : "#2f7ad1";
      g.fillRect(x + 4, 46 + h * 30, 42 * (0.4 + h * 0.6), 2);
    },
  },
  {
    // mid: pillars along the back wall
    factor: 0.6,
    spacing: 120,
    draw: (g, x) => {
      g.fillStyle = "#1c1c34";
      g.fillRect(x, 60, 14, FLOOR_Y - 60);
      g.fillStyle = "#26264a";
      g.fillRect(x + 2, 60, 2, FLOOR_Y - 60);
    },
  },
];

const FOREGROUND: ParallaxLayer = {
  // near: rail in front of the player, scrolls faster than the floor
  factor: 1.4,
  spacing: 70,
  draw: (g, x) => {
    g.fillStyle = "#0c0c18";
    g.fillRect(x, HEIGHT - 26, 6, 26);
  },
};

export class HallwayScene implements Scene {
  private machines: Machine[];
  private worldW: number;
  private x = START_X;
  private vx = 0;
  private facing = 1;
  private camX = 0;
  private time = 0;
  private walkTime = 0;
  private toast = "";
  private toastTime = 0;

  constructor(
    private readonly services: GameServices,
    private readonly onPlay: (info: GameInfo) => void,
  ) {
    this.machines = MACHINES.map((m) => ({ info: getGame(m.gameId), x: m.x, best: 0 }));
    const lastX = MACHINES.reduce((max, m) => Math.max(max, m.x), 0);
    this.worldW = Math.max(WIDTH, lastX + HALL_END_PADDING);
  }

  enter(): void {
    this.services.input.clear();
    for (const m of this.machines) m.best = getHighScore(m.info.id);
    this.updateCamera();
  }

  /** Called by the app when the player walks away from a machine. */
  onReturn(result: GameResult): void {
    if (result.newRecord) this.showToast(`NEW RECORD ${padScore(result.score)}!`);
  }

  update(dt: number): void {
    const { input, audio } = this.services;
    this.time += dt;
    if (this.toastTime > 0) this.toastTime -= dt;

    const dir = input.axisX();
    if (dir !== 0) this.facing = dir;
    const target = dir * PLAYER_SPEED;
    const dv = PLAYER_ACCEL * dt;
    this.vx = this.vx < target ? Math.min(this.vx + dv, target) : Math.max(this.vx - dv, target);
    this.x += this.vx * dt;

    // walls at both ends of the hallway
    const minX = WALL_THICKNESS + PLAYER_W / 2;
    const maxX = this.worldW - WALL_THICKNESS - PLAYER_W / 2;
    if (this.x < minX || this.x > maxX) {
      this.x = clamp(this.x, minX, maxX);
      this.vx = 0;
    }

    if (Math.abs(this.vx) > 1) {
      const before = Math.floor(this.walkTime * 6);
      this.walkTime += dt;
      if (Math.floor(this.walkTime * 6) !== before) audio.play("step");
    }

    const near = this.nearestMachine();
    if (near && (input.wasPressed(Keys.up) || input.wasPressed(Keys.confirm))) {
      audio.play("confirm");
      this.vx = 0;
      this.onPlay(near.info);
      return;
    }

    this.updateCamera();
  }

  render(g: CanvasRenderingContext2D): void {
    // back wall
    g.fillStyle = "#10101f";
    g.fillRect(0, 0, WIDTH, FLOOR_Y);
    for (const layer of LAYERS) this.drawLayer(g, layer);

    // floor
    g.fillStyle = "#24203a";
    g.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y);
    g.fillStyle = "#302a4c";
    const tile = 32;
    for (let wx = Math.floor(this.camX / tile) * tile; wx < this.camX + WIDTH; wx += tile) {
      g.fillRect(Math.round(wx - this.camX), FLOOR_Y, 1, HEIGHT - FLOOR_Y);
    }

    // end walls
    g.fillStyle = "#3a3a5a";
    g.fillRect(Math.round(-this.camX), 0, WALL_THICKNESS, HEIGHT);
    g.fillRect(Math.round(this.worldW - WALL_THICKNESS - this.camX), 0, WALL_THICKNESS, HEIGHT);

    drawText(g, "RETRO ARCADE", START_X - this.camX, 90, { color: COLORS.accent, size: 16, align: "center" });
    drawText(g, "LEFT / RIGHT walk   UP / ENTER play   M mute", START_X - this.camX, 112, { align: "center", color: COLORS.dim });

    const near = this.nearestMachine();
    for (const m of this.machines) this.drawCabinet(g, m, m === near);

    this.drawPlayer(g);
    this.drawLayer(g, FOREGROUND);

    if (near) this.drawPrompt(g, near);
    if (this.toastTime > 0) {
      drawPanel(g, WIDTH / 2 - 90, 8, 180, 18);
      drawText(g, this.toast, WIDTH / 2, 13, { align: "center", color: COLORS.good });
    }
    if (this.services.audio.muted) drawText(g, "MUTE", WIDTH - 4, 4, { align: "right", color: COLORS.dim });
  }

  private nearestMachine(): Machine | null {
    let best: Machine | null = null;
    let bestD = USE_RANGE;
    for (const m of this.machines) {
      const d = Math.abs(m.x - this.x);
      if (d <= bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  private updateCamera(): void {
    this.camX = clamp(this.x - WIDTH / 2, 0, this.worldW - WIDTH);
  }

  private drawLayer(g: CanvasRenderingContext2D, layer: ParallaxLayer): void {
    const offset = this.camX * layer.factor;
    const first = Math.floor(offset / layer.spacing) - 1;
    const last = Math.ceil((offset + WIDTH) / layer.spacing) + 1;
    for (let i = first; i <= last; i++) {
      layer.draw(g, Math.round(i * layer.spacing - offset), i);
    }
  }

  private drawCabinet(g: CanvasRenderingContext2D, m: Machine, highlighted: boolean): void {
    const x = Math.round(m.x - CABINET_W / 2 - this.camX);
    if (x > WIDTH || x + CABINET_W < 0) return;
    const y = FLOOR_Y - CABINET_H;

    // placeholder cabinet: body, marquee, screen, control panel
    g.fillStyle = m.info.color;
    g.fillRect(x, y, CABINET_W, CABINET_H);
    g.fillStyle = "#000";
    g.fillRect(x + 4, y + 4, CABINET_W - 8, 10);
    // marquee shows the first word; the prompt shows the full title
    drawText(g, m.info.title.split(" ")[0].toUpperCase(), x + CABINET_W / 2, y + 5, { align: "center", size: 8 });
    g.fillStyle = highlighted ? "#1e3a2a" : "#0a1a14";
    g.fillRect(x + 6, y + 18, CABINET_W - 12, 26);
    if (highlighted && blink(this.time, 3)) {
      g.fillStyle = COLORS.good;
      g.fillRect(x + 10, y + 28, CABINET_W - 20, 2);
    }
    g.fillStyle = "#222";
    g.fillRect(x + 2, y + 48, CABINET_W - 4, 8);
    if (highlighted) {
      g.strokeStyle = COLORS.accent;
      g.strokeRect(x - 1.5, y - 1.5, CABINET_W + 3, CABINET_H + 3);
    }

    if (m.best > 0) {
      drawText(g, `HI ${padScore(m.best)}`, x + CABINET_W / 2, y - 12, { align: "center", color: COLORS.dim });
    }
  }

  private drawPlayer(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x - PLAYER_W / 2 - this.camX);
    const moving = Math.abs(this.vx) > 1;
    const bob = moving && Math.floor(this.walkTime * 8) % 2 === 0 ? 1 : 0;
    const y = FLOOR_Y - PLAYER_H - bob;
    g.fillStyle = "#4ad7ff";
    g.fillRect(x, y, PLAYER_W, PLAYER_H);
    // facing marker stands in for a face until the sprite exists
    g.fillStyle = "#fff";
    g.fillRect(this.facing > 0 ? x + PLAYER_W - 4 : x + 1, y + 5, 3, 3);
  }

  private drawPrompt(g: CanvasRenderingContext2D, m: Machine): void {
    const w = 170;
    const x = clamp(Math.round(m.x - this.camX - w / 2), 4, WIDTH - w - 4);
    const y = FLOOR_Y - CABINET_H - 56;
    drawPanel(g, x, y, w, 40);
    drawText(g, m.info.title.toUpperCase(), x + w / 2, y + 4, { align: "center", color: COLORS.accent });
    drawText(g, m.info.tagline, x + w / 2, y + 15, { align: "center", color: COLORS.dim });
    if (blink(this.time)) drawText(g, "UP / ENTER: PLAY", x + w / 2, y + 27, { align: "center" });
  }

  private showToast(text: string): void {
    this.toast = text;
    this.toastTime = 3;
  }
}
