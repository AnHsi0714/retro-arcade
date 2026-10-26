import { FIELD, HEIGHT } from "../../engine/constants";
import type { ArcadeGame, GameServices, GameStatus, LegendItem } from "../../engine/game";
import { Keys } from "../../engine/input";
import { chance, clamp, pick, rand, rectsOverlap, TAU, type Rect } from "../../engine/math";
import { blink, COLORS, drawText } from "../../engine/ui";

const LEFT = FIELD.x + 8;
const RIGHT = FIELD.x + FIELD.w - 8;

const PLAYER_Y = HEIGHT - 20;
const PLAYER_W = 13;
const PLAYER_H = 8;
const PLAYER_SPEED = 140;
const FIRE_COOLDOWN = 0.25;
const BULLET_SPEED = 260;
const MAX_WEAPON = 3;
/** Max player bullets on screen, by weapon level. */
const MAX_BULLETS = [0, 2, 4, 6];
const START_LIVES = 3;
const INVULN_TIME = 2;

const ENEMY_W = 14;
const ENEMY_H = 10;
const COLS = 10;
const ROWS = 5;
const SPACING_X = 24;
const SPACING_Y = 16;
const FORMATION_TOP = FIELD.y + 26;
const DROP_STEP = 8;
const DIVE_INTERVAL = 4;
const DIVE_SPEED = 110;

const ENEMY_BULLET_SPEED = 110;

const SHIELD_COUNT = 4;
const SHIELD_CELL = 2;
const SHIELD_COLS = 12;
const SHIELD_ROWS = 8;
const SHIELD_Y = PLAYER_Y - 32;

const DROP_CHANCE = 0.05;
const DROP_SPEED = 50;
const BOSS_EVERY = 4;
const WAVE_CLEAR_TIME = 1.5;

type EnemyKind = "grunt" | "bomber" | "sniper";
type EnemyState = "formation" | "diving" | "returning";

interface Enemy {
  kind: EnemyKind;
  col: number;
  row: number;
  state: EnemyState;
  /** Free position used while diving or returning. */
  x: number;
  y: number;
  t: number;
  /** Horizontal center the dive weaves around. */
  diveX: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Shield {
  x: number;
  cells: boolean[];
}

interface Boss extends Rect {
  hp: number;
  maxHp: number;
  t: number;
  fire: number;
  pattern: number;
  flash: number;
}

interface PowerDrop {
  x: number;
  y: number;
}

const ENEMY_SCORE: Record<EnemyKind, number> = { grunt: 10, bomber: 20, sniper: 30 };
const ENEMY_COLORS: Record<EnemyKind, string> = { grunt: "#6cff7a", bomber: "#ff9a3a", sniper: "#ff5ad0" };
const SHIELD_COLOR = "#3fbf5a";
const BOSS_COLOR = "#b13a6a";

export const DEFENDER_LEGEND: LegendItem[] = [
  { color: ENEMY_COLORS.grunt, label: "Grunt: shoots straight" },
  { color: ENEMY_COLORS.bomber, label: "Bomber: 3-way spread" },
  { color: ENEMY_COLORS.sniper, label: "Sniper: aims at you" },
  { color: SHIELD_COLOR, label: "Shield: wears down" },
  { color: COLORS.accent, label: "P capsule: gun upgrade" },
  { color: BOSS_COLOR, label: "Boss: every 4th wave" },
];

const ROW_KINDS: EnemyKind[] = ["sniper", "bomber", "bomber", "grunt", "grunt"];

/**
 * Fixed-shooter defense game. Enemy types shoot differently (straight, spread,
 * aimed), some break formation to dive, shields erode, weapons upgrade, and
 * every few waves a boss appears.
 */
export class DefenderGame implements ArcadeGame {
  private services!: GameServices;
  private score = 0;
  private lives = START_LIVES;
  private wave = 0;
  private over = false;
  private time = 0;

  private playerX = FIELD.w / 2;
  private invuln = 0;
  private weapon = 1;
  private cooldown = 0;
  private bullets: Bullet[] = [];

  private enemies: Enemy[] = [];
  private formationX = 0;
  private formationY = FORMATION_TOP;
  private formationDir = 1;
  private totalEnemies = 0;
  private diveTimer = DIVE_INTERVAL;
  private enemyFire = 1;
  private enemyBullets: Bullet[] = [];

