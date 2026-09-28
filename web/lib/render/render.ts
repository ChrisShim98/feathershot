import { gradientLine } from "./gradients";
import { computeLayout } from "./layout";
import type { FrameKind, Layout, ResolvedBackground, ShadowLevel, Style } from "./types";

export const SHADOW_PARAMS: Record<ShadowLevel, { blur: number; y: number; alpha: number }> = {
  none: { blur: 0, y: 0, alpha: 0 },
  soft: { blur: 28, y: 10, alpha: 0.2 },
  medium: { blur: 48, y: 18, alpha: 0.32 },
  strong: { blur: 76, y: 30, alpha: 0.46 },
};
export const SHADOW_ORDER: ShadowLevel[] = ["none", "soft", "medium", "strong"];

export function shadowAt(level: number) {
  const l = Math.min(3, Math.max(0, level));
  const i = Math.min(2, Math.floor(l));
  const t = l - i;
  const a = SHADOW_PARAMS[SHADOW_ORDER[i]];
  const b = SHADOW_PARAMS[SHADOW_ORDER[i + 1]];
  return { blur: a.blur + (b.blur - a.blur) * t, y: a.y + (b.y - a.y) * t, alpha: a.alpha + (b.alpha - a.alpha) * t };
}

export interface Animated {
  padding: number;
  radius: number;
  shadow: number;
}

export interface DrawInput {
  source: CanvasImageSource;
  srcW: number;
  srcH: number;
  style: Style;
  anim: Animated;
  bg: ResolvedBackground;
  prevBg?: ResolvedBackground;
  bgT?: number;
  bloom?: boolean;
  lift?: number;
  opaque?: boolean;
}

