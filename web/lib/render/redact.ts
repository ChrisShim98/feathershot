/** Redaction on raw pixel data. Everything here mutates RGBA bytes: nothing is a removable layer. */

export interface PixelBuf {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clampRect(r: Rect, width: number, height: number): Rect {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(width, Math.ceil(r.x + r.w));
  const y1 = Math.min(height, Math.ceil(r.y + r.h));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export function pixelate(buf: PixelBuf, rect: Rect, block: number): void {
  const { data, width, height } = buf;
  const r = clampRect(rect, width, height);
  block = Math.max(2, Math.round(block));
  for (let by = r.y; by < r.y + r.h; by += block) {
    for (let bx = r.x; bx < r.x + r.w; bx += block) {
      const x1 = Math.min(bx + block, r.x + r.w);
      const y1 = Math.min(by + block, r.y + r.h);
      let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const i = (y * width + x) * 4;
          sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; sa += data[i + 3];
          n++;
        }
      }
      if (n === 0) continue;
      const ar = sr / n, ag = sg / n, ab = sb / n, aa = sa / n;
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const i = (y * width + x) * 4;
          data[i] = ar; data[i + 1] = ag; data[i + 2] = ab; data[i + 3] = aa;
        }
      }
    }
  }
}

export function boxBlur(buf: PixelBuf, rect: Rect, radius: number): void {
  const { data, width, height } = buf;
  const r = clampRect(rect, width, height);
  radius = Math.max(1, Math.round(radius));
  if (r.w === 0 || r.h === 0) return;
  const tmp = new Float32Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const si = ((r.y + y) * width + (r.x + x)) * 4;
      const di = (y * r.w + x) * 4;
      tmp[di] = data[si]; tmp[di + 1] = data[si + 1]; tmp[di + 2] = data[si + 2]; tmp[di + 3] = data[si + 3];
    }
  }
  const line = new Float32Array(Math.max(r.w, r.h) * 4);
  const pass = (horizontal: boolean) => {
    const len = horizontal ? r.w : r.h;
    const lines = horizontal ? r.h : r.w;
    for (let l = 0; l < lines; l++) {
      const idx = (p: number) => (horizontal ? (l * r.w + p) : (p * r.w + l)) * 4;
      for (let c = 0; c < 4; c++) {
        let acc = 0;
        for (let k = -radius; k <= radius; k++) acc += tmp[idx(Math.min(len - 1, Math.max(0, k))) + c];
        const win = radius * 2 + 1;
        for (let p = 0; p < len; p++) {
          line[p * 4 + c] = acc / win;
          const add = Math.min(len - 1, p + radius + 1);
          const sub = Math.max(0, p - radius);
          acc += tmp[idx(add) + c] - tmp[idx(sub) + c];
        }
      }
      for (let p = 0; p < len; p++) {
        const i = idx(p);
        tmp[i] = line[p * 4]; tmp[i + 1] = line[p * 4 + 1]; tmp[i + 2] = line[p * 4 + 2]; tmp[i + 3] = line[p * 4 + 3];
      }
    }
  };
  for (let n = 0; n < 3; n++) {
    pass(true);
    pass(false);
  }
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const di = ((r.y + y) * width + (r.x + x)) * 4;
      const si = (y * r.w + x) * 4;
      data[di] = tmp[si]; data[di + 1] = tmp[si + 1]; data[di + 2] = tmp[si + 2]; data[di + 3] = tmp[si + 3];
    }
  }
}

export function fillRect(buf: PixelBuf, rect: Rect, rgba: [number, number, number, number] = [0, 0, 0, 255]): void {
  const { data, width, height } = buf;
  const r = clampRect(rect, width, height);
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * width + x) * 4;
      data[i] = rgba[0]; data[i + 1] = rgba[1]; data[i + 2] = rgba[2]; data[i + 3] = rgba[3];
    }
  }
}

export function stampHighlight(buf: PixelBuf, cx: number, cy: number, radius: number, color: [number, number, number], opacity: number): void {
  const { data, width, height } = buf;
  const box = clampRect({ x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 }, width, height);
  if (box.w === 0 || box.h === 0) return;
  const feather = Math.max(1, radius * 0.3);
  const inner = radius - feather;
  const [cr, cg, cb] = color;
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const px = box.x + x;
      const py = box.y + y;
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const edge = dist <= inner ? 1 : 1 - (dist - inner) / feather;
      const a = opacity * edge;
      if (a <= 0) continue;
      const i = (py * width + px) * 4;
      data[i] = data[i] * (1 - a) + cr * a;
      data[i + 1] = data[i + 1] * (1 - a) + cg * a;
      data[i + 2] = data[i + 2] * (1 - a) + cb * a;
      data[i + 3] = Math.max(data[i + 3], Math.round(255 * a));
    }
  }
}

export type BrushKind = "blur" | "pixelate";

export function stampBrush(buf: PixelBuf, kind: BrushKind, cx: number, cy: number, radius: number, strength: number): void {
  const { data, width, height } = buf;
  const box = clampRect({ x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 }, width, height);
  if (box.w === 0 || box.h === 0) return;

  const before = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const s = ((box.y + y) * width + box.x) * 4;
    before.set(data.subarray(s, s + box.w * 4), y * box.w * 4);
  }

  if (kind === "pixelate") pixelate(buf, box, strength);
  else boxBlur(buf, box, strength);

  const r2 = radius * radius;
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const dx = box.x + x + 0.5 - cx;
      const dy = box.y + y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) continue;
      const di = ((box.y + y) * width + (box.x + x)) * 4;
      const si = (y * box.w + x) * 4;
      data[di] = before[si]; data[di + 1] = before[si + 1]; data[di + 2] = before[si + 2]; data[di + 3] = before[si + 3];
    }
  }
}
