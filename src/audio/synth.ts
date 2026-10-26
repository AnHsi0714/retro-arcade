/**
 * Tiny software synthesizer. Everything here is plain arithmetic on
 * Float32Arrays, so sounds are rendered once (at load time) and played back as
 * buffers, and the same code runs in Node for checks and for exporting WAVs.
 */

export const SAMPLE_RATE = 32000;

export type Wave = "pulse" | "triangle" | "saw" | "sine" | "noise";

export interface ToneSpec {
  wave: Wave;
  /** Start frequency (Hz). Required for every wave except noise. */
  f0?: number;
  /** End frequency (Hz). The pitch glides exponentially from f0 to f1 over `hold`. */
  f1?: number;
  vol: number;
  /** Seconds the note is held; the release comes after it. */
  hold: number;
  /** Linear fade-in (s). */
  attack?: number;
  /** Time constant (s) of the exponential fall toward `sustain`. Omit for no fall. */
  decay?: number;
  /** Level the decay falls toward, 0 to 1. */
  sustain?: number;
  /** Linear fade-out after `hold` (s). */
  release?: number;
  /** Pulse width, 0 to 1. */
  duty?: number;
  /** Pulse width at the end of `hold`; the width glides from `duty`. */
  dutyEnd?: number;
  vibrato?: { rate: number; cents: number; delay?: number };
  /** Noise only: new random value this many times per second (omit for white noise). */
  noiseRate?: number;
  /** One-pole low-pass cutoff (Hz), swept from the first value to the second over `hold`. */
  lp?: [number, number];
  /** One-pole high-pass cutoff (Hz). */
  hp?: number;
}

const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" -> 440. Sharps are "#", flats are "b": "C#4", "Bb3". */
export function noteHz(name: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name "${name}"`);
  const semis = NOTE_OFFSETS[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * 2 ** ((semis - 69) / 12);
}

/** Small deterministic generator so every render is identical. */
export class Rng {
  private state: number;
  constructor(seed = 0x2545f491) {
    this.state = seed >>> 0 || 1;
  }
  /** Uniform in [-1, 1). */
  next(): number {
    let s = this.state;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.state = s >>> 0;
    return (this.state / 4294967296) * 2 - 1;
  }
}

/** Band-limiting correction for the jump in a pulse or saw wave, which removes harsh aliasing. */
function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

function lowpassCoeff(cutoff: number): number {
  return 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
}

/** Pitch, pulse width and filter cutoff are updated once per this many samples. */
const CONTROL_PERIOD = 8;

/**
 * Adds one note into `out` starting at sample `start`. With `wrap` the note
 * continues from the beginning of the buffer when it runs past the end, which
 * keeps looping music seamless.
 */
export function renderTone(out: Float32Array, start: number, spec: ToneSpec, rng: Rng, wrap = false): void {
  const attackSamples = Math.max(1, Math.round((spec.attack ?? 0.002) * SAMPLE_RATE));
  const holdSamples = Math.max(1, Math.round(spec.hold * SAMPLE_RATE));
  const releaseSamples = Math.max(1, Math.round((spec.release ?? 0.01) * SAMPLE_RATE));
  const sustain = spec.sustain ?? 0;
  // the fall toward the sustain level is a running product: one multiply per sample
  const decayStep = spec.decay === undefined ? 1 : Math.exp(-1 / (spec.decay * SAMPLE_RATE));
  const total = holdSamples + releaseSamples;
  const f0 = spec.f0 ?? 0;
  if (f0 <= 0 && spec.wave !== "noise") throw new Error(`A ${spec.wave} tone needs f0`);

  const glide = spec.f1 !== undefined && f0 > 0 ? spec.f1 / f0 : 1;
  const duty0 = spec.duty ?? 0.5;
  const duty1 = spec.dutyEnd ?? duty0;
  const vib = spec.vibrato;
  const lp = spec.lp;
  const sweepsLp = lp !== undefined && lp[0] !== lp[1];
  const hpA = spec.hp ? lowpassCoeff(spec.hp) : 0;

  let phase = 0;
  let freq = f0;
  let dt = freq / SAMPLE_RATE;
  let duty = duty0;
  let lpA = lp ? lowpassCoeff(lp[0]) : 0;
  let noiseValue = rng.next();
  let noiseClock = 0;
  let lpState = 0;
  let hpState = 0;
  let fall = 1;
  let env = 0;

  for (let i = 0; i < total; i++) {
    if (i % CONTROL_PERIOD === 0) {
      const t = i / SAMPLE_RATE;
      const progress = Math.min(1, i / holdSamples);
      freq = glide === 1 ? f0 : f0 * glide ** progress;
      if (vib && t > (vib.delay ?? 0)) freq *= 2 ** ((vib.cents * Math.sin(2 * Math.PI * vib.rate * (t - (vib.delay ?? 0)))) / 1200);
      dt = freq / SAMPLE_RATE;
      duty = duty0 + (duty1 - duty0) * progress;
      if (sweepsLp) lpA = lowpassCoeff(lp[0] * (lp[1] / lp[0]) ** progress);
    }

    phase += dt;
    if (phase >= 1) phase -= 1;

    let s: number;
    switch (spec.wave) {
      case "pulse":
        s = phase < duty ? 1 : -1;
        s += polyBlep(phase, dt);
        s -= polyBlep((phase - duty + 1) % 1, dt);
        s -= 2 * duty - 1; // remove the DC offset of narrow pulses
        break;
      case "saw":
        s = 2 * phase - 1 - polyBlep(phase, dt);
        break;
      case "triangle":
        s = 1 - 4 * Math.abs(phase - 0.5);
        break;
      case "sine":
        s = Math.sin(2 * Math.PI * phase);
        break;
      default:
        if (spec.noiseRate === undefined) {
          noiseValue = rng.next();
        } else {
          noiseClock += spec.noiseRate / SAMPLE_RATE;
          if (noiseClock >= 1) {
            noiseClock -= 1;
            noiseValue = rng.next();
          }
        }
        s = noiseValue;
    }

    if (lp) {
      lpState += lpA * (s - lpState);
      s = lpState;
    }
    if (spec.hp) {
      hpState += hpA * (s - hpState);
      s -= hpState;
    }

    if (i < holdSamples) {
      if (i < attackSamples) env = i / attackSamples;
      else {
        env = sustain + (1 - sustain) * fall;
        fall *= decayStep;
      }
    } else {
      env *= 1 - 1 / (releaseSamples - (i - holdSamples) + 1);
    }

    let index = start + i;
    if (index >= out.length) {
      if (!wrap) break;
      index %= out.length;
    }
    out[index] += s * env * spec.vol;
  }
}

/** Gentle saturation so loud passages round off instead of clipping. */
export function softClip(buf: Float32Array, drive = 1.1): void {
  const norm = Math.tanh(drive);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive) / norm;
}

export function peakOf(buf: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  return peak;
}

/** Fades out the last few milliseconds so a one-shot never ends with a click. */
export function fadeTail(buf: Float32Array, seconds = 0.004): void {
  const n = Math.min(buf.length, Math.ceil(seconds * SAMPLE_RATE));
  for (let i = 0; i < n; i++) buf[buf.length - 1 - i] *= i / n;
}
