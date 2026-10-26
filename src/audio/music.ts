import { noteHz, peakOf, renderTone, Rng, SAMPLE_RATE, softClip, type ToneSpec } from "./synth";

/**
 * A tiny tracker. A track is a set of channels; each channel is a list of bars
 * and each bar is a string of space-separated tokens, evenly spaced across a
 * 4/4 bar (1, 2, 4, 8 or 16 tokens). Tokens:
 *
 *   C4  F#3  Bb2   a note; add "!" for an accent or "'" for a soft note
 *   -              keep holding the previous note
 *   .              rest
 *   A3+C4+E4       several notes at once (chords)
 *   k s h o c      drum hits (kick, snare, closed hat, open hat, clap), also joined with "+"
 *
 * A channel with fewer bars than the track simply repeats.
 */

const STEPS_PER_BAR = 16;
const LEGAL_TOKEN_COUNTS = [1, 2, 4, 8, 16];
const PEAK = 0.8;

export type InstrumentName = "lead" | "thin" | "bass" | "pluck" | "stab" | "pad" | "bell" | "drums";

export interface ChannelDef {
  inst: InstrumentName;
  /** Channel level, 1 = the instrument's own loudness. */
  vol?: number;
  /** Fraction of a note's length that is actually held; lower is more staccato. */
  gate?: number;
  /** How much of this channel is sent to the echo, 0 to 1. */
  echo?: number;
  bars: string[];
}

export interface TrackDef {
  bpm: number;
  /** Delay the off-beat eighths by this fraction of an eighth note (0 to 0.5). */
  swing?: number;
  /** Echo time in beats and how much of it feeds back. */
  echo?: { beats: number; feedback: number };
  channels: ChannelDef[];
}

/** A tone that may start slightly after the note itself (used to layer a clap). */
type TimedTone = ToneSpec & { at?: number };
type Maker = (hz: number, hold: number, vel: number) => TimedTone[];

const INSTRUMENTS: Record<Exclude<InstrumentName, "drums">, Maker> = {
  lead: (f, hold, v) => [
    { wave: "pulse", duty: 0.25, f0: f, hold, vol: 0.2 * v, attack: 0.004, decay: 0.6, sustain: 0.65, release: 0.06, vibrato: { rate: 5.5, cents: 12, delay: 0.2 } },
  ],
  thin: (f, hold, v) => [
    { wave: "pulse", duty: 0.125, f0: f, hold, vol: 0.18 * v, attack: 0.003, decay: 0.3, sustain: 0.55, release: 0.05, vibrato: { rate: 6, cents: 10, delay: 0.15 } },
  ],
  // the quiet upper layer gives low notes something to hear on small speakers
  bass: (f, hold, v) => [
    { wave: "triangle", f0: f, hold, vol: 0.5 * v, attack: 0.004, decay: 0.5, sustain: 0.7, release: 0.04 },
    { wave: "pulse", duty: 0.5, f0: f * 2, hold, vol: 0.08 * v, attack: 0.004, decay: 0.2, sustain: 0.3, release: 0.04, lp: [1100, 1100] },
  ],
  pluck: (f, hold, v) => [
    { wave: "pulse", duty: 0.5, f0: f, hold: Math.min(hold, 0.2), vol: 0.1 * v, attack: 0.002, decay: 0.07, sustain: 0, release: 0.03 },
  ],
  stab: (f, hold, v) => [
    { wave: "pulse", duty: 0.25, f0: f, hold: Math.min(hold, 0.12), vol: 0.07 * v, attack: 0.002, decay: 0.05, sustain: 0.1, release: 0.03 },
  ],
  pad: (f, hold, v) => [
    { wave: "saw", f0: f, hold, vol: 0.05 * v, attack: 0.3, release: 0.4, lp: [1500, 1500] },
    { wave: "saw", f0: f * 1.007, hold, vol: 0.05 * v, attack: 0.3, release: 0.4, lp: [1500, 1500] },
  ],
  bell: (f, hold, v) => [
    { wave: "sine", f0: f, hold: Math.min(hold, 0.9), vol: 0.16 * v, attack: 0.002, decay: 0.4, release: 0.1 },
    { wave: "sine", f0: f * 2.01, hold: Math.min(hold, 0.5), vol: 0.06 * v, attack: 0.002, decay: 0.2, release: 0.06 },
    { wave: "sine", f0: f * 3.98, hold: Math.min(hold, 0.25), vol: 0.025 * v, attack: 0.002, decay: 0.08, release: 0.04 },
  ],
};

const DRUMS: Record<string, (vel: number) => TimedTone[]> = {
  k: (v) => [
    { wave: "sine", f0: 150, f1: 42, hold: 0.13, decay: 0.07, vol: 0.7 * v, release: 0.02 },
    { wave: "noise", lp: [3000, 400], hold: 0.012, decay: 0.006, vol: 0.12 * v },
  ],
  s: (v) => [
    { wave: "noise", lp: [9000, 2500], hold: 0.14, decay: 0.05, vol: 0.32 * v, release: 0.03 },
    { wave: "triangle", f0: 220, f1: 130, hold: 0.07, decay: 0.03, vol: 0.28 * v },
  ],
  h: (v) => [{ wave: "noise", hp: 7000, hold: 0.03, decay: 0.012, vol: 0.2 * v, release: 0.01 }],
  o: (v) => [{ wave: "noise", hp: 6000, hold: 0.16, decay: 0.07, vol: 0.18 * v, release: 0.04 }],
  c: (v) => [
    { wave: "noise", hp: 900, lp: [6000, 3000], hold: 0.1, decay: 0.045, vol: 0.3 * v, release: 0.03 },
    { wave: "noise", hp: 900, lp: [6000, 3000], at: 0.012, hold: 0.1, decay: 0.045, vol: 0.2 * v, release: 0.03 },
  ],
};

