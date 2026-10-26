import { FIELD } from "../../engine/constants";
import type { ArcadeGame, GameServices, GameStatus, LegendItem } from "../../engine/game";
import { Keys } from "../../engine/input";
import { chance, circlesOverlap, dist, pick, rand, TAU, wrap } from "../../engine/math";
import { tr } from "../../engine/i18n";
import { blink, COLORS, drawText } from "../../engine/ui";

const SHIP_R = 6;
const TURN_SPEED = 4.2;
const THRUST = 180;
const DRAG = 0.5;
const MAX_SPEED = 220;
const FROZEN_SCALE = 0.4;
const START_LIVES = 3;
const RESPAWN_DELAY = 1.5;
const INVULN_TIME = 2.5;

const BULLET_SPEED = 300;
const BULLET_LIFE = 0.9;
const MAX_BULLETS = 6;
const FIRE_COOLDOWN = 0.18;
const RAPID_COOLDOWN = 0.08;
const POWER_DURATION = 10;

const METEOR_RADIUS = [0, 6, 11, 20];
const METEOR_SCORE = [0, 100, 50, 20];
const SPECIAL_CHANCE = 0.15;
const BLAST_RADIUS = 38;
const BLAST_TIME = 0.35;
const FROST_RADIUS = 34;
const FROST_TIME = 5;
const PICKUP_CHANCE = 0.07;
const PICKUP_LIFE = 8;

const WELL_FROM_WAVE = 3;
const WELL_PULL = 4500;
const WELL_CORE = 7;

const UFO_MIN_DELAY = 16;
const UFO_MAX_DELAY = 26;
const UFO_SPEED = 60;
const UFO_FIRE = 1.4;
const UFO_BULLET_SPEED = 140;
const UFO_SCORE = 200;

type MeteorKind = "rock" | "blast" | "ice";
type PickupKind = "spread" | "rapid";

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Meteor extends Body {
  size: 1 | 2 | 3;
  kind: MeteorKind;
  shape: number[];
  rot: number;
  spin: number;
}

interface Bullet extends Body {
  life: number;
}

interface Blast {
  x: number;
  y: number;
  t: number;
}

interface Frost {
  x: number;
  y: number;
  ttl: number;
}

interface Pickup extends Body {
  kind: PickupKind;
  ttl: number;
}

interface Ufo extends Body {
  t: number;
  fire: number;
}

interface Particle extends Body {
  life: number;
  color: string;
}

const METEOR_COLORS: Record<MeteorKind, string> = { rock: "#d8d8e8", blast: "#ff8a3a", ice: "#7ae8ff" };
const PICKUP_COLORS: Record<PickupKind, string> = { spread: "#ffd84a", rapid: "#6cff7a" };
const WELL_COLOR = "#b07aff";

export const METEOR_LEGEND: LegendItem[] = [
  { color: METEOR_COLORS.rock, label: { en: "Rock: splits in two", zh: "岩石：會分裂成兩塊" } },
  { color: METEOR_COLORS.blast, label: { en: "Blast: explodes, chains", zh: "爆炸隕石：爆炸並連鎖" } },
  { color: METEOR_COLORS.ice, label: { en: "Ice: frost slows your ship", zh: "冰隕石：冰霧讓飛船變慢" } },
  { color: WELL_COLOR, label: { en: "Well: pulls all, core kills", zh: "重力井：吸引一切，核心致命" } },
  { color: PICKUP_COLORS.spread, label: { en: "S: spread shot", zh: "S：散射" } },
  { color: PICKUP_COLORS.rapid, label: { en: "R: rapid fire", zh: "R：連射" } },
  { color: COLORS.danger, label: { en: "UFO: shoots at you", zh: "幽浮：會朝你開火" } },
];

/**
 * Inertia shooter in a wrapping field. Meteors may explode (blast) or leave
 * frost clouds that slow the ship (ice); pickups upgrade the gun; from wave 3
 * a gravity well bends everything around it; a UFO shows up now and then.
 */
export class MeteorGame implements ArcadeGame {
  private services!: GameServices;
  private score = 0;
  private lives = START_LIVES;
  private wave = 0;
  private over = false;
  private time = 0;

  private ship: Body & { angle: number; alive: boolean } = { x: 0, y: 0, vx: 0, vy: 0, angle: -Math.PI / 2, alive: true };
  private invuln = INVULN_TIME;
  private respawn = 0;
  private cooldown = 0;
  private spreadTime = 0;
  private rapidTime = 0;
  private thrusting = false;

