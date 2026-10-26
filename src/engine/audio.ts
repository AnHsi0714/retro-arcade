import { getFlag, setFlag } from "./storage";

/**
 * Placeholder synthesized sound. Stage 9 replaces these with recorded files via
 * AudioManager.load(); any name without a loaded file falls back to its synth.
 */
export interface SynthDef {
  wave: OscillatorType | "noise";
  /** Start frequency (Hz). Ignored for noise. */
  from: number;
  /** End frequency (Hz), swept exponentially. Ignored for noise. */
  to: number;
  duration: number;
  volume?: number;
}

export const SOUNDS = {
  select: { wave: "square", from: 660, to: 660, duration: 0.05, volume: 0.25 },
  confirm: { wave: "square", from: 440, to: 880, duration: 0.12, volume: 0.25 },
  back: { wave: "square", from: 660, to: 330, duration: 0.1, volume: 0.25 },
  pause: { wave: "triangle", from: 520, to: 260, duration: 0.15, volume: 0.3 },
  step: { wave: "triangle", from: 180, to: 140, duration: 0.03, volume: 0.15 },
  eat: { wave: "square", from: 500, to: 900, duration: 0.06, volume: 0.2 },
  powerup: { wave: "square", from: 300, to: 1200, duration: 0.3, volume: 0.25 },
  shoot: { wave: "square", from: 900, to: 200, duration: 0.08, volume: 0.15 },
  enemyShoot: { wave: "sawtooth", from: 400, to: 150, duration: 0.1, volume: 0.1 },
  bounce: { wave: "square", from: 300, to: 300, duration: 0.03, volume: 0.2 },
  hit: { wave: "square", from: 220, to: 110, duration: 0.06, volume: 0.25 },
  explode: { wave: "noise", from: 0, to: 0, duration: 0.3, volume: 0.35 },
  bigExplode: { wave: "noise", from: 0, to: 0, duration: 0.7, volume: 0.45 },
  die: { wave: "sawtooth", from: 600, to: 60, duration: 0.6, volume: 0.3 },
  levelUp: { wave: "triangle", from: 400, to: 1600, duration: 0.5, volume: 0.3 },
  gameOver: { wave: "triangle", from: 440, to: 80, duration: 1.0, volume: 0.35 },
  trap: { wave: "triangle", from: 200, to: 600, duration: 0.15, volume: 0.25 },
} satisfies Record<string, SynthDef>;

export type SoundName = keyof typeof SOUNDS;

const MUTE_KEY = "muted";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pendingLoads: Array<[SoundName, string]> = [];
  private _muted = getFlag(MUTE_KEY);

  get muted(): boolean {
    return this._muted;
  }

  /** Browsers only allow audio after a user gesture; call this from one. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
      for (const [name, url] of this.pendingLoads) void this.load(name, url);
      this.pendingLoads = [];
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Registers a sound file that overrides the synth with the same name. */
  async load(name: SoundName, url: string): Promise<void> {
    if (!this.ctx) {
      this.pendingLoads.push([name, url]);
      return;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load sound ${url}: ${res.status}`);
    this.buffers.set(name, await this.ctx.decodeAudioData(await res.arrayBuffer()));
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    setFlag(MUTE_KEY, this._muted);
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this._muted ? 0 : 1, this.ctx.currentTime);
    return this._muted;
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this._muted) return;

    const buffer = this.buffers.get(name);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(master);
      src.start();
      return;
    }

    const def: SynthDef = SOUNDS[name];
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(def.volume ?? 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + def.duration);
    gain.connect(master);

    let src: AudioScheduledSourceNode;
    if (def.wave === "noise") {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      src = s;
    } else {
      const osc = ctx.createOscillator();
      osc.type = def.wave;
      osc.frequency.setValueAtTime(def.from, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, def.to), t + def.duration);
      src = osc;
    }
    src.connect(gain);
    src.start(t);
    src.stop(t + def.duration);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
