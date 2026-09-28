import type { Align, CanvasPreset, FrameKind, Layout, Style } from "./types";

export const CANVAS_RATIOS: Record<Exclude<CanvasPreset, "auto" | "custom">, number> = {
  x: 16 / 9,
  linkedin: 1.91,
  square: 1,
  instagram: 4 / 5,
};

export const MAX_CANVAS_SIDE = 8192;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function frameBarHeight(frame: FrameKind, imgW: number): number {
  if (frame === "none") return 0;
  return Math.round(clamp(imgW * 0.035, 30, 64));
}

export function alignFractions(align: Align): { fx: number; fy: number } {
  const fx = align === "tl" || align === "l" || align === "bl" ? 0 : align === "tr" || align === "r" || align === "br" ? 1 : 0.5;
  const fy = align === "tl" || align === "t" || align === "tr" ? 0 : align === "bl" || align === "b" || align === "br" ? 1 : 0.5;
  return { fx, fy };
}

type LayoutStyle = Pick<Style, "padding" | "frame" | "canvas" | "customW" | "customH" | "align">;

/** Pure layout maths in design pixels. Preview and export both use this. */
export function computeLayout(srcW: number, srcH: number, style: LayoutStyle): Layout {
  const pad = Math.max(0, style.padding);
  const barH0 = frameBarHeight(style.frame, srcW);
  const contentW0 = Math.max(1, srcW);
  const contentH0 = Math.max(1, srcH + barH0);

  let canvasW: number;
  let canvasH: number;
  let s = 1;

  if (style.canvas === "custom") {
    canvasW = Math.max(16, Math.round(style.customW));
    canvasH = Math.max(16, Math.round(style.customH));
    const availW = Math.max(1, canvasW - 2 * pad);
    const availH = Math.max(1, canvasH - 2 * pad);
    s = Math.min(1, availW / contentW0, availH / contentH0);
  } else {
    const baseW = contentW0 + 2 * pad;
    const baseH = contentH0 + 2 * pad;
    if (style.canvas === "auto") {
      canvasW = baseW;
      canvasH = baseH;
    } else {
      const r = CANVAS_RATIOS[style.canvas];
      if (baseW / baseH < r) {
        canvasH = baseH;
        canvasW = Math.ceil(baseH * r);
      } else {
        canvasW = baseW;
        canvasH = Math.ceil(baseW / r);
      }
    }
  }

  const boxW = Math.round(contentW0 * s);
  const boxH = Math.round(contentH0 * s);
  const barH = Math.round(barH0 * s);
  const { fx, fy } = alignFractions(style.align);
  const boxX = Math.round(pad + fx * Math.max(0, canvasW - 2 * pad - boxW));
  const boxY = Math.round(pad + fy * Math.max(0, canvasH - 2 * pad - boxH));

  return {
    canvasW,
    canvasH,
    boxX,
    boxY,
    boxW,
    boxH,
    barH,
    imgX: boxX,
    imgY: boxY + barH,
    imgW: boxW,
    imgH: boxH - barH,
    contentScale: s,
  };
}

export function exportScale(canvasW: number, canvasH: number, wanted = 2): number {
  return Math.min(wanted, MAX_CANVAS_SIDE / Math.max(canvasW, canvasH));
}
