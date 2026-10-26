/**
 * Headless smoke test: runs every game with random input for a few simulated
 * minutes against a no-op canvas, and walks the hallway -> game -> hallway flow.
 * Catches crashes and NaN positions, not gameplay quality.
 *
 *   npm run smoke
 */
import { STEP } from "../src/engine/constants";
import type { GameServices } from "../src/engine/game";
import { GameScene } from "../src/engine/gameScene";
import { Input } from "../src/engine/input";
import type { AudioManager } from "../src/engine/audio";
import { HallwayScene } from "../src/hallway/HallwayScene";
import { GAMES } from "../src/games/registry";

const noop = () => {};
// any method call or property access on the context is accepted and ignored
const ctx = new Proxy({} as CanvasRenderingContext2D, {
  get: (_t, prop) => (prop === "measureText" ? () => ({ width: 0 }) : noop),
  set: () => true,
});

const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyX"];

/** Drives Input through its real event path with fake keyboard events. */
class FakeWindow {
  private handlers = new Map<string, Array<(e: unknown) => void>>();
  addEventListener(type: string, fn: (e: unknown) => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  key(type: "keydown" | "keyup", code: string) {
    for (const fn of this.handlers.get(type) ?? []) fn({ code, repeat: false, preventDefault: noop });
  }
}

function makeServices() {
  const win = new FakeWindow();
  const input = new Input();
  input.attach(win as unknown as Window);
  const audio = { muted: false, play: noop, unlock: noop, toggleMute: () => false } as unknown as AudioManager;
  return { services: { input, audio } as GameServices, win };
}

function mash(win: FakeWindow, held: Set<string>) {
  for (const k of KEYS) {
    if (k === "KeyX") continue; // X ends the test cabinet's run; keep it out of random input
    if (Math.random() < 0.03) {
      if (held.has(k)) {
        held.delete(k);
        win.key("keyup", k);
      } else {
        held.add(k);
        win.key("keydown", k);
      }
    }
  }
}

function checkFinite(obj: unknown, path: string, seen = new Set<unknown>()): void {
  if (typeof obj === "number") {
    if (Number.isNaN(obj)) throw new Error(`NaN at ${path}`);
    return;
  }
  if (!obj || typeof obj !== "object" || seen.has(obj)) return;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) if (k !== "services") checkFinite(v, `${path}.${k}`, seen);
}

let failures = 0;
const SECONDS = 240;

for (const info of GAMES) {
  const { services, win } = makeServices();
  const held = new Set<string>();
  let runs = 0;
  let maxScore = 0;
  try {
    let game = info.create();
    game.init(services);
    for (let i = 0; i < SECONDS / STEP; i++) {
      mash(win, held);
      services.input.beginStep();
      game.update(STEP);
      if (i % 30 === 0) game.render(ctx);
      if (i % 600 === 0) checkFinite(game, info.id);
      const s = game.status();
      maxScore = Math.max(maxScore, s.score);
      if (s.over) {
        runs++;
        game.destroy();
        game = info.create();
        game.init(services);
      }
    }
    console.log(`ok   ${info.id.padEnd(9)} runs ended: ${runs}, best score: ${maxScore}`);
  } catch (err) {
    failures++;
    console.log(`FAIL ${info.id}: ${(err as Error).stack}`);
  }
}

// hallway -> machine -> pause -> exit -> hallway
{
  const { services, win } = makeServices();
  let opened = "";
  let returned = false;
  let scene: { update(dt: number): void; render(g: CanvasRenderingContext2D): void } | null = null;
  const hallway: HallwayScene = new HallwayScene(services, (info) => {
    opened = info.id;
    const gs = new GameScene(info, services, () => {
      returned = true;
      scene = hallway;
      hallway.enter();
    });
    gs.enter();
    scene = gs;
  });
  hallway.enter();
  scene = hallway;
  const step = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      services.input.beginStep();
      scene!.update(STEP);
      scene!.render(ctx);
    }
  };
  const tap = (code: string) => {
    win.key("keydown", code);
    step(1);
    win.key("keyup", code);
    step(1);
  };
  try {
    // walk right until the first cabinet is in range, then use it
    win.key("keydown", "ArrowRight");
    for (let i = 0; i < 600 && !opened; i++) {
      step(1);
      if (i % 10 === 0) tap("ArrowUp");
    }
    win.key("keyup", "ArrowRight");
    if (!opened) throw new Error("never reached a cabinet");
    step(30);
    tap("Enter"); // dismiss the how-to card
    step(30);
    tap("Escape"); // pause
    tap("ArrowDown"); // HOW TO PLAY
    tap("Enter");
    tap("Escape"); // back to the pause menu
    tap("ArrowDown");
    tap("ArrowDown"); // EXIT TO HALL
    tap("Enter");
    if (!returned) throw new Error("did not return to the hallway");
    console.log(`ok   hallway flow (entered "${opened}" and came back)`);
  } catch (err) {
    failures++;
    console.log(`FAIL hallway flow: ${(err as Error).message}`);
  }
}

if (failures > 0) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
