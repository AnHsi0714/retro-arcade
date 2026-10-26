import { FIELD } from "../../engine/constants";
import type { ArcadeGame, GameServices, GameStatus, LegendItem } from "../../engine/game";
import { Keys } from "../../engine/input";
import { mod, pick } from "../../engine/math";
import { tr } from "../../engine/i18n";
import { blink, COLORS, drawText } from "../../engine/ui";
import { dirIndex } from "../../art/baked";
import { CHASERS_ART, CHOMPER, GATE, mazeWalls, POWER_ORB, TRAP, type ChaserTint } from "./art";
import { HOUSE_EXIT, HOUSE_SLOTS, MAZE, MAZE_H, MAZE_W, PLAYER_START, TUNNEL_ROW } from "./maze";

const WALLS = mazeWalls(false);
const WALLS_FLASH = mazeWalls(true);

const TILE = 8;
const OX = FIELD.x + Math.floor((FIELD.w - MAZE_W * TILE) / 2);
const OY = FIELD.y + Math.floor((FIELD.h - MAZE_H * TILE) / 2);

const START_LIVES = 3;
const READY_TIME = 2;
const DYING_TIME = 1.5;
const CLEAR_TIME = 2;

// speeds in tiles per second
const PLAYER_SPEED = 7.5;
const CHASER_SPEED = 6.6;
const CHASER_SPEED_PER_LEVEL = 0.25;
const CHASER_MAX_SPEED = 8;
const FRIGHT_SPEED = 4.5;
const TUNNEL_SPEED = 4;
const EATEN_SPEED = 14;

const FRIGHT_TIME = 7;
const FRIGHT_MIN = 2;
/** Alternating scatter/chase durations; chase continues forever after the last one. */
const PHASES = [7, 20, 7, 20, 5, 20, 5];
const HOUSE_RETURN_TIME = 1.5;
const RELEASE_TIMES = [0, 3, 7, 11];

const TRAPS_PER_LEVEL = 3;
const STUN_TIME = 3;
const GATE_INTERVAL = 8;
const GATE_WARNING = 1.5;
/** Blaze enrages when this fraction of dots or fewer remain. */
const RAGE_THRESHOLD = 0.3;
const RAGE_SPEED = 1.12;
/** Wisp chases only while farther than this many tiles. */
const WISP_SHY_RANGE = 8;

interface Dir {
  x: number;
  y: number;
}

const UP: Dir = { x: 0, y: -1 };
const LEFT: Dir = { x: -1, y: 0 };
const DOWN: Dir = { x: 0, y: 1 };
const RIGHT: Dir = { x: 1, y: 0 };
/** Order also breaks ties when two directions are equally good. */
const DIRS = [UP, LEFT, DOWN, RIGHT];

function isOpposite(a: Dir, b: Dir): boolean {
  return a.x === -b.x && a.y === -b.y;
}

function opposite(d: Dir): Dir {
  return DIRS.find((o) => isOpposite(o, d))!;
}

/** Something that walks tile to tile: at (x, y) heading `dir`, `t` of the way to the next tile. */
interface Mover {
  x: number;
  y: number;
  dir: Dir;
  t: number;
  moving: boolean;
}

type ChaserMode = "house" | "active" | "eaten" | "stunned";

interface Chaser extends Mover {
  id: number;
  name: string;
  color: string;
  mode: ChaserMode;
  frightened: boolean;
  /** House release countdown, or stun countdown. */
  timer: number;
  corner: { x: number; y: number };
}

const CHASERS = [
  { name: "Blaze", color: "#ff5a5a", corner: { x: MAZE_W - 2, y: 1 } },
  { name: "Pinch", color: "#ff7ab8", corner: { x: 1, y: 1 } },
  { name: "Echo", color: "#5ef0ff", corner: { x: MAZE_W - 2, y: MAZE_H - 2 } },
  { name: "Wisp", color: "#ff9a3a", corner: { x: 1, y: MAZE_H - 2 } },
];

