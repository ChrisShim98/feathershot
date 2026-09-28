"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bird } from "@/components/Bird";
import { TitleBar } from "@/components/chrome";
import { Kbd, Switch } from "@/components/controls";
import { DEFAULT_SETTINGS, getShell, type Settings, type ShellEnv, type ThemePref } from "@/lib/shell";
import { setTheme, useTheme } from "@/lib/theme";

function Group({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-1.5 px-1 text-[12px] font-bold text-ink-soft">{title}</h2>
      <div className="divide-y divide-line rounded-[12px] bg-surface shadow-[0_0_0_0.5px_var(--line),0_1px_2px_rgba(0,0,0,0.04)]">{children}</div>
      {footer && <p className="mt-1.5 px-1 text-[12px] font-semibold leading-relaxed text-ink-faint">{footer}</p>}
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="block text-[13px] font-bold">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-ink-soft">{hint}</span>}
      </span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function Thumb({ dark }: { dark: boolean }) {
  const bg = dark ? "#1b1924" : "#f3f0eb";
  const panel = dark ? "#2e2a3b" : "#ffffff";
  return (
    <div className="relative h-full w-full" style={{ background: bg }}>
      <div className="absolute top-[18%] left-[12%] h-[46%] w-[44%] rounded-[3px]" style={{ background: "var(--plumage)" }} />
      <div className="absolute top-[12%] right-[8%] bottom-[12%] w-[26%] rounded-[4px]" style={{ background: panel }} />
      <div className="absolute bottom-[10%] left-[18%] h-[12%] w-[32%] rounded-full" style={{ background: panel }} />
    </div>
  );
}

const APPEARANCES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function AppearancePicker() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className="flex justify-center gap-6 px-4 py-4">
      {APPEARANCES.map((a) => {
        const on = theme === a.value;
        return (
          <button key={a.value} role="radio" aria-checked={on} onClick={() => setTheme(a.value)} className="group flex flex-col items-center gap-2">
            <span
              className={`block h-14.5 w-22 overflow-hidden rounded-[9px] transition-shadow duration-150 ${
                on ? "ring-[2.5px] ring-accent ring-offset-2 ring-offset-surface" : "ring-1 ring-line group-hover:ring-ink-faint"
              }`}
            >
              {a.value === "system" ? (
                <span className="relative block h-full w-full">
                  <Thumb dark={false} />
                  <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
                    <Thumb dark />
                  </span>
                </span>
              ) : (
                <Thumb dark={a.value === "dark"} />
              )}
            </span>
            <span className={`text-[12px] font-bold ${on ? "text-ink" : "text-ink-soft"}`}>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const shell = getShell();
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [env, setEnv] = useState<ShellEnv | null>(null);

  useEffect(() => {
    void shell.getSettings().then(setS);
    void shell.getEnv().then(setEnv);
  }, [shell]);

  const set = (p: Partial<Settings>) => void shell.setSettings(p).then(setS);

  return (
    <div className="flex h-screen flex-col">
      <TitleBar className="shrink-0">
        <Bird size={24} blink={false} />
        <span className="text-[13px] font-extrabold tracking-tight">Settings</span>
      </TitleBar>

      <main className="panel-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-135 px-6 pt-2 pb-10">
          <Group
            title="Appearance"
            footer={
              <>
                Auto follows Windows. Switch anytime from the editor toolbar, or press <Kbd>Ctrl</Kbd> <Kbd>Shift</Kbd> <Kbd>L</Kbd>.
              </>
            }
          >
            <AppearancePicker />
          </Group>

          <Group title="Catching images">
            <Toggle
              label="Watch the clipboard"
              hint="Catches Win+Shift+S, Snipping Tool, and any image you copy."
              checked={s.watchClipboard}
              onChange={(v) => set({ watchClipboard: v })}
            />
            <Toggle label="Watch the Screenshots folder" hint="Catches Win+PrintScreen and Snipping Tool auto-save." checked={s.watchFolder} onChange={(v) => set({ watchFolder: v })} />
            <Toggle
              label="Open editor instantly"
              hint={s.openInstantly ? "Every catch opens straight into the editor." : "A small “Beautify?” toast asks first."}
              checked={s.openInstantly}
              onChange={(v) => set({ openInstantly: v })}
            />
          </Group>

          <Group title="Editor">
            <Toggle label="Close the editor after copying" checked={s.autoClose} onChange={(v) => set({ autoClose: v })} />
            <Toggle label="Mute sounds" hint="Sounds are also silent while Windows Do Not Disturb is on." checked={s.muted} onChange={(v) => set({ muted: v })} />
          </Group>

          <Group
            title="Windows"
            footer={
              env?.startupBlockedReason &&
              `Windows has this switched off at the system level (${
                env.startupBlockedReason === "DisabledByUser" ? "you turned it off in" : "your organisation's policy blocks"
              } Settings → Apps → Startup), so flip it there too.`
            }
          >
            <Toggle label="Start with Windows" hint="Opens quietly in the tray, no window." checked={s.startWithWindows} onChange={(v) => set({ startWithWindows: v })} />
          </Group>

          <Group title="Windows' own screenshot notification">
            <div className="px-4 py-3.5 text-[13px] font-semibold leading-relaxed text-ink-soft">
              <p>
                Windows shows its own “Screenshot copied” toast on top of Feathershot&apos;s. Only Windows can turn that off, and it takes under a
                minute:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  Open{" "}
                  <button onClick={() => void shell.openExternal("ms-settings:notifications")} className="cursor-pointer font-bold text-accent hover:underline">
                    Windows Settings → Notifications
                  </button>
                  .
                </li>
                <li>
                  Find <strong className="text-ink">Snipping Tool</strong> (or <strong className="text-ink">Screen Snipping</strong> on older builds).
                </li>
                <li>Turn its toggle off. Your other notifications are unaffected.</li>
              </ol>
            </div>
          </Group>

          <section id="about" className="mt-8 flex flex-col items-center text-center">
            <Bird size={64} />
            <h2 className="mt-2 text-[15px] font-extrabold">
              Feathershot {env?.version ? <span className="font-semibold text-ink-faint">v{env.version}</span> : null}
            </h2>
            <p className="mt-2 max-w-105 text-[12px] font-semibold leading-relaxed text-ink-soft">
              Feathershot never connects to the internet. Your screenshots stay in memory on this PC and are only written to disk when you press
              Save. There is no account, telemetry or crash reporting.
            </p>
            <p className="mt-2 text-[12px] font-semibold text-ink-faint">More small, private apps by the same maker: the photo scrubber and Kanban Lite.</p>
            <button onClick={() => void shell.openWelcome()} className="mt-3 cursor-pointer text-[12px] font-bold text-accent underline underline-offset-2">
              Show the welcome screen again
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