  private shields: Shield[] = [];
  private drops: PowerDrop[] = [];
  private boss: Boss | null = null;
  private waveTimer = 0;
  private stars: Array<[number, number]> = [];

  init(services: GameServices): void {
    this.services = services;
    for (let i = 0; i < 60; i++) this.stars.push([rand(0, FIELD.w), rand(FIELD.y, HEIGHT)]);
    this.buildShields();
    this.nextWave();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.waveTimer > 0) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.nextWave();
    }
    this.updatePlayer(dt);
    this.updateFormation(dt);
    this.updateDivers(dt);
    this.updateBoss(dt);
    this.updateEnemyFire(dt);
    this.updateBullets(dt);
    this.updateDrops(dt);

    if (this.waveTimer <= 0 && this.enemies.length === 0 && !this.boss) {
      this.waveTimer = WAVE_CLEAR_TIME;
      this.services.audio.play("levelUp");
    }
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = "#33335a";
    for (const [x, y] of this.stars) g.fillRect(Math.round(x), Math.round(y), 1, 1);

    g.fillStyle = SHIELD_COLOR;
    for (const s of this.shields) {
      s.cells.forEach((alive, i) => {
        if (!alive) return;
        const cx = i % SHIELD_COLS;
        const cy = Math.floor(i / SHIELD_COLS);
        g.fillRect(s.x + cx * SHIELD_CELL, SHIELD_Y + cy * SHIELD_CELL, SHIELD_CELL, SHIELD_CELL);
      });
    }

    for (const e of this.enemies) {
      const r = this.enemyRect(e);
      g.fillStyle = ENEMY_COLORS[e.kind];
      g.fillRect(Math.round(r.x), Math.round(r.y), r.w, r.h);
      // two-frame "animation" placeholder
      g.fillStyle = COLORS.bg;
      const frame = Math.floor(this.time * 2) % 2;
      g.fillRect(Math.round(r.x) + 3, Math.round(r.y) + 3 + frame, 2, 2);
      g.fillRect(Math.round(r.x) + r.w - 5, Math.round(r.y) + 3 + frame, 2, 2);
    }

    if (this.boss) {
      const b = this.boss;
      g.fillStyle = b.flash > 0 ? "#fff" : BOSS_COLOR;
      g.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
      g.fillStyle = COLORS.danger;
      g.fillRect(LEFT, FIELD.y + 4, Math.round(((RIGHT - LEFT) * b.hp) / b.maxHp), 3);
    }

    if (this.invuln <= 0 || blink(this.time, 10)) {
      g.fillStyle = "#4ad7ff";
      const x = Math.round(this.playerX - PLAYER_W / 2);
      g.fillRect(x, PLAYER_Y, PLAYER_W, PLAYER_H);
      g.fillRect(x + 5, PLAYER_Y - 3, 3, 3);
    }

    g.fillStyle = "#fff";
    for (const b of this.bullets) g.fillRect(Math.round(b.x), Math.round(b.y), 1, 4);
    g.fillStyle = COLORS.danger;
    for (const b of this.enemyBullets) g.fillRect(Math.round(b.x) - 1, Math.round(b.y), 2, 4);

    for (const d of this.drops) {
      g.fillStyle = COLORS.accent;
      g.fillRect(Math.round(d.x) - 5, Math.round(d.y) - 4, 10, 8);
      drawText(g, "P", d.x, d.y - 4, { align: "center", color: "#000" });
    }

