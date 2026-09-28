# Feathershot — Requirements

Sep 26, 2026 · @Chris

## Summary

Feathershot turns any Windows screenshot into a polished, share-ready image in seconds. It costs $1.99, runs fully offline, and ships to the Microsoft Store before Xnapper's Windows release.

- **Store title:** Feathershot – Screenshot Beautifier & Mockups.
- **Core flow:** press Win+Shift+S as usual, Feathershot catches the screenshot, you pick a style, press Ctrl+C, and paste anywhere.
- **The edge over Xnapper on Windows:** first to market, $1.99, works with the shortcut people already use, and offline and private.
- **Brand:** a small bird mascot, built on the idea that fine feathers make fine screenshots.
- **Stack:** Next.js static export hosted in WebView2 inside a small C# WinUI 3 shell, packaged as MSIX. One npm script builds everything. This replaces Electron, so the tray app stays light and the package stays small.
- **Suite role:** a $1.99 impulse buy that gets the account past the $50 payout threshold and links to the other apps.

## Project setup (already done)

The repo skeleton exists. Build on it, and don't regenerate either project.

```
feathershot/            # git repo root
  package.json          # created with npm init; add the build scripts here
  web/                  # created with create-next-app (TypeScript, Tailwind, ESLint, App Router, no src/)
  shell/
    Feathershot.sln     # created in Visual Studio from "Blank App, Packaged (WinUI 3 in Desktop)"
    Feathershot.csproj  # solution and project sit side by side in shell/
    Package.appxmanifest
    App.xaml, MainWindow.xaml, Assets/
  docs/requirements.md  # this document
  CLAUDE.md             # rules for the coding agent
```

**Machine setup**

- Visual Studio 2022 or newer with the WinUI application development workload.
- Windows Developer Mode is on, so packaged apps can be deployed locally.
- The empty shell runs with F5 from `shell\Feathershot.sln`.

**Still to do before the first coding session**

- [ ] Associate the project with the Feathershot Store listing: right-click the project, then Package and Publish, then Associate App with the Store.
- [ ] Set `output: 'export'`, `images: { unoptimized: true }` and `trailingSlash: true` in `web/next.config.ts`.
- [ ] Add `bin/`, `obj/`, `.vs/`, `AppPackages/`, `web/out/` and `shell/Assets/web/` to `.gitignore`.
- [ ] Add `CLAUDE.md` and this document as `docs/requirements.md`.

**Rules for the coding agent**

- Run all commands in PowerShell on Windows, not WSL.
- Edit the existing shell project. Don't create a new one or move files out of `shell/`.
- Don't add the WebView2 NuGet package; the Windows App SDK already includes it.
- Keep the three Next.js export settings above.
- No network calls anywhere in the app.
- `npm run package` must always produce an installable MSIX.

## Goals, non-goals and success metrics

Ship a small, fast, delightful v1 in three weekends and get reviews on the Store before a better-known competitor arrives.

**Goals**

- Launch on the Microsoft Store within three weekends.
- Screenshot to beautified image on the clipboard in under 10 seconds.
- Never make a network request.
- Stay light enough in the tray that users forget it's running.

**Non-goals for v1**

- Its own capture tool or Print Screen takeover (v1.1).
- Arrows, text boxes and other annotations beyond redaction (v2).
- Screen recording, scrolling capture, cloud upload or share links.
- Accounts or sync of any kind.

**Success metrics (first 60 days)**

| Metric | Target |
| --- | --- |
| Paid units | 30, enough on its own to clear the $50 payout threshold |
| Store page view to install | 3% or better |
| Rating | 4.5+ with at least 10 reviews |
| Idle memory in the tray | Under 60 MB |
| Screenshot detected to prompt shown | Under 300 ms |

## Screenshot detection

Feathershot hooks into the screenshots people already take rather than replacing their tool. It watches two sources and offers to beautify anything new.

### Sources

- **Clipboard (catches Win+Shift+S and Snipping Tool).** Listen with the Win32 AddClipboardFormatListener, which sends a WM\_CLIPBOARDUPDATE message on every change even while the app is in the background, so there's no polling. Hash each image to spot duplicates.
- **Screenshots folder (catches Win+PrintScreen and Snipping Tool auto-save).** Watch `Pictures\Screenshots`, with a FileSystemWatcher, resolving the real path when OneDrive has redirected Pictures.
- Each source can be switched on or off in settings.

