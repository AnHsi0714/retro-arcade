import { FIELD, HEIGHT } from "../../engine/constants";
import type { ArcadeGame, GameServices, GameStatus, LegendItem } from "../../engine/game";
import { Keys } from "../../engine/input";
import { chance, circleRectOverlap, clamp, pick, rand, rectsOverlap, type Rect } from "../../engine/math";
import { tr } from "../../engine/i18n";
import { COLORS, drawText } from "../../engine/ui";
import { LEVELS } from "./levels";

const WALL = 8;
const LEFT = FIELD.x + WALL;
const RIGHT = FIELD.x + FIELD.w - WALL;
const TOP = FIELD.y + WALL;

const BRICK_W = 32;
const BRICK_H = 10;
const BRICK_COLS = 14;
const BRICKS_X = LEFT + ((RIGHT - LEFT) - BRICK_COLS * BRICK_W) / 2;
const BRICKS_Y = FIELD.y + 40;

const PADDLE_Y = HEIGHT - 18;
const PADDLE_H = 6;
const PADDLE_W = 48;
const PADDLE_WIDE_W = 76;
const PADDLE_SPEED = 280;
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

const BALL_R = 3;
const BALL_SPEED = 170;
const BALL_SPEED_STEP = 0.15;
const MAX_BALLS = 8;

const DROP_CHANCE = 0.14;
const DROP_SPEED = 60;
const WIDE_DURATION = 12;
const START_LIVES = 3;
const CLEAR_TIME = 1.5;

const BOSS_W = 80;
const BOSS_H = 20;
const BOSS_HP = 24;
const BOSS_Y = FIELD.y + 18;
const BOSS_FIRE_INTERVAL = 1.6;
const BOSS_SHOT_SPEED = 95;
const STUN_TIME = 1;

type BrickKind = "1" | "2" | "3" | "X" | "S" | "M";
type DropKind = "multi" | "wide" | "life";

interface Brick extends Rect {
  kind: BrickKind;
  hp: number;
  col: number;
  row: number;
  baseX: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Drop {
  x: number;
  y: number;
  kind: DropKind;
}

interface Boss extends Rect {
  hp: number;
  t: number;
  fire: number;
  flash: number;
}

interface Shot {
  x: number;
  y: number;
}

/** Moving rows: amplitude/phase so the row stays inside the walls. */
interface MovingRow {
  row: number;
  min: number;
  max: number;
}

const BRICK_HP: Record<BrickKind, number> = { "1": 1, "2": 2, "3": 3, X: 1, S: Infinity, M: 1 };
const BRICK_SCORE: Record<BrickKind, number> = { "1": 10, "2": 20, "3": 30, X: 15, S: 50, M: 25 };
const BRICK_COLORS: Record<BrickKind, string> = {
  "1": "#4fa3ff",
  "2": "#5fd36a",
  "3": "#e0c341",
  X: "#ff6a3a",
  S: "#9a9aae",
  M: "#d65cff",
};
const DROP_COLORS: Record<DropKind, string> = { multi: "#5ef0ff", wide: "#6cff7a", life: "#ff7ab8" };
const DROP_LABELS: Record<DropKind, string> = { multi: "M", wide: "W", life: "+" };

export const BREAKOUT_LEGEND: LegendItem[] = [
  { color: BRICK_COLORS["1"], label: { en: "Brick: 1 hit", zh: "普通磚：1 下" } },
  { color: BRICK_COLORS["2"], label: { en: "Tough: 2 or 3 hits", zh: "硬磚：2 或 3 下" } },
  { color: BRICK_COLORS.X, label: { en: "Blast: breaks neighbours", zh: "爆炸磚：炸掉周圍磚塊" } },
  { color: BRICK_COLORS.M, label: { en: "Mover: the row slides", zh: "移動磚：整排左右滑動" } },
  { color: BRICK_COLORS.S, label: { en: "Steel: only blasts break it", zh: "鋼磚：只有爆炸能打破" } },
  { color: DROP_COLORS.multi, label: { en: "M capsule: multi-ball", zh: "M 膠囊：多球" } },
  { color: DROP_COLORS.wide, label: { en: "W capsule: wide paddle", zh: "W 膠囊：加長球拍" } },
  { color: DROP_COLORS.life, label: { en: "+ capsule: extra life", zh: "+ 膠囊：加一條命" } },
];

/**
 * Breakout with multi-hit, explosive, steel and moving bricks, falling
 * power-ups (multi-ball, wide paddle, extra life) and a boss stage.
 */
export class BreakoutGame implements ArcadeGame {
  private services!: GameServices;
  private level = 1;
  private lives = START_LIVES;
  private score = 0;
  private over = false;
  private time = 0;

