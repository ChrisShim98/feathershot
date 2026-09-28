import { normalizePresets, normalizeStyle, type NamedPreset } from "./render/presets";
import type { Style } from "./render/types";

export type ThemePref = "system" | "light" | "dark";

export interface Settings {
  watchClipboard: boolean;
  watchFolder: boolean;
  openInstantly: boolean;
  autoClose: boolean;
  muted: boolean;
  volume: number;
  startWithWindows: boolean;
  lastStyle: Style | null;
  presets: NamedPreset[];
  theme: ThemePref;
}

export const DEFAULT_SETTINGS: Settings = {
  watchClipboard: true,
  watchFolder: true,
  openInstantly: true,
  autoClose: false,
  muted: false,
  volume: 0.4,
  startWithWindows: true,
  lastStyle: null,
  presets: [],
  theme: "system",
};

export interface ShellEnv {
  quiet: boolean;
  version: string;
  native: boolean;
  startupBlockedReason: string | null;
  captionInset: number;
}


export interface ShellApi {
  getPendingImage(): Promise<Blob | null>;
  copyImage(png: Blob): Promise<void>;
  saveImage(data: Blob, format: "png" | "jpg"): Promise<{ saved: boolean; path?: string }>;
  startDragOut(png: Blob): Promise<boolean>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  getEnv(): Promise<ShellEnv>;
  closeEditor(): Promise<void>;
  openSettings(about?: boolean): Promise<void>;
  openExternal(uri: string): Promise<void>;
  openWelcome(): Promise<void>;
  beginWindowDrag(): Promise<void>;
  toggleMaximize(): Promise<void>;
  setWindowTheme(dark: boolean): Promise<void>;
  onImageAvailable(cb: () => void): () => void;
}

function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const r = raw ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    lastStyle: r.lastStyle ? normalizeStyle(r.lastStyle) : null,
    presets: normalizePresets(r.presets),
    theme: r.theme === "light" || r.theme === "dark" ? r.theme : "system",
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

interface WebViewHost {
  postMessage(msg: unknown): void;
  addEventListener(type: "message", cb: (e: { data: unknown }) => void): void;
}
const webview = (): WebViewHost | undefined =>
  typeof window !== "undefined" ? (window as unknown as { chrome?: { webview?: WebViewHost } }).chrome?.webview : undefined;

function createNative(host: WebViewHost): ShellApi {
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const imageListeners = new Set<() => void>();

  host.addEventListener("message", (e) => {
    const m = e.data as { id?: number; result?: unknown; error?: string; event?: string };
    if (m.event === "imageAvailable") {
      imageListeners.forEach((cb) => cb());
      return;
    }
    if (m.id === undefined) return;
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error));
    else p.resolve(m.result);
  });

  const call = <T>(method: string, args: Record<string, unknown> = {}): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      host.postMessage({ id, method, args });
    });

  return {
    async getPendingImage() {
      const b64 = await call<string | null>("getPendingImage");
      return b64 ? base64ToBlob(b64, "image/png") : null;
    },
    async copyImage(png) {
      await call("copyImage", { png: await blobToBase64(png) });
    },
    async saveImage(data, format) {
      return call("saveImage", { data: await blobToBase64(data), format });
    },
    async startDragOut(png) {
      return call<boolean>("startDragOut", { png: await blobToBase64(png) });
    },
    async getSettings() {
      return normalizeSettings(await call<Partial<Settings>>("getSettings"));
    },
    async setSettings(patch) {
      return normalizeSettings(await call<Partial<Settings>>("setSettings", { patch }));
    },
    getEnv: () => call<ShellEnv>("getEnv"),
    closeEditor: () => call("closeEditor"),
    openSettings: (about) => call("openSettings", { about: !!about }),
    openExternal: (uri) => call("openExternal", { uri }),
    openWelcome: () => call("openWelcome"),
    beginWindowDrag: () => call("beginWindowDrag"),
    toggleMaximize: () => call("toggleMaximize"),
    setWindowTheme: (dark) => call("setWindowTheme", { dark }),
    onImageAvailable(cb) {
      imageListeners.add(cb);
      return () => imageListeners.delete(cb);
    },
  };
}

function createMock(): ShellApi {
  const KEY = "feathershot.mock.settings";
  const load = (): Settings => {
    try {
      return normalizeSettings(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  };
  const download = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  return {
    async getPendingImage() {
      return null;
    },
    async copyImage(png) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    },
    async saveImage(data, format) {
      download(data, `feathershot.${format}`);
      return { saved: true };
    },
    async startDragOut() {
      return false;
    },
    async getSettings() {
      return load();
    },
    async setSettings(patch) {
      const next = normalizeSettings({ ...load(), ...patch });
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    },
    async getEnv() {
      return { quiet: false, version: "dev", native: false, startupBlockedReason: null, captionInset: 0 };
    },
    async closeEditor() {},
    async openSettings(about) {
      window.open(about ? "/settings/#about" : "/settings/", "_blank");
    },
    async openExternal(uri) {
      window.open(uri, "_blank");
    },
    async openWelcome() {
      window.open("/welcome/", "_blank");
    },
    async beginWindowDrag() {},
    async toggleMaximize() {},
    async setWindowTheme() {},
    onImageAvailable() {
      return () => {};
    },
  };
}

let instance: ShellApi | null = null;
export function getShell(): ShellApi {
  if (instance) return instance;
  const host = webview();
  instance = host ? createNative(host) : createMock();
  return instance;
}
