import { SCREEN_PRESETS, deviceResolution, ppiFromDiagonal, pxToMeters, formatDistance, INCH_M } from '../shared/units.js';
import { normalizeHost, PRESET_SITES } from '../shared/sites.js';
import { applyTheme, loadSettings } from '../shared/theme.js';
import { ensureCalibration, setManualCalibration, setAutoCalibration, confirmCalibration } from '../shared/calibration.js';
import { detectPrecise, estimateScreen, platformInfo } from '../shared/detect.js';

const $ = (id) => document.getElementById(id);
let settings, sites;
let manualOpen = false;

const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, (r) => res(r || {})));

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

async function saveSettings(patch) {
  settings = { ...settings, ...patch };
  await chrome.storage.local.set({ settings });
  send({ type: 'settings-changed' });
}

// =====================================================================
// Screen size / calibration
// =====================================================================
const KIND_ICON = { laptop: '💻', desktop: '🖥️', tablet: '📱' };

function renderCalibration() {
  const c = settings.calibration;
  const res = deviceResolution();
  const ppi = ppiFromDiagonal(settings.diagonalInches, res);
  const scale = Math.round(res.dpr * 100);

  // Detected card
  $('detIcon').textContent = KIND_ICON[c?.kind] || '🖥️';
  $('detSize').textContent = c ? `${c.inches}-inch screen` : 'Unknown screen';
  const mode = $('detMode');
  mode.textContent = c?.mode === 'manual' ? 'manual' : 'auto';
  const conf = $('detConf');
  conf.className = 'pill conf';
  if (c?.mode === 'manual') { conf.hidden = true; }
  else if (c?.confirmed) { conf.hidden = false; conf.textContent = '✓ confirmed'; conf.classList.add('confirmed'); }
  else { conf.hidden = false; conf.textContent = { high: 'high confidence', medium: 'medium confidence', low: 'rough estimate' }[c?.confidence] || ''; conf.classList.add(c?.confidence || 'low'); }

  const osName = { mac: 'macOS', win: 'Windows', cros: 'ChromeOS', linux: 'Linux', android: 'Android', ios: 'iOS' }[c?.os || platformInfo().os] || '';
  $('detDevice').textContent = c?.mode === 'manual'
    ? `You set this by hand · ${res.w} × ${res.h} @ ${scale}% ${osName}`
    : `${c?.device || 'Unrecognised display'} · ${res.w} × ${res.h} @ ${scale}% · ${osName}`;

  $('confirmBtn').hidden = !c || c.mode === 'manual' || c.confirmed;
  const note = $('detNote');
  if (c?.mode === 'manual' && c.screenChanged) {
    note.textContent = '⚠️ Your screen resolution changed since you set this (different monitor?). Your manual size is kept — re-check with the card outline or go back to automatic.';
  } else if (c?.mode === 'auto' && c.confidence === 'low' && !c.confirmed) {
    note.textContent = 'We couldn\'t recognise this display, so this is a formula-based estimate. Please check it against a bank card below, or set it manually.';
  } else if (c?.mode === 'auto' && c.confidence === 'medium' && !c.confirmed) {
    note.textContent = 'Several common displays share this resolution and scaling. Quick check: does a bank card fit the outline below?';
  } else {
    note.textContent = '';
  }

  // Manual panel
  const manual = $('manual');
  manual.hidden = !(manualOpen || c?.mode === 'manual');
  $('diagonal').value = settings.diagonalInches ?? '';
  const match = SCREEN_PRESETS.find((p) => Math.abs(p.inches - settings.diagonalInches) < 0.05);
  $('preset').value = match ? String(match.inches) : 'custom';
  $('backAutoBtn').hidden = c?.mode !== 'manual';

  // Readouts + bank-card outline (85.60 × 53.98 mm)
  $('resText').textContent = `${res.w} × ${res.h}${res.dpr !== 1 ? ` @ ${scale}%` : ''}`;
  $('ppiText').textContent = `${Math.round(ppi)} PPI`;
  $('screenM').textContent = formatDistance(pxToMeters(res.h, ppi), settings.units).text;
  const mmToCss = (mm) => (mm / 1000 / INCH_M) * ppi / res.dpr;
  const cc = $('cardOutline');
  cc.style.width = `${mmToCss(85.6).toFixed(1)}px`;
  cc.style.height = `${mmToCss(53.98).toFixed(1)}px`;
}

