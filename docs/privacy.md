---
title: FeedMiles — Privacy Policy
permalink: /privacy
---

# FeedMiles — Privacy Policy

_Last updated: September 8, 2026_

FeedMiles is a browser extension that measures how far you scroll on websites you choose to track and shows that scrolling as real-world distance. This policy explains what the extension does with data. The short version: **everything stays on your device, and nothing is sent anywhere.**

## What FeedMiles collects

FeedMiles records, **locally on your device only**:

- **Scroll distance** — the number of pixels scrolled per tracked website per day, plus the approximate time you were actively scrolling. It does **not** record what you scrolled past: no page content, URLs beyond the site's domain name (e.g. `instagram.com`), posts, images, messages, or account information.
- **Settings** — your screen-size calibration, unit preference, theme, alert preferences, and the list of sites you chose to track.
- **Milestone state** — which real-world comparison you last passed today, so the same alert isn't repeated.

FeedMiles does **not** collect personal information, browsing history, form data, cookies, login state, or anything typed on a page.

## Where the data lives

All data is stored using Chrome's `chrome.storage.local` API on your computer. It is never transmitted to the developer or to any third party. FeedMiles makes **no network requests** of any kind — there are no servers, no analytics, no crash reporting, no advertising SDKs, and no accounts.

You can export your data as a JSON file or delete it at any time from the extension's Settings page (*Your data → Export / Reset*). Uninstalling the extension removes all of its stored data.

## Permissions and why they are needed

| Permission | Why |
|---|---|
| Access to specific social-media sites (Facebook, Instagram, X/Twitter, TikTok, YouTube, Reddit, LinkedIn, Threads, Pinterest) | To run the small script that measures scrolling on those pages. |
| Optional access to other sites | Only when **you** add a site in Settings. Chrome asks for your consent for that one site; FeedMiles never requests access to all websites. |
| Storage | To save your distance history and settings on your device. |
| Scripting | To enable measurement on sites you add yourself. |
| Alarms | To refresh the toolbar badge when the day changes. |
| Notifications | To show the optional milestone reminders you can turn off. |
| Offscreen | To play the optional, quiet milestone chime (Chrome extensions can only play audio from an offscreen page). |

## Children

FeedMiles does not knowingly collect any information from anyone, including children, because it collects nothing off-device.

## Changes

If this policy changes, the updated version will be published at the same URL with a new "last updated" date. Material changes will be noted in the extension's release notes.

## Contact

Questions about privacy: open an issue at https://github.com/badruddin-tasnim/feedmiles/issues
