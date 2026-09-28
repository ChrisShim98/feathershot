# Submitting to the Microsoft Store

`npm run package:store` builds `dist/Feathershot_<version>.msixupload`. It's **unsigned on purpose** —
Partner Center signs the package itself when it ingests your submission, so there's nothing to sign
locally for this path (that's different from `npm run package`, which signs with a local dev certificate
so *you* can install and test the result before it ever goes near the Store).

Go through this list before you upload it. Most of it is one-time setup; a few items apply to every release.

**Already done:** the project is associated with the Store reservation (`shell/Package.StoreAssociation.xml`
is present and its Publisher matches `Package.appxmanifest`'s Identity — `npm run package:store` checks this
automatically on every run and warns if they ever drift apart, e.g. after a hand-edit to the manifest or a
fresh clone that's missing the association file).

## One-time, before your first submission

- [ ] **Run the Windows App Certification Kit** at least once (Visual Studio's Publish wizard has a
      "Run tests" step, or run `appcert.exe` from the Windows SDK directly). This is the automated
      pre-check Partner Center itself runs, and it catches manifest/capability problems before you burn a
      submission cycle on them. The requirements doc calls for this before *every* submission, not just
      the first.
- [ ] **Write a privacy policy page and host it somewhere with a URL** (even a single static page). Partner
      Center's submission form requires a privacy policy URL for essentially all apps, including ones like
      this with nothing to disclose — the in-app privacy paragraph in Settings isn't a substitute for that
      field.
- [ ] **Store listing assets**: description, the 7 keywords, category (Photo & video, fallback
      Productivity), and 5+ light-theme screenshots in the order the requirements doc lays out (before/after,
      the toast, auto background, size presets, redaction). None of this blocks the package build, but the
      submission can't complete without it.
- [ ] **Age ratings questionnaire** — Partner Center requires this per submission the first time; answers
      are simple for an app with no user content or network access.

## Worth a look, not blocking

- **Architecture coverage.** This builds x64 only. The Store accepts an x64-only submission fine, and
  everything so far has only been tested on x64 — I'd ship v1 this way rather than introduce untested
  ARM64/x86 cross-builds this late. Worth adding ARM64 in a follow-up update once x64 has real reviews,
  since Surface Pro X and other ARM devices can't install an x64-only package. (Multi-architecture support
  slots into `scripts/build-shell.mjs`'s `--store` branch as `/p:AppxBundlePlatforms` + `/p:AppxBundle=Always`
  when you're ready for it — flag me and I'll wire it up.)
- **Package version.** `1.0.0.0` in both `Package.appxmanifest` and the root `package.json` — fine for a
  first submission. Every subsequent submission needs a higher version, so this needs bumping by hand
  before each one (nothing currently automates that).
- **`MaxVersionTested`** in the manifest is `10.0.19041.0` (Windows 10 20H2-era). No need to change it —
  it's a compatibility hint, not a hard requirement — but bumping it after you've tested on a newer Windows
  build can unlock newer visual/behavioral defaults on those machines.
- **Package size.** Last measured at 29.9 MB, comfortably under the 50 MB target this project set for
  itself. `package:store` prints a warning if a future build creeps past 50 MB.

## Every release after the first

1. Bump the version (manifest + `package.json`).
2. `npm run package:store`.
3. Run WACK again.
4. Upload the new `.msixupload` in a new Partner Center submission.