async function applyManual(v) {
  if (!(v >= 5 && v <= 100)) return;
  settings = await setManualCalibration(settings, Math.round(v * 10) / 10);
  send({ type: 'settings-changed' });
  renderCalibration();
  renderData();
}

function initCalibration() {
  const sel = $('preset');
  sel.innerHTML = SCREEN_PRESETS.map((p) => `<option value="${p.inches}">${p.label}</option>`).join('') + '<option value="custom">Custom…</option>';
  sel.addEventListener('change', async () => {
    if (sel.value === 'custom') { $('diagonal').focus(); return; }
    $('diagonal').value = sel.value;
    await applyManual(Number(sel.value));
    toast('Screen size saved');
  });
  let t;
  $('diagonal').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => applyManual(Number($('diagonal').value)), 350);
  });

  $('confirmBtn').addEventListener('click', async () => {
    settings = await confirmCalibration(settings);
    renderCalibration();
    toast('Great — calibration confirmed');
  });
  $('manualBtn').addEventListener('click', () => {
    manualOpen = !manualOpen;
    renderCalibration();
    if (manualOpen) $('diagonal').focus();
  });
  $('backAutoBtn').addEventListener('click', async () => {
    manualOpen = false;
    settings = await setAutoCalibration(settings);
    send({ type: 'settings-changed' });
    renderCalibration(); renderData();
    toast(`Auto-detected ${settings.calibration.inches}" (${settings.calibration.confidence} confidence)`);
  });
  $('redetectBtn').addEventListener('click', async () => {
    settings = await setAutoCalibration(settings);
    send({ type: 'settings-changed' });
    manualOpen = false;
    renderCalibration(); renderData();
    toast(`Detected ${settings.calibration.device}`);
  });
  $('preciseBtn').addEventListener('click', async () => {
    const r = await detectPrecise();
    if (!r.supported) { toast('Your browser doesn\'t support precise screen detection'); return; }
    if (!r.granted) { toast('Permission not granted — using the standard estimate'); return; }
    const { os, touch, mobile } = platformInfo();
    const kindHint = r.isInternal ? 'laptop' : 'desktop';
    const est = estimateScreen({ w: r.w, h: r.h, dpr: r.dpr, os, touch, mobile, kindHint });
    let override = { method: 'precise', kind: r.isInternal ? (est.kind === 'tablet' ? 'tablet' : 'laptop') : 'desktop' };
    if (r.inchesFromLabel) {
      override = { ...override, inches: r.inchesFromLabel, confidence: 'high', device: `${r.label.trim()} (${r.inchesFromLabel}")` };
    } else {
      override = { ...override, inches: est.inches, confidence: est.confidence, device: r.isInternal ? `Built-in display · ${est.device}` : est.device };
      if (r.label && !/generic|pnp|built-?in|color lcd|display/i.test(r.label)) override.device += ` · ${r.label.trim()}`;
    }
    settings = await setAutoCalibration(settings, { kindHint, override });
    send({ type: 'settings-changed' });
    manualOpen = false;
    renderCalibration(); renderData();
    toast(r.inchesFromLabel ? `Read "${r.label.trim()}" → ${r.inchesFromLabel}"` : `Refined using ${r.isInternal ? 'built-in' : 'external'} display info`);
  });

  renderCalibration();
}

// =====================================================================
// Display
// =====================================================================
function bindRadioGroup(id, key, onChange) {
  const g = $(id);
  const paint = () => [...g.children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === settings[key])));
  g.addEventListener('click', async (e) => {
    const b = e.target.closest('[role="radio"]');
    if (!b) return;
    await saveSettings({ [key]: b.dataset.v });
    paint();
    onChange?.(b.dataset.v);
  });
  paint();
  return paint;
}

