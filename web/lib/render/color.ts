export type Rgb = [number, number, number];

export function rgbToHex([r, g, b]: Rgb): string {
  const h = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  let s = m[1];
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

export function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const dist2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export interface Cluster {
  color: Rgb;
  count: number;
}

/**
 * Small deterministic k-means over RGBA pixels (already downsampled by the caller).
 * Transparent pixels are ignored. Returns clusters sorted by population, biggest first.
 */
export function kmeans(rgba: ArrayLike<number>, k = 3, iterations = 12): Cluster[] {
  const px: Rgb[] = [];
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    px.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  if (px.length === 0) return [];

  // Deterministic farthest-point seeding, starting from the pixel nearest the mean.
  const mean: Rgb = [0, 0, 0];
  for (const p of px) {
    mean[0] += p[0];
    mean[1] += p[1];
    mean[2] += p[2];
  }
  mean[0] /= px.length;
  mean[1] /= px.length;
  mean[2] /= px.length;
  let first = px[0];
  let best = Infinity;
  for (const p of px) {
    const d = dist2(p, mean);
    if (d < best) {
      best = d;
      first = p;
    }
  }
  const centers: Rgb[] = [[...first] as Rgb];
  const minD = px.map((p) => dist2(p, first));
  while (centers.length < k) {
    let idx = 0;
    let far = -1;
    for (let i = 0; i < px.length; i++) {
      if (minD[i] > far) {
        far = minD[i];
        idx = i;
      }
    }
    if (far <= 0) break;
    const c = [...px[idx]] as Rgb;
    centers.push(c);
    for (let i = 0; i < px.length; i++) minD[i] = Math.min(minD[i], dist2(px[i], c));
  }

  const assign = new Int32Array(px.length);
  const counts = new Array<number>(centers.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts.fill(0);
    for (let i = 0; i < px.length; i++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(px[i], centers[c]);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      assign[i] = bi;
      sums[bi][0] += px[i][0];
      sums[bi][1] += px[i][1];
      sums[bi][2] += px[i][2];
      counts[bi]++;
    }
    let moved = false;
    for (let c = 0; c < centers.length; c++) {
      if (counts[c] === 0) continue;
      const n: Rgb = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]];
      if (dist2(n, centers[c]) > 0.5) moved = true;
      centers[c] = n;
    }
    if (!moved) break;
  }

  return centers
    .map((color, i) => ({ color, count: counts[i] }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Nudge a colour so it makes a pleasant gradient stop: a bit livelier, never black or white. */
export function vibrant(rgb: Rgb): Rgb {
  const [h, s, l] = rgbToHsl(rgb);
  const s2 = s < 0.08 ? s : Math.min(0.85, Math.max(0.3, s * 1.15));
  const l2 = Math.min(0.78, Math.max(0.28, l));
  return hslToRgb([h, s2, l2]);
}

/**
 * Pick 2 or 3 gradient stops that echo the screenshot.
 * Falls back to a hue-shifted partner when the screenshot is essentially one colour.
 */
export function autoStops(clusters: Cluster[]): string[] {
  const total = clusters.reduce((n, c) => n + c.count, 0);
  if (total === 0) return ["#2dd4bf", "#8b5cf6", "#fb7185"];

  const chosen: Rgb[] = [];
  for (const c of clusters) {
    if (c.count / total < 0.02) continue;
    if (chosen.every((o) => dist2(o, c.color) > 40 * 40)) chosen.push(c.color);
    if (chosen.length === 3) break;
  }
  if (chosen.length === 0) chosen.push(clusters[0].color);

  const stops = chosen.map(vibrant);
  if (stops.length === 1) {
    const [h, s, l] = rgbToHsl(stops[0]);
    stops.push(hslToRgb([h + 35, Math.max(s, 0.35), Math.min(0.8, l + 0.12)]));
  }
  return stops.map(rgbToHex);
}

export function extractAutoStops(rgba: ArrayLike<number>): string[] {
  return autoStops(kmeans(rgba, 3));
}
