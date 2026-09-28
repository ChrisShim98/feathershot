# MVP status (overnight build, 2026-09-26)

## Commands
| Command | What it does |
| --- | --- |
| `npm run dev` | `next dev` + Debug shell installed loose; loads `localhost:3000` (hot reload). DevTools: http://localhost:9222 |
| `npm run build:web` | Static export, copied to `shell/Assets/web` |
| `npm run build:shell` | Release build via vswhere/MSBuild (`--debug`, `--package` flags) |
| `npm run package` | `build:web` + signed sideload `.msix` and Store `.msixupload` in `dist/` (~30 MB) |
| `node scripts/install-local.mjs` | Register the packaged build from `dist/` for testing (no cert trust needed, Developer Mode) |
| `npm test` | Vitest on `web/lib/render` (20 tests) |
| `npm run gen-sounds` / `gen-icons` | Regenerate placeholder WAVs / bird icons and tile assets |

## Verified working (run in the real packaged app)
- Clipboard watcher: image detected, tiny images (<50 px) rejected, duplicates rejected, own copies ignored.
- Folder watcher: file dropped in `Pictures\Screenshots` detected.
- Native toast: bottom-right, ~6 s auto-dismiss, no focus steal.
- Editor in WebView2 (virtual host, bridge round trips), Auto background, Copy -> 2x PNG on the clipboard, auto-close.
- Idle with no window open: ~22 MB working set, 0 WebView2 processes (Debug build).
- Single instance; second launch opens the editor.

## Written but NOT visually/interactively verified
- Toast animations and chirp, tray menu items (pause/mute/quit), Save dialog, file association ("Open with"), startup task, redaction brush, presets UI, frames, canvas sizes, drag-out, sounds in the editor. Screen capture was unavailable, so only the editor page was checked (via DevTools screenshots).
- Native drag-out is a stub (returns false); the editor uses an HTML5 drag handle, best effort.

## Decisions made after the initial build (live, by @Chris)
These reverse or resolve specific calls made in `docs/requirements.md`:
- **"Open editor instantly" is now the default** (was off). Any caught screenshot *or copied image* opens
  straight into the editor with no toast prompt. This also resolves the doc's open question about making
  it the default after 5 screenshots — it's the default from install now.
- **Catching any copied image (not just screenshots) is now a stated feature, not an edge case to avoid.**
  The requirements doc treated "the toast fires on images that aren't screenshots" as a risk to mitigate
  with a toast-first flow; live testing showed people want this — copy any image, Ctrl+C, and Feathershot
  opens it for a quick edit, working like a lightweight always-available image editor. Copy across the app
  (empty state, welcome screen, Settings hints) was updated to describe this directly rather than only
  mentioning Win+Shift+S. The toast-first flow still exists (toggle off "Open editor instantly" in Settings)
  for anyone who finds instant-open too eager.
- **Tray menu redesigned to match the Claude desktop app's shape:** Open window / Version (label) / Pause
  (submenu: For 1 hour / Until I resume / Resume) / Exit. The original doc's Settings/About/Open-image tray
  entries were dropped; Settings/About are now reached via a gear icon in the editor's top-left instead.
- Fixed a real crash: H.NotifyIcon delivers tray input on its own thread, not the UI thread: touching a
  XAML window from that handler directly (the original single-click-opens-editor code) throws off-thread,
  which is unhandled and kills the whole process — this is what made double-clicking the tray icon "fully
  close" the app. Fixed by marshaling every tray-triggered action through the UI dispatcher.
- Feathershot's own toast now anchors higher up (one notification's height of clearance) so it doesn't
  land in the exact same spot as Windows' own Snipping Tool toast and lose the z-order fight it can't win
  (system toasts render in a shell-reserved z-band above any app's "always on top"). Settings also has a
  guided link (`ms-settings:notifications`) to switch Snipping Tool's own notification off entirely.

## Later fixes (after @Chris's GUI overhaul: glass panels, native-feeling custom title bar, dark mode)
- **Custom title bar caption buttons didn't work.** WebView2 hosts content in its own child window, which
  claims all mouse input in its bounds — including wherever the system draws the extended title bar's
  minimize/maximize/close buttons — unless told otherwise. Fixed with `IsNonClientRegionSupportEnabled` plus
  marking the empty toolbar space `app-region: drag`, but the no-drag exclusion around the button strip
  originally used normal flex flow, which only reached the true right edge by coincidence (when other
  toolbar content filled the space). A sparse header (Settings' small title, Welcome's empty one) left it
  short, so the exclusion is now pinned there with `margin-left: auto` regardless of what precedes it.
- **A new window (first opening Settings) could open behind the Editor.** Windows' foreground-lock timeout
  can silently refuse a plain `Activate()` for a window created from a click inside another of the app's
  own WebView2 windows. Fixed with a topmost-toggle + `SetForegroundWindow` push (`WebWindow.ActivateInFront`),
  which isn't subject to that lock since it's a z-order change, not a focus request.
- `autoClose` ("Close the editor after copying") now defaults to **off**, not on.
- Global cursor fix: `body` sets `cursor: default` (so native controls don't get a text-style pointer),
  which every button/link then inherited instead of a clickable cursor. Fixed with a blanket rule for
  `button`/`[role="button"]`/`a[href]`, plus explicit `cursor-pointer` on `IconButton` and the theme toggle
  specifically (WebView2's `app-region: drag` can override inherited cursor styling on plain descendants).
- Added a highlighter tool (5 preset colours, soft-edged, builds up like a real marker) alongside
  blur/pixelate/box in the redact dock — `stampHighlight` in `web/lib/render/redact.ts`.
- `npm run package:store` — a dedicated **unsigned** `.msixupload` build for Partner Center (Store re-signs
  on ingestion, so no local cert). Warns automatically if `Package.appxmanifest`'s Identity Publisher and
  `Package.StoreAssociation.xml` ever disagree. (The project was already associated with the Store
  reservation before this session started — confirmed via that same file, an MSA-account GUID-style
  Publisher, not a placeholder.) Checklist: `docs/store-submission.md`.

## Known gaps / next
- Localization (es/de) not started (weekend 3). Only English strings, inline.
- WCAG/keyboard pass, real mascot polish, landing page, Store listing assets, WACK run.
- ARM64/x86 builds not produced (x64 only). `H.NotifyIcon.WinUI` is pinned to 2.3.2 (2.4+ needs net10).
- WebView2 virtual hosts don't serve `index.html` for folder URLs, so the shell navigates to `.../index.html` explicitly.
- Diagnostics log (local only): `%LOCALAPPDATA%\Packages\<pkg>\LocalState\feathershot.log`.
- Repo: `web/` has its own nested `.git` (from create-next-app); the root is not yet a git repo.
