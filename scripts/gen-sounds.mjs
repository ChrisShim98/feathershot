// Synthesizes the placeholder sounds. No third-party audio, so no licensing questions.
// Replace any WAV in web/public/sounds with one of the same name to swap in a final sound.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SR = 44100;

/** Renders `ms` of audio by calling fn(t seconds, progress 0..1). */
function render(ms, fn) {
  const n = Math.round((SR * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i / n);
  return out;
}
const env = (t, attack, dur) => Math.min(1, t / attack) * Math.exp((-4 * t) / dur);
const sine = (f, t) => Math.sin(2 * Math.PI * f * t);
let seed = 1;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 31 - 1;
};

/** A bird note: sine with a fast upward glide and a touch of vibrato. */
const chirpNote = (t, start, len, f0, f1) => {
  const lt = t - start;
  if (lt < 0 || lt > len) return 0;
  const p = lt / len;
  const f = f0 + (f1 - f0) * Math.sin((p * Math.PI) / 2);
  const phase = 2 * Math.PI * (f * lt + 18 * Math.sin(2 * Math.PI * 30 * lt) * 0.01);
  return Math.sin(phase) * Math.sin(Math.PI * p) ** 0.6 * 0.8;
};

const sounds = {
  "toast.chirp": render(150, (t) => chirpNote(t, 0, 0.06, 2600, 3400) + chirpNote(t, 0.075, 0.07, 3000, 4000) * 0.9),
  "ui.tick": render(30, (t) => sine(1800, t) * env(t, 0.001, 0.02) * 0.6),
  "bg.whoosh": render(300, (t, p) => {
    // band-limited noise swelling then fading, with a rising resonant sweep
    const a = Math.sin(Math.PI * p) ** 2;
    return (noise() * 0.35 + sine(500 + 1500 * p, t) * 0.15) * a * 0.9;
  }),
  "copy.flutter": render(400, (t, p) => {
    // fast amplitude flutter (wing beats) plus a light sparkle arpeggio at the end
    const flutter = (0.5 + 0.5 * sine(28, t)) * Math.sin(Math.PI * Math.min(1, p * 1.6)) * (1 - p) * noise() * 0.35;
    const sp = [0.16, 0.22, 0.29].reduce((s, st, i) => {
      const lt = t - st;
      return lt > 0 ? s + sine(2400 + i * 700, lt) * Math.exp(-lt * 22) * 0.35 : s;
    }, 0);
    return flutter + sp;
  }),
  "save.pop": render(120, (t) => sine(520 * Math.exp(-t * 12) + 220, t) * env(t, 0.002, 0.07) * 0.8),
  "redact.swish": render(100, (t, p) => noise() * Math.sin(Math.PI * p) ** 1.5 * 0.22 * (0.6 + 0.4 * p)),
  "error.soft": render(200, (t) => (sine(330, t) * env(t, 0.004, 0.09) + (t > 0.09 ? sine(247, t - 0.09) * env(t - 0.09, 0.004, 0.1) : 0)) * 0.6),
};

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  const fade = Math.round(SR * 0.004);
  for (let i = 0; i < samples.length; i++) {
    const f = Math.min(1, i / fade, (samples.length - 1 - i) / fade);
    const v = Math.max(-1, Math.min(1, samples[i] * f));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

const webDir = join(root, "web", "public", "sounds");
const shellDir = join(root, "shell", "Assets", "sounds");
mkdirSync(webDir, { recursive: true });
mkdirSync(shellDir, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(join(webDir, `${name}.wav`), wav(samples));
  console.log(`  ${name}.wav  ${samples.length} samples`);
}
writeFileSync(join(shellDir, "toast.chirp.wav"), wav(sounds["toast.chirp"]));
console.log("Sounds written to web/public/sounds and shell/Assets/sounds");