function drumHit(name: string, vel: number): TimedTone[] {
  const make = DRUMS[name];
  if (!make) throw new Error(`Unknown drum "${name}"`);
  return make(vel);
}

interface NoteEvent {
  /** Start position in sixteenth-note steps. */
  step: number;
  /** Length in steps. */
  length: number;
  token: string;
}

function parseBar(bar: string): string[] {
  const tokens = bar.trim().split(/\s+/);
  if (!LEGAL_TOKEN_COUNTS.includes(tokens.length)) {
    throw new Error(`A bar needs 1, 2, 4, 8 or 16 tokens, got ${tokens.length}: "${bar}"`);
  }
  return tokens;
}

function channelEvents(channel: ChannelDef, bars: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  let open: NoteEvent | null = null;
  for (let b = 0; b < bars; b++) {
    const tokens = parseBar(channel.bars[b % channel.bars.length]);
    const span = STEPS_PER_BAR / tokens.length;
    tokens.forEach((token, i) => {
      const step = b * STEPS_PER_BAR + i * span;
      if (token === "-") {
        if (open) open.length += span;
      } else if (token === ".") {
        open = null;
      } else {
        open = { step, length: span, token };
        events.push(open);
      }
    });
  }
  return events;
}

/** Splits "C4!" into pitch name and velocity. */
function readNote(part: string): { name: string; vel: number } {
  if (part.endsWith("!")) return { name: part.slice(0, -1), vel: 1.3 };
  if (part.endsWith("'")) return { name: part.slice(0, -1), vel: 0.6 };
  return { name: part, vel: 1 };
}

/**
 * Music repeats the same notes constantly, so each distinct note is rendered
 * once and copied to every place it is played.
 */
function cachedTone(cache: Map<string, Float32Array>, spec: TimedTone, rng: Rng): Float32Array {
  const key = JSON.stringify(spec);
  let tone = cache.get(key);
  if (!tone) {
    tone = new Float32Array(Math.ceil((spec.hold + (spec.release ?? 0.01)) * SAMPLE_RATE) + 1);
    renderTone(tone, 0, spec, rng);
    cache.set(key, tone);
  }
  return tone;
}

/** Adds a rendered note into a loop buffer; a note that runs past the end continues at the start. */
function addWrapped(out: Float32Array, start: number, tone: Float32Array): void {
  let index = start % out.length;
  for (let i = 0; i < tone.length; i++) {
    out[index] += tone[i];
    if (++index === out.length) index = 0;
  }
}

/** Renders a track to one seamless loop of mono samples. */
export function renderTrack(def: TrackDef): Float32Array {
  const bars = Math.max(...def.channels.map((c) => c.bars.length));
  const beat = 60 / def.bpm;
  const stepSeconds = beat / 4;
  const length = Math.round(bars * STEPS_PER_BAR * stepSeconds * SAMPLE_RATE);
  const dry = new Float32Array(length);
  const send = new Float32Array(length);
  const rng = new Rng(0xc0ffee);
  const cache = new Map<string, Float32Array>();

  for (const channel of def.channels) {
    const level = channel.vol ?? 1;
    const gate = channel.gate ?? 0.92;
    const mix = new Float32Array(length);
    for (const ev of channelEvents(channel, bars)) {
      const swing = ev.step % 4 === 2 ? (def.swing ?? 0) * stepSeconds * 2 : 0;
      const start = Math.round((ev.step * stepSeconds + swing) * SAMPLE_RATE);
      const hold = ev.length * stepSeconds * gate;
      for (const part of ev.token.split("+")) {
        const { name, vel } = readNote(part);
        const specs = channel.inst === "drums" ? drumHit(name, vel * level) : INSTRUMENTS[channel.inst](noteHz(name), hold, vel * level);
        for (const spec of specs) addWrapped(mix, start + Math.round((spec.at ?? 0) * SAMPLE_RATE), cachedTone(cache, spec, rng));
      }
    }
    // an echo send still plays dry; the send is an extra copy that feeds the echo
    const amount = channel.echo ?? 0;
    for (let i = 0; i < length; i++) {
      dry[i] += mix[i];
      if (amount > 0) send[i] += mix[i] * amount;
    }
  }

  const out = dry;
  if (def.echo) {
    const delay = Math.round(def.echo.beats * beat * SAMPLE_RATE);
    // feed the sends around the loop a few times so the echo tail wraps over the seam
    const wet = new Float32Array(length);
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < length; i++) {
        const j = (i - delay + length) % length;
        wet[i] = send[j] + def.echo.feedback * wet[j];
      }
    }
    for (let i = 0; i < length; i++) out[i] += wet[i];
  }

  softClip(out);
  const peak = peakOf(out);
  if (peak > 0) for (let i = 0; i < length; i++) out[i] *= PEAK / peak;
  return out;
}