  private paddleX = FIELD.w / 2;
  private paddleW = PADDLE_W;
  private wideTime = 0;
  private stunTime = 0;
  /** While true the first ball rides on the paddle until launched. */
  private stuck = true;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private movingRows: MovingRow[] = [];
  private drops: Drop[] = [];
  private boss: Boss | null = null;
  private shots: Shot[] = [];
  private clearTimer = 0;

  init(services: GameServices): void {
    this.services = services;
    this.loadLevel();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.level++;
        this.loadLevel();
      }
      return;
    }

    this.updatePaddle(dt);
    this.updateMovingRows();
    this.updateBalls(dt);
    this.updateDrops(dt);
    this.updateBoss(dt);

    if (!this.bricks.some((b) => b.kind !== "S") && !this.boss) {
      this.clearTimer = CLEAR_TIME;
      this.services.audio.play("levelUp");
    }
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = "#2e2e4e";
    g.fillRect(FIELD.x, FIELD.y, WALL, FIELD.h);
    g.fillRect(RIGHT, FIELD.y, WALL, FIELD.h);
    g.fillRect(FIELD.x, FIELD.y, FIELD.w, WALL);

    for (const b of this.bricks) {
      g.fillStyle = BRICK_COLORS[b.kind];
      g.globalAlpha = b.kind === "2" || b.kind === "3" ? 0.45 + 0.55 * (b.hp / BRICK_HP[b.kind]) : 1;
      g.fillRect(Math.round(b.x) + 1, b.y + 1, b.w - 2, b.h - 2);
    }
    g.globalAlpha = 1;