  private bullets: Bullet[] = [];
  private meteors: Meteor[] = [];
  private blasts: Blast[] = [];
  private frosts: Frost[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private well: { x: number; y: number } | null = null;
  private ufo: Ufo | null = null;
  private ufoTimer = UFO_MAX_DELAY;
  private ufoBullets: Bullet[] = [];
  private waveDelay = 0;

  init(services: GameServices): void {
    this.services = services;
    this.ship.x = FIELD.x + FIELD.w / 2;
    this.ship.y = FIELD.y + FIELD.h / 2;
    this.nextWave();
  }

  update(dt: number): void {
    this.time += dt;
    this.updateShip(dt);
    this.updateMeteors(dt);
    this.updateBullets(dt);
    this.updateUfo(dt);
    this.updateEffects(dt);
    this.checkShipCollisions();

    if (this.meteors.length === 0 && this.waveDelay <= 0) {
      this.waveDelay = 2;
      this.services.audio.play("levelUp");
    }
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) this.nextWave();
    }
  }

  render(g: CanvasRenderingContext2D): void {
    g.lineWidth = 1;

    for (const f of this.frosts) {
      g.fillStyle = `rgba(122, 232, 255, ${0.12 * Math.min(1, f.ttl)})`;
      g.beginPath();
      g.arc(f.x, f.y, FROST_RADIUS, 0, TAU);
      g.fill();
    }

    if (this.well) {
      const { x, y } = this.well;
      g.strokeStyle = "#5a3a9a";
      for (let i = 0; i < 3; i++) {
        const r = WELL_CORE + ((this.time * 20 + i * 12) % 36);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.stroke();
      }
      g.fillStyle = WELL_COLOR;
      g.beginPath();
      g.arc(x, y, WELL_CORE, 0, TAU);
      g.fill();
    }

    for (const m of this.meteors) this.drawMeteor(g, m);

    for (const p of this.pickups) {
      if (p.ttl < 2 && !blink(this.time, 6)) continue;
      g.fillStyle = PICKUP_COLORS[p.kind];
      g.fillRect(Math.round(p.x) - 5, Math.round(p.y) - 5, 10, 10);
      drawText(g, p.kind === "spread" ? "S" : "R", p.x, p.y - 4, { align: "center", color: "#000" });
    }

    if (this.ufo) {
      const u = this.ufo;
      g.strokeStyle = COLORS.danger;
      g.strokeRect(Math.round(u.x) - 9.5, Math.round(u.y) - 2.5, 19, 6);
      g.strokeRect(Math.round(u.x) - 4.5, Math.round(u.y) - 6.5, 9, 4);
    }

    g.fillStyle = "#fff";
    for (const b of this.bullets) g.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
    g.fillStyle = COLORS.danger;
    for (const b of this.ufoBullets) g.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);

    for (const b of this.blasts) {
      const k = b.t / BLAST_TIME;
      g.strokeStyle = `rgba(255, 160, 60, ${1 - k})`;
      g.beginPath();
      g.arc(b.x, b.y, BLAST_RADIUS * Math.min(1, k * 1.5), 0, TAU);
      g.stroke();
    }

    for (const p of this.particles) {
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }

    if (this.ship.alive && (this.invuln <= 0 || blink(this.time, 10))) this.drawShip(g);

    if (this.waveDelay > 0 && this.wave > 0) {
      const next = this.wave + 1;
      const label =
        next === WELL_FROM_WAVE
          ? { en: `WAVE ${next} - GRAVITY WELL`, zh: `第 ${next} 波：重力井出現` }
          : { en: `WAVE ${next}`, zh: `第 ${next} 波` };
      drawText(g, label, FIELD.w / 2, FIELD.y + 30, { align: "center", color: COLORS.accent });
    }
  }

  destroy(): void {}

  status(): GameStatus {
    const info: string[] = [];
    if (this.spreadTime > 0) info.push(tr({ en: "SPREAD", zh: "散射" }));
    if (this.rapidTime > 0) info.push(tr({ en: "RAPID", zh: "連射" }));
    if (this.isFrozen()) info.push(tr({ en: "FROZEN", zh: "冰凍" }));
    return { score: this.score, lives: this.lives, level: this.wave, over: this.over, info: info.join(" ") || undefined };
  }

  private nextWave(): void {
    this.wave++;
    const count = 3 + this.wave;
    for (let i = 0; i < count; i++) {
      // spawn along the edges, away from the ship
      let x = 0;
      let y = 0;
      do {
        if (chance(0.5)) {
          x = rand(FIELD.x, FIELD.x + FIELD.w);
          y = FIELD.y;
        } else {
          x = FIELD.x;
          y = rand(FIELD.y, FIELD.y + FIELD.h);
        }
      } while (dist(x, y, this.ship.x, this.ship.y) < 90);
      const kind: MeteorKind = this.wave >= 2 && chance(SPECIAL_CHANCE * 2) ? pick(["blast", "ice"] as const) : "rock";
      this.meteors.push(this.makeMeteor(x, y, 3, kind));
    }
    if (this.wave >= WELL_FROM_WAVE) {
      do {
        this.well = { x: rand(FIELD.x + 80, FIELD.x + FIELD.w - 80), y: rand(FIELD.y + 50, FIELD.y + FIELD.h - 50) };
      } while (dist(this.well.x, this.well.y, this.ship.x, this.ship.y) < 80);
    }
  }

  private makeMeteor(x: number, y: number, size: 1 | 2 | 3, kind: MeteorKind): Meteor {
    const speed = rand(18, 36) * (1 + (3 - size) * 0.6) * (1 + this.wave * 0.05);
    const dir = rand(0, TAU);
    const points = 9;
    const shape: number[] = [];
    for (let i = 0; i < points; i++) shape.push(rand(0.7, 1.1));
    return { x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, size, kind, shape, rot: rand(0, TAU), spin: rand(-1, 1) };
  }

  private isFrozen(): boolean {
    return this.ship.alive && this.frosts.some((f) => dist(f.x, f.y, this.ship.x, this.ship.y) < FROST_RADIUS);
  }

  private updateShip(dt: number): void {
    const { input, audio } = this.services;
    const ship = this.ship;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.spreadTime = Math.max(0, this.spreadTime - dt);
    this.rapidTime = Math.max(0, this.rapidTime - dt);

    if (!ship.alive) {
      if (this.lives <= 0) {
        this.respawn -= dt;
        if (this.respawn <= 0) this.over = true;
        return;
      }
      this.respawn -= dt;
      if (this.respawn <= 0) {
        Object.assign(ship, { x: FIELD.x + FIELD.w / 2, y: FIELD.y + FIELD.h / 2, vx: 0, vy: 0, angle: -Math.PI / 2, alive: true });
        this.invuln = INVULN_TIME;
      }
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);

    const scale = this.isFrozen() ? FROZEN_SCALE : 1;
    ship.angle += input.axisX() * TURN_SPEED * scale * dt;
    this.thrusting = input.isDown(Keys.up);
    if (this.thrusting) {
      ship.vx += Math.cos(ship.angle) * THRUST * scale * dt;
      ship.vy += Math.sin(ship.angle) * THRUST * scale * dt;
    }
    this.applyWell(ship, dt, 1);
    const drag = Math.max(0, 1 - DRAG * dt);
    ship.vx *= drag;
    ship.vy *= drag;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > MAX_SPEED) {
      ship.vx *= MAX_SPEED / speed;
      ship.vy *= MAX_SPEED / speed;
    }
    this.move(ship, dt);

    const cooldown = this.rapidTime > 0 ? RAPID_COOLDOWN : FIRE_COOLDOWN;
    const limit = this.spreadTime > 0 || this.rapidTime > 0 ? MAX_BULLETS * 2 : MAX_BULLETS;
    if (input.isDown(Keys.action) && this.cooldown <= 0 && this.bullets.length < limit) {
      this.cooldown = cooldown;
      const angles = this.spreadTime > 0 ? [-0.2, 0, 0.2] : [0];
      for (const a of angles) {
        const angle = ship.angle + a;
        this.bullets.push({
          x: ship.x + Math.cos(angle) * SHIP_R,
          y: ship.y + Math.sin(angle) * SHIP_R,
          vx: ship.vx + Math.cos(angle) * BULLET_SPEED,
          vy: ship.vy + Math.sin(angle) * BULLET_SPEED,
          life: BULLET_LIFE,
        });
      }
      audio.play("shoot");
    }
  }

  /** Pulls a body toward the gravity well. */
  private applyWell(b: Body, dt: number, strength: number): void {
    if (!this.well) return;
    const dx = this.well.x - b.x;
    const dy = this.well.y - b.y;
    const d = Math.max(16, Math.hypot(dx, dy));
    const a = (WELL_PULL / d) * strength;
    b.vx += (dx / d) * a * dt;
    b.vy += (dy / d) * a * dt;
  }

  private move(b: Body, dt: number): void {
    b.x = wrap(b.x + b.vx * dt, FIELD.x, FIELD.w);
    b.y = wrap(b.y + b.vy * dt, FIELD.y, FIELD.h);
  }

  private updateMeteors(dt: number): void {
    for (const m of [...this.meteors]) {
      this.applyWell(m, dt, 0.3);
      this.move(m, dt);
      m.rot += m.spin * dt;
      if (this.well && dist(m.x, m.y, this.well.x, this.well.y) < WELL_CORE + METEOR_RADIUS[m.size] * 0.5) {
        // swallowed by the well: gone, no score
        this.meteors.splice(this.meteors.indexOf(m), 1);
        this.burst(m.x, m.y, METEOR_COLORS[m.kind], 6);
      }
    }
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      this.applyWell(b, dt, 2);
      this.move(b, dt);
      b.life -= dt;
    }
    this.bullets = this.bullets.filter((b) => {
      if (b.life <= 0) return false;
      const m = this.meteors.find((m) => circlesOverlap(b.x, b.y, 1, m.x, m.y, METEOR_RADIUS[m.size]));
      if (m) {
        this.destroyMeteor(m, true);
        return false;
      }
      if (this.ufo && circlesOverlap(b.x, b.y, 1, this.ufo.x, this.ufo.y, 9)) {
        this.score += UFO_SCORE;
        this.burst(this.ufo.x, this.ufo.y, COLORS.danger, 16);
        this.services.audio.play("bigExplode");
        this.ufo = null;
        return false;
      }
      return true;
    });

    for (const b of this.ufoBullets) {
      this.move(b, dt);
      b.life -= dt;
    }
    this.ufoBullets = this.ufoBullets.filter((b) => b.life > 0);
  }

  private destroyMeteor(m: Meteor, scored: boolean): void {
    const index = this.meteors.indexOf(m);
    if (index < 0) return;
    this.meteors.splice(index, 1);
    if (scored) this.score += METEOR_SCORE[m.size];
    this.burst(m.x, m.y, METEOR_COLORS[m.kind], 4 + m.size * 3);
    this.services.audio.play(m.kind === "blast" ? "bigExplode" : "explode");

    if (m.size > 1) {
      for (let i = 0; i < 2; i++) this.meteors.push(this.makeMeteor(m.x, m.y, (m.size - 1) as 1 | 2, "rock"));
    }
    if (m.kind === "ice") this.frosts.push({ x: m.x, y: m.y, ttl: FROST_TIME });
    if (m.kind === "blast") {
      this.blasts.push({ x: m.x, y: m.y, t: 0 });
      // chain: everything inside the blast radius goes too
      const caught = this.meteors.filter((o) => circlesOverlap(m.x, m.y, BLAST_RADIUS, o.x, o.y, METEOR_RADIUS[o.size]));
      for (const o of caught) this.destroyMeteor(o, true);
      if (this.ship.alive && this.invuln <= 0 && circlesOverlap(m.x, m.y, BLAST_RADIUS, this.ship.x, this.ship.y, SHIP_R)) {
        this.killShip();
      }
    }
    if (chance(PICKUP_CHANCE)) {
      const dir = rand(0, TAU);
      this.pickups.push({ x: m.x, y: m.y, vx: Math.cos(dir) * 15, vy: Math.sin(dir) * 15, kind: pick(["spread", "rapid"] as const), ttl: PICKUP_LIFE });
    }
  }

  private updateUfo(dt: number): void {
    if (!this.ufo) {
      this.ufoTimer -= dt;
      if (this.ufoTimer <= 0) {
        this.ufoTimer = rand(UFO_MIN_DELAY, UFO_MAX_DELAY);
        const fromLeft = chance(0.5);
        this.ufo = {
          x: fromLeft ? FIELD.x - 10 : FIELD.x + FIELD.w + 10,
          y: rand(FIELD.y + 30, FIELD.y + FIELD.h - 30),
          vx: fromLeft ? UFO_SPEED : -UFO_SPEED,
          vy: 0,
          t: 0,
          fire: UFO_FIRE,
        };
      }
      return;
    }
    const u = this.ufo;
    u.t += dt;
    u.x += u.vx * dt;
    u.y = wrap(u.y + Math.sin(u.t * 2) * 40 * dt, FIELD.y, FIELD.h);
    if (u.x < FIELD.x - 20 || u.x > FIELD.x + FIELD.w + 20) {
      this.ufo = null;
      return;
    }
    u.fire -= dt;
    if (u.fire <= 0 && this.ship.alive) {
      u.fire = UFO_FIRE;
      const angle = Math.atan2(this.ship.y - u.y, this.ship.x - u.x) + rand(-0.3, 0.3);
      this.ufoBullets.push({ x: u.x, y: u.y, vx: Math.cos(angle) * UFO_BULLET_SPEED, vy: Math.sin(angle) * UFO_BULLET_SPEED, life: 2 });
      this.services.audio.play("enemyShoot");
    }
  }

  private updateEffects(dt: number): void {
    for (const b of this.blasts) b.t += dt;
    this.blasts = this.blasts.filter((b) => b.t < BLAST_TIME);
    for (const f of this.frosts) f.ttl -= dt;
    this.frosts = this.frosts.filter((f) => f.ttl > 0);
    for (const p of this.pickups) {
      this.move(p, dt);
      p.ttl -= dt;
    }
    this.pickups = this.pickups.filter((p) => p.ttl > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private checkShipCollisions(): void {
    const ship = this.ship;
    if (!ship.alive) return;

    this.pickups = this.pickups.filter((p) => {
      if (!circlesOverlap(p.x, p.y, 6, ship.x, ship.y, SHIP_R)) return true;
      if (p.kind === "spread") this.spreadTime = POWER_DURATION;
      else this.rapidTime = POWER_DURATION;
      this.score += 50;
      this.services.audio.play("powerup");
      return false;
    });

    if (this.invuln > 0) return;
    if (this.well && dist(ship.x, ship.y, this.well.x, this.well.y) < WELL_CORE + SHIP_R * 0.5) return this.killShip();
    const meteor = this.meteors.find((m) => circlesOverlap(m.x, m.y, METEOR_RADIUS[m.size] * 0.85, ship.x, ship.y, SHIP_R * 0.7));
    if (meteor) {
      this.destroyMeteor(meteor, false);
      return this.killShip();
    }
    if (this.ufo && circlesOverlap(this.ufo.x, this.ufo.y, 9, ship.x, ship.y, SHIP_R)) {
      this.ufo = null;
      return this.killShip();
    }
    if (this.ufoBullets.some((b) => circlesOverlap(b.x, b.y, 1.5, ship.x, ship.y, SHIP_R * 0.8))) this.killShip();
  }

  private killShip(): void {
    if (!this.ship.alive) return;
    this.ship.alive = false;
    this.lives--;
    this.respawn = RESPAWN_DELAY;
    this.spreadTime = 0;
    this.rapidTime = 0;
    this.ufoBullets = [];
    this.burst(this.ship.x, this.ship.y, "#4ad7ff", 24);
    this.services.audio.play("die");
  }

  private burst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(20, 90);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.8), color });
    }
  }

  private drawShip(g: CanvasRenderingContext2D): void {
    const { x, y, angle } = this.ship;
    const point = (a: number, r: number): [number, number] => [x + Math.cos(angle + a) * r, y + Math.sin(angle + a) * r];
    g.strokeStyle = this.isFrozen() ? "#7ae8ff" : "#4ad7ff";
    g.beginPath();
    g.moveTo(...point(0, SHIP_R + 2));
    g.lineTo(...point(2.5, SHIP_R));
    g.lineTo(...point(Math.PI, SHIP_R * 0.4));
    g.lineTo(...point(-2.5, SHIP_R));
    g.closePath();
    g.stroke();
    if (this.thrusting && blink(this.time, 20)) {
      g.strokeStyle = COLORS.accent;
      g.beginPath();
      g.moveTo(...point(2.8, SHIP_R * 0.6));
      g.lineTo(...point(Math.PI, SHIP_R + 4));
      g.lineTo(...point(-2.8, SHIP_R * 0.6));
      g.stroke();
    }
  }

  private drawMeteor(g: CanvasRenderingContext2D, m: Meteor): void {
    const r = METEOR_RADIUS[m.size];
    g.strokeStyle = METEOR_COLORS[m.kind];
    g.beginPath();
    m.shape.forEach((k, i) => {
      const a = m.rot + (i / m.shape.length) * TAU;
      const px = m.x + Math.cos(a) * r * k;
      const py = m.y + Math.sin(a) * r * k;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
    g.stroke();
  }
}
