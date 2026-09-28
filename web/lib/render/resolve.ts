import { resolvePreset } from "./gradients";
import type { Background, ResolvedBackground } from "./types";

export const FALLBACK_STOPS = ["#2dd4bf", "#8b5cf6", "#fb7185"]; // Plumage

export function resolveBackground(
  bg: Background,
  autoStops: string[] | null,
  bgImage: HTMLImageElement | null,
): ResolvedBackground {
  switch (bg.kind) {
    case "auto":
      return { kind: "gradient", stops: autoStops && autoStops.length >= 2 ? autoStops : FALLBACK_STOPS, angle: 135 };
    case "gradient":
      return resolvePreset(bg.id);
    case "solid":
      return { kind: "solid", color: bg.color };
    case "image":
      return bgImage && bgImage.naturalWidth > 0
        ? { kind: "image", img: bgImage, w: bgImage.naturalWidth, h: bgImage.naturalHeight }
        : { kind: "transparent" };
    case "transparent":
      return { kind: "transparent" };
  }
}