    if (this.boss) {
      const b = this.boss;
      g.fillStyle = b.flash > 0 ? "#fff" : "#b13a6a";
      g.fillRect(Math.round(b.x), b.y, b.w, b.h);
      g.fillStyle = "#300";
      g.fillRect(Math.round(b.x), b.y - 4, b.w, 2);
      g.fillStyle = COLORS.danger;
      g.fillRect(Math.round(b.x), b.y - 4, Math.round((b.w * b.hp) / BOSS_HP), 2);
    }
    g.fillStyle = COLORS.danger;
    for (const s of this.shots) g.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 3, 4, 6);

    for (const d of this.drops) {
      g.fillStyle = DROP_COLORS[d.kind];
      g.fillRect(Math.round(d.x) - 7, Math.round(d.y) - 4, 14, 8);
      drawText(g, DROP_LABELS[d.kind], d.x, d.y - 4, { align: "center", color: "#000" });
    }

    g.fillStyle = this.stunTime > 0 ? "#666" : this.wideTime > 0 ? "#6cff7a" : "#f4f4f4";
    g.fillRect(Math.round(this.paddleX - this.paddleW / 2), PADDLE_Y, this.paddleW, PADDLE_H);

    g.fillStyle = "#fff";
    for (const b of this.balls) g.fillRect(Math.round(b.x - BALL_R), Math.round(b.y - BALL_R), BALL_R * 2, BALL_R * 2);

    if (this.stuck && this.clearTimer <= 0) {
      drawText(g, { en: `STAGE ${this.level}  -  SPACE TO LAUNCH`, zh: `第 ${this.level} 關　按 SPACE 發球` }, FIELD.w / 2, PADDLE_Y - 40, { align: "center", color: COLORS.dim });
    }
    if (this.clearTimer > 0) {
      drawText(g, { en: "STAGE CLEAR", zh: "過關！" }, FIELD.w / 2, FIELD.y + FIELD.h / 2, { align: "center", color: COLORS.accent });
    }
  }

  destroy(): void {}

  status(): GameStatus {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      over: this.over,
      info: this.wideTime > 0 ? `${tr({ en: "WIDE", zh: "加長" })} ${Math.ceil(this.wideTime)}` : undefined,
    };
  }

  private ballSpeed(): number {
    const loop = Math.floor((this.level - 1) / LEVELS.length);
    return BALL_SPEED * (1 + loop * BALL_SPEED_STEP);
  }

  private loadLevel(): void {
    const def = LEVELS[(this.level - 1) % LEVELS.length];
    this.bricks = [];
    this.movingRows = [];
    this.drops = [];
    this.shots = [];
    def.rows.forEach((line, row) => {
      let hasMoving = false;
      for (let col = 0; col < BRICK_COLS; col++) {
        const ch = line[col] as BrickKind | "." | undefined;
        if (!ch || ch === ".") continue;
        if (ch === "M") hasMoving = true;
        const x = BRICKS_X + col * BRICK_W;
        this.bricks.push({ x, baseX: x, y: BRICKS_Y + row * BRICK_H, w: BRICK_W, h: BRICK_H, kind: ch, hp: BRICK_HP[ch], col, row });
      }
      if (hasMoving) {
        const rowBricks = this.bricks.filter((b) => b.row === row);
        const minX = Math.min(...rowBricks.map((b) => b.baseX));
        const maxX = Math.max(...rowBricks.map((b) => b.baseX + b.w));
        this.movingRows.push({ row, min: LEFT - minX, max: RIGHT - maxX });
      }
    });
    this.boss = def.boss
      ? { x: FIELD.w / 2 - BOSS_W / 2, y: BOSS_Y, w: BOSS_W, h: BOSS_H, hp: BOSS_HP, t: 0, fire: BOSS_FIRE_INTERVAL, flash: 0 }
      : null;
    this.resetBall();
  }

  private resetBall(): void {
    this.paddleW = PADDLE_W;
    this.wideTime = 0;
    this.stuck = true;
    this.balls = [{ x: this.paddleX, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }];
  }

  private updatePaddle(dt: number): void {
    const { input, audio } = this.services;
    if (this.wideTime > 0) {
      this.wideTime -= dt;
      if (this.wideTime <= 0) this.paddleW = PADDLE_W;
    }
    if (this.stunTime > 0) this.stunTime -= dt;
    else this.paddleX += input.axisX() * PADDLE_SPEED * dt;
    this.paddleX = clamp(this.paddleX, LEFT + this.paddleW / 2, RIGHT - this.paddleW / 2);

    if (this.stuck) {
      const ball = this.balls[0];
      ball.x = this.paddleX;
      ball.y = PADDLE_Y - BALL_R;
      if (input.wasPressed(Keys.action) || input.wasPressed(Keys.up)) {
        this.stuck = false;
        const angle = rand(-0.4, 0.4);
        ball.vx = Math.sin(angle) * this.ballSpeed();
        ball.vy = -Math.cos(angle) * this.ballSpeed();
        audio.play("bounce");
      }
    }
  }

  private updateMovingRows(): void {
    for (const r of this.movingRows) {
      const mid = (r.min + r.max) / 2;
      const amp = (r.max - r.min) / 2;
      const offset = mid + Math.sin(this.time * 1.2 + r.row) * amp;
      for (const b of this.bricks) if (b.row === r.row) b.x = b.baseX + offset;
    }
  }

  private updateBalls(dt: number): void {
    if (this.stuck) return;
    const speed = this.ballSpeed();
    const substeps = Math.ceil((speed * dt) / 2);
    const h = dt / substeps;
    for (const ball of this.balls) {
      for (let i = 0; i < substeps; i++) this.moveBall(ball, h);
    }

    this.balls = this.balls.filter((b) => b.y - BALL_R < HEIGHT);
    if (this.balls.length === 0) {
      this.lives--;
      this.services.audio.play("die");
      if (this.lives <= 0) this.over = true;
      else this.resetBall();
    }
  }

  private moveBall(ball: Ball, dt: number): void {
    const { audio } = this.services;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - BALL_R < LEFT) {
      ball.x = LEFT + BALL_R;
      ball.vx = Math.abs(ball.vx);
      audio.play("bounce");
    } else if (ball.x + BALL_R > RIGHT) {
      ball.x = RIGHT - BALL_R;
      ball.vx = -Math.abs(ball.vx);
      audio.play("bounce");
    }
    if (ball.y - BALL_R < TOP) {
      ball.y = TOP + BALL_R;
      ball.vy = Math.abs(ball.vy);
      audio.play("bounce");
    }

    const paddle = { x: this.paddleX - this.paddleW / 2, y: PADDLE_Y, w: this.paddleW, h: PADDLE_H };
    if (ball.vy > 0 && circleRectOverlap(ball.x, ball.y, BALL_R, paddle)) {
      // the further from the center, the steeper the bounce
      const rel = clamp((ball.x - this.paddleX) / (this.paddleW / 2), -1, 1);
      const angle = rel * MAX_BOUNCE_ANGLE;
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      ball.y = PADDLE_Y - BALL_R;
      audio.play("bounce");
      return;
    }

    if (this.boss && circleRectOverlap(ball.x, ball.y, BALL_R, this.boss)) {
      this.reflect(ball, this.boss);
      this.hitBoss();
      return;
    }

    const brick = this.bricks.find((b) => circleRectOverlap(ball.x, ball.y, BALL_R, b));
    if (brick) {
      this.reflect(ball, brick);
      this.damageBrick(brick);
    }
  }

  /** Bounces the ball off a rect along the axis of least penetration. */
  private reflect(ball: Ball, r: Rect): void {
    const overlapX = Math.min(ball.x + BALL_R - r.x, r.x + r.w - (ball.x - BALL_R));
    const overlapY = Math.min(ball.y + BALL_R - r.y, r.y + r.h - (ball.y - BALL_R));
    if (overlapX < overlapY) {
      ball.vx = ball.x < r.x + r.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
      ball.x += ball.vx > 0 ? overlapX : -overlapX;
    } else {
      ball.vy = ball.y < r.y + r.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
      ball.y += ball.vy > 0 ? overlapY : -overlapY;
    }
  }

  private damageBrick(brick: Brick): void {
    if (brick.kind === "S") {
      this.services.audio.play("bounce");
      return;
    }
    brick.hp--;
    if (brick.hp > 0) {
      this.services.audio.play("hit");
      return;
    }
    this.destroyBrick(brick);
  }

  private destroyBrick(brick: Brick): void {
    const index = this.bricks.indexOf(brick);
    if (index < 0) return;
    this.bricks.splice(index, 1);
    this.score += BRICK_SCORE[brick.kind];

    if (brick.kind === "X") {
      this.services.audio.play("explode");
      // destroy all 8 neighbours; other explosive bricks chain recursively
      const neighbours = this.bricks.filter((b) => Math.abs(b.col - brick.col) <= 1 && Math.abs(b.row - brick.row) <= 1);
      for (const n of neighbours) this.destroyBrick(n);
    } else {
      this.services.audio.play("hit");
    }

    if (chance(DROP_CHANCE)) {
      const kind: DropKind = this.lives < START_LIVES && chance(0.25) ? "life" : pick<DropKind>(["multi", "wide"]);
      this.drops.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, kind });
    }
  }

  private updateDrops(dt: number): void {
    const paddle = { x: this.paddleX - this.paddleW / 2, y: PADDLE_Y, w: this.paddleW, h: PADDLE_H };
    for (const d of this.drops) d.y += DROP_SPEED * dt;
    this.drops = this.drops.filter((d) => {
      if (rectsOverlap({ x: d.x - 7, y: d.y - 4, w: 14, h: 8 }, paddle)) {
        this.applyDrop(d.kind);
        return false;
      }
      return d.y < HEIGHT + 8;
    });
  }

  private applyDrop(kind: DropKind): void {
    this.services.audio.play("powerup");
    this.score += 50;
    switch (kind) {
      case "multi": {
        if (this.stuck) return;
        const extra: Ball[] = [];
        for (const b of this.balls) {
          for (const turn of [-0.35, 0.35]) {
            if (this.balls.length + extra.length >= MAX_BALLS) break;
            const cos = Math.cos(turn);
            const sin = Math.sin(turn);
            extra.push({ x: b.x, y: b.y, vx: b.vx * cos - b.vy * sin, vy: b.vx * sin + b.vy * cos });
          }
        }
        this.balls.push(...extra);
        break;
      }
      case "wide":
        this.paddleW = PADDLE_WIDE_W;
        this.wideTime = WIDE_DURATION;
        break;
      case "life":
        this.lives++;
        break;
    }
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (boss) {
      boss.t += dt;
      boss.flash = Math.max(0, boss.flash - dt);
      const range = (RIGHT - LEFT - boss.w) / 2;
      boss.x = LEFT + range + Math.sin(boss.t * 0.9) * range;
      boss.fire -= dt;
      if (boss.fire <= 0 && !this.stuck) {
        // fires faster as it gets damaged
        boss.fire = BOSS_FIRE_INTERVAL * (0.5 + 0.5 * (boss.hp / BOSS_HP));
        this.shots.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h });
        this.services.audio.play("enemyShoot");
      }
    }

    const paddle = { x: this.paddleX - this.paddleW / 2, y: PADDLE_Y, w: this.paddleW, h: PADDLE_H };
    for (const s of this.shots) s.y += BOSS_SHOT_SPEED * dt;
    this.shots = this.shots.filter((s) => {
      if (rectsOverlap({ x: s.x - 2, y: s.y - 3, w: 4, h: 6 }, paddle)) {
        this.stunTime = STUN_TIME;
        this.services.audio.play("hit");
        return false;
      }
      return s.y < HEIGHT;
    });
  }

  private hitBoss(): void {
    const boss = this.boss;
    if (!boss) return;
    boss.hp--;
    boss.flash = 0.08;
    this.score += 20;
    if (boss.hp <= 0) {
      this.score += 1000;
      this.boss = null;
      this.shots = [];
      this.services.audio.play("bigExplode");
    } else {
      this.services.audio.play("hit");
    }
  }
}
