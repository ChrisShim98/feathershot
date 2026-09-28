export type ShadowLevel = "none" | "soft" | "medium" | "strong";
export type FrameKind = "none" | "browser-light" | "browser-dark" | "app-light" | "app-dark";
export type CanvasPreset = "auto" | "x" | "linkedin" | "square" | "instagram" | "custom";
export type Align = "tl" | "t" | "tr" | "l" | "c" | "r" | "bl" | "b" | "br";

export type Background =
  | { kind: "auto" }
  | { kind: "gradient"; id: string }
  | { kind: "solid"; color: string }
  | { kind: "image"; dataUrl: string }
  | { kind: "transparent" };

export interface Style {
  background: Background;
  padding: number;
  radius: number;
  shadow: ShadowLevel;
  frame: FrameKind;
  canvas: CanvasPreset;
  customW: number;
  customH: number;
  align: Align;
  watermark: string;
}

export const DEFAULT_STYLE: Style = {
  background: { kind: "auto" },
  padding: 64,
  radius: 14,
  shadow: "medium",
  frame: "none",
  canvas: "auto",
  customW: 1600,
  customH: 900,
  align: "c",
  watermark: "",
};

export interface Layout {
  canvasW: number;
  canvasH: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  barH: number;
  imgX: number;
  imgY: number;
  imgW: number;
  imgH: number;
  contentScale: number;
}

export interface ResolvedGradient {
  kind: "gradient";
  stops: string[];
  angle: number;
}
export type ResolvedBackground =
  | ResolvedGradient
  | { kind: "solid"; color: string }
  | { kind: "image"; img: CanvasImageSource; w: number; h: number }
  | { kind: "transparent" };
