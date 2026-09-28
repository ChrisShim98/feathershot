import type { ResolvedGradient } from "./types";

export interface GradientPreset {
  id: string;
  name: string;
  stops: string[];
  angle: number;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: "plumage", name: "Plumage", stops: ["#2dd4bf", "#8b5cf6", "#fb7185"], angle: 135 },
  { id: "kingfisher", name: "Kingfisher", stops: ["#0ea5e9", "#06b6d4", "#f97316"], angle: 140 },
  { id: "flamingo", name: "Flamingo", stops: ["#fda4af", "#f472b6", "#fb923c"], angle: 135 },
  { id: "bluejay", name: "Bluejay", stops: ["#1d4ed8", "#60a5fa", "#e0f2fe"], angle: 150 },
  { id: "canary", name: "Canary", stops: ["#fde047", "#facc15", "#fef3c7"], angle: 130 },
  { id: "robin", name: "Robin", stops: ["#7c2d12", "#ea580c", "#fdba74"], angle: 145 },
  { id: "peacock", name: "Peacock", stops: ["#0f766e", "#1d4ed8", "#7c3aed"], angle: 135 },
  { id: "dove", name: "Dove", stops: ["#f8fafc", "#cbd5e1", "#94a3b8"], angle: 135 },
  { id: "hummingbird", name: "Hummingbird", stops: ["#16a34a", "#14b8a6", "#db2777"], angle: 120 },
  { id: "oriole", name: "Oriole", stops: ["#f59e0b", "#ea580c", "#1f2937"], angle: 135 },
  { id: "parrot", name: "Parrot", stops: ["#ef4444", "#facc15", "#22c55e"], angle: 125 },
  { id: "owl", name: "Owl", stops: ["#44342a", "#a16207", "#d6d3d1"], angle: 145 },
];

export function findGradient(id: string): GradientPreset {
  return GRADIENT_PRESETS.find((g) => g.id === id) ?? GRADIENT_PRESETS[0];
}

export function resolvePreset(id: string): ResolvedGradient {
  const g = findGradient(id);
  return { kind: "gradient", stops: g.stops, angle: g.angle };
}

export function cssGradient(stops: string[], angle: number): string {
  return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
}

export function gradientLine(w: number, h: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return { x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half };
}
