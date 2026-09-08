/**
 * FeedMiles — background service worker (MV3, ES module)
 *
 * Storage layout (chrome.storage.local):
 *   settings : { diagonalInches, units, theme, badge, installedAt }
 *   sites    : { [host]: { name, color, colorDark, enabled, custom } }
 *   daily    : { 'YYYY-MM-DD': { [host]: { px, ms } } }   // px = device pixels
 *   totals   : { [host]: { px, ms } }
 */
import { defaultSites, matchTrackedHost, normalizeHost, prettyName, colorForCustom } from './shared/sites.js';
import { dateKey, ppiFromDiagonal, pxToMeters, badgeText, formatDistance, COMPARISONS } from './shared/units.js';

const KEEP_DAYS = 120;
const MIN_MILESTONE_M = 5;      // don't nag about bananas
const MILESTONE_GAP = 1.2;      // next alert only when ≥ 1.2× the last one (dedupes bus vs T-rex)

const DEFAULT_ALERTS = { enabled: true, system: true, inPage: true, sound: true, volume: 0.4 };

const DEFAULT_SETTINGS = {
  // diagonalInches / calibration are filled in by auto-detection the first time an
  // extension page (options on install, or the popup) can see the real screen.
  diagonalInches: null,
  calibration: null,
  units: 'metric',
  theme: 'system',
  badge: true,
  alerts: DEFAULT_ALERTS,
  // Screen resolution as last seen by an extension page (popup/options), so the
  // worker (which has no `screen`) can compute PPI for the badge.
  screenW: 1920,
  screenH: 1080,
  installedAt: Date.now(),
};

// ---------- storage helpers ----------
const get = (keys) => chrome.storage.local.get(keys);
const set = (obj) => chrome.storage.local.set(obj);

async function ensureInitialized() {
  const { settings, sites } = await get(['settings', 'sites']);
  const patch = {};
  if (!settings) patch.settings = { ...DEFAULT_SETTINGS, installedAt: Date.now() };
  if (!sites) patch.sites = defaultSites();
  if (Object.keys(patch).length) await set(patch);
}

// Serialize writes: messages from many tabs can arrive concurrently and
// read-modify-write on storage would otherwise lose increments.
let queue = Promise.resolve();
function enqueue(fn) {
  queue = queue.then(fn, fn);
  return queue;
}

// ---------- recording ----------
async function record(pageHost, devicePx, ms, tabId) {
  const { sites = {}, daily = {}, totals = {} } = await get(['sites', 'daily', 'totals']);
  const host = matchTrackedHost(pageHost, sites);
  if (!host || !sites[host]?.enabled) return;

  const key = dateKey();
  daily[key] ??= {};
  daily[key][host] ??= { px: 0, ms: 0 };
  daily[key][host].px += devicePx;
  daily[key][host].ms += ms;

  totals[host] ??= { px: 0, ms: 0 };
  totals[host].px += devicePx;
  totals[host].ms += ms;

  // prune old days
  const keys = Object.keys(daily).sort();
  while (keys.length > KEEP_DAYS) delete daily[keys.shift()];

  await set({ daily, totals });
  await updateBadge(daily[key]);
  await checkMilestone(daily[key], key, tabId, sites[host].name);
}

// ---------- milestone alerts ----------
function todayMeters(settings, todayMap) {
  if (!settings.diagonalInches) return 0;
  const px = Object.values(todayMap || {}).reduce((a, v) => a + (v.px || 0), 0);
  const ppi = ppiFromDiagonal(settings.diagonalInches, { w: settings.screenW || 1920, h: settings.screenH || 1080 });
  return pxToMeters(px, ppi);
}

/** Alert once per real-world object crossed today, spaced out so it stays encouraging, not nagging. */
async function checkMilestone(todayMap, key, tabId, siteName) {
  const { settings = DEFAULT_SETTINGS, milestones = {} } = await get(['settings', 'milestones']);
  const alerts = { ...DEFAULT_ALERTS, ...(settings.alerts || {}) };
  if (!alerts.enabled) return;
  const m = todayMeters(settings, todayMap);
  if (m < MIN_MILESTONE_M) return;

  const state = milestones.date === key ? milestones : { date: key, lastM: 0, count: 0 };
  // Largest object we've now passed
  let reached = null;
  for (const c of COMPARISONS) { if (c.m <= m && c.m >= MIN_MILESTONE_M) reached = c; else if (c.m > m) break; }
  if (!reached || reached.m <= state.lastM || reached.m < state.lastM * MILESTONE_GAP) return;

  await set({ milestones: { date: key, lastM: reached.m, count: state.count + 1, lastName: reached.name, at: Date.now() } });
  await fireAlert({ comparison: reached, meters: m, settings, alerts, tabId, siteName, count: state.count + 1 });
}

