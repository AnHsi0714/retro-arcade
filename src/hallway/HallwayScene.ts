import { HEIGHT, WIDTH } from "../engine/constants";
import { drawPixelText } from "../art/font";
import type { GameInfo, GameResult, GameServices } from "../engine/game";
import { Keys } from "../engine/input";
import { clamp } from "../engine/math";
import type { Scene } from "../engine/scene";
import { getHighScore } from "../engine/storage";
import { tr } from "../engine/i18n";
import { blink, COLORS, drawPanel, drawText, measureText, padScore } from "../engine/ui";
import { getGame } from "../games/registry";
import {
  CABINET_H,
  CABINET_W,
  drawBackdrop,
  drawCabinet,
  drawDoor,
  drawFloor,
  drawLamp,
  FLOOR_Y,
  PLAYER_FRAMES,
  PLAYER_FRAMES_LEFT,
  PLAYER_H,
  PLAYER_W as SPRITE_W,
  PLANT,
  POST,
} from "./art";
import { HALL_END_PADDING, MACHINES } from "./machines";

const WALL_THICKNESS = 16;
/** Width of the player's body for walls; the sprite is a little wider. */
const PLAYER_W = 12;
const PLAYER_SPEED = 110;
const PLAYER_ACCEL = 900;
/** How close (px, center to center) the player must be to use a cabinet. */
const USE_RANGE = 22;
const START_X = 80;
/** Walk animation frames per second; stand, left foot, stand, right foot make one cycle. */
const WALK_FRAME_RATE = 12;

interface Machine {
  info: GameInfo;
  x: number;
  best: number;
}

