"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { Check, ClipboardCopy, Download, Droplets, FolderOpen, GripVertical, Grid2x2, Highlighter, ImagePlus, MousePointer2, Plus, Settings as SettingsIcon, Sparkles, Square, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bird } from "./Bird";
import { TitleBar, ThemeToggle, TITLEBAR_H } from "./chrome";
import { IconButton, Kbd, Row, Section, Segmented, Slider } from "./controls";
import { extractAutoStops, hexToRgb } from "@/lib/render/color";
import { cssGradient, findGradient, GRADIENT_PRESETS } from "@/lib/render/gradients";
import { exportScale } from "@/lib/render/layout";
import { addPreset, MAX_PRESETS, persistable, removePreset } from "@/lib/render/presets";
import { fillRect, stampBrush, stampHighlight } from "@/lib/render/redact";
import { drawScene, layoutFor, renderToBlob, SHADOW_ORDER, type Animated, type DrawInput } from "@/lib/render/render";
import { resolveBackground } from "@/lib/render/resolve";
import { DEFAULT_STYLE, type Align, type CanvasPreset, type FrameKind, type Layout, type ResolvedBackground, type ShadowLevel, type Style } from "@/lib/render/types";
import { DEFAULT_SETTINGS, getShell, type Settings } from "@/lib/shell";
import { sounds } from "@/lib/sounds";

type Tool = "none" | "blur" | "pixelate" | "box" | "highlight";

/** Classic marker colours, at the opacity a real highlighter lays down. */
const HIGHLIGHT_COLORS = [
  { name: "Yellow", hex: "#ffe066" },
  { name: "Pink", hex: "#ff8fc7" },
  { name: "Green", hex: "#8cf07c" },
  { name: "Blue", hex: "#7cc9ff" },
  { name: "Orange", hex: "#ffb066" },
];

const targets = (s: Style): Animated => ({ padding: s.padding, radius: s.radius, shadow: SHADOW_ORDER.indexOf(s.shadow) });
const bgKey = (s: Style) => JSON.stringify(s.background);

/** Mutable render state lives in a ref so animation frames never wait for React. */
interface RenderState {
  style: Style;
  src: HTMLCanvasElement | null;
  pixels: ImageData | null;
  srcW: number;
  srcH: number;
  autoStops: string[] | null;
  bgImg: HTMLImageElement | null;
  anim: Animated;
  bgPrev: ResolvedBackground | null;
  bgT: number;
  bloom: boolean;
  lift: number;
  layout: Layout | null;
  boxRect: { x0: number; y0: number; x1: number; y1: number } | null;
  undo: Uint8ClampedArray[];
  raf: number;
  tween: { stop: () => void } | null;
  bgTween: { stop: () => void } | null;
}

/** Width of the floating style inspector. */
const INSPECTOR_W = 288;

const ALIGNS: Align[] = ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"];