const NUDGES = [
  'A good moment to look up.',
  'Your thumb has earned a stretch.',
  'Blink. Breathe. Maybe close the tab?',
  'That\'s a lot of feed. Water break?',
  'Look at something 20 feet away for 20 seconds.',
  'The feed will still be there later.',
];

async function fireAlert({ comparison, meters, settings, alerts, tabId, siteName, count }) {
  const dist = formatDistance(meters, settings.units).text;
  const title = `${comparison.emoji} You just scrolled ${comparison.name}`;
  const body = `${dist} on social media today${siteName ? ` (mostly ${siteName})` : ''}. ${NUDGES[(count - 1) % NUDGES.length]}`;

  if (alerts.system && chrome.notifications) {
    chrome.notifications.create(`sm-${Date.now()}`, {
      type: 'basic', iconUrl: 'icons/icon128.png', title, message: body, silent: true, priority: 1,
    }, () => void chrome.runtime.lastError);
  }
  if (alerts.inPage && tabId != null) {
    chrome.tabs.sendMessage(tabId, { type: 'milestone', emoji: comparison.emoji, title, body, dist }).catch(() => {});
  }
  if (alerts.sound) await playChime(alerts.volume);
}

async function playChime(volume) {
  try {
    if (!chrome.offscreen) return;
    const contexts = await chrome.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).catch(() => []);
    if (!contexts || !contexts.length) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play a soft chime when a scroll-distance milestone is reached',
      }).catch((e) => { if (!/single offscreen|already exists/i.test(String(e))) throw e; });
    }
    await chrome.runtime.sendMessage({ type: 'play-chime', target: 'offscreen', volume });
  } catch (e) {
    console.warn('chime unavailable', e);
  }
}

/** Preview the alert from the options page. */
async function testAlert() {
  const { settings = DEFAULT_SETTINGS, daily = {} } = await get(['settings', 'daily']);
  const alerts = { ...DEFAULT_ALERTS, ...(settings.alerts || {}) };
  const m = Math.max(todayMeters(settings, daily[dateKey()]), 330);
  let reached = COMPARISONS[0];
  for (const c of COMPARISONS) { if (c.m <= m) reached = c; else break; }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  await fireAlert({ comparison: reached, meters: m, settings, alerts: { ...alerts, enabled: true }, tabId: tab?.id, siteName: null, count: 1 });
  return { ok: true };
}

// ---------- badge ----------
async function updateBadge(todayMap) {
  const { settings = DEFAULT_SETTINGS, daily = {} } = await get(['settings', 'daily']);
  if (!settings.badge) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const today = todayMap || daily[dateKey()] || {};
  const px = Object.values(today).reduce((a, v) => a + (v.px || 0), 0);
  if (!settings.diagonalInches) {
    // Not calibrated yet (no extension page has opened) — pixels are still being
    // recorded; show a dot so the user knows to open the popup once.
    await chrome.action.setBadgeBackgroundColor({ color: '#7C3AED' });
    await chrome.action.setBadgeText({ text: px > 0 ? '•' : '' });
    return;
  }
  const ppi = ppiFromDiagonal(settings.diagonalInches, { w: settings.screenW || 1920, h: settings.screenH || 1080 });
  const meters = pxToMeters(px, ppi);
  await chrome.action.setBadgeBackgroundColor({ color: '#7C3AED' });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  await chrome.action.setBadgeText({ text: badgeText(meters, settings.units) });
}

// ---------- custom sites (dynamic content scripts) ----------
function scriptIdFor(host) {
  return 'sm-' + host.replace(/[^a-z0-9]/gi, '_');
}

async function registerCustomScript(host) {
  const id = scriptIdFor(host);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] }).catch(() => []);
  if (existing.length) return;
  await chrome.scripting.registerContentScripts([{
    id,
    matches: [`*://*.${host}/*`, `*://${host}/*`],
    js: ['content.js'],
    runAt: 'document_idle',
    persistAcrossSessions: true,
  }]);
}

async function unregisterCustomScript(host) {
  await chrome.scripting.unregisterContentScripts({ ids: [scriptIdFor(host)] }).catch(() => {});
}

async function syncCustomScripts() {
  const { sites = {} } = await get(['sites']);
  for (const [host, s] of Object.entries(sites)) {
    if (!s.custom) continue;
    const granted = await chrome.permissions.contains({ origins: [`*://*.${host}/*`] }).catch(() => false);
    if (granted) await registerCustomScript(host).catch((e) => console.warn('register failed', host, e));
  }
}