export function layoutFor(input: Pick<DrawInput, "srcW" | "srcH" | "style" | "anim">): Layout {
  return computeLayout(input.srcW, input.srcH, { ...input.style, padding: input.anim.padding });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: ResolvedBackground) {
  switch (bg.kind) {
    case "transparent":
      return;
    case "solid":
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, w, h);
      return;
    case "gradient": {
      const { x0, y0, x1, y1 } = gradientLine(w, h, bg.angle);
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      const n = bg.stops.length;
      bg.stops.forEach((c, i) => g.addColorStop(n === 1 ? 0 : i / (n - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      return;
    }
    case "image": {
      const s = Math.max(w / bg.w, h / bg.h);
      const dw = bg.w * s;
      const dh = bg.h * s;
      ctx.drawImage(bg.img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return;
    }
  }
}

interface FramePalette {
  bar: string;
  dot: [string, string, string];
  pill: string;
  line: string;
}
const FRAME_PALETTES: Record<Exclude<FrameKind, "none">, FramePalette> = {
  "browser-light": { bar: "#f4f1ec", dot: ["#f2a7a0", "#f3d28b", "#a9d6a0"], pill: "#e6e1d9", line: "rgba(0,0,0,0.08)" },
  "browser-dark": { bar: "#26262b", dot: ["#c97d78", "#c9a962", "#7fae78"], pill: "#38383f", line: "rgba(255,255,255,0.08)" },
  "app-light": { bar: "#faf8f5", dot: ["#d9d3ca", "#d9d3ca", "#d9d3ca"], pill: "#e9e4dc", line: "rgba(0,0,0,0.07)" },
  "app-dark": { bar: "#1d1d21", dot: ["#4a4a52", "#4a4a52", "#4a4a52"], pill: "#33333a", line: "rgba(255,255,255,0.07)" },
};

function drawFrameBar(ctx: CanvasRenderingContext2D, kind: Exclude<FrameKind, "none">, x: number, y: number, w: number, h: number) {
  const p = FRAME_PALETTES[kind];
  ctx.fillStyle = p.bar;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = p.line;
  ctx.fillRect(x, y + h - 1, w, 1);
  const cy = y + h / 2;
  const dot = h * 0.16;
  if (kind.startsWith("browser")) {
    p.dot.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + h * 0.55 + i * dot * 3, cy, dot, 0, Math.PI * 2);
      ctx.fill();
    });
    const pw = Math.min(w * 0.5, h * 9);
    ctx.fillStyle = p.pill;
    roundRectPath(ctx, x + (w - pw) / 2, cy - h * 0.2, pw, h * 0.4, h * 0.2);
    ctx.fill();
  } else {
    ctx.fillStyle = p.dot[0];
    roundRectPath(ctx, x + h * 0.4, cy - h * 0.18, h * 0.36, h * 0.36, h * 0.09);
    ctx.fill();
    const pw = Math.min(w * 0.3, h * 6);
    ctx.fillStyle = p.pill;
    roundRectPath(ctx, x + (w - pw) / 2, cy - h * 0.13, pw, h * 0.26, h * 0.13);
    ctx.fill();
    ctx.fillStyle = p.dot[1];
    for (let i = 0; i < 3; i++) {
      roundRectPath(ctx, x + w - h * 0.4 - (3 - i) * h * 0.42, cy - h * 0.04, h * 0.28, h * 0.08, h * 0.04);
      ctx.fill();
    }
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, input: DrawInput, scale: number): Layout {
  const layout = layoutFor(input);
  const { canvasW, canvasH } = layout;
  const { style, anim } = input;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, Math.ceil(canvasW * scale), Math.ceil(canvasH * scale));
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (input.opaque) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  const t = input.bgT ?? 1;
  if (input.prevBg && t < 1) {
    paintBackground(ctx, canvasW, canvasH, input.prevBg);
    ctx.save();
    if (input.bloom) {
      const maxR = Math.hypot(canvasW, canvasH) / 2;
      ctx.beginPath();
      ctx.arc(canvasW / 2, canvasH / 2, maxR * t, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.globalAlpha = t;
    }
    paintBackground(ctx, canvasW, canvasH, input.bg);
    ctx.restore();
  } else {
    paintBackground(ctx, canvasW, canvasH, input.bg);
  }

  const lift = input.lift ?? 0;
  ctx.save();
  if (lift > 0) {
    const s = 1 + 0.02 * lift;
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  }

  const r = anim.radius * layout.contentScale;
  const { boxX: bx, boxY: by, boxW: bw, boxH: bh, barH } = layout;

  const sh = shadowAt(anim.shadow);
  const sAlpha = Math.min(0.7, sh.alpha * (1 + 0.35 * lift));
  if (sAlpha > 0.001) {
    const layers = [
      { blur: sh.blur, y: sh.y, a: sAlpha },
      { blur: sh.blur * 0.3, y: sh.y * 0.3, a: sAlpha * 0.6 },
    ];
    for (const l of layers) {
      ctx.save();
      ctx.shadowColor = `rgba(15, 12, 30, ${l.a})`;
      ctx.shadowBlur = l.blur * scale;
      ctx.shadowOffsetY = l.y * scale;
      ctx.fillStyle = "#000";
      roundRectPath(ctx, bx, by, bw, bh, r);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  roundRectPath(ctx, bx, by, bw, bh, r);
  ctx.clip();
  ctx.fillStyle = "#fff";
  ctx.fillRect(bx, by, bw, bh);
  ctx.drawImage(input.source, layout.imgX, layout.imgY, layout.imgW, layout.imgH);
  if (barH > 0 && style.frame !== "none") drawFrameBar(ctx, style.frame, bx, by, bw, barH);
  ctx.restore();
  ctx.restore();

  if (style.watermark.trim()) {
    const size = Math.min(40, Math.max(12, canvasH * 0.022));
    ctx.font = `700 ${size}px "Nunito Variable", "Segoe UI", sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 4 * scale;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const m = size * 0.9;
    ctx.fillText(style.watermark.trim(), canvasW - m, canvasH - m * 0.7);
  }

  ctx.restore();
  return layout;
}

export async function renderToBlob(input: DrawInput, scale: number, type: "image/png" | "image/jpeg"): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.load('700 16px "Nunito Variable"');
    } catch {}
  }
  const layout = layoutFor(input);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(layout.canvasW * scale));
  canvas.height = Math.max(1, Math.round(layout.canvasH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  drawScene(ctx, { ...input, bgT: 1, prevBg: undefined, lift: 0, opaque: type === "image/jpeg" }, scale);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), type, type === "image/jpeg" ? 0.92 : undefined),
  );
}