    if (this.waveTimer > 0) {
      const next = this.wave + 1;
      const label = next % BOSS_EVERY === 0 ? "WARNING: BOSS" : `WAVE ${next}`;
      drawText(g, label, FIELD.w / 2, FIELD.y + FIELD.h / 2 - 10, { align: "center", color: COLORS.accent });
    }
  }

  destroy(): void {}

  status(): GameStatus {
    return { score: this.score, lives: this.lives, level: this.wave, over: this.over, info: `GUN ${this.weapon}` };
  }

  private nextWave(): void {
    this.wave++;
    this.enemyBullets = [];
    this.formationX = LEFT + 20;
    this.formationY = FORMATION_TOP + Math.min(this.wave - 1, 5) * 4;
    this.formationDir = 1;
    this.enemies = [];
    if (this.wave % BOSS_EVERY === 0) {
      const maxHp = 30 + this.wave * 3;
      this.boss = { x: FIELD.w / 2 - 32, y: FIELD.y + 20, w: 64, h: 24, hp: maxHp, maxHp, t: 0, fire: 1.5, pattern: 0, flash: 0 };
    } else {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          this.enemies.push({ kind: ROW_KINDS[row], col, row, state: "formation", x: 0, y: 0, t: 0, diveX: 0 });
        }
      }
    }
    this.totalEnemies = this.enemies.length;
    if (this.wave > 1 && this.wave % BOSS_EVERY === 1) this.buildShields();
  }

  private buildShields(): void {
    this.shields = [];
    const w = SHIELD_COLS * SHIELD_CELL;
    const gap = (RIGHT - LEFT - SHIELD_COUNT * w) / (SHIELD_COUNT + 1);
    for (let i = 0; i < SHIELD_COUNT; i++) {
      const cells: boolean[] = [];
      for (let y = 0; y < SHIELD_ROWS; y++) {
        for (let x = 0; x < SHIELD_COLS; x++) {
          // notch out the bottom middle to give the bunker an arch shape
          const arch = y >= SHIELD_ROWS - 3 && x >= 4 && x < SHIELD_COLS - 4;
          const corner = y === 0 && (x === 0 || x === SHIELD_COLS - 1);
          cells.push(!arch && !corner);
        }
      }
      this.shields.push({ x: Math.round(LEFT + gap + i * (w + gap)), cells });
    }
  }

  private updatePlayer(dt: number): void {
    const { input, audio } = this.services;
    this.invuln = Math.max(0, this.invuln - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.playerX = clamp(this.playerX + input.axisX() * PLAYER_SPEED * dt, LEFT + PLAYER_W / 2, RIGHT - PLAYER_W / 2);

    if (input.isDown(Keys.action) && this.cooldown <= 0 && this.bullets.length < MAX_BULLETS[this.weapon]) {
      this.cooldown = FIRE_COOLDOWN;
      const y = PLAYER_Y - 6;
      const x = this.playerX;
      if (this.weapon === 1) this.bullets.push({ x, y, vx: 0, vy: -BULLET_SPEED });
      else if (this.weapon === 2) this.bullets.push({ x: x - 4, y, vx: 0, vy: -BULLET_SPEED }, { x: x + 4, y, vx: 0, vy: -BULLET_SPEED });
      else
        this.bullets.push(
          { x, y, vx: 0, vy: -BULLET_SPEED },
          { x, y, vx: -50, vy: -BULLET_SPEED },
          { x, y, vx: 50, vy: -BULLET_SPEED },
        );
      audio.play("shoot");
    }
  }

  private slot(e: Enemy): { x: number; y: number } {
    return { x: this.formationX + e.col * SPACING_X, y: this.formationY + e.row * SPACING_Y };
  }

  private enemyRect(e: Enemy): Rect {
    const p = e.state === "formation" ? this.slot(e) : e;
    return { x: p.x, y: p.y, w: ENEMY_W, h: ENEMY_H };
  }

  private updateFormation(dt: number): void {
    const inFormation = this.enemies.filter((e) => e.state === "formation");
    if (this.totalEnemies === 0) return;
    // fewer enemies -> faster formation
    const killed = 1 - this.enemies.length / this.totalEnemies;
    const speed = 18 + killed * 70 + this.wave * 3;
    this.formationX += this.formationDir * speed * dt;

    if (inFormation.length > 0) {
      const xs = inFormation.map((e) => this.slot(e).x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs) + ENEMY_W;
      if ((this.formationDir < 0 && minX < LEFT) || (this.formationDir > 0 && maxX > RIGHT)) {
        this.formationDir = -this.formationDir;
        this.formationY += DROP_STEP;
      }
      const bottom = Math.max(...inFormation.map((e) => this.slot(e).y)) + ENEMY_H;
      for (const e of inFormation) this.erodeShields(this.enemyRect(e));
      if (bottom >= PLAYER_Y) this.gameOver();
    }
  }

  private updateDivers(dt: number): void {
    this.diveTimer -= dt;
    if (this.diveTimer <= 0) {
      this.diveTimer = Math.max(1.5, DIVE_INTERVAL - this.wave * 0.3);
      const candidates = this.enemies.filter((e) => e.state === "formation" && e.kind !== "sniper");
      if (candidates.length > 0) {
        const e = pick(candidates);
        const p = this.slot(e);
        e.state = "diving";
        e.x = p.x;
        e.y = p.y;
        e.t = 0;
        e.diveX = p.x;
      }
    }

    for (const e of this.enemies) {
      if (e.state === "diving") {
        e.t += dt;
        // weave toward the player while descending
        e.diveX += clamp(this.playerX - e.diveX, -40, 40) * dt;
        e.x = e.diveX + Math.sin(e.t * 4) * 30;
        e.y += DIVE_SPEED * dt;
        this.erodeShields(this.enemyRect(e));
        if (e.y > HEIGHT) {
          e.state = "returning";
          e.y = FIELD.y - ENEMY_H;
        }
      } else if (e.state === "returning") {
        const target = this.slot(e);
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const d = Math.hypot(dx, dy);
        const step = DIVE_SPEED * dt;
        if (d <= step) e.state = "formation";
        else {
          e.x += (dx / d) * step;
          e.y += (dy / d) * step;
        }
      }
    }
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    if (!b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    const range = (RIGHT - LEFT - b.w) / 2;
    b.x = LEFT + range + Math.sin(b.t * 0.7) * range;
    b.y = FIELD.y + 20 + Math.sin(b.t * 1.3) * 8;
    b.fire -= dt;
    if (b.fire > 0) return;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h;
    if (b.pattern % 2 === 0) {
      // aimed triple
      const angle = Math.atan2(PLAYER_Y - cy, this.playerX - cx);
      for (const spread of [-0.2, 0, 0.2]) this.fireEnemyBullet(cx, cy, angle + spread, 1.1);
      b.fire = 1.2;
    } else {
      // ring burst
      for (let i = 0; i < 10; i++) this.fireEnemyBullet(cx, cy, (i / 10) * TAU + b.t, 0.8);
      b.fire = 1.6;
    }
    b.pattern++;
    this.services.audio.play("enemyShoot");
  }

  private updateEnemyFire(dt: number): void {
    this.enemyFire -= dt;
    if (this.enemyFire > 0 || this.enemies.length === 0) return;
    this.enemyFire = Math.max(0.35, 1.2 - this.wave * 0.08);

    // the lowest enemy of each column can shoot, plus anyone diving
    const shooters: Enemy[] = [];
    for (let col = 0; col < COLS; col++) {
      const column = this.enemies.filter((e) => e.col === col && e.state === "formation");
      if (column.length) shooters.push(column.reduce((a, b) => (a.row > b.row ? a : b)));
    }
    shooters.push(...this.enemies.filter((e) => e.state === "diving"));
    if (shooters.length === 0) return;

    const e = pick(shooters);
    const r = this.enemyRect(e);
    const x = r.x + r.w / 2;
    const y = r.y + r.h;
    switch (e.kind) {
      case "grunt":
        this.fireEnemyBullet(x, y, Math.PI / 2, 1);
        break;
      case "bomber":
        for (const spread of [-0.35, 0, 0.35]) this.fireEnemyBullet(x, y, Math.PI / 2 + spread, 0.7);
        break;
      case "sniper":
        this.fireEnemyBullet(x, y, Math.atan2(PLAYER_Y - y, this.playerX - x), 1.4);
        break;
    }
    this.services.audio.play("enemyShoot");
  }

  private fireEnemyBullet(x: number, y: number, angle: number, speedScale: number): void {
    const s = ENEMY_BULLET_SPEED * speedScale;
    this.enemyBullets.push({ x, y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s });
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    this.bullets = this.bullets.filter((b) => {
      if (b.y < FIELD.y || b.x < LEFT || b.x > RIGHT) return false;
      if (this.hitShield(b.x, b.y)) return false;
      const rect = { x: b.x, y: b.y, w: 1, h: 4 };
      if (this.boss && rectsOverlap(rect, this.boss)) {
        this.damageBoss();
        return false;
      }
      const hit = this.enemies.find((e) => rectsOverlap(rect, this.enemyRect(e)));
      if (hit) {
        this.killEnemy(hit);
        return false;
      }
      return true;
    });

    const player = { x: this.playerX - PLAYER_W / 2, y: PLAYER_Y - 3, w: PLAYER_W, h: PLAYER_H + 3 };
    this.enemyBullets = this.enemyBullets.filter((b) => {
      if (b.y > HEIGHT || b.y < FIELD.y || b.x < 0 || b.x > FIELD.w) return false;
      if (this.hitShield(b.x, b.y + 4)) return false;
      if (this.invuln <= 0 && rectsOverlap({ x: b.x - 1, y: b.y, w: 2, h: 4 }, player)) {
        this.playerHit();
        return false;
      }
      return true;
    });

    if (this.invuln <= 0) {
      const diver = this.enemies.find((e) => e.state === "diving" && rectsOverlap(this.enemyRect(e), player));
      if (diver) {
        this.killEnemy(diver);
        this.playerHit();
      }
    }
  }

  private killEnemy(e: Enemy): void {
    this.enemies.splice(this.enemies.indexOf(e), 1);
    // divers are worth double
    this.score += ENEMY_SCORE[e.kind] * (e.state === "formation" ? 1 : 2);
    this.services.audio.play("explode");
    if (chance(DROP_CHANCE)) {
      const r = this.enemyRect(e);
      this.drops.push({ x: r.x + r.w / 2, y: r.y });
    }
  }

  private damageBoss(): void {
    const b = this.boss;
    if (!b) return;
    b.hp--;
    b.flash = 0.06;
    this.score += 5;
    this.services.audio.play("hit");
    if (b.hp <= 0) {
      this.score += 1500;
      this.drops.push({ x: b.x + b.w / 2, y: b.y + b.h });
      this.boss = null;
      this.enemyBullets = [];
      this.services.audio.play("bigExplode");
    }
  }

  private playerHit(): void {
    this.lives--;
    this.invuln = INVULN_TIME;
    this.weapon = Math.max(1, this.weapon - 1);
    this.services.audio.play("die");
    if (this.lives <= 0) this.gameOver();
  }

  private gameOver(): void {
    this.lives = 0;
    this.over = true;
  }

  private updateDrops(dt: number): void {
    const player = { x: this.playerX - PLAYER_W / 2, y: PLAYER_Y - 3, w: PLAYER_W, h: PLAYER_H + 3 };
    for (const d of this.drops) d.y += DROP_SPEED * dt;
    this.drops = this.drops.filter((d) => {
      if (rectsOverlap({ x: d.x - 5, y: d.y - 4, w: 10, h: 8 }, player)) {
        this.weapon = Math.min(MAX_WEAPON, this.weapon + 1);
        this.score += 100;
        this.services.audio.play("powerup");
        return false;
      }
      return d.y < HEIGHT;
    });
  }

  /** Removes the shield cell at a point (plus a little splash). Returns true if something was hit. */
  private hitShield(x: number, y: number): boolean {
    for (const s of this.shields) {
      const cx = Math.floor((x - s.x) / SHIELD_CELL);
      const cy = Math.floor((y - SHIELD_Y) / SHIELD_CELL);
      if (cx < 0 || cy < 0 || cx >= SHIELD_COLS || cy >= SHIELD_ROWS) continue;
      if (!s.cells[cy * SHIELD_COLS + cx]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= SHIELD_COLS || ny >= SHIELD_ROWS) continue;
          if ((dx === 0 && dy === 0) || chance(0.4)) s.cells[ny * SHIELD_COLS + nx] = false;
        }
      }
      return true;
    }
    return false;
  }

  private erodeShields(r: Rect): void {
    if (r.y + r.h < SHIELD_Y || r.y > SHIELD_Y + SHIELD_ROWS * SHIELD_CELL) return;
    for (const s of this.shields) {
      s.cells.forEach((alive, i) => {
        if (!alive) return;
        const x = s.x + (i % SHIELD_COLS) * SHIELD_CELL;
        const y = SHIELD_Y + Math.floor(i / SHIELD_COLS) * SHIELD_CELL;
        if (rectsOverlap(r, { x, y, w: SHIELD_CELL, h: SHIELD_CELL })) s.cells[i] = false;
      });
    }
  }
}
