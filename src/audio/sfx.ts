import { fadeTail, noteHz, peakOf, renderTone, Rng, SAMPLE_RATE, type ToneSpec } from "./synth";

/** One layer of a sound effect: a tone starting `at` seconds after the sound begins. */
interface Layer extends ToneSpec {
  at?: number;
}

/** Rising or falling run of notes, one layer per note. */
function run(notes: string[], step: number, base: Omit<ToneSpec, "f0" | "hold">, hold = step * 0.9, lastHold = hold): Layer[] {
  return notes.map((name, i) => ({
    ...base,
    f0: noteHz(name),
    at: i * step,
    hold: i === notes.length - 1 ? lastHold : hold,
  }));
}

/**
 * Every sound effect, described as layers of tones and noise. Original designs,
 * rendered by the synth in synth.ts; nothing is sampled from any recording.
 */
export const SFX = {
  select: [{ wave: "pulse", duty: 0.25, f0: 880, hold: 0.03, decay: 0.02, vol: 0.24 }],
  confirm: run(["C5", "G5"], 0.055, { wave: "pulse", duty: 0.5, decay: 0.06, vol: 0.2 }, 0.05, 0.1),
  back: run(["G5", "C5"], 0.055, { wave: "pulse", duty: 0.5, decay: 0.06, vol: 0.2 }, 0.05, 0.1),
  pause: [
    { wave: "triangle", f0: 520, f1: 260, hold: 0.12, decay: 0.09, vol: 0.32 },
    { wave: "pulse", duty: 0.25, f0: 1040, f1: 520, hold: 0.06, decay: 0.04, vol: 0.08 },
  ],
  step: [
    { wave: "noise", noiseRate: 9000, lp: [1600, 450], hold: 0.025, decay: 0.014, vol: 0.16 },
    { wave: "sine", f0: 120, f1: 70, hold: 0.03, decay: 0.016, vol: 0.14 },
  ],
  eat: [{ wave: "pulse", duty: 0.25, f0: 740, f1: 1040, hold: 0.045, decay: 0.03, vol: 0.22 }],
  powerup: run(["C5", "E5", "G5", "C6", "E6"], 0.05, { wave: "pulse", duty: 0.5, decay: 0.07, vol: 0.2 }, 0.045, 0.18),
  shoot: [
    { wave: "pulse", duty: 0.125, f0: 1500, f1: 260, hold: 0.09, decay: 0.05, vol: 0.22 },
    { wave: "noise", hp: 2500, hold: 0.02, decay: 0.01, vol: 0.06 },
  ],
  enemyShoot: [{ wave: "saw", f0: 520, f1: 160, hold: 0.12, decay: 0.07, vol: 0.16, lp: [3200, 900] }],
  bounce: [{ wave: "pulse", duty: 0.5, f0: 420, f1: 380, hold: 0.035, decay: 0.02, vol: 0.2 }],
  hit: [
    { wave: "noise", noiseRate: 12000, lp: [5000, 900], hold: 0.06, decay: 0.03, vol: 0.2 },
    { wave: "pulse", duty: 0.5, f0: 240, f1: 110, hold: 0.06, decay: 0.04, vol: 0.18 },
  ],
  explode: [
    { wave: "noise", lp: [5000, 200], hold: 0.32, decay: 0.12, vol: 0.38 },
    { wave: "sine", f0: 130, f1: 38, hold: 0.25, decay: 0.12, vol: 0.4 },
  ],
  bigExplode: [
    { wave: "noise", lp: [4500, 120], hold: 0.75, decay: 0.28, vol: 0.42 },
    { wave: "sine", f0: 90, f1: 28, hold: 0.6, decay: 0.25, vol: 0.5 },
    { wave: "noise", noiseRate: 3000, lp: [2500, 150], at: 0.08, hold: 0.5, decay: 0.2, vol: 0.2 },
  ],
  die: [
    { wave: "saw", f0: 700, f1: 70, hold: 0.6, decay: 0.45, vol: 0.26, lp: [4000, 600], vibrato: { rate: 14, cents: 60 } },
    { wave: "noise", lp: [3000, 200], at: 0.05, hold: 0.3, decay: 0.15, vol: 0.14 },
  ],
  levelUp: [
    ...run(["C5", "E5", "G5", "C6"], 0.09, { wave: "pulse", duty: 0.25, decay: 0.12, vol: 0.2 }, 0.08),
    ...["C6", "E6", "G6"].map((n): Layer => ({ wave: "pulse", duty: 0.5, f0: noteHz(n), at: 0.36, hold: 0.3, decay: 0.2, vol: 0.1 })),
  ],
  gameOver: [
    ...run(["A4", "G4", "F4", "E4"], 0.19, { wave: "pulse", duty: 0.5, decay: 0.12, vol: 0.2 }, 0.17, 0.6),
    ...run(["A3", "G3", "F3", "E3"], 0.19, { wave: "triangle", vol: 0.28 }, 0.17, 0.6),
  ],
  trap: [
    { wave: "pulse", duty: 0.125, f0: 300, f1: 900, hold: 0.08, decay: 0.08, vol: 0.2, vibrato: { rate: 40, cents: 200 } },
    { wave: "pulse", duty: 0.125, f0: 900, f1: 200, at: 0.08, hold: 0.1, decay: 0.08, vol: 0.15 },
  ],
  newRecord: [
    ...run(["C5", "E5", "G5", "C6", "G5", "C6", "E6", "G6"], 0.07, { wave: "pulse", duty: 0.25, decay: 0.1, vol: 0.18 }, 0.06, 0.06),
    ...["C6", "E6", "G6", "C7"].map((n): Layer => ({ wave: "pulse", duty: 0.5, f0: noteHz(n), at: 0.56, hold: 0.5, decay: 0.3, vol: 0.09 })),
    { wave: "triangle", f0: noteHz("C3"), at: 0.56, hold: 0.5, decay: 0.3, vol: 0.3 },
  ],
} satisfies Record<string, Layer[]>;

export type SoundName = keyof typeof SFX;

/** Renders one effect to mono samples at SAMPLE_RATE. */
export function renderSfx(name: SoundName): Float32Array {
  const layers: Layer[] = SFX[name];
  const length = Math.ceil(Math.max(...layers.map((l) => (l.at ?? 0) + l.hold + (l.release ?? 0.01))) * SAMPLE_RATE) + 64;
  const out = new Float32Array(length);
  // each effect has its own seed, so noise is stable but different between effects
  const rng = new Rng(0x1234 + name.length * 977 + name.charCodeAt(0));
  for (const layer of layers) renderTone(out, Math.round((layer.at ?? 0) * SAMPLE_RATE), layer, rng);
  // layered effects may sum past full scale; scale them down instead of clipping
  const peak = peakOf(out);
  if (peak > 0.9) for (let i = 0; i < out.length; i++) out[i] *= 0.9 / peak;
  fadeTail(out);
  return out;
}
