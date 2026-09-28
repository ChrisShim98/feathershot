import { DEFAULT_STYLE, type Style } from "./types";

export const MAX_PRESETS = 5;

export interface NamedPreset {
  id: string;
  name: string;
  style: Style;
}

export function persistable(style: Style): Style {
  return style.background.kind === "image" ? { ...style, background: { kind: "auto" } } : style;
}

export function normalizeStyle(raw: unknown): Style {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STYLE };
  const r = raw as Partial<Style>;
  const num = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  return {
    ...DEFAULT_STYLE,
    ...r,
    padding: num(r.padding, 0, 200, DEFAULT_STYLE.padding),
    radius: num(r.radius, 0, 40, DEFAULT_STYLE.radius),
    customW: num(r.customW, 16, 8192, DEFAULT_STYLE.customW),
    customH: num(r.customH, 16, 8192, DEFAULT_STYLE.customH),
    background: r.background && typeof r.background === "object" && "kind" in r.background ? r.background : DEFAULT_STYLE.background,
    watermark: typeof r.watermark === "string" ? r.watermark.slice(0, 40) : "",
  };
}

export function normalizePresets(raw: unknown): NamedPreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is NamedPreset => !!p && typeof p === "object" && typeof (p as NamedPreset).id === "string")
    .slice(0, MAX_PRESETS)
    .map((p) => ({ id: p.id, name: String(p.name ?? "Preset").slice(0, 24), style: normalizeStyle(p.style) }));
}

export function addPreset(list: NamedPreset[], name: string, style: Style, id = crypto.randomUUID()): NamedPreset[] | null {
  if (list.length >= MAX_PRESETS) return null;
  const clean = name.trim().slice(0, 24) || `Preset ${list.length + 1}`;
  return [...list, { id, name: clean, style: persistable(style) }];
}

export function removePreset(list: NamedPreset[], id: string): NamedPreset[] {
  return list.filter((p) => p.id !== id);
}

export function renamePreset(list: NamedPreset[], id: string, name: string): NamedPreset[] {
  const clean = name.trim().slice(0, 24);
  if (!clean) return list;
  return list.map((p) => (p.id === id ? { ...p, name: clean } : p));
}
