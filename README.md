# Feathershot

Turn any Windows screenshot into a polished, share-ready image in seconds - or use it as a quick,
always-available editor for any image you copy. Runs fully offline, no account, no telemetry.

Press **Win+Shift+S** as usual (or copy any image with Ctrl+C), pick a style, press **Ctrl+C**, paste
anywhere. Feathershot catches it, beautifies it, and gets out of the way.

## Features

- **Catches screenshots automatically** - watches the clipboard (Win+Shift+S, Snipping Tool, or any
  copied image) and the Screenshots folder (Win+PrintScreen), with no polling.
- **Auto background** - picks the dominant colours out of the screenshot and builds a matching gradient,
  plus 12 bird-named gradient presets, solid colours, a custom image, or transparent.
- **Padding, corner radius, shadow, window frames, canvas presets** (X/Twitter, LinkedIn, Square,
  Instagram, custom) and edge alignment for tall or wide captures.
- **Redact** - blur brush, pixelate brush, and a box tool, baked into the pixels before export.
- **Highlight** - a translucent colour brush for pointing something out rather than hiding it.
- **Up to 5 named presets**, remembers your last-used style automatically.
- **Copy (Ctrl+C)** as a 2x PNG, **Save (Ctrl+S)** as PNG or JPG, or drag the result straight into another
  app.
- Native toast, tray icon with Pause, light/dark/system theme, sound effects - all off or mutable, and all
  optional.
- **Privacy first**: no network requests of any kind. Screenshots stay in memory and are only written to
  disk when you save.

## How it's built

One repo, two projects, one build:

- **`web/`** - the whole UI (editor, settings, welcome screen), a Next.js app statically exported
  (`output: "export"`) with no server. Styling with Tailwind, motion with Framer Motion, icons from
  Lucide.
- **`shell/`** - a small C# **WinUI 3** app that hosts the web export in **WebView2**, packaged as an
  **MSIX**. Everything that actually touches Windows lives here: the tray icon, the clipboard/folder
  watchers, the native toast, settings storage, and the bridge the web UI calls into.

The two talk to each other only through a small typed bridge (`web/lib/shell.ts` ↔
`shell/Services/Bridge.cs`), so the UI is easy to keep platform-neutral for later.

Rendering (`web/lib/render/`) is plain Canvas 2D, pure TypeScript, unit tested - the same code draws the
live preview and the final export, so what you see is exactly what you get.

## Getting started

**Prerequisites**

- Windows, with **Developer Mode** turned on (Settings → Privacy & security → For developers) - needed to
  install a locally-built MSIX without a trusted certificate.
- [Node.js](https://nodejs.org/) 20+.
- Visual Studio 2022 or newer with the **WinUI application development** workload.

**Everyday loop**

```bash
npm run dev
```

Starts `next dev` and launches the real WinUI shell pointed at `localhost:3000`, so edits under `web/`
hot-reload inside the actual app (tray icon, native toast, everything). Chrome DevTools for the WebView2
windows are at `http://localhost:9222` while this is running.

**Build an installable app**

```bash
npm run package        # signed with a local dev certificate, for testing
node scripts/install-local.mjs   # installs and launches it from dist/
```

or together in one step:

```bash
npm run gen-local
```

**Build for the Microsoft Store**

```bash
npm run package:store
```

Produces an **unsigned** `.msixupload` (Partner Center signs it on ingestion) and checks that the project
is actually associated with your Store reservation before it lets you think you're done. See
[`docs/store-submission.md`](docs/store-submission.md) for the full pre-submission checklist.

| Script | What it does |
| --- | --- |
| `npm run dev` | Hot-reloading dev loop against the real shell |
| `npm run build:web` | Static-exports the Next.js app into `shell/Assets/web` |
| `npm run build:shell` | Builds the WinUI shell (`--debug` / `--package` / `--store`) |
| `npm run package` | Web export + a signed sideload MSIX in `dist/` |
| `npm run package:store` | Web export + an unsigned Store-upload MSIX in `dist/` |
| `npm run gen-local` | `package` + install it locally in one step |
| `npm test` | Unit tests for `web/lib/render` |
| `npm run gen-icons` / `gen-sounds` | Regenerate the procedural bird icon/tile assets or placeholder sounds |

## Project layout

```
feathershot/
  web/                Next.js app (editor, settings, welcome) - statically exported
    app/              Routes/pages
    components/       Editor, chrome/title bar, shared controls, the bird mascot
    lib/              shell.ts (native bridge), render/ (pure canvas rendering, unit tested), sounds.ts
  shell/              WinUI 3 + WebView2 host, packaged as MSIX
    Services/         ClipboardWatcher, FolderWatcher, TrayService, WindowManager, Bridge, SettingsStore
    ToastWindow.xaml  Native "Beautify?" toast (no WebView, so it's instant)
  scripts/            Build tooling - web export, MSBuild packaging, local install, icon/sound generation
  docs/               requirements.md (source of truth), mvp-status.md (build log), store-submission.md
```