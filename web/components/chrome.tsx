"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getShell, type ThemePref } from "@/lib/shell";
import { setTheme, toggleTheme, useTheme } from "@/lib/theme";

export const TITLEBAR_H = 48;
const INTERACTIVE = "button, a, input, select, textarea, label, [data-no-drag]";

export function TitleBar({ children, className = "" }: { children?: ReactNode; className?: string }) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    void getShell().getEnv().then((e) => setInset(e.captionInset ?? 0));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    const shell = getShell();
    if (e.detail === 2) void shell.toggleMaximize();
    else void shell.beginWindowDrag();
  };

  return (
    <header
      onPointerDown={onPointerDown}
      className={`flex items-center gap-2 pl-3 ${className}`}
      style={{ height: TITLEBAR_H, ["appRegion" as string]: "drag", WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {children}
      <div aria-hidden data-no-drag style={{ width: inset + 8, height: "100%", flexShrink: 0, marginLeft: "auto" }} />
    </header>
  );
}

const THEME_OPTIONS: { value: ThemePref; icon: ReactNode; title: string }[] = [
  { value: "light", icon: <Sun size={14} strokeWidth={2.2} />, title: "Light" },
  { value: "dark", icon: <Moon size={14} strokeWidth={2.2} />, title: "Dark" },
  { value: "system", icon: <SunMoon size={14} strokeWidth={2.2} />, title: "Match Windows" },
];

export function ThemeToggle() {
  const theme = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div role="radiogroup" aria-label="Appearance" className="glass flex h-8 items-center gap-0.5 rounded-full p-[3px]">
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          aria-label={o.title}
          title={`${o.title} (Ctrl+Shift+L)`}
          onClick={() => setTheme(o.value)}
          className={`flex h-6.5 w-7.5 cursor-pointer items-center justify-center rounded-full transition-[background,color,box-shadow] duration-150 ${
            theme === o.value ? "bg-surface text-ink shadow-[0_0_0_0.5px_var(--line),0_1px_2px_rgba(0,0,0,0.12)]" : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
