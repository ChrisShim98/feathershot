export type SoundKey =
  | "toast.chirp"
  | "ui.tick"
  | "bg.whoosh"
  | "copy.flutter"
  | "save.pop"
  | "redact.swish"
  | "error.soft";

export const SOUNDS: Record<SoundKey, { file: string; volume: number }> = {
  "toast.chirp": { file: "toast.chirp.wav", volume: 1 },
  "ui.tick": { file: "ui.tick.wav", volume: 0.7 },
  "bg.whoosh": { file: "bg.whoosh.wav", volume: 0.8 },
  "copy.flutter": { file: "copy.flutter.wav", volume: 1 },
  "save.pop": { file: "save.pop.wav", volume: 1 },
  "redact.swish": { file: "redact.swish.wav", volume: 0.8 },
  "error.soft": { file: "error.soft.wav", volume: 1 },
};

export const MIN_GAP_MS = 100;

/** True when a sound may start now: not muted, not in Do Not Disturb, and 100 ms since the last one. */
export function canPlay(now: number, last: number, muted: boolean, quiet: boolean): boolean {
  return !muted && !quiet && now - last >= MIN_GAP_MS;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundKey, AudioBuffer>();
  private last = -Infinity;
  muted = false;
  quiet = false;
  volume = 0.4;

  async preload() {
    if (typeof window === "undefined" || this.buffers.size === SOUND_KEYS.length) return;
    try {
      this.ctx ??= new AudioContext();
      await Promise.all(
        SOUND_KEYS.map(async (key) => {
          if (this.buffers.has(key)) return;
          const res = await fetch(`/sounds/${SOUNDS[key].file}`);
          const data = await res.arrayBuffer();
          this.buffers.set(key, await this.ctx!.decodeAudioData(data));
        }),
      );
    } catch {}
  }

  play(key: SoundKey) {
    const now = performance.now();
    if (!this.ctx || !canPlay(now, this.last, this.muted, this.quiet)) return;
    const buf = this.buffers.get(key);
    if (!buf) return;
    this.last = now;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = this.volume * SOUNDS[key].volume;
    src.buffer = buf;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.buffers.clear();
  }
}

const SOUND_KEYS = Object.keys(SOUNDS) as SoundKey[];
export const sounds = new SoundEngine();
