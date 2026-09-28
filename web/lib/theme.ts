import { useSyncExternalStore } from "react";
import { getShell, type ThemePref } from "./shell";
import { THEME_KEY as KEY } from "./theme-boot";

const parse = (v: unknown): ThemePref => (v === "light" || v === "dark" ? v : "system");

let pref: ThemePref = "system";
let started = false;
const listeners = new Set<() => void>();

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
export const isDark = (p: ThemePref) => (p === "system" ? systemDark() : p === "dark");

function apply(next: ThemePref, mirror: boolean) {
  pref = next;
  const root = document.documentElement;
  if (next === "system") delete root.dataset.theme;
  else root.dataset.theme = next;
  if (mirror) {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
  }
  void getShell().setWindowTheme(isDark(next));
  listeners.forEach((l) => l());
}

function start() {
  if (started) return;
  started = true;
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(KEY);
  } catch {}
  apply(parse(cached), false);
  void getShell()
    .getSettings()
    .then((s) => s.theme !== pref && apply(s.theme, true));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => pref === "system" && apply("system", false));
  window.addEventListener("storage", (e) => e.key === KEY && apply(parse(e.newValue), false));
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setTheme(next: ThemePref) {
  apply(next, true);
  void getShell().setSettings({ theme: next });
}

export const toggleTheme = () => setTheme(isDark(pref) ? "light" : "dark");

export function useTheme(): ThemePref {
  return useSyncExternalStore(subscribe, () => pref, () => "system");
}
