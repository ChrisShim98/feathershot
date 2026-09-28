"use client";

import type { ReactNode } from "react";

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="px-4 py-3.5 [&+&]:border-t [&+&]:border-line">
      <div className="mb-2.5 flex h-4 items-center justify-between">
        <h3 className="text-[12px] font-bold text-ink-soft">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <span className="font-semibold">{label}</span>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[9px] bg-fill p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          aria-label={o.title}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center rounded-[7px] font-semibold transition-[background,box-shadow,color] duration-150 ${
            size === "sm" ? "h-6 px-2" : "h-6 px-2.5 text-[12px]"
          } ${o.value === value ? "bg-surface text-ink shadow-[0_0_0_0.5px_var(--line),0_1px_2px_rgba(0,0,0,0.1)]" : "text-ink-soft hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-1 flex justify-between">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-ink-faint">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider"
        style={{ "--p": `${p}%` } as React.CSSProperties}
      />
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5.5 w-9.5 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-accent" : "bg-fill-hover"}`}
    >
      <span
        className="absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-(--knob-shadow) transition-transform duration-200 ease-out"
        style={{ transform: checked ? "translateX(16px)" : "none" }}
      />
    </button>
  );
}

/** Small round icon button used on glass chrome. */
export function IconButton({ title, onClick, children, disabled, active }: { title: string; onClick?: () => void; children: ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? "bg-accent-soft text-accent" : "text-ink-soft enabled:hover:bg-fill-hover enabled:hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Kbd({ children, onAccent }: { children: ReactNode; onAccent?: boolean }) {
  return (
    <kbd className={`rounded-[5px] px-1.5 py-px text-[11px] font-bold ${onAccent ? "bg-white/20 text-white" : "bg-fill text-ink-soft shadow-[inset_0_-1px_0_var(--line)]"}`}>
      {children}
    </kbd>
  );
}
