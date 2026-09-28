import { describe, expect, it } from "vitest";
import { autoStops, extractAutoStops, hexToRgb, kmeans, rgbToHex } from "./color";
import { GRADIENT_PRESETS, gradientLine } from "./gradients";
import { computeLayout, exportScale, frameBarHeight } from "./layout";
import { addPreset, MAX_PRESETS, normalizePresets, normalizeStyle, persistable, removePreset, renamePreset } from "./presets";
import { boxBlur, fillRect, pixelate, stampBrush, stampHighlight, type PixelBuf } from "./redact";
import { shadowAt } from "./render";
import { DEFAULT_STYLE } from "./types";

const base = { padding: 50, frame: "none" as const, canvas: "auto" as const, customW: 1000, customH: 500, align: "c" as const };

describe("layout", () => {
  it("auto canvas is content plus padding on every side", () => {
    const l = computeLayout(800, 600, base);
    expect([l.canvasW, l.canvasH]).toEqual([900, 700]);
    expect([l.imgX, l.imgY, l.imgW, l.imgH]).toEqual([50, 50, 800, 600]);
  });

  it("adds the frame bar above the screenshot", () => {
    const bar = frameBarHeight("browser-light", 800);
    const l = computeLayout(800, 600, { ...base, frame: "browser-light" });
    expect(l.barH).toBe(bar);
    expect(l.canvasH).toBe(600 + bar + 100);
    expect(l.imgY).toBe(50 + bar);
    expect(l.boxH).toBe(600 + bar);
  });

  it("expands to a fixed ratio without shrinking the content", () => {
    const sq = computeLayout(800, 600, { ...base, canvas: "square" });
    expect(sq.canvasW).toBe(sq.canvasH);
    expect(sq.boxW).toBe(800);
    expect(sq.boxX).toBe(Math.round((sq.canvasW - 800) / 2) );

    const x = computeLayout(400, 400, { ...base, canvas: "x" });
    expect(x.canvasW / x.canvasH).toBeGreaterThanOrEqual(16 / 9 - 0.01);
  });

  it("fits content into a custom canvas, never scaling up", () => {
    const l = computeLayout(2000, 1000, { ...base, canvas: "custom", customW: 1000, customH: 500 });
    expect([l.canvasW, l.canvasH]).toEqual([1000, 500]);
    expect(l.contentScale).toBeLessThan(1);
    expect(l.boxX).toBeGreaterThanOrEqual(50);
    expect(l.boxX + l.boxW).toBeLessThanOrEqual(950);
    const small = computeLayout(100, 100, { ...base, canvas: "custom", customW: 1000, customH: 500 });
    expect(small.contentScale).toBe(1);
  });

  it("pins to edges", () => {
    const tl = computeLayout(200, 200, { ...base, canvas: "custom", customW: 1000, customH: 800, align: "tl" });
    expect([tl.boxX, tl.boxY]).toEqual([50, 50]);
    const br = computeLayout(200, 200, { ...base, canvas: "custom", customW: 1000, customH: 800, align: "br" });
    expect([br.boxX + br.boxW, br.boxY + br.boxH]).toEqual([950, 750]);
  });

  it("caps export scale for huge canvases", () => {
    expect(exportScale(1000, 800)).toBe(2);
    expect(exportScale(6000, 3000)).toBeCloseTo(8192 / 6000);
  });
});

describe("gradients", () => {
  it("ships twelve bird presets with unique ids", () => {
    expect(GRADIENT_PRESETS).toHaveLength(12);
    expect(new Set(GRADIENT_PRESETS.map((g) => g.id)).size).toBe(12);
    expect(GRADIENT_PRESETS.map((g) => g.name)).toContain("Plumage");
  });
  it("gradient line spans the box for 90deg", () => {
    const g = gradientLine(200, 100, 90);
    expect(g.x0).toBeCloseTo(0);
    expect(g.x1).toBeCloseTo(200);
    expect(g.y0).toBeCloseTo(50);
  });
  it("interpolates shadow between levels", () => {
    expect(shadowAt(0).alpha).toBe(0);
    const mid = shadowAt(1.5);
    expect(mid.blur).toBeGreaterThan(shadowAt(1).blur);
    expect(mid.blur).toBeLessThan(shadowAt(2).blur);
  });
});

