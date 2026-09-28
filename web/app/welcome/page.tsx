"use client";

import { Bird } from "@/components/Bird";
import { TitleBar } from "@/components/chrome";
import { Kbd } from "@/components/controls";

export default function Welcome() {
  return (
    <div className="stage-dots flex h-screen flex-col">
      <TitleBar className="shrink-0" />
      <main className="-mt-6 flex flex-1 flex-col items-center justify-center px-8 text-center">
        <Bird size={112} />
        <h1 className="mt-5 text-[26px] font-extrabold tracking-tight">Hello, I&apos;m Feathershot.</h1>
        <p className="mt-2 max-w-sm text-[15px] font-semibold leading-relaxed text-ink-soft">
          Take a screenshot with <Kbd>Win</Kbd> <Kbd>Shift</Kbd> <Kbd>S</Kbd> to try it. I&apos;ll open right up for a quick edit.
        </p>
        <p className="mt-4 max-w-sm text-[12px] font-semibold text-ink-faint">I&apos;ll wait quietly in the tray. Everything stays on this PC.</p>
      </main>
    </div>
  );
}