// =====================================================================
// Sites
// =====================================================================
function siteCard(host, s, dark) {
  const color = dark && s.colorDark ? s.colorDark : s.color;
  const light = isLight(color);
  const el = document.createElement('div');
  el.className = 'site-card' + (s.enabled ? '' : ' off');
  el.innerHTML = `
    <div class="sw" style="background:${color};color:${light ? '#111' : '#fff'}">${escapeHtml((s.name || host).charAt(0).toUpperCase())}</div>
    <div class="nm"><b>${escapeHtml(s.name || host)}</b><span>${escapeHtml(host)}</span></div>
    <button class="switch" role="switch" aria-checked="${s.enabled}" aria-label="Track ${escapeHtml(s.name)}"></button>
    ${s.custom ? `<button class="rm" title="Remove" aria-label="Remove ${escapeHtml(s.name)}">✕</button>` : ''}`;
  el.querySelector('.switch').addEventListener('click', async (e) => {
    const next = e.currentTarget.getAttribute('aria-checked') !== 'true';
    await send({ type: 'toggle-site', host, enabled: next });
    sites[host].enabled = next;
    renderSites();
  });
  el.querySelector('.rm')?.addEventListener('click', async () => {
    if (!confirm(`Remove ${s.name} and delete its scroll history?`)) return;
    await send({ type: 'remove-site', host });
    delete sites[host];
    renderSites();
    toast(`${s.name} removed`);
  });
  return el;
}

function renderSites() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const presets = $('presetSites'); presets.innerHTML = '';
  const customs = $('customSites'); customs.innerHTML = '';
  const order = PRESET_SITES.map((p) => p.host);
  const entries = Object.entries(sites).sort(([a], [b]) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
  });
  let nCustom = 0;
  for (const [host, s] of entries) {
    (s.custom ? customs : presets).appendChild(siteCard(host, s, dark));
    if (s.custom) nCustom++;
  }
  $('customEmpty').hidden = nCustom > 0;
}

async function addSite(raw) {
  const err = $('addErr');
  err.textContent = '';
  const host = normalizeHost(raw);
  if (!host) { err.textContent = 'Hmm, that doesn\'t look like a site. Try a name like "tumblr" or a URL.'; return; }
  if (sites[host]) {
    if (sites[host].enabled) { err.textContent = `${sites[host].name} is already tracked.`; return; }
    await send({ type: 'toggle-site', host, enabled: true });
    sites[host].enabled = true; renderSites(); toast(`${sites[host].name} re-enabled`); return;
  }
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [`*://*.${host}/*`] });
  } catch (e) {
    err.textContent = 'Chrome refused that pattern: ' + (e.message || e);
    return;
  }
  if (!granted) { err.textContent = 'Permission denied — FeedMiles can\'t measure a site it isn\'t allowed to see.'; return; }
  const r = await send({ type: 'add-site', input: host });
  if (!r.ok) { err.textContent = r.error || 'Could not add site.'; return; }
  const { sites: fresh } = await chrome.storage.local.get('sites');
  sites = fresh || sites;
  renderSites();
  $('addInput').value = '';
  toast(`Now tracking ${sites[host]?.name || host}. Reload its tabs to start counting.`);
}

// =====================================================================
// Alerts
// =====================================================================
const DEFAULT_ALERTS = { enabled: true, system: true, inPage: true, sound: true, volume: 0.4 };

function initAlerts() {
  const a = { ...DEFAULT_ALERTS, ...(settings.alerts || {}) };
  const bind = (id, key) => {
    const el = $(id);
    el.setAttribute('aria-checked', String(!!a[key]));
    el.addEventListener('click', async () => {
      const next = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(next));
      await saveSettings({ alerts: { ...DEFAULT_ALERTS, ...(settings.alerts || {}), [key]: next } });
      paintAlertsState();
    });
  };
  bind('alEnabled', 'enabled'); bind('alInPage', 'inPage'); bind('alSystem', 'system'); bind('alSound', 'sound');
  const vol = $('alVolume');
  vol.value = Math.round(a.volume * 100);
  $('volLabel').textContent = `${vol.value}%`;
  let t;
  vol.addEventListener('input', () => {
    $('volLabel').textContent = `${vol.value}%`;
    clearTimeout(t);
    t = setTimeout(() => saveSettings({ alerts: { ...DEFAULT_ALERTS, ...(settings.alerts || {}), volume: Number(vol.value) / 100 } }), 200);
  });
  $('testAlertBtn').addEventListener('click', async () => {
    const r = await send({ type: 'test-alert' });
    toast(r.ok ? 'Alert sent — check your notifications / a tracked tab' : 'Could not send test alert');
  });
  paintAlertsState();
}

