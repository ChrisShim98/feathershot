// Rasterizes the Feathershot bird (original artwork) into the tray .ico and the MSIX tile assets.
// Pure Node, no dependencies: shapes are supersampled and encoded with zlib. Run: npm run gen-icons
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "shell", "Assets");
mkdirSync(assets, { recursive: true });

// ---- bird geometry, 100x100 design grid (mirrors web/components/Bird.tsx) ----
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const cubic = (p0, p1, p2, p3, n = 20) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
  });
const feather = [
  ...cubic([26, 48], [10, 42], [5, 26], [12, 10]),
  ...cubic([12, 10], [25, 18], [30, 34], [26, 48]),
];
const shapes = [
  { poly: feather, color: hex("#fb7185"), a: 1 },
  { seg: [42, 84, 42, 90], r: 1.6, color: hex("#fb923c"), a: 1 },
  { seg: [56, 84, 56, 90], r: 1.6, color: hex("#fb923c"), a: 1 },
  { ell: [48, 56, 30, 30], grad: [hex("#2dd4bf"), hex("#7c6cf0")], a: 1 },
  { ell: [46, 67, 19, 15], color: hex("#fff7ed"), a: 1 },
  { ell: [34, 58, 11, 7], rot: -25, color: hex("#8b5cf6"), a: 0.85 },
  { poly: [[74, 50], [90, 55], [74, 60]], color: hex("#fb923c"), a: 1 },
  { ell: [58, 46, 4.6, 4.6], color: hex("#1f1b2e"), a: 1 },
  { ell: [59.6, 44.4, 1.4, 1.4], color: [255, 255, 255], a: 1 },
  { ell: [64, 55, 4, 4], color: hex("#fb7185"), a: 0.45 },
];

function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function hit(s, x, y) {
  if (s.poly) return inPoly(s.poly, x, y);
  if (s.seg) {
    const [x0, y0, x1, y1] = s.seg;
    const dx = x1 - x0, dy = y1 - y0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)) <= s.r;
  }
  let [cx, cy, rx, ry] = s.ell;
  let px = x - cx, py = y - cy;
  if (s.rot) {
    const a = (-s.rot * Math.PI) / 180;
    [px, py] = [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];
  }
  return (px / rx) ** 2 + (py / ry) ** 2 <= 1;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Plumage gradient (teal -> violet -> coral, 135deg) at normalised (u, v). */
function plumage(u, v) {
  const t = (u + v) / 2;
  const [a, b, c] = [hex("#2dd4bf"), hex("#8b5cf6"), hex("#fb7185")];
  return t < 0.55 ? mix(a, b, t / 0.55) : mix(b, c, (t - 0.55) / 0.45);
}

/**
 * Renders a w x h image. `bg`: true fills with Plumage. `scale` is the bird's height as a fraction of h.
 */
function render(w, h, { bg, scale, rounded = 0 }) {
  const px = Buffer.alloc(w * h * 4);
  const size = h * scale;
  const ox = (w - size) / 2, oy = (h - size) / 2 + (bg ? h * 0.02 : 0);
  // The bird's own body is teal-to-violet, which the Plumage background also passes through — wherever
  // the icon centers on that stretch of the gradient, bird-on-background contrast collapses. A soft light
  // halo behind the bird (like a subject light in a photo) guarantees separation regardless of which part
  // of the gradient lands there, without giving up the gradient look everywhere else.
  const haloCx = ox + size * 0.5, haloCy = oy + size * 0.55, haloR = size * 0.66;
  const SS = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS, fy = y + (sy + 0.5) / SS;
          let col = [0, 0, 0], alpha = 0;
          const inBg = bg && (!rounded || roundedHit(fx, fy, w, h, rounded));
          if (inBg) {
            col = plumage(fx / w, fy / h);
            alpha = 1;
            const hd = Math.hypot(fx - haloCx, fy - haloCy) / haloR;
            if (hd < 1) {
              const t = 1 - hd;
              col = mix(col, [255, 255, 255], t * t * 0.72);
            }
          }
          const bx = ((fx - ox) / size) * 100, by = ((fy - oy) / size) * 100;
          if (bx >= 0 && bx <= 100 && by >= 0 && by <= 100) {
            for (const s of shapes) {
              if (!hit(s, bx, by)) continue;
              let c = s.color;
              if (s.grad) c = mix(s.grad[0], s.grad[1], Math.max(0, Math.min(1, ((bx - 18) + (by - 26)) / 120)));
              const out = s.a + alpha * (1 - s.a);
              col = col.map((v, i) => (c[i] * s.a + v * alpha * (1 - s.a)) / out);
              alpha = out;
            }
          }
          r += col[0] * alpha; g += col[1] * alpha; b += col[2] * alpha; a += alpha;
        }
      }
      const i = (y * w + x) * 4;
      const n = SS * SS;
      if (a > 0) {
        px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a);
      }
      px[i + 3] = Math.round((a / n) * 255);
    }
  }
  return px;
}
function roundedHit(x, y, w, h, r) {
  const cx = Math.max(r, Math.min(w - r, x)), cy = Math.max(r, Math.min(h - r, y));
  return Math.hypot(x - cx, y - cy) <= r;
}

// ---- PNG / ICO encoding ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
function ico(sizes) {
  const images = sizes.map((s) => png(s, s, render(s, s, { bg: false, scale: 0.96 })));
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    head[e] = s >= 256 ? 0 : s; head[e + 1] = s >= 256 ? 0 : s;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(images[i].length, e + 8); head.writeUInt32LE(off, e + 12);
    off += images[i].length;
  });
  return Buffer.concat([head, ...images]);
}

const write = (name, w, h, opts) => {
  writeFileSync(join(assets, name), png(w, h, render(w, h, opts)));
  console.log(`  ${name} ${w}x${h}`);
};

writeFileSync(join(assets, "feathershot.ico"), ico([16, 20, 24, 32, 40, 48, 64, 256]));
console.log("  feathershot.ico");
write("StoreLogo.png", 50, 50, { bg: true, scale: 0.78, rounded: 10 });
write("Square44x44Logo.scale-200.png", 88, 88, { bg: true, scale: 0.8, rounded: 18 });
write("Square44x44Logo.targetsize-24_altform-unplated.png", 24, 24, { bg: false, scale: 0.96 });
write("Square150x150Logo.scale-200.png", 300, 300, { bg: true, scale: 0.72, rounded: 48 });
write("Wide310x150Logo.scale-200.png", 620, 300, { bg: true, scale: 0.72 });
write("SplashScreen.scale-200.png", 1240, 600, { bg: true, scale: 0.55 });
write("LockScreenLogo.scale-200.png", 48, 48, { bg: false, scale: 0.96 });

// favicon for the web app
copyFileSync(join(assets, "feathershot.ico"), join(root, "web", "app", "favicon.ico"));
console.log("Icons written to shell/Assets and web/app/favicon.ico");