async function addCustomSite(rawInput) {
  const host = normalizeHost(rawInput);
  if (!host) return { ok: false, error: 'That doesn\'t look like a valid site.' };
  const { sites = {} } = await get(['sites']);
  if (sites[host]) {
    if (!sites[host].enabled) {
      sites[host].enabled = true;
      await set({ sites });
      return { ok: true, host, existed: true };
    }
    return { ok: false, error: `${sites[host].name} is already tracked.` };
  }
  // Permission must already have been granted by the options page (user gesture).
  const granted = await chrome.permissions.contains({ origins: [`*://*.${host}/*`] });
  if (!granted) return { ok: false, error: 'Permission for this site was not granted.', needsPermission: true, host };
  sites[host] = { name: prettyName(host), color: colorForCustom(host), colorDark: colorForCustom(host), enabled: true, custom: true };
  await set({ sites });
  await registerCustomScript(host);
  return { ok: true, host };
}

async function removeCustomSite(host) {
  const { sites = {}, totals = {}, daily = {} } = await get(['sites', 'daily', 'totals']);
  if (!sites[host]) return { ok: false };
  const wasCustom = sites[host].custom;
  delete sites[host];
  delete totals[host];
  for (const day of Object.values(daily)) delete day[host];
  await set({ sites, totals, daily });
  if (wasCustom) {
    await unregisterCustomScript(host);
    await chrome.permissions.remove({ origins: [`*://*.${host}/*`] }).catch(() => {});
  }
  await updateBadge();
  return { ok: true };
}

async function broadcastSiteState(host, enabled) {
  const tabs = await chrome.tabs.query({}).catch(() => []);
  for (const t of tabs) {
    if (!t.url) continue;
    let h;
    try { h = new URL(t.url).hostname; } catch { continue; }
    if (h === host || h.endsWith('.' + host)) {
      chrome.tabs.sendMessage(t.id, { type: 'site-state', enabled }).catch(() => {});
    }
  }
}

// ---------- messaging ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'scroll') {
    const px = Number(msg.devicePx) || 0;
    const ms = Math.max(0, Math.min(Number(msg.ms) || 0, 10000)); // cap: one flush ≤ 10s
    if (px > 0 || ms > 0) enqueue(() => record(msg.host, px, ms, sender.tab?.id));
    sendResponse?.({ ok: true });
    return false;
  }

  if (msg.type === 'hello') {
    (async () => {
      const { sites = {} } = await get(['sites']);
      const host = matchTrackedHost(msg.host, sites);
      const enabled = !!(host && sites[host]?.enabled);
      sendResponse({ type: 'site-state', enabled });
      if (sender.tab?.id != null) chrome.tabs.sendMessage(sender.tab.id, { type: 'site-state', enabled }).catch(() => {});
    })();
    return true;
  }

  if (msg.type === 'add-site') {
    enqueue(() => addCustomSite(msg.input)).then(sendResponse);
    return true;
  }
  if (msg.type === 'remove-site') {
    enqueue(() => removeCustomSite(msg.host)).then(sendResponse);
    return true;
  }
  if (msg.type === 'toggle-site') {
    enqueue(async () => {
      const { sites = {} } = await get(['sites']);
      if (sites[msg.host]) {
        sites[msg.host].enabled = !!msg.enabled;
        await set({ sites });
        await broadcastSiteState(msg.host, !!msg.enabled);
        await updateBadge();
      }
      return { ok: true };
    }).then(sendResponse);
    return true;
  }
  if (msg.type === 'settings-changed') {
    enqueue(() => updateBadge()).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'test-alert') {
    testAlert().then(sendResponse);
    return true;
  }
  if (msg.type === 'reset-data') {
    enqueue(async () => {
      await set({ daily: {}, totals: {}, milestones: {} });
      await updateBadge();
      return { ok: true };
    }).then(sendResponse);
    return true;
  }
  return false;
});

// ---------- lifecycle ----------
chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureInitialized();
  await syncCustomScripts();
  await updateBadge();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html?welcome=1') });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureInitialized();
  await syncCustomScripts();
  await updateBadge();
});

chrome.notifications?.onClicked.addListener((id) => {
  if (String(id).startsWith('sm-')) chrome.notifications.clear(id);
});

// Refresh the badge shortly after local midnight so "today" resets.
chrome.alarms.create('sm-midnight', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'sm-midnight') updateBadge(); });

// Worker may be woken by a message before onStartup fires — be safe.
ensureInitialized().then(updateBadge).catch(() => {});
