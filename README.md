# FeedMiles 📏

> How many miles of feed today?

[![Release](https://github.com/badruddin-tasnim/feedmiles/actions/workflows/release.yml/badge.svg)](https://github.com/badruddin-tasnim/feedmiles/actions/workflows/release.yml) · [Latest release](https://github.com/badruddin-tasnim/feedmiles/releases/latest) · [Privacy policy](https://badruddin-tasnim.github.io/feedmiles/privacy) · [Report an issue](https://github.com/badruddin-tasnim/feedmiles/issues)

> How far did you *really* scroll today? FeedMiles turns your social-media
> thumbing into real-world distance — meters, kilometers, Eiffel Towers.

Most screen-time tools tell you *how long* you scrolled. FeedMiles tells you
**how far**: every pixel your feed moves past your eyes is measured, converted
using your monitor's physical size, and shown as a distance you can picture
("≈ 3.2× the Eiffel Tower", "1.4 km — a 5K run is 3.6 km away").

## Install (unpacked, Chrome / Edge / Brave)

1. Download `feedmiles-store.zip` from the [latest release](https://github.com/badruddin-tasnim/feedmiles/releases/latest) and unzip it somewhere permanent (Chrome loads it from that folder).
2. Open `chrome://extensions`, turn on **Developer mode** (top-right).
3. Click **Load unpacked** and pick the unzipped folder (the one containing `manifest.json`).
4. The settings page opens automatically and **auto-detects your screen size**
   (e.g. "15.6-inch laptop · high confidence"). Hold a bank card against the
   outline to check it, click **Looks right**, or **Set manually** if it's off.
5. Pin the icon and go scroll something. Reload any feed tabs that were already open.

## What it tracks

Built-in (toggle on/off in Settings): Facebook, Instagram, X/Twitter, TikTok,
YouTube, Reddit, LinkedIn, Threads, Pinterest.

**Custom sites:** type a name (`9gag`, `tumblr`), a domain, or a full URL in
Settings → Tracked sites → *Add site*. Chrome will ask once for permission to
that site only; FeedMiles never requests access to all websites.

## How the math works

```
PPI    = √(width² + height²) / diagonalInches      (width/height in device pixels)
meters = scrolledDevicePixels / PPI × 0.0254
```

### How the screen size is detected

No web API reveals a monitor's physical size, so FeedMiles estimates it in layers
(`shared/detect.js`) and tells you how confident it is:

1. **Known-panel lookup** — device resolution + OS display scaling + platform is a
   strong fingerprint (operating systems choose scaling from physical pixel density).
   `1920×1080 @125% on Windows` → 15.6" laptop; `1512×982 @2x on macOS` → MacBook Pro 14";
   `2560×1440 @100%` → 27" monitor; `3440×1440` → 34" ultrawide, and ~80 more.
2. **Precise mode (opt-in)** — the *Detect precisely* button uses the Window
   Management API (Chrome asks once). It tells us whether the screen is a laptop's
   built-in panel and gives the monitor's name; model numbers usually encode the
   size (`DELL U2415` → 24", `LG 27GN800` → 27").
3. **Formula fallback** — platform baseline PPI × scaling factor, flagged as a rough estimate.

Manual override is always available (presets or any diagonal in inches). Switching
between auto and manual never loses data, because history is stored in pixels.
If you move the window to a different monitor, auto mode re-detects; manual mode
keeps your value and shows a heads-up.

- Scroll deltas are captured from the window *and* inner scroll containers
  (Instagram/Facebook/TikTok feeds scroll a `<div>`, not the page).
- Single jumps larger than 4000 px are ignored — those are route changes or
  "back to top", not human scrolling.
- Distances are stored in device pixels, so changing the calibration later
  re-computes all history correctly.
- Everything lives in `chrome.storage.local`. No network requests, no analytics.

## Milestone alerts

Every time today's total passes a real-world object (from a giraffe upward — no
banana spam), FeedMiles nudges you to look up:

- a **small popup on the page** that slides in under the toolbar icon and fades after 7 s,
- a **system notification** (silent — we bring our own sound),
- a **soft two-note chime** synthesised with Web Audio in an offscreen document
  (MV3 service workers can't play audio). Volume is capped low and adjustable.

Alerts are spaced out (the next one needs ≥1.2× the last distance), reset daily,
and each channel can be switched off in Settings → Milestone alerts, where a
**Test alert** button previews the whole thing.

## Popup

- **Today / 7 days / 30 days / All time** with an animated distance and the
  best-fitting real-world comparison.
- **Next milestone** progress bar (banana → giraffe → Eiffel Tower → Everest → the Moon).
- **Daily bar chart** (7 or 30 days) with hover details.
- **By site** breakdown with share bars and active-time per platform.
- Light & dark mode (follows system, or force in Settings). Toolbar badge shows
  today's total.

## Project layout

```
manifest.json          MV3 manifest
background.js          service worker: aggregates distance, badge, custom-site scripts
content.js             injected into tracked sites; measures scroll deltas, shows milestone toast
offscreen.html|js      offscreen document that plays the soft chime (Web Audio)
popup/                 dashboard UI
options/               settings: calibration, sites, theme/units, data export
shared/units.js        px→m conversion, formatting, comparisons
shared/detect.js       screen-size detection (panel table, label parsing, fallback)
shared/calibration.js  calibration lifecycle (auto / manual / re-detect on new screen)
shared/sites.js        preset platforms, host normalization/matching
shared/theme.css|js    design tokens + light/dark handling
test/run.mjs           Node test harness (node test/run.mjs)
```

## Development

```bash
node test/run.mjs      # unit tests + simulated feed + background logic
python3 make_icons.py  # regenerate icons
```

## License

MIT — see [LICENSE](LICENSE).