function solid(w: number, h: number, rgb: [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set([...rgb, 255], i * 4);
  return d;
}

describe("colour extraction", () => {
  it("round-trips hex", () => {
    expect(rgbToHex(hexToRgb("#1e90ff"))).toBe("#1e90ff");
  });
  it("finds the dominant colours, biggest first", () => {
    const d = new Uint8ClampedArray(30 * 10 * 4);
    d.set(solid(20, 10, [200, 30, 30]), 0);
    d.set(solid(10, 10, [30, 30, 200]), 20 * 10 * 4);
    const c = kmeans(d, 3);
    expect(c[0].count).toBe(200);
    expect(c[0].color[0]).toBeGreaterThan(150);
    expect(c[1].color[2]).toBeGreaterThan(150);
  });
  it("is deterministic", () => {
    const d = new Uint8ClampedArray(400);
    for (let i = 0; i < d.length; i++) d[i] = (i * 37) % 256;
    expect(extractAutoStops(d)).toEqual(extractAutoStops(d));
  });
  it("makes 2-3 stops even for a single colour, and ignores transparency", () => {
    expect(autoStops(kmeans(solid(8, 8, [40, 120, 200]), 3)).length).toBeGreaterThanOrEqual(2);
    expect(autoStops(kmeans(new Uint8ClampedArray(64), 3))).toHaveLength(3); // fully transparent -> Plumage fallback
    expect(extractAutoStops(solid(8, 8, [10, 200, 90])).length).toBeLessThanOrEqual(3);
  });
});

describe("presets", () => {
  it("caps at five and supports rename and remove", () => {
    let list: ReturnType<typeof normalizePresets> = [];
    for (let i = 0; i < MAX_PRESETS; i++) list = addPreset(list, `P${i}`, DEFAULT_STYLE, `id${i}`)!;
    expect(addPreset(list, "extra", DEFAULT_STYLE)).toBeNull();
    list = renamePreset(list, "id0", "  Renamed ");
    expect(list[0].name).toBe("Renamed");
    expect(removePreset(list, "id1")).toHaveLength(4);
  });
  it("never persists custom background images", () => {
    const s = persistable({ ...DEFAULT_STYLE, background: { kind: "image", dataUrl: "data:..." } });
    expect(s.background.kind).toBe("auto");
  });
  it("survives a JSON round trip and repairs bad data", () => {
    const s = { ...DEFAULT_STYLE, padding: 120, watermark: "@me" };
    expect(normalizeStyle(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(normalizeStyle({ padding: 9999, radius: -4 }).padding).toBe(200);
    expect(normalizeStyle({ padding: 9999, radius: -4 }).radius).toBe(0);
    expect(normalizeStyle(null)).toEqual(DEFAULT_STYLE);
    expect(normalizePresets("nope")).toEqual([]);
  });
});

describe("redaction", () => {
  const checker = (w: number, h: number): PixelBuf => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(((x + y) & 1 ? [255, 255, 255, 255] : [0, 0, 0, 255]), (y * w + x) * 4);
    return { data, width: w, height: h };
  };
  it("pixelate flattens each block to its average", () => {
    const b = checker(8, 8);
    pixelate(b, { x: 0, y: 0, w: 8, h: 8 }, 4);
    expect(new Set(Array.from({ length: 16 }, (_, i) => b.data[i * 4])).size).toBe(1);
  });
  it("blur reduces contrast and leaves pixels outside untouched", () => {
    const b = checker(16, 16);
    boxBlur(b, { x: 4, y: 4, w: 8, h: 8 }, 2);
    const inside = b.data[(8 * 16 + 8) * 4];
    expect(inside).toBeGreaterThan(60);
    expect(inside).toBeLessThan(200);
    expect(b.data[0]).toBe(0);
  });
  it("box fill is opaque black", () => {
    const b = checker(4, 4);
    fillRect(b, { x: 1, y: 1, w: 2, h: 2 });
    expect(Array.from(b.data.slice((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 4))).toEqual([0, 0, 0, 255]);
  });
  it("brush only touches pixels within its circle", () => {
    const b = checker(40, 40);
    const before = Uint8ClampedArray.from(b.data);
    stampBrush(b, "pixelate", 20, 20, 6, 6);
    const mid = b.data[(20 * 40 + 20) * 4];
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(255); // averaged, no longer pure black/white
    // a corner of the bounding square is outside the circle: unchanged
    const corner = (14 * 40 + 14) * 4;
    expect(b.data[corner]).toBe(before[corner]);
  });

  it("highlight tints toward the colour without fully replacing it, and leaves the far corner alone", () => {
    const b = checker(40, 40);
    const before = Uint8ClampedArray.from(b.data);
    stampHighlight(b, 20, 20, 10, [255, 220, 0], 0.5);
    const i = (20 * 40 + 20) * 4;
    expect(b.data[i]).toBeGreaterThan(before[i]); // pulled toward yellow's high red/green...
    expect(b.data[i + 2]).toBeLessThanOrEqual(before[i + 2]); // ...and not toward its zero blue
    const corner = (2 * 40 + 2) * 4;
    expect(b.data[corner]).toBe(before[corner]);
  });

  it("highlight builds up with repeated strokes, like a real marker", () => {
    const b = checker(40, 40);
    stampHighlight(b, 20, 20, 10, [255, 220, 0], 0.5);
    const once = b.data[(20 * 40 + 20) * 4 + 1];
    stampHighlight(b, 20, 20, 10, [255, 220, 0], 0.5);
    const twice = b.data[(20 * 40 + 20) * 4 + 1];
    expect(twice).toBeGreaterThan(once);
  });
});
