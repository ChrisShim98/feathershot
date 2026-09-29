# Microsoft Store listing - English (first round)

Ready to paste into Partner Center's Store listing page. Localized (Spanish, German) versions come in a
later round per `docs/requirements.md`.

Price used throughout: **$4.99** (the marketing site was updated to this from the original $1.99 in
`requirements.md` - everything below matches the site).

## Product name

Feathershot – Screenshot Beautifier & Mockups

## Short description

Used for search-result teasers and anywhere Partner Center wants a one-liner. 96 characters.

> Win+Shift+S, then Feathershot. Beautiful screenshots in one click. Offline, no account, $4.99.

## Description

Paste as-is - the bullet points below use a plain `•` so they render fine in Partner Center's description
field without needing markdown support.

```
Feathershot turns any Windows screenshot into a polished, share-ready image in seconds.

Press Win+Shift+S exactly like you already do. Feathershot catches the screenshot, offers to beautify
it, and gets out of the way. Pick a style, press Ctrl+C, and paste your polished image anywhere - Slack,
docs, email, wherever it needs to go.

FEATURES

• Auto backgrounds - Feathershot samples the dominant colors in your screenshot and builds a matching
gradient automatically, or choose from 12 bird-named gradient presets, a solid color, a custom image, or
transparent.
• Mockup frames - padding, corner radius, shadow, and browser or app window frames, with canvas presets
for X/Twitter, LinkedIn, Instagram, Square, or a custom size.
• Redact anything - blur brush, pixelate brush, and a box tool, baked into the pixels before export so
nothing is accidentally reversible.
• Highlight what matters - a soft, translucent color brush for pointing something out instead of hiding
it.
• Named presets - save up to 5 styles, and Feathershot remembers your last-used look automatically.
• Copy, save, or drag out - copy a crisp 2x PNG with Ctrl+C, save as PNG or JPG, or drag the result
straight into another app.
• Catches screenshots automatically - watches the clipboard (Win+Shift+S, Snipping Tool, or any copied
image) and the Screenshots folder, with no polling.
• A quick editor for any image - copy any picture with Ctrl+C and Feathershot picks it up like an
always-available photo editor.

PRIVATE BY DESIGN

Feathershot makes no network requests of any kind - no analytics, no telemetry, no ads, no cloud upload.
Your screenshots stay in memory and are only written to disk when you choose to save. There's no account
and nothing to sign in to.

ONE-TIME PURCHASE

$4.99, once. No subscription, no trial that expires, no features locked behind a plan.
```

## What's new (v1.0.0 release notes)

> Initial release. Auto backgrounds, redact & highlight tools, mockup frames, canvas presets, named
> styles, and automatic screenshot capture - all fully offline.

## Category

- **Primary:** Photo & video
- **Fallback**, only if Partner Center rejects that for some reason: Productivity

## Search terms (max 7, task words only - no competitor or Microsoft product names)

1. screenshot beautifier
2. screenshot editor
3. beautiful screenshots
4. screenshot background
5. mockup
6. redact screenshot
7. screenshot tool

`"Snipping Tool"` is deliberately left out - it's a Microsoft product name, and the same search-terms
policy already rejected competitor names like Trello/Notion on Kanban Lite's listing.

## Screenshots - light theme, in this order

Real captures of the running app now live in `docs/store-screenshots/`, ready to upload as-is:

1. **[01-before-after.png](store-screenshots/01-before-after.png)** - the raw capture next to the beautified result.
   Caption: *Turn any screenshot into a polished, share-ready image.*
2. **[02-toast.png](store-screenshots/02-toast.png)** - the "Beautify?" toast after Win+Shift+S.
   Caption: *Catches your screenshot the moment you take it.*
3. **[03-auto-background.png](store-screenshots/03-auto-background.png)** - the gradient built from the screenshot's own colors.
   Caption: *Auto backgrounds pick colors straight from your screenshot.*
4. **[04-canvas-presets.png](store-screenshots/04-canvas-presets.png)** - the Square (1:1) canvas preset applied.
   Caption: *Ready-made sizes for every platform you post to.*
5. **[05-redact.png](store-screenshots/05-redact.png)** - the box-redaction tool covering part of the image.
   Caption: *Blur, pixelate, or box out anything private before you share.*

All five were captured from the real, packaged app (Light theme, confirmed in Settings) using a VS Code
window as realistic stand-in content, since no actual product screenshots existed yet. The dark tone in
screenshots 1 and 3 is the auto-background feature genuinely sampling colors from that dark code editor —
not a theme bug. Swap in screenshots of real, more colorful content (a dashboard, a chat, a light-mode
app) before final submission if a livelier gradient is wanted for the hero shot.

## Age ratings questionnaire

Feathershot has no user-generated content, no online interaction, no network access, no ads, and no
in-app purchases beyond the app's own listed price - answer "No" to essentially every content question.
That should land the lowest rating tier in every ratings board (e.g. ESRB Everyone / PEGI 3 / Microsoft
"Ages 3+").

## Support info fields

- **Website:** the marketing site URL (`SITE_URL` in `feathershot-marketing/lib/constants.ts`)
- **Support contact info:** the contact email (`CONTACT_EMAIL` in the same file)
- **Privacy policy URL:** `<site>/privacy` - needs to actually be live at that URL before submission
- **Copyright and trademark info:** e.g. `© 2026 <publisher name>. Feathershot and the Feathershot bird
  mark are trademarks of <publisher name>.` - fill in the name you want shown publicly (your Store
  publisher display name is `Christopher Shim`, per `Package.StoreAssociation.xml`, but you may want a
  business name here instead).

## Still needs a real value before submission

- `STORE_URL` is now live: `https://apps.microsoft.com/detail/9NT86PWCRC0P`.
- `CONTACT_EMAIL` and `SITE_URL` in `feathershot-marketing/lib/constants.ts` are still placeholders
  (`feathershotapp.com` domain isn't registered yet, as far as I know) - once you pick a real domain and
  contact address, update them there and the whole site + this listing stay in sync.
- The 5 screenshots in `docs/store-screenshots/` use a VS Code window as stand-in content. Worth
  reshooting with something more visually appealing (a colorful dashboard, a chat, a browser page) before
  the actual submission, since the auto-background gradient looks best against colorful source material.