function paintAlertsState() {
  const on = $('alEnabled').getAttribute('aria-checked') === 'true';
  for (const id of ['alInPage', 'alSystem', 'alSound', 'alVolume']) {
    const el = $(id);
    el.closest('.row').style.opacity = on ? '1' : '.45';
    if (el.tagName === 'INPUT') el.disabled = !on; else el.style.pointerEvents = on ? '' : 'none';
  }
}

// =====================================================================
// Data
// =====================================================================
async function renderData() {
  const { daily = {}, totals = {} } = await chrome.storage.local.get(['daily', 'totals']);
  const ppi = ppiFromDiagonal(settings.diagonalInches);
  const px = Object.values(totals).reduce((a, v) => a + (v.px || 0), 0);
  const days = Object.keys(daily).length;
  const since = settings.installedAt ? new Date(settings.installedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  $('dataStats').innerHTML = `
    <span>All-time <b>${formatDistance(pxToMeters(px, ppi), settings.units).text}</b></span>
    <span>Days recorded <b>${days}</b></span>
    <span>Since <b>${since}</b></span>`;
}

$('exportBtn').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `feedmiles-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('resetBtn').addEventListener('click', async () => {
  if (!confirm('Delete all recorded scroll distance? Sites and settings are kept.')) return;
  await send({ type: 'reset-data' });
  renderData();
  toast('Distance data cleared');
});

// =====================================================================
// Misc
// =====================================================================
function isLight(hex) {
  const c = (hex || '').replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

$('addForm').addEventListener('submit', (e) => { e.preventDefault(); addSite($('addInput').value); });
$('closeWelcome').addEventListener('click', () => { $('welcome').hidden = true; });

let booted = false;
chrome.storage.onChanged.addListener((changes, area) => {
  if (booted && area === 'local' && (changes.daily || changes.totals)) renderData();
});

// =====================================================================
// Boot
// =====================================================================
(async () => {
  settings = await loadSettings();
  // First run: detect the physical screen size (or re-check it for this monitor).
  settings = await ensureCalibration({ units: 'metric', theme: 'system', badge: true, ...settings });
  send({ type: 'settings-changed' });
  applyTheme(settings.theme || 'system');
  ({ sites = {} } = await chrome.storage.local.get('sites'));

  if (new URLSearchParams(location.search).get('welcome')) {
    $('welcome').hidden = false;
    const c = settings.calibration;
    if (c) $('welcomeDetected').textContent = `We detected a ${c.inches}-inch ${c.kind === 'desktop' ? 'monitor' : 'display'} (${c.device}). If that's right, hit "Looks right" below — otherwise set it manually.`;
  }

  initCalibration();
  initAlerts();
  const paintTheme = bindRadioGroup('theme', 'theme', (v) => { applyTheme(v); renderSites(); });
  bindRadioGroup('units', 'units', () => { renderCalibration(); renderData(); });
  const badge = $('badge');
  badge.setAttribute('aria-checked', String(settings.badge !== false));
  badge.addEventListener('click', async () => {
    const next = badge.getAttribute('aria-checked') !== 'true';
    badge.setAttribute('aria-checked', String(next));
    await saveSettings({ badge: next });
  });
  $('themeBtn').addEventListener('click', async () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    await saveSettings({ theme: next });
    applyTheme(next); paintTheme(); renderSites();
  });

  renderSites();
  renderData();
  booted = true;
})();