const DOT_COLOR = "#f4d9b0";
const GATE_COLOR = "#7a5ad6";

export const MAZE_LEGEND: LegendItem[] = [
  { color: CHASERS[0].color, label: { en: "Blaze: hunts, enrages late", zh: "Blaze：追獵，後期暴怒" } },
  { color: CHASERS[1].color, label: { en: "Pinch: cuts ahead, no traps", zh: "Pinch：繞前包抄，不踩陷阱" } },
  { color: CHASERS[2].color, label: { en: "Echo: flanks with Blaze", zh: "Echo：與 Blaze 夾擊" } },
  { color: CHASERS[3].color, label: { en: "Wisp: shy, ghosts thru gates", zh: "Wisp：怕生，能穿過閘門" } },
  { color: DOT_COLOR, label: { en: "Big dot: chasers flee", zh: "大豆子：追逐者逃跑" } },
  { color: GATE_COLOR, label: { en: "Gate: opens and shuts", zh: "閘門：定時開關" } },
  { color: COLORS.good, label: { en: "Trap: stuns a chaser 3s", zh: "陷阱：讓追逐者暈 3 秒" } },
];

type Phase = "ready" | "play" | "dying" | "clear";

/**
 * Maze chase. Four chasers with their own targeting and a skill each
 * (Blaze enrages late in a level, Pinch never trips traps, Echo flanks using
 * Blaze's position, Wisp slips through closed gates). Gates open and close
 * over time and the player can drop stun traps.
 */
export class MazeGame implements ArcadeGame {
  private services!: GameServices;
  private tiles: string[][] = [];
  private totalDots = 0;
  private dotsLeft = 0;
  private gatesOpen = false;
  private gateTimer = GATE_INTERVAL;
  private traps: Array<{ x: number; y: number }> = [];
  private trapsLeft = TRAPS_PER_LEVEL;

  private player: Mover = { x: 0, y: 0, dir: LEFT, t: 0, moving: false };
  private desired: Dir | null = null;
  private chasers: Chaser[] = [];

  private phase: Phase = "ready";
  private phaseTimer = READY_TIME;
  private modeIndex = 0;
  private modeTimer = PHASES[0];
  private frightTimer = 0;
  private combo = 0;

  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private over = false;
  private time = 0;

  init(services: GameServices): void {
    this.services = services;
    this.loadLevel();
  }

