/**
 * Node test harness (no browser needed):
 *  1. unit tests for conversion / site matching
 *  2. simulated content script on a fake infinite feed
 *  3. background worker record() logic against a fake chrome.storage
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const units = await import(path.join(root, 'shared/units.js'));
const sitesMod = await import(path.join(root, 'shared/sites.js'));

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

console.log('\n[1] units.js');
t('ppi from 24" 1920x1080 ≈ 92', () => {
  const ppi = units.ppiFromDiagonal(24, { w: 1920, h: 1080, dpr: 1 });
  assert.ok(Math.abs(ppi - 91.8) < 0.2, ppi);
});
t('1080 px on a 24" 1080p screen ≈ 0.30 m (screen height)', () => {
  const ppi = units.ppiFromDiagonal(24, { w: 1920, h: 1080, dpr: 1 });
  const m = units.pxToMeters(1080, ppi);
  assert.ok(Math.abs(m - 0.299) < 0.005, m);
});
t('formatDistance metric thresholds', () => {
  assert.equal(units.formatDistance(0.42).text, '42 cm');
  assert.equal(units.formatDistance(12.345).text, '12.3 m');
  assert.equal(units.formatDistance(1500).text, '1.5 km');
});
t('formatDistance imperial', () => {
  assert.equal(units.formatDistance(10, 'imperial').unit, 'ft');
  assert.equal(units.formatDistance(5000, 'imperial').unit, 'mi');
});
t('badgeText compact', () => {
  assert.equal(units.badgeText(0), '');
  assert.equal(units.badgeText(482), '482m');
  assert.equal(units.badgeText(1240), '1.2k');
  assert.equal(units.badgeText(25000), '25k');
});
t('bestComparison picks largest fitting object', () => {
  const c = units.bestComparison(1000);
  assert.equal(c.name, 'the Burj Khalifa');
  assert.ok(c.text.startsWith('≈ 1.2×'), c.text);
  assert.ok(units.bestComparison(0.1).text.includes('% of a banana'));
});
t('nextMilestone progress in [0,1] and remaining > 0', () => {
  const n = units.nextMilestone(300);
  assert.equal(n.name, 'the Eiffel Tower');
  assert.ok(n.progress > 0 && n.progress < 1);
  assert.ok(Math.abs(n.remaining - 30) < 1e-9);
});
t('lastNDays returns n keys ending today', () => {
  const k = units.lastNDays(7);
  assert.equal(k.length, 7);
  assert.equal(k[6], units.dateKey());
});

console.log('\n[1b] detect.js');
const detect = await import(path.join(root, 'shared/detect.js'));
t('roundDpr snaps to common scaling steps', () => {
  assert.equal(detect.roundDpr(1.2490234), 1.25);
  assert.equal(detect.roundDpr(1.4999), 1.5);
  assert.equal(detect.roundDpr(2.0000001), 2);
});
const est = (w, h, dpr, os, extra = {}) => detect.estimateScreen({ w, h, dpr, os, ...extra });
t('MacBook Air M2 (1470×956 logical @2x) → 13.6" high', () => {
  const r = est(2940, 1912, 2, 'mac'); assert.equal(r.inches, 13.6); assert.equal(r.confidence, 'high');
});
t('MacBook Pro 14 → 14.2", MBP 16 → 16.2"', () => {
  assert.equal(est(3024, 1964, 2, 'mac').inches, 14.2);
  assert.equal(est(3456, 2234, 2, 'mac').inches, 16.2);
});
t('Windows 1920×1080 @125% → 15.6" laptop high', () => {
  const r = est(1920, 1080, 1.25, 'win'); assert.equal(r.inches, 15.6); assert.equal(r.confidence, 'high');
});
t('Windows 1920×1080 @150% → 14" laptop', () => assert.equal(est(1920, 1080, 1.5, 'win').inches, 14));
t('Windows 1920×1080 @100% ambiguous → 24" desktop, medium; touch hint → 15.6" laptop', () => {
  const r = est(1920, 1080, 1, 'win'); assert.equal(r.inches, 24); assert.equal(r.confidence, 'medium');
  const r2 = est(1920, 1080, 1, 'win', { touch: true }); assert.equal(r2.inches, 15.6);
  const r3 = est(1920, 1080, 1, 'win', { kindHint: 'desktop' }); assert.equal(r3.inches, 24);
});
t('2560×1440 @100% → 27" high; 3440×1440 → 34" ultrawide', () => {
  assert.equal(est(2560, 1440, 1, 'win').inches, 27);
  assert.equal(est(3440, 1440, 1, 'linux').inches, 34);
});
t('portrait monitor is normalised (1440×2560 → 27")', () => assert.equal(est(1440, 2560, 1, 'win').inches, 27));
t('Surface Laptop 2256×1504 @150% → 13.5"', () => assert.equal(est(2256, 1504, 1.5, 'win').inches, 13.5));
t('unknown resolution falls back to formula with low confidence', () => {
  const r = est(2000, 1300, 1.25, 'win'); assert.equal(r.method, 'formula'); assert.equal(r.confidence, 'low');
  assert.ok(r.inches > 14 && r.inches < 20, r.inches);
  const m = est(3300, 2100, 2, 'mac'); assert.ok(m.inches > 15 && m.inches < 19, m.inches);
});
t('parseInchesFromLabel reads monitor model numbers', () => {
  const p = detect.parseInchesFromLabel;
  assert.equal(p('DELL U2415'), 24);
  assert.equal(p('LG ULTRAGEAR 27GN800'), 27);
  assert.equal(p('Samsung C27F390'), 27);
  assert.equal(p('BenQ GW2480'), 24);
  assert.equal(p('Gigabyte M32U'), 32);
  assert.equal(p('LG 34WN80C-B'), 34);
  assert.equal(p('DELL S3222DGM'), 32);
  assert.equal(p('Acer 27-inch Predator'), 27);
  assert.equal(p('Built-in Retina Display'), null);
  assert.equal(p('Generic PnP Monitor'), null);
  assert.equal(p('Samsung Odyssey G9'), null);
  assert.equal(p('LG HDR 4K'), null);
});
t('platformInfo detects OS from userAgentData / platform', () => {
  assert.equal(detect.platformInfo({ userAgentData: { platform: 'macOS' }, maxTouchPoints: 0 }).os, 'mac');
  assert.equal(detect.platformInfo({ platform: 'Win32', maxTouchPoints: 10 }).touch, true);
  assert.equal(detect.platformInfo({ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64)' }).os, 'cros');
});

console.log('\n[2] sites.js');
t('normalizeHost handles names, aliases, urls', () => {
  assert.equal(sitesMod.normalizeHost('9gag'), '9gag.com');
  assert.equal(sitesMod.normalizeHost('https://www.tumblr.com/dashboard'), 'tumblr.com');
  assert.equal(sitesMod.normalizeHost('twitter'), 'x.com');
  assert.equal(sitesMod.normalizeHost('Twitter.com'), 'x.com');
  assert.equal(sitesMod.normalizeHost('  IG '), 'instagram.com');
  assert.equal(sitesMod.normalizeHost('news.ycombinator.com'), 'news.ycombinator.com');
  assert.equal(sitesMod.normalizeHost('??'), null);
});
t('matchTrackedHost walks subdomains & merges', () => {
  const s = sitesMod.defaultSites();
  assert.equal(sitesMod.matchTrackedHost('m.facebook.com', s), 'facebook.com');
  assert.equal(sitesMod.matchTrackedHost('www.instagram.com', s), 'instagram.com');
  assert.equal(sitesMod.matchTrackedHost('mobile.twitter.com', s), 'x.com');
  assert.equal(sitesMod.matchTrackedHost('old.reddit.com', s), 'reddit.com');
  assert.equal(sitesMod.matchTrackedHost('example.org', s), null);
});

// ---------------------------------------------------------------------------
console.log('\n[3] content.js simulated feed');
{
  const sent = [];
  const listeners = { scroll: [], resize: [], visibilitychange: [], pagehide: [], unload: [] };
  let nowMs = 0;
  class FakeElement { constructor() { this.scrollTop = 0; this.scrollLeft = 0; } }
  const feed = new FakeElement();
  const doc = {
    addEventListener: (ev, fn) => listeners[ev]?.push(fn),
    visibilityState: 'visible',
    documentElement: {}, body: {},
  };
  const win = {
    scrollX: 0, scrollY: 0, devicePixelRatio: 2,
    addEventListener: (ev, fn) => listeners[ev]?.push(fn),
  };
  const ctx = {
    window: win, document: doc, location: { hostname: 'www.instagram.com' },
    Element: FakeElement,
    performance: { now: () => nowMs },
    Date, Math, Number, WeakMap, setInterval: () => 1, clearInterval: () => {},
    chrome: { runtime: { sendMessage: (m) => sent.push(m), onMessage: { addListener() {} }, lastError: null } },
  };
  ctx.window.window = win; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // Run content.js with `window`/`document` resolving to our fakes.
  vm.runInContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), ctx);

  const fire = (target) => listeners.scroll.forEach((fn) => fn({ target }));
  const flush = () => listeners.visibilitychange.forEach((fn) => { doc.visibilityState = 'hidden'; fn(); doc.visibilityState = 'visible'; });

  // hello sent on load
  assert.equal(sent[0].type, 'hello');

  // 1) inner-container scroll: 50 events of 120px
  fire(feed); // baseline
  for (let i = 1; i <= 50; i++) { feed.scrollTop = i * 120; nowMs += 40; fire(feed); }
  // 2) window scroll 10 events of 300px, including scrolling back up
  fire(doc);
  for (let i = 1; i <= 10; i++) { win.scrollY = (i % 2 ? 300 : 0); nowMs += 40; fire(doc); }
  // 3) programmatic jump (route change) — should be ignored
  feed.scrollTop += 20000; fire(feed);
  nowMs += 1000;
  flush();

  const scrollMsgs = sent.filter((m) => m.type === 'scroll');
  assert.equal(scrollMsgs.length, 1);
  const m = scrollMsgs[0];
  t('css px = 50×120 + 10×300 = 9000, jump ignored', () => assert.equal(m.cssPx, 9000));
  t('device px doubles with DPR 2', () => assert.equal(m.devicePx, 18000));
  t('active ms accrued while scrolling', () => assert.ok(m.ms > 0 && m.ms <= 10000, m.ms));
  t('host reported', () => assert.equal(m.host, 'www.instagram.com'));
}

// ---------------------------------------------------------------------------
console.log('\n[4] background.js record + badge');
{
  const store = { sites: sitesMod.defaultSites() };
  const badge = {};
  const listeners = {};
  const notifs = [];
  const tabMsgs = [];
  const runtimeMsgs = [];
  let offscreenCreated = 0;
  const chrome = {
    notifications: { create: (id, opts, cb) => { notifs.push(opts); cb && cb(); }, clear() {}, onClicked: { addListener() {} } },
    offscreen: { createDocument: async () => { offscreenCreated++; } },
    storage: { local: {
      get: async (keys) => { const out = {}; for (const k of [].concat(keys)) if (k in store) out[k] = structuredClone(store[k]); return out; },
      set: async (obj) => Object.assign(store, structuredClone(obj)),
    } },
    action: { setBadgeText: async ({ text }) => { badge.text = text; }, setBadgeBackgroundColor: async () => {}, setBadgeTextColor: async () => {} },
    runtime: {
      onMessage: { addListener: (fn) => (listeners.msg = fn) }, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, getURL: (p) => p,
      getContexts: async () => [], sendMessage: async (m) => { runtimeMsgs.push(m); },
    },
    alarms: { create() {}, onAlarm: { addListener() {} } },
    scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async () => {}, unregisterContentScripts: async () => {} },
    permissions: { contains: async () => true, remove: async () => {} },
    tabs: { query: async () => [], sendMessage: async (id, m) => { tabMsgs.push({ id, m }); }, create() {} },
  };
  globalThis.chrome = chrome;
  await import(path.join(root, 'background.js'));
  await new Promise((r) => setTimeout(r, 20));
  const call = (msg) => new Promise((res) => { const r = listeners.msg(msg, { tab: { id: 1 } }, res); if (r === false) res(); });

  // Two concurrent messages from different tabs must both be counted.
  await Promise.all([
    call({ type: 'scroll', host: 'www.instagram.com', devicePx: 18000, ms: 3000 }),
    call({ type: 'scroll', host: 'm.facebook.com', devicePx: 9000, ms: 1500 }),
    call({ type: 'scroll', host: 'evil.example.com', devicePx: 99999, ms: 1500 }), // untracked
  ]);
  await new Promise((r) => setTimeout(r, 50));
  const today = units.dateKey();
  t('daily totals recorded per tracked host, untracked ignored', () => {
    assert.equal(store.daily[today]['instagram.com'].px, 18000);
    assert.equal(store.daily[today]['facebook.com'].px, 9000);
    assert.equal(Object.keys(store.daily[today]).length, 2);
  });
  t('all-time totals match', () => assert.equal(store.totals['instagram.com'].px + store.totals['facebook.com'].px, 27000));
  t('badge shows a dot before calibration exists (no extension page opened yet)', () => {
    assert.equal(badge.text, '•');
  });
  // Simulate the popup/options page having calibrated the screen.
  store.settings = { ...store.settings, diagonalInches: 24, screenW: 1920, screenH: 1080, calibration: { mode: 'auto', inches: 24 } };
  await call({ type: 'settings-changed' });
  await new Promise((r) => setTimeout(r, 30));
  t('badge shows today in meters once calibrated', () => {
    const ppi = units.ppiFromDiagonal(24, { w: 1920, h: 1080 });
    const expected = units.badgeText(units.pxToMeters(27000, ppi));
    assert.equal(badge.text, expected);
    console.log('     badge =', badge.text);
  });
  // ---- milestone alerts ----
  t('no alerts while uncalibrated (meters unknown)', () => assert.equal(notifs.length, 0));
  // Now calibrated: +4000 px → 31000 px ≈ 8.6 m on 24"/1080p → passes "a giraffe" (5.5 m), under the bus (12 m)
  await call({ type: 'scroll', host: 'instagram.com', devicePx: 4000, ms: 0 });
  await new Promise((r) => setTimeout(r, 30));
  t('first alert names the giraffe, silent system notification', () => {
    assert.equal(notifs.length, 1, JSON.stringify(notifs));
    assert.ok(notifs[0].title.includes('giraffe'), notifs[0].title);
    assert.equal(notifs[0].silent, true);
  });
  t('alert fans out to the page toast and the offscreen chime', () => {
    assert.ok(tabMsgs.some((x) => x.m.type === 'milestone' && x.id === 1));
    assert.equal(offscreenCreated, 1);
    assert.ok(runtimeMsgs.some((x) => x.type === 'play-chime' && x.target === 'offscreen'));
  });
  // A bit more (still < 12 m) → no new alert
  await call({ type: 'scroll', host: 'instagram.com', devicePx: 3000, ms: 0 });
  await new Promise((r) => setTimeout(r, 30));
  t('no duplicate alert between milestones', () => assert.equal(notifs.length, 1));
  // Big jump to ~140 m: passes bus, T-rex, whale, 747, Liberty, Big Ben, pitch, Pyramid → exactly one alert, for the largest
  await call({ type: 'scroll', host: 'instagram.com', devicePx: 480000, ms: 0 });
  await new Promise((r) => setTimeout(r, 30));
  t('one alert per crossing, naming the largest object passed', () => {
    assert.equal(notifs.length, 2);
    assert.ok(notifs[1].title.includes('Great Pyramid'), notifs[1].title);
  });
  // Alerts disabled → nothing more
  store.settings = { ...store.settings, alerts: { enabled: false } };
  await call({ type: 'scroll', host: 'instagram.com', devicePx: 900000, ms: 0 });
  await new Promise((r) => setTimeout(r, 30));
  t('alerts respect the master switch', () => assert.equal(notifs.length, 2));
  store.settings = { ...store.settings, alerts: { enabled: true, sound: false } };
  await call({ type: 'test-alert' });
  t('test-alert fires a notification and skips the chime when sound is off', () => {
    assert.equal(notifs.length, 3);
    assert.equal(runtimeMsgs.filter((x) => x.type === 'play-chime').length, 2);
  });

  // toggling off stops recording
  await call({ type: 'toggle-site', host: 'facebook.com', enabled: false });
  await call({ type: 'scroll', host: 'facebook.com', devicePx: 5000, ms: 0 });
  await new Promise((r) => setTimeout(r, 30));
  t('disabled site no longer accumulates', () => assert.equal(store.daily[today]['facebook.com'].px, 9000));
  t('content.js toast listener wiring exists', () => {
    const src = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
    assert.ok(src.includes("msg.type === 'milestone'") && src.includes('attachShadow'));
  });
  await call({ type: 'reset-data' });
  await new Promise((r) => setTimeout(r, 30));
  t('reset clears data and badge', () => { assert.deepEqual(store.totals, {}); assert.equal(badge.text, ''); });
}

console.log("\n[5] manifest");
t("manifest description ≤ 132 chars (Chrome Web Store limit)", () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.ok(m.description.length <= 132, m.description.length);
  assert.ok(m.name.length <= 45);
});

console.log(`\n${passed} checks passed ✅`);
