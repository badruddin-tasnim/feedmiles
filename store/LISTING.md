# FeedMiles — Chrome Web Store listing

## Store metadata

| Field | Value |
|---|---|
| **Name** | FeedMiles |
| **Summary** (≤132 chars) | How many miles of feed today? Turns your social-media scrolling into real-world distance — meters, km, Eiffel Towers. |
| **Category** | Lifestyle → Well-being *(alt: Productivity → Workflow & Planning)* |
| **Language** | English |
| **Website** | https://github.com/badruddin-tasnim/feedmiles |
| **Support** | https://github.com/badruddin-tasnim/feedmiles/issues |
| **Privacy policy URL** | https://badruddin-tasnim.github.io/feedmiles/privacy  _(fallback if Pages is off: https://github.com/badruddin-tasnim/feedmiles/blob/main/store/PRIVACY.md)_ |
| **Pricing** | Free |
| **Visibility** | Public |

**Character counts:** summary above = 128 chars.

## Detailed description

> Paste into the "Description" field. Plain text; the store strips markdown.

```
How many miles of feed did you scroll today?

Screen-time apps tell you how LONG you scrolled. FeedMiles tells you how FAR. Every pixel your feed moves past your eyes is measured and converted into real-world distance using your actual screen size — then shown as something you can picture:

  "1.4 km today  ≈  4.2× the Eiffel Tower"

WHAT IT DOES
• Measures scrolling on Facebook, Instagram, X/Twitter, TikTok, YouTube, Reddit, LinkedIn, Threads and Pinterest — or any site you add yourself
• Shows today / 7-day / 30-day / all-time distance with an animated dashboard
• Real-world comparisons: giraffe → school bus → blue whale → Boeing 747 → Eiffel Tower → Burj Khalifa → Everest → marathon → the Moon
• "Next milestone" progress bar and a daily bar chart
• Per-site breakdown with share and active-time
• Toolbar badge with today's total
• Light and dark mode

GENTLE MILESTONE ALERTS
Each time today's scrolling passes a real-world object, FeedMiles gives you a nudge: a small card slides in under the toolbar icon, a silent system notification appears, and a soft two-note chime plays (quiet by design, adjustable, each part switchable). Alerts are spaced out so they encourage a break instead of nagging.

HONEST MEASUREMENT
Browsers don't reveal a monitor's physical size, so FeedMiles auto-detects it from your resolution, display scaling and platform — and tells you how confident it is. Verify in seconds by holding a bank card against the on-screen outline, or set the size manually. All history is stored in pixels, so changing calibration recalculates everything correctly.

PRIVACY FIRST
Everything stays on your device in the extension's local storage. FeedMiles makes no network requests, has no analytics, no accounts and no tracking. Custom sites ask for permission individually — FeedMiles never requests access to all websites.

OPEN SOURCE
Built with Manifest V3. Source and issues: https://github.com/badruddin-tasnim/feedmiles
```

## Single-purpose statement

> Required by the Web Store's single-purpose policy. Field: "Single purpose description".

```
FeedMiles measures how far a user scrolls on social-media sites they choose to track and displays that scrolling as real-world distance (meters/kilometers and comparisons to familiar objects), with optional milestone reminders to encourage breaks.
```

## Screenshots (1280×800)

| # | File | Caption idea |
|---|---|---|
| 1 | `store/screenshot-1-popup.png` | Your feed, in kilometers. Today / week / month / all-time. |
| 2 | `store/screenshot-2-alert.png` | A gentle nudge when you pass the Eiffel Tower. |
| 3 | `store/screenshot-3-settings.png` | Auto-detects your screen size — verify with a bank card. |
| 4 | `store/screenshot-4-dark.png` | Dark mode, per-site breakdown, next milestone. |

Promo assets: `store/promo-small-440x280.png` (required small tile), `store/promo-marquee-1400x560.png` (optional marquee), `store/icon-128.png` (store icon), `icons/icon512.png` (source).

## Pre-submission checklist

- [ ] Bump `version` in `manifest.json` for every upload
- [ ] Zip the **contents** of the `feedmiles/` folder (manifest.json at the zip root), excluding `test/`, `make_icons.py`, `store/`
- [ ] Privacy policy URL is live (https://badruddin-tasnim.github.io/feedmiles/privacy) and matches `PRIVACY.md`
- [ ] Permission justifications pasted from `PERMISSIONS.md` into the Privacy tab
- [ ] Data-use disclosure: tick **"does not collect or use user data"**; certify the three statements (no selling, no unrelated use, no creditworthiness use)
- [ ] Remove `optional_host_permissions` warning concerns by explaining runtime, per-site consent (see PERMISSIONS.md)
- [ ] Test on a fresh Chrome profile: install → welcome page opens → screen detected → scroll Instagram → badge updates → alert fires
- [ ] Screenshots are exactly 1280×800 (or 640×400), PNG/JPEG, no rounded corners/transparency
- [ ] Small promo tile 440×280 present (required for featuring)
