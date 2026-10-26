import { FIELD } from "../../engine/constants";
import type { ArcadeGame, GameServices, GameStatus, LegendItem } from "../../engine/game";
import { Keys } from "../../engine/input";
import { chance, pick, randInt } from "../../engine/math";
import { tr } from "../../engine/i18n";
import { blink, COLORS, drawText } from "../../engine/ui";

const CELL = 8;
const COLS = FIELD.w / CELL; // 60
const ROWS = FIELD.h / CELL; // 32

const START_LENGTH = 4;
const BASE_INTERVAL = 0.11;
const MIN_INTERVAL = 0.065;
const READY_TIME = 1.2;
const DEATH_TIME = 1.0;
const MAX_QUEUED_TURNS = 3;

const POWER_DURATION = 6;
const POWER_LIFETIME = 7;
const POWER_SPAWN_MIN = 6;
const POWER_SPAWN_MAX = 12;
const OBSTACLE_INTERVAL = 12;
const OBSTACLE_WARNING = 1.5;
/** Obstacles never spawn this close (in cells) to the head. */
const OBSTACLE_SAFE_RADIUS = 6;

type PowerKind = "speed" | "ghost" | "shrink";

const POWER_COLORS: Record<PowerKind, string> = {
  speed: "#ffd84a",
  ghost: "#5ef0ff",
  shrink: "#c06cff",
};

const APPLE_COLOR = "#ff4d4d";
const BLOCK_COLOR = "#8a8aa6";

export const SNAKE_LEGEND: LegendItem[] = [
  { color: APPLE_COLOR, label: { en: "Apple: grow, +10", zh: "蘋果：變長，+10" } },
  { color: BLOCK_COLOR, label: { en: "Block: appears over time", zh: "障礙：隨時間出現" } },
  { color: POWER_COLORS.speed, label: { en: "Speed: faster, double pts", zh: "加速：變快，分數加倍" } },
  { color: POWER_COLORS.ghost, label: { en: "Ghost: pass walls, blocks", zh: "幽靈：穿過牆與障礙" } },
  { color: POWER_COLORS.shrink, label: { en: "Shrink: drop 3 segments", zh: "縮短：少 3 節" } },
];

interface Cell {
  x: number;
  y: number;
}

interface PowerApple extends Cell {
  kind: PowerKind;
  ttl: number;
}

interface Obstacle extends Cell {
  /** Seconds until it becomes solid; drawn as a warning until then. */
  warn: number;
}

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;

/**
 * Snake with power apples (speed, ghost = pass through walls/obstacles, shrink)
 * and obstacles that appear over time.
 */
export class SnakeGame implements ArcadeGame {
  private services!: GameServices;
  private body: Cell[] = [];
  private dir: Cell = DIRS.right;
  private queue: Cell[] = [];
  private grow = 0;
  private stepTimer = 0;
  private apple: Cell = { x: 0, y: 0 };
  private power: PowerApple | null = null;
  private powerSpawn = POWER_SPAWN_MIN;
  private speedTime = 0;
  private ghostTime = 0;
  private obstacles: Obstacle[] = [];
  private obstacleTimer = OBSTACLE_INTERVAL;
  private score = 0;
  private ready = READY_TIME;
  private dying = 0;
  private over = false;
  private time = 0;

  init(services: GameServices): void {
    this.services = services;
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    for (let i = 0; i < START_LENGTH; i++) this.body.push({ x: cx - i, y: cy });
    this.apple = this.freeCell();
  }

  update(dt: number): void {
    this.time += dt;
    this.readTurns();
    if (this.ready > 0) {
      this.ready -= dt;
      return;
    }
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this.over = true;
      return;
    }

    this.speedTime = Math.max(0, this.speedTime - dt);
    this.ghostTime = Math.max(0, this.ghostTime - dt);
    this.updatePowerApple(dt);
    this.updateObstacles(dt);

