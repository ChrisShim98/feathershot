# Feathershot - rules for the coding agent

Read `docs/requirements.md` first. It is the source of truth.

- Run all commands in PowerShell on Windows, not WSL.
- Edit the existing shell project in `shell/`. Do not create a new one or move files out of it.
- Do not add the WebView2 NuGet package; the Windows App SDK already includes it.
- Keep `output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: true` in `web/next.config.ts`.
- No network calls anywhere in the app (no CDNs, no telemetry, no font CDN).
- `npm run package` must always produce an installable MSIX.
- Web UI lives in `web/`, everything that touches Windows lives in `shell/`. They talk only through `web/lib/shell.ts` <-> `shell/Services/Bridge.cs`.
- Render code (`web/lib/render`) is pure TS, shared by preview and export, and unit tested (`npm test`).
