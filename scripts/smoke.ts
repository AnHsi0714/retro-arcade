/**
 * Headless smoke test: runs every game with random input for a few simulated
 * minutes against a no-op canvas, walks the hallway -> game -> hallway flow,
 * and renders every sound effect and music track.
 * Catches crashes and NaN positions, not gameplay quality.
 *
 *   npm run smoke
 */
import { renderTrack } from "../src/audio/music";
import { renderSfx, SFX, type SoundName } from "../src/audio/sfx";
import { TRACKS, type MusicName } from "../src/audio/tracks";
import { STEP } from "../src/engine/constants";
import type { GameServices } from "../src/engine/game";
import { GameScene } from "../src/engine/gameScene";
import { Input } from "../src/engine/input";
import type { AudioManager } from "../src/engine/audio";
import { HallwayScene } from "../src/hallway/HallwayScene";
import { GAMES } from "../src/games/registry";

const noop = () => {};
// any method call or property access on the context is accepted and ignored; calls return the
// context itself so things like gradients (createLinearGradient(...).addColorStop(...)) also work
const ctx: CanvasRenderingContext2D = new Proxy({} as CanvasRenderingContext2D, {
  get: (_t, prop) => (prop === "measureText" ? () => ({ width: 0 }) : () => ctx),
  set: () => true,
});
// pictures are painted into small canvases on first use; give them the same no-op context
(globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };

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
  const audio = { muted: false, volume: 7, play: noop, unlock: noop, playMusic: noop, duckMusic: noop, toggleMute: () => false, changeVolume: () => 7 } as unknown as AudioManager;
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
    tap("ArrowDown"); // VOLUME
    tap("ArrowRight");
    tap("ArrowUp");
    tap("ArrowUp");
    tap("ArrowUp"); // wraps from the top to the last row, EXIT TO HALL
    tap("Enter");
    if (!returned) throw new Error("did not return to the hallway");
    console.log(`ok   hallway flow (entered "${opened}" and came back)`);
  } catch (err) {
    failures++;
    console.log(`FAIL hallway flow: ${(err as Error).message}`);
  }
}

// every effect and track renders to finite, audible, unclipped samples
{
  const check = (label: string, samples: Float32Array, loop: boolean) => {
    let peak = 0;
    for (const v of samples) {
      if (!Number.isFinite(v)) throw new Error(`${label}: non-finite sample`);
      peak = Math.max(peak, Math.abs(v));
    }
    if (peak < 0.05) throw new Error(`${label}: almost silent (peak ${peak.toFixed(3)})`);
    if (peak > 1) throw new Error(`${label}: clips (peak ${peak.toFixed(3)})`);
    // a loop that starts where it ended sounds seamless; a jump here would click once per repeat
    if (loop && Math.abs(samples[0] - samples[samples.length - 1]) > 0.1) throw new Error(`${label}: loop seam jumps`);
  };
  try {
    const sounds = Object.keys(SFX) as SoundName[];
    const tracks = Object.keys(TRACKS) as MusicName[];
    for (const name of sounds) check(`sfx ${name}`, renderSfx(name), false);
    for (const name of tracks) check(`music ${name}`, renderTrack(TRACKS[name]), true);
    console.log(`ok   audio renders (${sounds.length} effects, ${tracks.length} tracks)`);
  } catch (err) {
    failures++;
    console.log(`FAIL audio: ${(err as Error).message}`);
  }
}

if (failures > 0) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