    this.stepTimer += dt;
    const interval = this.interval();
    while (this.stepTimer >= interval && this.dying <= 0) {
      this.stepTimer -= interval;
      this.step();
    }
  }

  render(g: CanvasRenderingContext2D): void {
    // walls
    g.fillStyle = this.ghostTime > 0 && blink(this.time, 4) ? "#1d4a52" : "#2e2e4e";
    g.fillRect(FIELD.x, FIELD.y, FIELD.w, CELL);
    g.fillRect(FIELD.x, FIELD.y + FIELD.h - CELL, FIELD.w, CELL);
    g.fillRect(FIELD.x, FIELD.y, CELL, FIELD.h);
    g.fillRect(FIELD.x + FIELD.w - CELL, FIELD.y, CELL, FIELD.h);

    for (const o of this.obstacles) {
      if (o.warn > 0) {
        if (blink(this.time, 6)) this.fillCell(g, o, "#6a2a2a", 1);
      } else {
        this.fillCell(g, o, BLOCK_COLOR, 0);
      }
    }

    this.fillCell(g, this.apple, APPLE_COLOR, 1);
    if (this.power && (this.power.ttl > 2 || blink(this.time, 6))) {
      this.fillCell(g, this.power, POWER_COLORS[this.power.kind], 0);
    }

    const visible = this.dying <= 0 || blink(this.time, 8);
    if (visible) {
      const bodyColor = this.ghostTime > 0 ? "#5ef0ff" : this.speedTime > 0 ? "#ffd84a" : "#3fbf5a";
      this.body.forEach((c, i) => this.fillCell(g, c, i === 0 ? "#b6ffbf" : bodyColor, 1));
    }

    if (this.ready > 0) {
      drawText(g, { en: "READY", zh: "準備" }, FIELD.w / 2, FIELD.y + FIELD.h / 2 - 20, { align: "center", color: COLORS.accent });
    }
  }

  destroy(): void {}

  status(): GameStatus {
    const info: string[] = [];
    if (this.speedTime > 0) info.push(`${tr({ en: "SPD", zh: "加速" })} ${Math.ceil(this.speedTime)}`);
    if (this.ghostTime > 0) info.push(`${tr({ en: "GHOST", zh: "幽靈" })} ${Math.ceil(this.ghostTime)}`);
    return { score: this.score, over: this.over, info: info.join(" ") || undefined };
  }

  private interval(): number {
    const base = Math.max(MIN_INTERVAL, BASE_INTERVAL - this.body.length * 0.0008);
    return this.speedTime > 0 ? base * 0.6 : base;
  }

  private readTurns(): void {
    const { input } = this.services;
    const pressed: Cell[] = [];
    if (input.wasPressed(Keys.up)) pressed.push(DIRS.up);
    if (input.wasPressed(Keys.down)) pressed.push(DIRS.down);
    if (input.wasPressed(Keys.left)) pressed.push(DIRS.left);
    if (input.wasPressed(Keys.right)) pressed.push(DIRS.right);
    for (const d of pressed) {
      const last = this.queue[this.queue.length - 1] ?? this.dir;
      if (this.queue.length >= MAX_QUEUED_TURNS) break;
      if (d.x === last.x && d.y === last.y) continue;
      if (d.x === -last.x && d.y === -last.y) continue;
      this.queue.push(d);
    }
  }

  private step(): void {
    const { audio } = this.services;
    const next = this.queue.shift();
    if (next) this.dir = next;

    const head = this.body[0];
    let nx = head.x + this.dir.x;
    let ny = head.y + this.dir.y;
    const ghost = this.ghostTime > 0;

    if (this.isWall(nx, ny)) {
      if (!ghost) return this.die();
      // wrap to the opposite inner edge
      if (nx <= 0) nx = COLS - 2;
      else if (nx >= COLS - 1) nx = 1;
      if (ny <= 0) ny = ROWS - 2;
      else if (ny >= ROWS - 1) ny = 1;
    }
    if (!ghost && this.solidObstacleAt(nx, ny)) return this.die();

    // the tail moves out of the way this step unless we're growing
    const checkLength = this.grow > 0 ? this.body.length : this.body.length - 1;
    for (let i = 0; i < checkLength; i++) {
      if (this.body[i].x === nx && this.body[i].y === ny) return this.die();
    }

    this.body.unshift({ x: nx, y: ny });
    if (this.grow > 0) this.grow--;
    else this.body.pop();

    if (nx === this.apple.x && ny === this.apple.y) {
      this.grow += 1;
      this.score += this.speedTime > 0 ? 20 : 10;
      audio.play("eat");
      this.apple = this.freeCell();
    }

    if (this.power && nx === this.power.x && ny === this.power.y) {
      this.applyPower(this.power.kind);
      this.power = null;
    }
  }

  private applyPower(kind: PowerKind): void {
    this.services.audio.play("powerup");
    this.score += 25;
    switch (kind) {
      case "speed":
        this.speedTime = POWER_DURATION;
        break;
      case "ghost":
        this.ghostTime = POWER_DURATION;
        break;
      case "shrink": {
        const remove = Math.min(3, this.body.length - 2);
        this.body.length -= Math.max(0, remove);
        this.grow = 0;
        break;
      }
    }
  }

  private updatePowerApple(dt: number): void {
    if (this.power) {
      this.power.ttl -= dt;
      if (this.power.ttl <= 0) this.power = null;
      return;
    }
    this.powerSpawn -= dt;
    if (this.powerSpawn <= 0) {
      this.powerSpawn = randInt(POWER_SPAWN_MIN, POWER_SPAWN_MAX);
      // shrink is only offered once the snake is long enough to matter
      const kinds: PowerKind[] = this.body.length > 8 ? ["speed", "ghost", "shrink"] : ["speed", "ghost"];
      this.power = { ...this.freeCell(), kind: pick(kinds), ttl: POWER_LIFETIME };
    }
  }

  private updateObstacles(dt: number): void {
    for (const o of this.obstacles) if (o.warn > 0) o.warn -= dt;
    this.obstacleTimer -= dt;
    if (this.obstacleTimer > 0) return;
    this.obstacleTimer = OBSTACLE_INTERVAL;
    // sometimes a small cluster instead of a single block
    const count = chance(0.4) ? 3 : 1;
    const head = this.body[0];
    let origin: Cell | null = null;
    for (let tries = 0; tries < 50; tries++) {
      const c = this.freeCell();
      if (Math.abs(c.x - head.x) + Math.abs(c.y - head.y) > OBSTACLE_SAFE_RADIUS) {
        origin = c;
        break;
      }
    }
    if (!origin) return;
    const horizontal = chance(0.5);
    for (let i = 0; i < count; i++) {
      const c = horizontal ? { x: origin.x + i, y: origin.y } : { x: origin.x, y: origin.y + i };
      if (this.isFree(c.x, c.y)) this.obstacles.push({ ...c, warn: OBSTACLE_WARNING });
    }
  }

  private die(): void {
    this.dying = DEATH_TIME;
    this.services.audio.play("die");
  }

  private isWall(x: number, y: number): boolean {
    return x <= 0 || y <= 0 || x >= COLS - 1 || y >= ROWS - 1;
  }

  private solidObstacleAt(x: number, y: number): boolean {
    return this.obstacles.some((o) => o.warn <= 0 && o.x === x && o.y === y);
  }

  private isFree(x: number, y: number): boolean {
    if (this.isWall(x, y)) return false;
    if (this.body.some((c) => c.x === x && c.y === y)) return false;
    if (this.obstacles.some((o) => o.x === x && o.y === y)) return false;
    if (this.apple.x === x && this.apple.y === y) return false;
    if (this.power && this.power.x === x && this.power.y === y) return false;
    return true;
  }

  private freeCell(): Cell {
    for (let tries = 0; tries < 500; tries++) {
      const x = randInt(1, COLS - 2);
      const y = randInt(1, ROWS - 2);
      if (this.isFree(x, y)) return { x, y };
    }
    // board nearly full: scan for any free cell
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (this.isFree(x, y)) return { x, y };
    return { x: -1, y: -1 };
  }

  private fillCell(g: CanvasRenderingContext2D, c: Cell, color: string, inset: number): void {
    g.fillStyle = color;
    g.fillRect(FIELD.x + c.x * CELL + inset, FIELD.y + c.y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
  }
}