/** Foreground posts scroll faster than the floor, which adds depth. */
const FOREGROUND_FACTOR = 1.4;
const POST_SPACING = 96;

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
    this.services.audio.playMusic("hallway");
    this.services.audio.duckMusic(false);
    this.updateCamera();
  }

  /** Called by the app when the player walks away from a machine. */
  onReturn(result: GameResult): void {
    if (result.newRecord) this.showToast(`${tr({ en: "NEW RECORD", zh: "新紀錄" })} ${padScore(result.score)}!`);
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
      const before = Math.floor(this.walkTime * WALK_FRAME_RATE);
      this.walkTime += dt;
      const after = Math.floor(this.walkTime * WALK_FRAME_RATE);
      // a foot lands on the two stepping frames of the cycle, and the footstep sound follows it
      if (after !== before && after % 2 === 1) audio.play("step");
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
    drawBackdrop(g, this.camX);
    drawFloor(g, this.camX);

    // end walls and the doors beside them
    g.fillStyle = "#0a0a18";
    g.fillRect(Math.round(-this.camX), 0, WALL_THICKNESS, HEIGHT);
    g.fillRect(Math.round(this.worldW - WALL_THICKNESS - this.camX), 0, WALL_THICKNESS, HEIGHT);
    g.fillStyle = "#4ad7ff";
    g.fillRect(Math.round(WALL_THICKNESS - 1 - this.camX), 0, 1, HEIGHT);
    g.fillRect(Math.round(this.worldW - WALL_THICKNESS - this.camX), 0, 1, HEIGHT);
    drawDoor(g, Math.round(WALL_THICKNESS + 18 - this.camX), "ENTRY", "#4ad7ff");
    drawDoor(g, Math.round(this.worldW - WALL_THICKNESS - 58 - this.camX), "EXIT", "#6cff7a");

    const near = this.nearestMachine();
    for (const m of this.machines) drawLamp(g, Math.round(m.x - this.camX), m.info.color);

    // left-aligned near the left wall so nothing is cut off at the start of the hall
    const introX = WALL_THICKNESS + 12 - this.camX;
    const line1 = { en: "LEFT / RIGHT walk    UP / ENTER play", zh: "LEFT / RIGHT 走動　　UP / ENTER 遊玩" };
    const line2 = { en: "ESC pause   M mute   - / + volume   L 中文", zh: "ESC 暫停　M 靜音　- / + 音量　L English" };
    const panelW = Math.max(measureText(g, line1), measureText(g, line2), 150) + 16;
    drawPanel(g, introX - 8, 26, panelW, 56);
    drawPixelText(g, "RETRO ARCADE", introX, 32, { color: COLORS.accent, scale: 2, shadow: "#6a5410" });
    drawText(g, line1, introX, 56, { color: COLORS.dim });
    drawText(g, line2, introX, 68, { color: COLORS.dim });

    for (const m of this.machines) this.drawCabinet(g, m, m === near);

    this.drawPlayer(g);
    this.drawForeground(g);

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

  private drawCabinet(g: CanvasRenderingContext2D, m: Machine, lit: boolean): void {
    const x = Math.round(m.x - CABINET_W / 2 - this.camX);
    if (x > WIDTH || x + CABINET_W < 0) return;
    drawCabinet(g, m.info, x, this.time, lit);
    if (m.best > 0) {
      const label = `${tr({ en: "HI", zh: "最高" })} ${padScore(m.best)}`;
      const w = Math.ceil(measureText(g, label)) + 8;
      const y = FLOOR_Y - CABINET_H - 14;
      // a solid backing keeps the small text readable against the city behind
      drawPanel(g, Math.round(x + CABINET_W / 2 - w / 2), y - 2, w, 14);
      drawText(g, label, x + CABINET_W / 2, y + 1, { align: "center", color: COLORS.dim });
    }
  }

  private drawPlayer(g: CanvasRenderingContext2D): void {
    const moving = Math.abs(this.vx) > 1;
    const frame = moving ? [0, 1, 0, 2][Math.floor(this.walkTime * WALK_FRAME_RATE) % 4] : 0;
    const bob = moving && frame === 0 ? 1 : 0;
    const x = Math.round(this.x - SPRITE_W / 2 - this.camX);
    g.fillStyle = "rgba(0, 0, 0, 0.35)";
    g.fillRect(x + 1, FLOOR_Y - 1, SPRITE_W - 2, 3);
    (this.facing > 0 ? PLAYER_FRAMES : PLAYER_FRAMES_LEFT)[frame].draw(g, x, FLOOR_Y - PLAYER_H - bob);
  }

  /** Rope posts and a plant in front of the player, scrolling faster than the floor. */
  private drawForeground(g: CanvasRenderingContext2D): void {
    const offset = this.camX * FOREGROUND_FACTOR;
    const first = Math.floor(offset / POST_SPACING) - 1;
    const last = Math.ceil((offset + WIDTH) / POST_SPACING) + 1;
    const top = HEIGHT - 12;
    for (let i = first; i <= last; i++) {
      const x = i * POST_SPACING - offset;
      if (i % 4 === 0) PLANT.draw(g, x - 16, HEIGHT - 36);
      else {
        g.strokeStyle = "#ff7ab8";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 3, top + 2);
        g.quadraticCurveTo(x + POST_SPACING / 2, top + 10, x + POST_SPACING - 3, top + 2);
        g.stroke();
        POST.draw(g, x, top - 4);
      }
    }
  }

  private drawPrompt(g: CanvasRenderingContext2D, m: Machine): void {
    const w = 170;
    const x = clamp(Math.round(m.x - this.camX - w / 2), 4, WIDTH - w - 4);
    const y = FLOOR_Y - CABINET_H - 56;
    drawPanel(g, x, y, w, 40);
    drawText(g, m.info.title.toUpperCase(), x + w / 2, y + 4, { align: "center", color: COLORS.accent });
    drawText(g, m.info.tagline, x + w / 2, y + 15, { align: "center", color: COLORS.dim });
    if (blink(this.time)) drawText(g, { en: "UP / ENTER: PLAY", zh: "UP / ENTER：開始遊玩" }, x + w / 2, y + 27, { align: "center" });
  }

  private showToast(text: string): void {
    this.toast = text;
    this.toastTime = 3;
  }
}
