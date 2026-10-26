import { renderTrack } from "../audio/music";
import { renderSfx, SFX, type SoundName } from "../audio/sfx";
import { SAMPLE_RATE } from "../audio/synth";
import { TRACKS, type MusicName } from "../audio/tracks";
import { getFlag, getNumber, setFlag, setNumber } from "./storage";

export type { MusicName, SoundName };

const MUTE_KEY = "muted";
const VOLUME_KEY = "volume";
export const MAX_VOLUME = 10;
const DEFAULT_VOLUME = 7;

/** Music sits well under the effects so shots and pickups stay easy to hear. */
const MUSIC_LEVEL = 0.3;
/** Music level while the game is paused. */
const MUSIC_DUCKED = 0.09;
const MUSIC_FADE_IN = 0.15;
const MUSIC_FADE_OUT = 0.25;

interface PlayingMusic {
  name: MusicName;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Plays sound effects and looping music. Everything is synthesized by code in
 * src/audio/ and rendered to sample buffers up front (prepare()), so there are
 * no audio files to load or license.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  /** Rendered samples, kept until an AudioBuffer exists for them. */
  private sfxSamples = new Map<SoundName, Float32Array>();
  private trackSamples = new Map<MusicName, Float32Array>();
  private sfxBuffers = new Map<SoundName, AudioBuffer>();
  private trackBuffers = new Map<MusicName, AudioBuffer>();
  private music: PlayingMusic | null = null;
  /** The track the scene asked for, started as soon as the browser allows audio. */
  private wanted: MusicName | null = null;
  private ducked = false;
  private _muted = getFlag(MUTE_KEY);
  private _volume = Math.round(Math.min(MAX_VOLUME, Math.max(0, getNumber(VOLUME_KEY, DEFAULT_VOLUME))));

  get muted(): boolean {
    return this._muted;
  }

  /** Volume step from 0 to MAX_VOLUME, independent of mute. */
  get volume(): number {
    return this._volume;
  }

  /** Changes the volume by `delta` steps; also unmutes so the change is audible. */
  changeVolume(delta: number): number {
    this._volume = Math.min(MAX_VOLUME, Math.max(0, this._volume + delta));
    setNumber(VOLUME_KEY, this._volume);
    if (this._muted) {
      this._muted = false;
      setFlag(MUTE_KEY, false);
    }
    this.applyGain();
    return this._volume;
  }

  /**
   * Renders every effect and track. Needs no audio context, so it runs while
   * the loading screen is up; it yields between tracks to keep that screen moving.
   */
  async prepare(): Promise<void> {
    for (const name of Object.keys(SFX) as SoundName[]) this.sfx(name);
    for (const name of Object.keys(TRACKS) as MusicName[]) {
      await nextTask();
      this.track(name);
    }
  }

  /** Browsers only allow audio after a user gesture; call this from one. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.gain();
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.ducked ? MUSIC_DUCKED : MUSIC_LEVEL;
      this.musicBus.connect(this.master);
      // no sound from a hidden tab
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) void ctx.suspend();
        else void ctx.resume();
      });
      this.playMusic(this.wanted);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    setFlag(MUTE_KEY, this._muted);
    this.applyGain();
    return this._muted;
  }

  /** Squared so each step sounds roughly equally louder. */
  private gain(): number {
    return this._muted ? 0 : (this._volume / MAX_VOLUME) ** 2;
  }

  private applyGain(): void {
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this.gain(), this.ctx.currentTime);
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || this._muted || this._volume === 0) return;
    let buffer = this.sfxBuffers.get(name);
    if (!buffer) {
      buffer = this.toBuffer(this.sfx(name));
      this.sfxBuffers.set(name, buffer);
      this.sfxSamples.delete(name);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(bus);
    src.start();
  }

  /** Switches the looping background music; null stops it. Safe to call before audio is unlocked. */
  playMusic(name: MusicName | null): void {
    this.wanted = name;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    if (this.music?.name === name) return;
    this.stopMusic();
    if (!name) return;

    let buffer = this.trackBuffers.get(name);
    if (!buffer) {
      buffer = this.toBuffer(this.track(name));
      this.trackBuffers.set(name, buffer);
      this.trackSamples.delete(name);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + MUSIC_FADE_IN);
    source.connect(gain);
    gain.connect(this.musicBus);
    source.start();
    this.music = { name, source, gain };
  }

  /** Turns the music down (paused) or back up; the effects are not affected. */
  duckMusic(ducked: boolean): void {
    this.ducked = ducked;
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(ducked ? MUSIC_DUCKED : MUSIC_LEVEL, this.ctx.currentTime, 0.05);
    }
  }

  private stopMusic(): void {
    const ctx = this.ctx;
    const playing = this.music;
    this.music = null;
    if (!ctx || !playing) return;
    const t = ctx.currentTime;
    playing.gain.gain.cancelScheduledValues(t);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, t);
    playing.gain.gain.linearRampToValueAtTime(0, t + MUSIC_FADE_OUT);
    playing.source.stop(t + MUSIC_FADE_OUT + 0.05);
    playing.source.onended = () => {
      playing.source.disconnect();
      playing.gain.disconnect();
    };
  }

  private sfx(name: SoundName): Float32Array {
    let samples = this.sfxSamples.get(name);
    if (!samples) {
      samples = renderSfx(name);
      this.sfxSamples.set(name, samples);
    }
    return samples;
  }

  private track(name: MusicName): Float32Array {
    let samples = this.trackSamples.get(name);
    if (!samples) {
      samples = renderTrack(TRACKS[name]);
      this.trackSamples.set(name, samples);
    }
    return samples;
  }

  private toBuffer(samples: Float32Array): AudioBuffer {
    const buffer = this.ctx!.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }
}