### What happens when a screenshot is detected

1. A small toast slides in at the bottom-right: a thumbnail, the bird, and "Beautify?" It dismisses itself after 6 seconds.
2. Clicking it opens the editor with the screenshot loaded and the last-used style already applied.
3. A setting, **Open editor instantly**, skips the toast to match Xnapper's behaviour. It's off by default.

The toast is the default because clipboard watching can't tell a screenshot from any other copied image, such as a picture copied in a browser. A toast is easy to ignore, but a window popping up uninvited isn't.

### Rules that are easy to get wrong

- **Ignore Feathershot's own copies.** When the app puts a finished image on the clipboard, record its hash so it doesn't prompt itself.
- **Skip tiny images** under 50×50 px, such as icons copied by accident.
- **Show one toast at a time.** A new screenshot replaces the current toast rather than stacking.
- **Pause option:** "Pause for 1 hour" and "Pause until I resume" in the tray menu, for screen-sharing or gaming.

### Manual entry points

- Drag an image onto the tray icon or the editor.
- Open an image from the tray menu.
- "Open with Feathershot" for PNG and JPG files, registered through the MSIX file-type association.

## Editor features

One screen: the preview on the left, a short style panel on the right, and a large Copy button. Every control updates the preview live.

### Style

| Control | v1 options |
| --- | --- |
| Background | Auto (gradient built from the screenshot's own colours), 12 preset gradients, solid colour, custom image, transparent |
| Padding | Slider, 0–200 px |
| Corner radius | Slider, 0–40 px |
| Shadow | None, soft, medium, strong |
| Window frame | None, generic browser bar, generic app window (light or dark). Original designs, no copied OS or brand chrome |
| Canvas size | Auto, X/Twitter 16:9, LinkedIn 1.91:1, Square 1:1, Instagram 4:5, custom |
| Alignment | Centre, or pinned to any edge (for tall or wide captures) |
| Handle or watermark | Optional small text in a corner, such as @ChrisCreateGame |

**Auto background** is the signature feature: pick the 2 or 3 dominant colours in the screenshot and build a matching gradient, so every result looks designed with no effort.

### Redact

- Blur or pixelate brush, and a rectangle tool for quick boxes.
- Redactions are applied to the image pixels before export, never as a removable layer.

### Presets

- The last-used style is remembered and applied to the next screenshot automatically.
- Save up to 5 named presets, one-click from the editor.

### Export

- **Copy (Ctrl+C)** as PNG at 2× resolution. This is the main action, and the editor can close itself afterwards (a setting, on by default).
- **Save (Ctrl+S)** as PNG or JPG to a chosen folder. The default is `Pictures\Feathershot`.
- **Drag out** the finished image straight into Slack, Discord, email or a folder.
- Esc closes the editor without saving.

## Design, motion and sound

Priority order: UX first, then motion, then sound. Every interaction must work and feel good with animations off and sound muted. Motion and sound add delight on top, and never make the user wait.

### Look and feel

The theme is feather-light: airy, soft and a little playful, like the name.

- **Shapes:** rounded corners, generous whitespace, soft layered shadows. Nothing sharp or heavy.
- **Palette:** warm off-white base in light mode, deep ink in dark mode, and one signature accent gradient, "Plumage" (teal to violet to coral). The accent appears on the primary button, selections and the default background.
- **The bird:** a small round bird with one bright tail feather. It appears on the toast, the tray icon, empty states and the success moment, and blinks occasionally when idle. It must be an original design.
- **Bird-named gradient presets (12):** Plumage, Kingfisher, Flamingo, Bluejay, Canary, Robin, Peacock, Dove, Hummingbird, Oriole, Parrot, Owl. Each is a gradient inspired by that bird's colours. All other control labels stay plain ("Padding", "Shadow").
- **Typography:** one friendly rounded sans-serif under the SIL Open Font License, such as Nunito, bundled locally with no font CDN.
- **Icons:** one consistent open-licence set, such as Lucide, bundled locally.
- **Voice:** short, warm, lightly playful. Examples: the toast says "Beautify?"; on copy, "Fluffed up and copied!"; the empty state says "Take a screenshot with Win+Shift+S and I'll fluff it up."

### Motion

Motion should be fast, springy and interruptible: nothing blocks input, and any animation can be cut short by the next action. When Windows' "Animation effects" setting is off (`prefers-reduced-motion`), every animation becomes a simple crossfade.

| Moment | Animation | Timing |
| --- | --- | --- |
| Toast appears | Slides up 16 px and fades in; the bird hops once | 220 ms, spring |
| Toast dismisses | Fades and drifts down | 160 ms, ease-in |
| Editor opens | Screenshot scales from 0.96 to 1 and fades in; the style panel slides in from the right | 240 ms, ease-out |
| Any style change | Background crossfades; padding, radius and shadow tween | 180 ms, ease-out |
| Auto background | The gradient blooms outward from behind the screenshot | 400 ms |
| Preset hover | Thumbnail lifts slightly | 120 ms |
| Copy success | Image lifts (scale 1.02, deeper shadow), a few feathers float up from the button, the button morphs into "Copied" with a check | 500 ms; the editor auto-closes 700 ms later if that setting is on |
| Redaction | Blur fades in under the stroke as it's drawn | Live |
| Error | Gentle horizontal shake of the affected control | 250 ms |

- Editor animations: the `motion` library (Framer Motion) in the web app. Toast animations: WinUI composition animations in XAML.
- Target 60 fps. The preview renders at screen resolution so style changes redraw in under 16 ms; full 2× resolution only on export.

### Sound

- On by default at a gentle volume (40%), with a Mute toggle in settings and the tray menu. No sounds while Windows Do Not Disturb is on.
- Never loop, and never play more than one sound within 100 ms.

| Key | Moment | Character | Length |
| --- | --- | --- | --- |
| `toast.chirp` | Toast appears | Tiny two-note bird chirp | \~150 ms |
| `ui.tick` | Slider steps, preset selected | Soft tick | \~30 ms |
| `bg.whoosh` | Auto background blooms | Airy whoosh | \~300 ms |
| `copy.flutter` | Copy succeeds | Wing flutter with a light sparkle | \~400 ms |
| `save.pop` | Save completes | Soft pop | \~120 ms |
| `redact.swish` | Redaction stroke starts | Muted swish | \~100 ms |
| `error.soft` | Something fails | Low, gentle two-note tone | \~200 ms |

**Placeholders:** generate simple synthesized WAV files with a script (`scripts/gen-sounds`), so no third-party audio ships and there are no licensing questions. Put them in `web/public/sounds/`, with a copy of the chirp in `shell/Assets/sounds/` for the native toast.

**Swapping them later:** a single manifest, `web/lib/sounds.ts`, maps each key to a file name and volume. Replacing a WAV with one of the same name is all it takes to swap in a final sound.

**Playback:** Web Audio API with buffers preloaded when the editor opens, so there's no delay. The native toast plays its chirp from C# with `MediaPlayer`.

## Privacy, performance and tray behaviour

Screenshots often contain private messages, emails and dashboards, so nothing leaves the PC. The app also has to be light enough to live in the tray all day.

**Privacy**

- Block every navigation and request outside the app's own virtual host, using WebView2's NavigationStarting and WebResourceRequested events. No telemetry, analytics or crash reporting to any server.
- Strict Content Security Policy, with fonts and assets bundled.
- Screenshots are held in memory and only written to disk when the user saves.
- A one-paragraph privacy statement in the listing and the About screen.

**Performance**

- When idle, only the C# tray process runs. The editor's WebView2 is fully disposed, not hidden.
- Create the toast and editor windows on demand and destroy them on close.
- Budget: under 60 MB idle, prompt within 300 ms of detection, editor open within 1 second.
- The clipboard listener checks the format first and only reads and hashes the data when it's an image.

**Tray and startup**

- Tray icon (the bird) with: Open image, Pause, Settings, About, Quit.
- Start with Windows, on by default, through the MSIX startup task. The user can switch it off in settings or in Windows' own startup apps.
- First launch shows one welcome screen: "Take a screenshot with Win+Shift+S to try it." Then it gets out of the way.

## Technical architecture

One repo with two projects: a Next.js app for every screen the user works in, and a small C# WinUI 3 shell for everything that touches Windows. One npm script builds both into an MSIX.

```
feathershot/
  package.json        # npm scripts: dev, build:web, build:shell, package
  web/                # Next.js with output: 'export' — editor and settings pages
    lib/shell.ts      # typed bridge to the C# shell
    lib/render/       # pure TS: layout, gradients, colour extraction, canvas rendering
  shell/              # C# WinUI 3 "Blank App, Packaged" project (MSIX)
    Assets/web/       # the web export, copied in by the build
    Services/         # ClipboardWatcher, FolderWatcher, TrayService, WindowManager, Bridge
    ToastWindow.xaml  # native toast, no WebView, so it appears instantly
    Package.appxmanifest
  scripts/            # build helpers: copy the export, locate MSBuild with vswhere
```

### npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts `next dev` and launches the shell in Debug, with WebView2 pointed at `http://localhost:3000` for hot reload |
| `npm run build:web` | Runs the static export, then copies `web/out` into `shell/Assets/web` |
| `npm run build:shell` | Finds MSBuild with `vswhere` and builds the shell in Release |
| `npm run package` | Runs both, then produces the MSIX for Store upload |

### Shell (C#)

- Load the export with `SetVirtualHostNameToFolderMapping`, mapping `https://app.feathershot.local` to `Assets/web`. Debug builds load the Next.js dev server instead.
- Don't add the WebView2 NuGet package. The Windows App SDK already includes it, and adding it again causes type conflicts.
- Clipboard: `AddClipboardFormatListener` on a hidden message-only window, reacting to `WM_CLIPBOARDUPDATE`.
- Folder: `FileSystemWatcher` on the resolved Screenshots folder, waiting until each new file is fully written.
- Tray: the `H.NotifyIcon.WinUI` package.
- Toast: a native XAML window, so it appears within the 300 ms budget without starting WebView2.
- Editor: a window hosting WebView2, created on demand and disposed on close.
- Settings and presets: JSON in the app's `LocalFolder`.

### Bridge API (`web/lib/shell.ts`)

Calls go through `chrome.webview.postMessage` and `WebMessageReceived`, with a request id on each so every call returns a promise.

| Method | Purpose |
| --- | --- |
| `getPendingImage()` | Returns the screenshot that opened the editor, as PNG bytes |
| `copyImage(png)` | Puts the finished image on the clipboard and records its hash so it doesn't re-trigger the toast |
| `saveImage(png, format)` | Save dialog, defaulting to `Pictures\Feathershot` |
| `startDragOut(png)` | Drag the finished image into other apps |
| `getSettings()` / `setSettings(s)` | Read and write settings and presets |
| `closeEditor()` | Closes and disposes the editor window |

Keep this interface platform-neutral so it can later be implemented with Capacitor for Android.

### Rendering (`web/lib/render`)

- Plain Canvas 2D at 2×. The same code draws the live preview and the exported image, so what you see is exactly what you get.
- Colour extraction: downsample the screenshot and cluster the colours (a small k-means) to pick 2 or 3 gradient stops.
- Blur and pixelate applied to a copy of the pixel data.

### Packaging

- MSIX built by MSBuild from the WinUI 3 project, with identity values (name, publisher) taken from Partner Center.
- Publish .NET self-contained and trimmed, so users don't need a separate .NET install. Target a package under 50 MB.
- The manifest declares the startup task and PNG/JPG file associations.
- Run the Windows App Certification Kit locally before every submission.
- The build machine needs Visual Studio 2022 with the WinUI application development workload.

### Testing

- Unit tests on `web/lib/render`: layout maths, gradient stops, and presets saved and loaded.
- A manual pass each release: Win+Shift+S, Win+PrintScreen, Snipping Tool auto-save, copying an image in a browser (toast only, no auto-open), multiple monitors at 100% and 150% scaling, OneDrive-redirected Pictures, and idle memory with no window open.

## Store listing, branding and localization

The listing sells the before-and-after and the Win+Shift+S flow in the first screenshot.

- **Title:** Feathershot – Screenshot Beautifier & Mockups.
- **Short description:** "Win+Shift+S, then Feathershot. Beautiful screenshots in one click. Offline, no account, $1.99."
- **Category:** Photo & video, with Productivity as the fallback.
- **Keywords (7 max, task words only, no competitor names):** screenshot beautifier, screenshot editor, beautiful screenshots, screenshot background, mockup, redact screenshot, screenshot tool. Leave out "Snipping Tool", since it's Microsoft's product name and the same search-terms policy rejected Trello and Notion on Kanban Lite.
- **Screenshots:** light theme, 5 or more. Order: before and after, the toast appearing after Win+Shift+S, the auto background, the size presets, redaction.
- **Price:** $1.99 one-time. No trial and no in-app purchases for v1.
- **Mascot and icon:** a small, round bird with one bright feather. It appears on the toast, the tray and the icon, in a friendly and recognisable style that isn't a copy of any existing mascot.
- **Landing page:** a single page with a before-and-after slider and the Store link, so buyers who arrive through your own link earn you 95% instead of 85%.
- **Localization:** English, Spanish and German from day one, for the app and the listing.
- **Cross-promotion:** About screen and listing link to the photo scrubber and Kanban Lite.

## Milestones and roadmap

v1 ships in three weekends. Capture and annotations wait until there are reviews and feedback.

| Weekend | Deliverable | Done when |
| --- | --- | --- |
| 1 (Oct 3–4) | Shell template (WinUI 3, WebView2, bridge, npm scripts), tray, clipboard and folder detection, native toast, editor with backgrounds, padding, corners and shadow | Win+Shift+S to copied result works end to end, and npm run package produces an installable MSIX |
| 2 (Oct 10–11) | Auto background, frames, size presets, redaction, presets, save and drag-out, settings, network block, full motion pass, placeholder sounds wired in | Full manual test pass succeeds; idle under 60 MB |
| 3 (Oct 17–18) | Mascot and icon, localization, landing page, Store listing and screenshots, submission | Submitted to the Store |

You start at GK on Oct 5, the day after weekend 1. If that week runs long, move everything back a weekend rather than cutting auto background.

**v1.1**

- Print Screen takeover: register the key as a global shortcut, plus a button that opens `ms-settings:easeofaccess-keyboard` with a one-line instruction to switch off Windows' own Print Screen setting.
- Feathershot's own region capture across monitors, handling display scaling correctly.

**v2**

- Annotations: arrows, text, numbered steps, highlight.
- 3D tilt and device mockups.
- An Android version through Capacitor, working from the share sheet.

## Risks and open questions

The biggest risk is timing. Everything else is about keeping the tray app quiet and light.

| Risk | Mitigation |
| --- | --- |
| Xnapper launches on Windows first | Ship v1 lean in three weekends; don't wait for v1.1 features |
| The toast fires on images that aren't screenshots and annoys people | Toast by default rather than auto-open; skip tiny images; easy pause |
| The new C# shell and MSIX pipeline take longer than expected | Build and package an empty shell first on weekend 1. If it still isn't working by Oct 11, fall back to the existing Electron pipeline for v1 |
| The clipboard listener misses images or fires twice | Hash-based detection, ignore Feathershot's own copies, cover it in the manual test pass |
| The design looks like Xnapper or another tool | Original frames, gradients, mascot and copy; take ideas, never assets |
| The startup task or file associations fail MSIX certification | Test the package locally with the Windows App Certification Kit before submitting |
| Dragging the finished image out of WebView2 into other apps is fiddly | Implement drag-out natively in the shell. If it slips, move it to v1.1, since Copy and Save cover the core flow |
| The package grows too large once .NET is bundled | Publish self-contained with trimming and check the MSIX size on every build against the 50 MB target |

**Open questions**

- [ ] Name reserved in Partner Center, and a domain for the landing page?
- [ ] Start with Windows on by default, or ask on first launch?
- [ ] Should the "Open editor instantly" setting become the default after the user's first 5 screenshots?
- [ ] Keep v1 at exactly $1.99, or launch at $1.99 and raise to $2.99 after reviews come in?