  update(dt: number): void {
    this.time += dt;
    this.readInput();

    switch (this.phase) {
      case "ready":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.phase = "play";
        return;
      case "dying":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.lives--;
          if (this.lives <= 0) this.over = true;
          else this.resetActors();
        }
        return;
      case "clear":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.level++;
          this.loadLevel();
        }
        return;
      case "play":
        this.updatePlay(dt);
    }
  }

  render(g: CanvasRenderingContext2D): void {
    const flashWalls = this.phase === "clear" && blink(this.time, 6);
    const gateClosing = this.gatesOpen && this.gateTimer < GATE_WARNING;
    (flashWalls ? WALLS_FLASH : WALLS).draw(g, OX, OY);
    for (let y = 0; y < MAZE_H; y++) {
      for (let x = 0; x < MAZE_W; x++) {
        const ch = this.tiles[y][x];
        const px = OX + x * TILE;
        const py = OY + y * TILE;
        if (ch === ".") {
          g.fillStyle = DOT_COLOR;
          g.fillRect(px + 3, py + 3, 2, 2);
        } else if (ch === "o") {
          if (blink(this.time, 4)) POWER_ORB.draw(g, px + 1, py + 1);
        } else if (ch === "G") {
          if (!this.gatesOpen) {
            GATE.draw(g, px, py);
          } else if (gateClosing && blink(this.time, 8)) {
            g.strokeStyle = GATE_COLOR;
            g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          }
        }
      }
    }

    for (const trap of this.traps) TRAP.draw(g, OX + trap.x * TILE, OY + trap.y * TILE);

    for (const c of this.chasers) this.drawChaser(g, c);

    if (this.phase !== "dying" || blink(this.time, 8)) {
      const p = this.pixel(this.player);
      // the mouth opens and closes while moving
      const open = this.player.moving ? Math.abs(Math.sin(this.time * 14)) > 0.4 : false;
      CHOMPER[dirIndex(this.player.dir.x, this.player.dir.y)][open ? 1 : 0].drawCentered(g, p.x, p.y);
    }

    if (this.phase === "ready") {
      drawText(g, { en: "READY!", zh: "準備！" }, OX + (MAZE_W * TILE) / 2, OY + 17 * TILE - 9, { align: "center", color: COLORS.accent });
    }

    // side panel: chaser legend and trap count
    const sx = OX + MAZE_W * TILE + 12;
    drawText(g, { en: "CHASERS", zh: "追逐者" }, sx, OY, { color: COLORS.dim });
    CHASERS.forEach((info, i) => {
      CHASERS_ART[i].normal[0].draw(g, sx, OY + 12 + i * 12);
      drawText(g, info.name.toUpperCase(), sx + 14, OY + 13 + i * 12);
    });
    drawText(g, `${tr({ en: "TRAPS", zh: "陷阱" })} ${this.trapsLeft}`, sx, OY + 70, { color: COLORS.good });
    drawText(g, this.gatesOpen ? { en: "GATES OPEN", zh: "閘門開啟" } : { en: "GATES SHUT", zh: "閘門關閉" }, sx, OY + 82, { color: "#b49aff" });
  }

  destroy(): void {}

  status(): GameStatus {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      over: this.over,
      info: this.frightTimer > 0 ? `${tr({ en: "POWER", zh: "能量" })} ${Math.ceil(this.frightTimer)}` : undefined,
    };
  }

  private loadLevel(): void {
    this.tiles = MAZE.map((row) => row.split(""));
    this.totalDots = 0;
    for (const row of this.tiles) for (const ch of row) if (ch === "." || ch === "o") this.totalDots++;
    this.dotsLeft = this.totalDots;
    this.traps = [];
    this.trapsLeft = TRAPS_PER_LEVEL;
    this.gatesOpen = false;
    this.gateTimer = GATE_INTERVAL;
    this.resetActors();
  }

  /** Puts everyone back at their start without touching the dots. */
  private resetActors(): void {
    this.player = { x: PLAYER_START.x, y: PLAYER_START.y, dir: LEFT, t: 0, moving: false };
    this.desired = null;
    this.chasers = CHASERS.map((info, id) => ({
      id,
      ...info,
      x: HOUSE_EXIT.x,
      y: HOUSE_EXIT.y,
      dir: LEFT,
      t: 0,
      moving: false,
      mode: "house" as ChaserMode,
      frightened: false,
      timer: RELEASE_TIMES[id],
    }));
    this.modeIndex = 0;
    this.modeTimer = PHASES[0];
    this.frightTimer = 0;
    this.phase = "ready";
    this.phaseTimer = READY_TIME;
  }

  private readInput(): void {
    const { input } = this.services;
    // pressed keys queue a turn; held keys keep it
    if (input.wasPressed(Keys.up) || input.isDown(Keys.up)) this.desired = UP;
    else if (input.wasPressed(Keys.down) || input.isDown(Keys.down)) this.desired = DOWN;
    else if (input.wasPressed(Keys.left) || input.isDown(Keys.left)) this.desired = LEFT;
    else if (input.wasPressed(Keys.right) || input.isDown(Keys.right)) this.desired = RIGHT;
  }

  private updatePlay(dt: number): void {
    this.updateTimers(dt);

    if (this.services.input.wasPressed(Keys.action)) this.placeTrap();

    // instant reversal mid-tile
    const p = this.player;
    if (this.desired && p.moving && p.t > 0 && isOpposite(this.desired, p.dir)) this.reverse(p);
    this.advance(
      p,
      (this.frightTimer > 0 ? PLAYER_SPEED * 1.07 : PLAYER_SPEED) * dt,
      (m) => this.choosePlayerDir(m),
      (m) => this.playerArrive(m),
    );

    for (const c of this.chasers) this.updateChaser(c, dt);
    this.checkCollisions();

    if (this.dotsLeft === 0 && this.phase === "play") {
      this.phase = "clear";
      this.phaseTimer = CLEAR_TIME;
      this.services.audio.play("levelUp");
    }
  }

  private updateTimers(dt: number): void {
    if (this.frightTimer > 0) {
      this.frightTimer -= dt;
      if (this.frightTimer <= 0) for (const c of this.chasers) c.frightened = false;
    } else if (this.modeIndex < PHASES.length) {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        this.modeIndex++;
        this.modeTimer = PHASES[this.modeIndex] ?? Infinity;
        // changing between scatter and chase makes active chasers turn around
        for (const c of this.chasers) if (c.mode === "active") this.reverse(c);
      }
    }

    this.gateTimer -= dt;
    if (this.gateTimer <= 0) {
      this.gateTimer = GATE_INTERVAL;
      this.gatesOpen = !this.gatesOpen;
      this.services.audio.play("trap");
    }
  }

  private scatterMode(): boolean {
    return this.modeIndex < PHASES.length && this.modeIndex % 2 === 0;
  }

  private placeTrap(): void {
    if (this.trapsLeft <= 0) return;
    const tile = this.nearestTile(this.player);
    if (this.traps.some((t) => t.x === tile.x && t.y === tile.y)) return;
    this.traps.push(tile);
    this.trapsLeft--;
    this.services.audio.play("trap");
  }

  // --- movement -----------------------------------------------------------

  private wrapX(x: number): number {
    return mod(x, MAZE_W);
  }

  private tileAt(x: number, y: number): string {
    if (y < 0 || y >= MAZE_H) return "#";
    if (x < 0 || x >= MAZE_W) return y === TUNNEL_ROW ? " " : "#";
    return this.tiles[y][x];
  }

  private passable(x: number, y: number, ignoreGates = false): boolean {
    const ch = this.tileAt(this.wrapX(x), y);
    if (ch === "#" || ch === "-") return false;
    if (ch === "G") return this.gatesOpen || ignoreGates;
    return true;
  }

  /** Moves `dist` tiles, asking `choose` for a direction at each tile center. */
  private advance(m: Mover, dist: number, choose: (m: Mover) => Dir | null, arrive: (m: Mover) => boolean): void {
    if (!m.moving) {
      const d = choose(m);
      if (!d) return;
      m.dir = d;
      m.moving = true;
    }
    m.t += dist;
    while (m.t >= 1) {
      m.t -= 1;
      m.x = this.wrapX(m.x + m.dir.x);
      m.y += m.dir.y;
      if (arrive(m)) {
        m.t = 0;
        m.moving = false;
        return;
      }
      const d = choose(m);
      if (!d) {
        m.t = 0;
        m.moving = false;
        return;
      }
      m.dir = d;
    }
  }

  /** Turns around in place, keeping the exact pixel position. */
  private reverse(m: Mover): void {
    if (m.moving && m.t > 0) {
      m.x = this.wrapX(m.x + m.dir.x);
      m.y += m.dir.y;
      m.t = 1 - m.t;
    }
    m.dir = opposite(m.dir);
  }

  private nearestTile(m: Mover): { x: number; y: number } {
    if (m.moving && m.t >= 0.5) return { x: this.wrapX(m.x + m.dir.x), y: m.y + m.dir.y };
    return { x: m.x, y: m.y };
  }

  private pixel(m: Mover): { x: number; y: number } {
    const t = m.moving ? m.t : 0;
    return { x: OX + (m.x + m.dir.x * t) * TILE + TILE / 2, y: OY + (m.y + m.dir.y * t) * TILE + TILE / 2 };
  }

  // --- player -------------------------------------------------------------

  private choosePlayerDir(m: Mover): Dir | null {
    if (this.desired && this.passable(m.x + this.desired.x, m.y + this.desired.y)) return this.desired;
    if (this.passable(m.x + m.dir.x, m.y + m.dir.y)) return m.dir;
    return null;
  }

  private playerArrive(m: Mover): boolean {
    const ch = this.tiles[m.y]?.[m.x];
    if (ch === ".") {
      this.tiles[m.y][m.x] = " ";
      this.dotsLeft--;
      this.score += 10;
      this.services.audio.play("eat");
    } else if (ch === "o") {
      this.tiles[m.y][m.x] = " ";
      this.dotsLeft--;
      this.score += 50;
      this.services.audio.play("powerup");
      this.startFright();
    }
    return false;
  }

  private startFright(): void {
    this.frightTimer = Math.max(FRIGHT_MIN, FRIGHT_TIME - (this.level - 1) * 0.5);
    this.combo = 0;
    for (const c of this.chasers) {
      if (c.mode === "active" || c.mode === "stunned") {
        if (c.mode === "active" && !c.frightened) this.reverse(c);
        c.frightened = true;
      }
    }
  }

  // --- chasers ------------------------------------------------------------

  private updateChaser(c: Chaser, dt: number): void {
    switch (c.mode) {
      case "house":
        c.timer -= dt;
        if (c.timer <= 0) {
          Object.assign(c, { mode: "active", x: HOUSE_EXIT.x, y: HOUSE_EXIT.y, dir: LEFT, t: 0, moving: false });
        }
        return;
      case "stunned":
        c.timer -= dt;
        if (c.timer <= 0) c.mode = "active";
        return;
      case "active":
      case "eaten":
        this.advance(c, this.chaserSpeed(c) * dt, (m) => this.chooseChaserDir(c, m), () => this.chaserArrive(c));
    }
  }

  private chaserSpeed(c: Chaser): number {
    if (c.mode === "eaten") return EATEN_SPEED;
    if (c.y === TUNNEL_ROW && (c.x < 5 || c.x > MAZE_W - 6)) return TUNNEL_SPEED;
    if (c.frightened) return FRIGHT_SPEED;
    const base = Math.min(CHASER_MAX_SPEED, CHASER_SPEED + (this.level - 1) * CHASER_SPEED_PER_LEVEL);
    return this.enraged(c) ? base * RAGE_SPEED : base;
  }

  /** Blaze's skill: faster and never scatters once few dots remain. */
  private enraged(c: Chaser): boolean {
    return c.name === "Blaze" && this.dotsLeft <= this.totalDots * RAGE_THRESHOLD;
  }

  private chooseChaserDir(c: Chaser, m: Mover): Dir | null {
    // Wisp's skill: slips through closed gates
    const ghostly = c.name === "Wisp";
    const canEnter = (d: Dir) => this.passable(m.x + d.x, m.y + d.y, ghostly);
    const options = DIRS.filter((d) => !isOpposite(d, m.dir) && canEnter(d));
    if (options.length === 0) {
      const back = opposite(m.dir);
      return canEnter(back) ? back : null;
    }
    if (c.frightened && c.mode === "active") return pick(options);

    const target = this.chaserTarget(c);
    let best = options[0];
    let bestD = Infinity;
    for (const d of options) {
      const dx = m.x + d.x - target.x;
      const dy = m.y + d.y - target.y;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    return best;
  }

  private chaserTarget(c: Chaser): { x: number; y: number } {
    if (c.mode === "eaten") return HOUSE_EXIT;
    if (this.scatterMode() && !this.enraged(c)) return c.corner;

    const p = this.nearestTile(this.player);
    const d = this.player.dir;
    switch (c.name) {
      case "Pinch":
        // aims ahead of the player
        return { x: p.x + d.x * 4, y: p.y + d.y * 4 };
      case "Echo": {
        // mirrors Blaze around a point ahead of the player, so the two close in from both sides
        const blaze = this.chasers[0];
        const ax = p.x + d.x * 2;
        const ay = p.y + d.y * 2;
        return { x: ax * 2 - blaze.x, y: ay * 2 - blaze.y };
      }
      case "Wisp": {
        const far = Math.hypot(c.x - p.x, c.y - p.y) > WISP_SHY_RANGE;
        return far ? p : c.corner;
      }
      default:
        return p;
    }
  }

  /** Returns true when the chaser should stop at this tile. */
  private chaserArrive(c: Chaser): boolean {
    if (c.mode === "eaten") {
      if (c.y === HOUSE_EXIT.y && Math.abs(c.x - HOUSE_EXIT.x) <= 1) {
        c.mode = "house";
        c.timer = HOUSE_RETURN_TIME;
        return true;
      }
      return false;
    }
    // Pinch's skill: never trips traps
    if (c.name === "Pinch") return false;
    const i = this.traps.findIndex((t) => t.x === c.x && t.y === c.y);
    if (i < 0) return false;
    this.traps.splice(i, 1);
    c.mode = "stunned";
    c.timer = STUN_TIME;
    this.score += 100;
    this.services.audio.play("hit");
    return true;
  }

  private checkCollisions(): void {
    const p = this.pixel(this.player);
    for (const c of this.chasers) {
      if (c.mode === "house" || c.mode === "eaten") continue;
      const q = this.pixel(c);
      if (Math.abs(p.x - q.x) > 5 || Math.abs(p.y - q.y) > 5) continue;
      if (c.frightened) {
        c.mode = "eaten";
        c.frightened = false;
        this.score += 200 * 2 ** Math.min(this.combo, 3);
        this.combo++;
        this.services.audio.play("explode");
      } else if (c.mode === "active") {
        this.phase = "dying";
        this.phaseTimer = DYING_TIME;
        this.services.audio.play("die");
        return;
      }
    }
  }

  private drawChaser(g: CanvasRenderingContext2D, c: Chaser): void {
    let x: number;
    let y: number;
    if (c.mode === "house") {
      const slot = HOUSE_SLOTS[c.id];
      x = OX + slot.x * TILE;
      y = OY + slot.y * TILE + TILE / 2 + Math.sin(this.time * 6 + c.id) * 1.5;
    } else {
      ({ x, y } = this.pixel(c));
    }
    x = Math.round(x);
    y = Math.round(y);

    const scared = c.frightened && c.mode !== "eaten";
    if (c.mode !== "eaten") {
      let tint: ChaserTint = "normal";
      if (scared) tint = this.frightTimer < 2 && blink(this.time, 6) ? "flash" : "scared";
      if (c.mode === "stunned" && blink(this.time, 4)) tint = "stunned";
      CHASERS_ART[c.id][tint][Math.floor(this.time * 6 + c.id) % 2].drawCentered(g, x, y);
    }

    // eyes stay visible even when eaten; their pupils look where the chaser is heading
    for (const ex of [x - 3, x + 1]) {
      g.fillStyle = "#fff";
      g.fillRect(ex, y - 2, 2, 3);
      g.fillStyle = scared ? "#3a4aff" : "#05050f";
      g.fillRect(ex + (c.dir.x > 0 ? 1 : 0), y - 2 + (c.dir.y > 0 ? 1 : 0), 1, 2);
    }
    if (scared) {
      // a worried zigzag mouth
      g.fillStyle = "#fff";
      for (let i = 0; i < 6; i++) g.fillRect(x - 3 + i, y + 2 + (i % 2), 1, 1);
    }
  }
}
