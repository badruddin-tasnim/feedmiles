# FeedMiles — Permission justifications

> Paste these into the Chrome Web Store Developer Dashboard → **Privacy practices** tab. Each field has a ~1000-character limit; these are all well under.

## Single purpose

FeedMiles measures how far a user scrolls on social-media sites they choose to track and displays that scrolling as real-world distance (meters/kilometers and comparisons to familiar objects), with optional milestone reminders to encourage breaks.

## `storage`

Stores the user's scroll-distance history (pixels per site per day), screen-size calibration, unit/theme preferences, alert preferences and the list of tracked sites in `chrome.storage.local`. All data stays on the device; nothing is synced or transmitted.

## `scripting`

Used only to register the measurement content script for sites the user adds manually in Settings (via `chrome.scripting.registerContentScripts`) and to unregister it when the user removes that site. The built-in social platforms are covered by static content scripts declared in the manifest.

## `alarms`

A low-frequency alarm (every 30 minutes) refreshes the toolbar badge so "today's distance" resets at local midnight even when no tracked tab is open.

## `notifications`

Shows the optional milestone reminder ("You just scrolled the Eiffel Tower — 330 m today") when the day's scrolling passes a real-world object. Notifications are silent, spaced out, and can be disabled entirely in Settings.

## `offscreen`

Manifest V3 service workers cannot play audio. An offscreen document (reason: `AUDIO_PLAYBACK`) synthesises the optional soft milestone chime with Web Audio. It is created on demand only when the sound alert is enabled and a milestone is reached.

## Host permissions (declared)

`*://*.facebook.com/*`, `*://*.instagram.com/*`, `*://*.x.com/*`, `*://*.twitter.com/*`, `*://*.tiktok.com/*`, `*://*.youtube.com/*`, `*://*.reddit.com/*`, `*://*.linkedin.com/*`, `*://*.threads.net/*`, `*://*.threads.com/*`, `*://*.pinterest.com/*`

The extension's core function is measuring scrolling on social-media feeds. A content script on these domains listens to scroll events and reports the number of pixels scrolled (and nothing else — no page content, URLs or user data) to the extension's background worker. Each platform can be toggled off in Settings.

## Optional host permissions

`*://*/*` (declared under `optional_host_permissions` only)

Users can add any website to track (e.g. a forum or news site). When they do, Chrome prompts for access to **that specific origin only**, requested at runtime from a user gesture in the Settings page. The extension never requests, and cannot obtain, blanket access to all sites without a per-site prompt. Removing a site revokes its permission.

## Remote code

FeedMiles does **not** use remote code. All JavaScript is packaged in the extension. The only external resource is an optional Google Fonts stylesheet (`fonts.googleapis.com`) for typography on the extension's own popup/settings pages, which is CSS only and falls back to system fonts offline.

## Data usage disclosure

- Does the extension collect or use user data? **No.**
- Personally identifiable information: **Not collected**
- Health, financial, authentication, personal communications, location, web history, user activity, website content: **Not collected**

Scroll-distance figures are computed and stored locally and never leave the device.

Certifications (tick all three):
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes
