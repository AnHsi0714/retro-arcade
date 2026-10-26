/**
 * Renders every sound effect and music track to WAV files so they can be
 * auditioned in any media player, and prints a few level checks.
 *
 *   npm run audio:export        (writes to audio-preview/, which is git-ignored)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderTrack } from "../src/audio/music";
import { renderSfx, SFX, type SoundName } from "../src/audio/sfx";
import { peakOf, SAMPLE_RATE } from "../src/audio/synth";
import { TRACKS, type MusicName } from "../src/audio/tracks";

const OUT = "audio-preview";

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function rms(buf: Float32Array): number {
  let sum = 0;
  for (const s of buf) sum += s * s;
  return Math.sqrt(sum / buf.length);
}

const db = (v: number) => (20 * Math.log10(Math.max(v, 1e-9))).toFixed(1).padStart(6);

mkdirSync(`${OUT}/sfx`, { recursive: true });
mkdirSync(`${OUT}/music`, { recursive: true });

console.log("sfx          length   peak dB   rms dB");
for (const name of Object.keys(SFX) as SoundName[]) {
  const buf = renderSfx(name);
  writeFileSync(`${OUT}/sfx/${name}.wav`, wav(buf));
  console.log(`${name.padEnd(12)} ${(buf.length / SAMPLE_RATE).toFixed(2).padStart(5)}s  ${db(peakOf(buf))}   ${db(rms(buf))}`);
}

console.log("\nmusic        length   peak dB   rms dB   render ms   loop jump");
for (const name of Object.keys(TRACKS) as MusicName[]) {
  const t0 = performance.now();
  const buf = renderTrack(TRACKS[name]);
  const ms = performance.now() - t0;
  writeFileSync(`${OUT}/music/${name}.wav`, wav(buf));
  // how far the signal jumps where the loop restarts, compared with its normal step to step change
  let maxStep = 0;
  for (let i = 1; i < buf.length; i++) maxStep = Math.max(maxStep, Math.abs(buf[i] - buf[i - 1]));
  const seam = Math.abs(buf[0] - buf[buf.length - 1]);
  console.log(
    `${name.padEnd(12)} ${(buf.length / SAMPLE_RATE).toFixed(1).padStart(5)}s  ${db(peakOf(buf))}   ${db(rms(buf))}   ${ms.toFixed(0).padStart(7)}     ${(seam / maxStep).toFixed(2)}x max step`,
  );
}