export default function Editor() {
  const shell = useMemo(() => getShell(), []);
  const reduce = useReducedMotion() ?? false;

  const [style, setStyleState] = useState<Style>(DEFAULT_STYLE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasImage, setHasImage] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<Tool>("none");
  const [brush, setBrush] = useState(28);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].hex);
  const [copy, setCopy] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [feathers, setFeathers] = useState<{ id: number; x: number; r: number }[]>([]);
  const [saveFmt, setSaveFmt] = useState<"png" | "jpg">("png");
  const [note, setNote] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [namingPreset, setNamingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [canUndo, setCanUndo] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ blob: Blob; url: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const strokeRef = useRef<{ last: { x: number; y: number }; dirty: boolean } | null>(null);

  const R = useRef<RenderState>({
    style: DEFAULT_STYLE,
    src: null,
    pixels: null,
    srcW: 0,
    srcH: 0,
    autoStops: null,
    bgImg: null,
    anim: targets(DEFAULT_STYLE),
    bgPrev: null,
    bgT: 1,
    bloom: false,
    lift: 0,
    layout: null,
    boxRect: null,
    undo: [],
    raf: 0,
    tween: null,
    bgTween: null,
  }).current;

  // ------------------------------------------------------------------ drawing

  const buildInput = useCallback((): DrawInput | null => {
    if (!R.src) return null;
    return {
      source: R.src,
      srcW: R.srcW,
      srcH: R.srcH,
      style: R.style,
      anim: R.anim,
      bg: resolveBackground(R.style.background, R.autoStops, R.bgImg),
      prevBg: R.bgPrev ?? undefined,
      bgT: R.bgT,
      bloom: R.bloom,
      lift: R.lift,
    };
  }, [R]);

  const draw = useCallback(() => {
    R.raf = 0;
    const c = canvasRef.current;
    const stage = stageRef.current;
    const input = buildInput();
    if (!c || !stage || !input) return;
    const layout = layoutFor(input);
    const fit = Math.min((stage.clientWidth - 56) / layout.canvasW, (stage.clientHeight - 56) / layout.canvasH, 1.5);
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, layout.canvasW * fit);
    const cssH = Math.max(1, layout.canvasH * fit);
    const pw = Math.max(1, Math.round(cssW * dpr));
    const ph = Math.max(1, Math.round(cssH * dpr));
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
    }
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    R.layout = drawScene(ctx, input, pw / layout.canvasW);

    // Live outline for the box tool
    if (R.boxRect) {
      const k = pw / layout.canvasW;
      const s = layout.contentScale;
      const toC = (sx: number, sy: number) => [(layout.imgX + (sx / R.srcW) * layout.imgW) * k, (layout.imgY + (sy / R.srcH) * layout.imgH) * k];
      const [ax, ay] = toC(R.boxRect.x0, R.boxRect.y0);
      const [bx, by] = toC(R.boxRect.x1, R.boxRect.y1);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5 * dpr * Math.max(0.5, s);
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      ctx.restore();
    }
  }, [R, buildInput]);

  const schedule = useCallback(() => {
    if (!R.raf) R.raf = requestAnimationFrame(draw);
  }, [R, draw]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(schedule);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [schedule]);

  // ------------------------------------------------------------------ style changes

  const currentBg = useCallback(
    (s: Style) => resolveBackground(s.background, R.autoStops, R.bgImg),
    [R],
  );

  const applyStyle = useCallback(
    (next: Style, opts: { instant?: boolean; bloom?: boolean } = {}) => {
      const prev = R.style;
      const bgChanged = bgKey(prev) !== bgKey(next);
      if (bgChanged) {
        R.bgPrev = currentBg(prev);
        R.bgT = 0;
        R.bloom = opts.bloom ?? next.background.kind === "auto";
        R.bgTween?.stop();
        const dur = opts.instant ? 0.001 : R.bloom && !reduce ? 0.4 : 0.18;
        R.bgTween = animate(0, 1, {
          duration: reduce ? 0.18 : dur,
          ease: "easeOut",
          onUpdate: (v) => {
            R.bgT = v;
            schedule();
          },
          onComplete: () => {
            R.bgPrev = null;
            R.bgT = 1;
            schedule();
          },
        });
        if (R.bloom && !opts.instant) sounds.play("bg.whoosh");
      }
      R.style = next;
      setStyleState(next);

      const from = { ...R.anim };
      const to = targets(next);
      R.tween?.stop();
      R.tween = animate(0, 1, {
        duration: opts.instant || reduce ? 0.001 : 0.18,
        ease: "easeOut",
        onUpdate: (p) => {
          R.anim = {
            padding: from.padding + (to.padding - from.padding) * p,
            radius: from.radius + (to.radius - from.radius) * p,
            shadow: from.shadow + (to.shadow - from.shadow) * p,
          };
          schedule();
        },
      });
      schedule();

      // remember the last-used style
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void shell.setSettings({ lastStyle: persistable(next) }), 500);
    },
    [R, currentBg, reduce, schedule, shell],
  );

  const patch = useCallback((p: Partial<Style>, opts?: { instant?: boolean; bloom?: boolean }) => applyStyle({ ...R.style, ...p }, opts), [R, applyStyle]);

  /** A short status message that floats above the dock and clears itself. */
  const flash = useCallback((msg: string) => {
    clearTimeout(noteTimer.current);
    setNote(msg);
    noteTimer.current = setTimeout(() => setNote(null), 2400);
  }, []);

  // ------------------------------------------------------------------ loading images

  const loadBlob = useCallback(
    async (blob: Blob, startStyle?: Style) => {
      try {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement("canvas");
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        R.src = c;
        R.srcW = c.width;
        R.srcH = c.height;
        R.pixels = ctx.getImageData(0, 0, c.width, c.height);
        R.undo = [];
        setCanUndo(false);

        // Downsample for colour extraction
        const k = 64 / Math.max(c.width, c.height);
        const t = document.createElement("canvas");
        t.width = Math.max(1, Math.round(c.width * Math.min(1, k)));
        t.height = Math.max(1, Math.round(c.height * Math.min(1, k)));
        const tctx = t.getContext("2d", { willReadFrequently: true })!;
        tctx.drawImage(c, 0, 0, t.width, t.height);
        R.autoStops = extractAutoStops(tctx.getImageData(0, 0, t.width, t.height).data);
        bmp.close();

        setHasImage(true);
        setDims({ w: c.width, h: c.height });
        setCopy("idle");
        // The Auto background blooms out from behind the screenshot.
        const target = startStyle ?? R.style;
        R.style = { ...target, background: { kind: "transparent" } };
        R.anim = targets(target);
        applyStyle(target, { bloom: true });
        schedule();
      } catch {
        flash("That file isn't an image I can open.");
        sounds.play("error.soft");
      }
    },
    [R, applyStyle, schedule, flash],
  );

  // Boot: settings, environment, pending screenshot
  useEffect(() => {
    let off = () => {};
    let cancelled = false;
    (async () => {
      const [s, env] = await Promise.all([shell.getSettings(), shell.getEnv()]);
      if (cancelled) return;
      setSettings(s);
      sounds.muted = s.muted;
      sounds.volume = s.volume;
      sounds.quiet = env.quiet;
      void sounds.preload();
      const start = s.lastStyle ?? DEFAULT_STYLE;
      R.style = start;
      R.anim = targets(start);
      setStyleState(start);
      const blob = await shell.getPendingImage();
      if (blob && !cancelled) await loadBlob(blob, start);
      off = shell.onImageAvailable(async () => {
        const b = await shell.getPendingImage();
        if (b) await loadBlob(b, R.style);
      });
    })();
    const onFocus = () => void shell.getEnv().then((e) => (sounds.quiet = e.quiet));
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      off();
      window.removeEventListener("focus", onFocus);
      cancelAnimationFrame(R.raf);
      sounds.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ export

  const exportInput = useCallback((): DrawInput | null => {
    const input = buildInput();
    if (!input) return null;
    return { ...input, anim: targets(R.style), bgT: 1, prevBg: undefined, lift: 0 };
  }, [R, buildInput]);

  const render = useCallback(
    async (type: "image/png" | "image/jpeg") => {
      const input = exportInput();
      if (!input) throw new Error("No image");
      const l = layoutFor(input);
      return renderToBlob(input, exportScale(l.canvasW, l.canvasH), type);
    },
    [exportInput],
  );

  const flushStyle = useCallback(() => {
    clearTimeout(saveTimer.current);
    void shell.setSettings({ lastStyle: persistable(R.style) });
  }, [R, shell]);

  const doCopy = useCallback(async () => {
    if (!R.src || copy === "busy") return;
    setCopy("busy");
    try {
      const blob = await render("image/png");
      await shell.copyImage(blob);
      flushStyle();
      sounds.play("copy.flutter");
      setCopy("done");
      setFeathers(Array.from({ length: 6 }, (_, i) => ({ id: Date.now() + i, x: (Math.random() - 0.5) * 120, r: (Math.random() - 0.5) * 80 })));
      // lift: scale 1.02 and a deeper shadow, then settle
      animate(0, 1, { duration: 0.25, ease: "easeOut", onUpdate: (v) => { R.lift = v; schedule(); } }).then(() =>
        animate(1, 0, { duration: 0.25, ease: "easeInOut", onUpdate: (v) => { R.lift = v; schedule(); } }),
      );
      if (settings.autoClose) setTimeout(() => void shell.closeEditor(), 700);
      else setTimeout(() => setCopy("idle"), 1800);
    } catch {
      sounds.play("error.soft");
      setCopy("error");
      setTimeout(() => setCopy("idle"), 900);
    }
  }, [R, copy, render, shell, flushStyle, schedule, settings.autoClose]);

  const doSave = useCallback(
    async (fmt: "png" | "jpg" = saveFmt) => {
      if (!R.src) return;
      try {
        const blob = await render(fmt === "png" ? "image/png" : "image/jpeg");
        const res = await shell.saveImage(blob, fmt);
        if (res.saved) {
          flushStyle();
          sounds.play("save.pop");
          flash("Saved");
        }
      } catch {
        sounds.play("error.soft");
        flash("Couldn't save that one. Try another folder?");
      }
    },
    [R, render, saveFmt, shell, flushStyle, flash],
  );

  const undo = useCallback(() => {
    const snap = R.undo.pop();
    if (!snap || !R.pixels || !R.src) return;
    R.pixels.data.set(snap);
    R.src.getContext("2d")!.putImageData(R.pixels, 0, 0);
    setCanUndo(R.undo.length > 0);
    schedule();
  }, [R, schedule]);

  // Keyboard: Ctrl+C copy, Ctrl+S save, Ctrl+Z undo, Esc close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" && (el as HTMLInputElement).type === "text");
      if (e.key === "Escape") {
        if (typing) return void el!.blur();
        void shell.closeEditor();
      } else if ((e.ctrlKey || e.metaKey) && !typing) {
        const k = e.key.toLowerCase();
        if (k === "c") { e.preventDefault(); void doCopy(); }
        else if (k === "s") { e.preventDefault(); void doSave("png"); }
        else if (k === "z") { e.preventDefault(); undo(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doCopy, doSave, undo, shell]);

  // Paste and drop
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (f) void loadBlob(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadBlob]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropping(false);
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
    if (f) void loadBlob(f);
  };

  // ------------------------------------------------------------------ redaction pointer handling

  const toSource = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const l = R.layout;
    if (!c || !l) return null;
    const r = c.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width) * l.canvasW;
    const dy = ((e.clientY - r.top) / r.height) * l.canvasH;
    return { x: ((dx - l.imgX) / l.imgW) * R.srcW, y: ((dy - l.imgY) / l.imgH) * R.srcH };
  };

  const snapshot = () => {
    if (!R.pixels) return;
    R.undo.push(new Uint8ClampedArray(R.pixels.data));
    if (R.undo.length > 6) R.undo.shift();
    setCanUndo(true);
  };

  const stamp = (x: number, y: number) => {
    if (!R.pixels || !R.src) return;
    if (tool === "blur" || tool === "pixelate") {
      stampBrush(R.pixels, tool, x, y, brush, tool === "blur" ? Math.max(3, brush * 0.4) : Math.max(5, brush * 0.45));
    } else if (tool === "highlight") {
      stampHighlight(R.pixels, x, y, brush, hexToRgb(highlightColor), 0.45);
    } else {
      return;
    }
    const dx = Math.max(0, Math.floor(x - brush));
    const dy = Math.max(0, Math.floor(y - brush));
    R.src.getContext("2d")!.putImageData(R.pixels, 0, 0, dx, dy, Math.min(R.srcW - dx, brush * 2 + 2), Math.min(R.srcH - dy, brush * 2 + 2));
    schedule();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "none") return;
    const p = toSource(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    snapshot();
    sounds.play("redact.swish");
    if (tool === "box") {
      R.boxRect = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    } else {
      strokeRef.current = { last: p, dirty: true };
      stamp(p.x, p.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool === "none") return;
    const p = toSource(e);
    if (!p) return;
    if (tool === "box" && R.boxRect) {
      R.boxRect.x1 = p.x;
      R.boxRect.y1 = p.y;
      schedule();
    } else if (strokeRef.current) {
      const { last } = strokeRef.current;
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      const step = Math.max(2, brush * 0.35);
      const n = Math.floor(dist / step);
      if (n > 0) {
        const ux = (p.x - last.x) / dist;
        const uy = (p.y - last.y) / dist;
        for (let i = 1; i <= n; i++) stamp(last.x + ux * step * i, last.y + uy * step * i);
        strokeRef.current.last = { x: last.x + ux * step * n, y: last.y + uy * step * n };
      }
    }
  };

  const onPointerUp = () => {
    if (tool === "box" && R.boxRect && R.pixels && R.src) {
      const b = R.boxRect;
      fillRect(R.pixels, { x: Math.min(b.x0, b.x1), y: Math.min(b.y0, b.y1), w: Math.abs(b.x1 - b.x0), h: Math.abs(b.y1 - b.y0) });
      R.src.getContext("2d")!.putImageData(R.pixels, 0, 0);
      R.boxRect = null;
      schedule();
    }
    strokeRef.current = null;
  };

  // ------------------------------------------------------------------ misc handlers


  const saveCurrentPreset = async () => {
    const list = addPreset(settings.presets, presetName, R.style);
    setNamingPreset(false);
    setPresetName("");
    if (!list) return;
    setSettings(await shell.setSettings({ presets: list }));
    sounds.play("ui.tick");
  };

  const chooseBgImage = (f: File | undefined) => {
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const dataUrl = String(fr.result);
      const img = new Image();
      img.onload = () => {
        R.bgImg = img;
        patch({ background: { kind: "image", dataUrl } });
      };
      img.src = dataUrl;
    };
    fr.readAsDataURL(f);
  };

  const prepareDrag = async () => {
    if (!R.src) return;
    try {
      const blob = await render("image/png");
      if (dragRef.current) URL.revokeObjectURL(dragRef.current.url);
      dragRef.current = { blob, url: URL.createObjectURL(blob) };
    } catch {
      /* ignore: drag simply won't carry a file */
    }
  };

  const bg = style.background;
  const tick = () => sounds.play("ui.tick");
  const bgName =
    bg.kind === "auto" ? "Auto" : bg.kind === "gradient" ? findGradient(bg.id).name : bg.kind === "solid" ? "Solid" : bg.kind === "image" ? "Image" : "None";
  const brushing = tool === "blur" || tool === "pixelate" || tool === "highlight";
  const hint =
    note ??
    (copy === "done"
      ? "Fluffed up and copied!"
      : tool === "highlight"
        ? "Drag to highlight. It's baked into the pixels."
        : tool !== "none"
          ? "Drag over anything private. It's baked into the pixels."
          : null);

  return (
    <div
      className="stage-dots relative h-screen w-screen overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      {/* Unified toolbar */}
      <TitleBar className="absolute inset-x-0 top-0 z-30">
        <Bird size={26} blink={false} />
        <span className="text-[13px] font-extrabold tracking-tight">Feathershot</span>
        {dims && <span className="ml-1 text-[12px] font-semibold tabular-nums text-ink-faint">{dims.w} × {dims.h}</span>}
        <div className="flex-1" />
        <ThemeToggle />
        <div className="glass flex h-8 w-8 items-center justify-center rounded-full">
          <IconButton title="Settings" onClick={() => void shell.openSettings()}>
            <SettingsIcon size={15} strokeWidth={2.2} />
          </IconButton>
        </div>
      </TitleBar>

      <div
        ref={stageRef}
        className="absolute left-4 flex items-center justify-center transition-[right] duration-300 ease-out"
        style={{ top: TITLEBAR_H + 8, bottom: hasImage ? 84 : 16, right: hasImage ? INSPECTOR_W + 28 : 16 }}
      >
        {hasImage ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="relative"
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className={`block rounded-md ${bg.kind === "transparent" ? "checker" : "shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_18px_50px_-18px_rgba(20,10,40,0.35)]"}`}
              style={{ cursor: tool === "none" ? "default" : "crosshair", touchAction: "none" }}
            />
          </motion.div>
        ) : (
          <div className="flex max-w-sm flex-col items-center text-center">
            <motion.div animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}>
              <Bird size={104} />
            </motion.div>
            <h1 className="mt-5 text-[22px] font-extrabold tracking-tight">Ready when you are</h1>
            <p className="mt-1.5 text-[14px] font-semibold leading-relaxed text-ink-soft">
              Take a screenshot with <Kbd>Win</Kbd> <Kbd>Shift</Kbd> <Kbd>S</Kbd> and I&apos;ll fluff it up.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="glass mt-6 flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-transform duration-150 hover:-translate-y-0.5"
            >
              <FolderOpen size={15} strokeWidth={2.2} /> Open an image
            </button>
            <p className="mt-3 text-[12px] font-semibold text-ink-faint">or drop one here, or paste with Ctrl+V</p>
            {note && <p role="status" className="shake mt-4 text-[13px] font-bold text-ink">{note}</p>}
          </div>
        )}
      </div>

      {dropping && (
        <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-[20px] border-2 border-dashed border-accent bg-accent-soft text-[17px] font-extrabold text-accent" style={{ top: TITLEBAR_H }}>
          Drop it here
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void loadBlob(e.target.files[0])} />
      <input ref={bgFileRef} type="file" accept="image/*" hidden onChange={(e) => chooseBgImage(e.target.files?.[0])} />

      <AnimatePresence>
        {hasImage && (
          <>
            <motion.div
              key="dock"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="absolute bottom-4 left-4 z-20 flex flex-col items-center"
              style={{ right: INSPECTOR_W + 28 }}
            >
              <AnimatePresence>
                {hint && (
                  <motion.div
                    key={hint}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="glass absolute -top-11 rounded-full px-3.5 py-1.5 text-[12px] font-bold whitespace-nowrap"
                    role="status"
                  >
                    {hint}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="glass flex h-12 items-center gap-1 rounded-full py-1.5 pr-1.5 pl-2">
                <div role="radiogroup" aria-label="Redaction tool" className="flex items-center gap-0.5">
                  {([
                    ["none", "Select", MousePointer2],
                    ["blur", "Blur brush", Droplets],
                    ["pixelate", "Pixelate brush", Grid2x2],
                    ["box", "Redaction box", Square],
                    ["highlight", "Highlighter", Highlighter],
                  ] as const).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={tool === id}
                      aria-label={label}
                      title={label}
                      onClick={() => setTool(id)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 ${tool === id ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-fill-hover hover:text-ink"}`}
                    >
                      <Icon size={17} strokeWidth={2.1} />
                    </button>
                  ))}
                </div>
                <AnimatePresence initial={false}>
                  {brushing && (
                    <motion.label
                      key="brush"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 112, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="flex items-center overflow-hidden px-1"
                      title="Brush size"
                    >
                      <input type="range" aria-label="Brush size" min={2} max={50} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="slider" style={{ "--p": `${((brush - 2) / 50) * 100}%` } as React.CSSProperties} />
                    </motion.label>
                  )}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {tool === "highlight" && (
                    <motion.div
                      key="highlight-colors"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      role="radiogroup"
                      aria-label="Highlighter colour"
                      className="flex items-center gap-1.5 pr-1"
                    >
                      {HIGHLIGHT_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          role="radio"
                          aria-checked={highlightColor === c.hex}
                          aria-label={c.name}
                          title={c.name}
                          onClick={() => setHighlightColor(c.hex)}
                          className={`h-3 w-3 shrink-0 rounded-full transition-transform duration-150 ${highlightColor === c.hex ? "scale-100 ring-2 ring-accent ring-offset-2 ring-offset-surface" : "scale-90 hover:scale-100"}`}
                          style={{ background: c.hex }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <IconButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
                  <Undo2 size={16} strokeWidth={2.1} />
                </IconButton>

                <div className="mx-1.5 h-6 w-px bg-line" />

                <div className="flex h-9 items-center rounded-full bg-fill">
                  <button onClick={() => void doSave()} title="Save (Ctrl+S)" className="flex h-9 items-center gap-1.5 rounded-l-full pr-2 pl-3.5 font-bold transition-colors hover:bg-fill-hover">
                    <Download size={15} strokeWidth={2.2} /> Save
                  </button>
                  <select aria-label="Save format" value={saveFmt} onChange={(e) => setSaveFmt(e.target.value as "png" | "jpg")} className="h-9 cursor-pointer appearance-none rounded-r-full bg-transparent pr-3 pl-1.5 text-[12px] font-bold text-ink-soft outline-none hover:bg-fill-hover">
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                  </select>
                </div>
                <div
                  draggable
                  title="Drag the finished image into another app"
                  aria-label="Drag out"
                  onPointerEnter={() => void prepareDrag()}
                  onDragStart={(e) => {
                    const d = dragRef.current;
                    if (!d) return e.preventDefault();
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.setData("DownloadURL", `image/png:feathershot.png:${d.url}`);
                    e.dataTransfer.items.add(new File([d.blob], "feathershot.png", { type: "image/png" }));
                  }}
                  className="flex h-9 w-9 cursor-grab items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-fill-hover hover:text-ink active:cursor-grabbing"
                >
                  <GripVertical size={16} strokeWidth={2.2} />
                </div>

                <div className="relative ml-1">
                  <motion.button
                    onClick={() => void doCopy()}
                    whileTap={reduce ? undefined : { scale: 0.97 }}
                    title="Copy (Ctrl+C)"
                    className={`btn-plumage flex h-9 min-w-33 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-extrabold ${copy === "error" ? "shake" : ""}`}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copy === "done" ? (
                        <motion.span key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="flex items-center gap-1.5">
                          <Check size={17} strokeWidth={3} /> Copied
                        </motion.span>
                      ) : (
                        <motion.span key="copy" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="flex items-center gap-2">
                          <ClipboardCopy size={16} strokeWidth={2.4} /> Copy <Kbd onAccent>Ctrl C</Kbd>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                  <AnimatePresence>
                    {copy === "done" &&
                      !reduce &&
                      feathers.map((f) => (
                        <motion.svg key={f.id} width="16" height="24" viewBox="0 0 18 26" className="pointer-events-none absolute top-1 left-1/2" initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }} animate={{ opacity: 0, x: f.x, y: -110, rotate: f.r }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} onAnimationComplete={() => setFeathers([])}>
                          <path d="M9 1 C16 8 15 19 9 25 C3 19 2 8 9 1 Z" fill="#fb7185" />
                        </motion.svg>
                      ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Inspector */}
            <motion.aside
              key="inspector"
              initial={reduce ? { opacity: 0 } : { x: 32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="glass absolute right-3 bottom-3 z-20 flex flex-col overflow-hidden rounded-[18px]"
              style={{ top: TITLEBAR_H + 4, width: INSPECTOR_W }}
              aria-label="Style"
            >
              <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
                <Section title="Background" aside={<span className="text-[12px] font-bold text-ink">{bgName}</span>}>
                  <div className="grid grid-cols-8 gap-1.5">
                    <Swatch label="Auto: colours from your screenshot" selected={bg.kind === "auto"} onClick={() => { tick(); patch({ background: { kind: "auto" } }, { bloom: true }); }} css="var(--plumage)">
                      <Sparkles size={13} strokeWidth={2.4} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" />
                    </Swatch>
                    {GRADIENT_PRESETS.map((g) => (
                      <Swatch key={g.id} label={g.name} selected={bg.kind === "gradient" && bg.id === g.id} css={cssGradient(g.stops, g.angle)} onClick={() => { tick(); patch({ background: { kind: "gradient", id: g.id } }); }} />
                    ))}
                    <label title="Solid colour" className={`relative aspect-square cursor-pointer rounded-full transition-transform duration-100 hover:scale-110 ${ring(bg.kind === "solid")}`} style={{ background: bg.kind === "solid" ? bg.color : "conic-gradient(#fb7185,#facc15,#2dd4bf,#8b5cf6,#fb7185)" }}>
                      <input type="color" aria-label="Solid colour" className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0" value={bg.kind === "solid" ? bg.color : "#8b5cf6"} onChange={(e) => patch({ background: { kind: "solid", color: e.target.value } })} />
                    </label>
                    <Swatch label="Custom image" selected={bg.kind === "image"} onClick={() => bgFileRef.current?.click()} css="var(--surface)">
                      <ImagePlus size={13} strokeWidth={2.2} className="text-ink-soft" />
                    </Swatch>
                    <Swatch label="Transparent" selected={bg.kind === "transparent"} onClick={() => { tick(); patch({ background: { kind: "transparent" } }); }} className="checker" />
                  </div>
                </Section>

                <Section title="Shape">
                  <div className="space-y-3">
                    <Slider label="Padding" value={style.padding} min={0} max={200} onChange={(v) => { tick(); patch({ padding: v }); }} />
                    <Slider label="Corner radius" value={style.radius} min={0} max={40} onChange={(v) => { tick(); patch({ radius: v }); }} />
                    <div>
                      <div className="mb-1.5 font-semibold">Shadow</div>
                      <Segmented<ShadowLevel> label="Shadow" value={style.shadow} onChange={(v) => patch({ shadow: v })} options={[{ value: "none", label: "None" }, { value: "soft", label: "Soft" }, { value: "medium", label: "Medium" }, { value: "strong", label: "Strong" }]} />
                    </div>
                  </div>
                </Section>

                <Section title="Layout">
                  <div className="space-y-2">
                    <Row label="Window frame">
                      <select aria-label="Window frame" value={style.frame} onChange={(e) => patch({ frame: e.target.value as FrameKind })} className="popup w-[136px]">
                        <option value="none">None</option>
                        <option value="browser-light">Browser, light</option>
                        <option value="browser-dark">Browser, dark</option>
                        <option value="app-light">App, light</option>
                        <option value="app-dark">App, dark</option>
                      </select>
                    </Row>
                    <Row label="Canvas size">
                      <select aria-label="Canvas size" value={style.canvas} onChange={(e) => patch({ canvas: e.target.value as CanvasPreset })} className="popup w-[136px]">
                        <option value="auto">Auto</option>
                        <option value="x">X (16:9)</option>
                        <option value="linkedin">LinkedIn (1.91:1)</option>
                        <option value="square">Square (1:1)</option>
                        <option value="instagram">Instagram (4:5)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </Row>
                    {style.canvas === "custom" && (
                      <div className="ml-auto flex w-34 items-center gap-1.5">
                        <input type="number" aria-label="Width" min={16} max={8192} value={style.customW} onChange={(e) => patch({ customW: Number(e.target.value) || 16 })} className="field w-full min-w-0 px-2 tabular-nums" />
                        <X size={12} className="shrink-0 text-ink-faint" />
                        <input type="number" aria-label="Height" min={16} max={8192} value={style.customH} onChange={(e) => patch({ customH: Number(e.target.value) || 16 })} className="field w-full min-w-0 px-2 tabular-nums" />
                      </div>
                    )}
                    <Row label="Alignment">
                      <div className="grid grid-cols-3 gap-0.75 rounded-lg bg-fill p-0.75" role="radiogroup" aria-label="Alignment">
                        {ALIGNS.map((a) => (
                          <button key={a} role="radio" aria-checked={style.align === a} aria-label={`Align ${a}`} onClick={() => patch({ align: a })} className="group flex h-3.5 w-4.5 items-center justify-center rounded-[3px] hover:bg-fill-hover">
                            <span className={`block transition-all duration-150 ${style.align === a ? "h-2 w-3 rounded-xs bg-accent" : "h-0.75 w-0.75 rounded-full bg-ink-faint group-hover:bg-ink-soft"}`} />
                          </button>
                        ))}
                      </div>
                    </Row>
                  </div>
                </Section>

                <Section title="Handle or watermark">
                  <input type="text" aria-label="Watermark" placeholder="@yourhandle" maxLength={40} value={style.watermark} onChange={(e) => patch({ watermark: e.target.value })} className="field w-full" />
                </Section>

                <Section
                  title="Presets"
                  aside={settings.presets.length < MAX_PRESETS && !namingPreset && (
                    <button onClick={() => setNamingPreset(true)} className="flex items-center gap-1 text-[12px] font-bold text-accent hover:opacity-80">
                      <Plus size={13} strokeWidth={2.6} /> Save current
                    </button>
                  )}
                >
                  {namingPreset && (
                    <form className="mb-2.5 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void saveCurrentPreset(); }}>
                      <input autoFocus type="text" maxLength={24} value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Name it" className="field min-w-0 flex-1" />
                      <button className="h-7 rounded-lg bg-accent px-3 text-[12px] font-bold text-white">Save</button>
                    </form>
                  )}
                  {settings.presets.length === 0 && !namingPreset ? (
                    <p className="text-[12px] font-semibold leading-relaxed text-ink-faint">Save up to {MAX_PRESETS} favourite looks for one-click reuse.</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {settings.presets.map((p) => (
                        <motion.div key={p.id} whileHover={reduce ? undefined : { y: -2 }} transition={{ duration: 0.12 }} className="group relative">
                          <button title={p.name} onClick={() => { tick(); applyStyle(p.style); }} className="block w-full">
                            <PresetThumb style={p.style} />
                            <span className="mt-1 block truncate text-[11px] font-bold text-ink-soft">{p.name}</span>
                          </button>
                          <button aria-label={`Delete ${p.name}`} onClick={async () => setSettings(await shell.setSettings({ presets: removePreset(settings.presets, p.id) }))} className="absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-ink text-canvas group-hover:flex">
                            <X size={10} strokeWidth={3} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const ring = (on: boolean) => (on ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--surface)]" : "ring-1 ring-inset ring-black/10");

function Swatch({ label, css, selected, onClick, children, className = "" }: { label: string; css?: string; selected: boolean; onClick: () => void; children?: React.ReactNode; className?: string }) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex aspect-square items-center justify-center rounded-full transition-transform duration-100 hover:scale-110 ${ring(selected)} ${className}`}
      style={css ? { background: css } : undefined}
    >
      {children}
    </button>
  );
}

function PresetThumb({ style }: { style: Style }) {
  const bg = style.background;
  const css =
    bg.kind === "gradient"
      ? cssGradient(findGradient(bg.id).stops, 135)
      : bg.kind === "solid"
        ? bg.color
        : "var(--plumage)";
  const inset = 6 + (style.padding / 200) * 8;
  return (
    <div className={`relative aspect-square w-full overflow-hidden rounded-[10px] ring-1 ring-inset ring-black/10 ${bg.kind === "transparent" ? "checker" : ""}`} style={bg.kind === "transparent" ? undefined : { background: css }}>
      <div className="absolute bg-white" style={{ inset, borderRadius: 2 + (style.radius / 40) * 6, boxShadow: style.shadow === "none" ? "none" : "0 3px 6px rgba(0,0,0,0.3)" }} />
    </div>
  );
}
