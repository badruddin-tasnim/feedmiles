import {
  ppiFromDiagonal, pxToMeters, formatDistance, formatDuration,
  bestComparison, nextMilestone, dateKey, lastNDays,
} from '../shared/units.js';
import { applyTheme, loadSettings } from '../shared/theme.js';
import { ensureCalibration } from '../shared/calibration.js';
import { describeCalibration } from '../shared/detect.js';

const $ = (id) => document.getElementById(id);

let settings = {}, sites = {}, daily = {}, totals = {}, ppi = 96;
let range = 'today';
let booted = false; // guards storage.onChanged renders that fire before initial load

const RANGE_META = {
  today: { label: 'Scrolled today', days: 1, chartDays: 7, chartTitle: 'Last 7 days' },
  week:  { label: 'Last 7 days', days: 7, chartDays: 7, chartTitle: 'Last 7 days' },
  month: { label: 'Last 30 days', days: 30, chartDays: 30, chartTitle: 'Last 30 days' },
  all:   { label: 'All time', days: null, chartDays: 30, chartTitle: 'Last 30 days' },
};

async function loadData() {
  const data = await chrome.storage.local.get(['sites', 'daily', 'totals']);
  sites = data.sites || {};
  daily = data.daily || {};
  totals = data.totals || {};
}

function meters(px) { return pxToMeters(px || 0, ppi); }
function fmt(m, compact) { return formatDistance(m, settings.units, { compact }); }

/** Sum {px, ms} per host over a range. */
function aggregate(rangeKey) {
  const meta = RANGE_META[rangeKey];
  const perHost = {};
  const add = (host, v) => {
    perHost[host] ??= { px: 0, ms: 0 };
    perHost[host].px += v.px || 0;
    perHost[host].ms += v.ms || 0;
  };
  let dayCount;
  if (meta.days == null) {
    for (const [h, v] of Object.entries(totals)) add(h, v);
    dayCount = Object.keys(daily).length || 1;
  } else {
    const keys = lastNDays(meta.days);
    for (const k of keys) for (const [h, v] of Object.entries(daily[k] || {})) add(h, v);
    dayCount = meta.days;
  }
  const total = Object.values(perHost).reduce((a, v) => ({ px: a.px + v.px, ms: a.ms + v.ms }), { px: 0, ms: 0 });
  return { perHost, total, dayCount };
}

// ---- number animation ----
let animFrame;
function animateNumber(el, toText) {
  // Parse numeric portion for a tween; fall back to instant set.
  const to = parseFloat(toText.replace(/,/g, ''));
  const from = parseFloat((el.dataset.raw || '0').replace(/,/g, '')) || 0;
  const decimals = (toText.split('.')[1] || '').length;
  if (!isFinite(to)) { el.textContent = toText; return; }
  cancelAnimationFrame(animFrame);
  const t0 = performance.now(), dur = 520;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    const v = from + (to - from) * e;
    el.textContent = v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (p < 1) animFrame = requestAnimationFrame(step);
    else { el.textContent = toText; el.dataset.raw = toText; }
  };
  animFrame = requestAnimationFrame(step);
}

// ---- render ----
function render() {
  const meta = RANGE_META[range];
  const { perHost, total, dayCount } = aggregate(range);
  const m = meters(total.px);

  $('heroLabel').textContent = meta.label;
  const d = fmt(m);
  animateNumber($('heroNumber'), d.text.replace(/\s\S+$/, ''));
  $('heroUnit').textContent = d.unit;

  const cmp = bestComparison(m);
  $('heroCompare').innerHTML = `<span class="emoji">${cmp.emoji}</span><span>${cmp.text}</span>`;

  $('heroTime').textContent = `⏱ ${formatDuration(total.ms)} active`;
  if (range === 'today') {
    // Compare with yesterday
    const yKey = lastNDays(2)[0];
    const yPx = Object.values(daily[yKey] || {}).reduce((a, v) => a + (v.px || 0), 0);
    const ym = meters(yPx);
    if (ym > 0) {
      const diff = ((m - ym) / ym) * 100;
      const arrow = diff >= 0 ? '↑' : '↓';
      $('heroAvg').textContent = `${arrow} ${Math.abs(diff).toFixed(0)}% vs yesterday`;
    } else {
      $('heroAvg').textContent = 'no data yesterday';
    }
  } else {
    $('heroAvg').textContent = `${fmt(m / Math.max(1, dayCount), true).text} / day`;
  }

  // Milestone (always based on selected range total)
  const ms = nextMilestone(m);
  $('msEmoji').textContent = ms.emoji;
  $('msName').textContent = ms.name;
  $('msRemaining').textContent = `${fmt(ms.remaining, true).text} to go`;
  $('msPct').textContent = `${Math.round(ms.progress * 100)}%`;
  $('msBar').style.width = `${Math.round(ms.progress * 100)}%`;

  renderChart(meta.chartDays, meta.chartTitle);
  renderSites(perHost, total.px);

  renderCalibNote();
}

function renderCalibNote() {
  const c = settings.calibration;
  const note = $('calibNote');
  const link = $('calibLink');
  note.classList.remove('warn');
  if (!c) { note.textContent = 'Not calibrated'; link.textContent = 'set up'; return; }
  const size = `${c.inches}"`;
  if (c.mode === 'manual') {
    note.textContent = c.screenChanged ? `Screen changed · still using your manual ${size}` : `Manual · ${size} · ${Math.round(ppi)} PPI`;
    if (c.screenChanged) note.classList.add('warn');
    link.textContent = 'change';
  } else {
    const conf = c.confidence === 'high' ? '' : c.confidence === 'medium' ? ' · verify?' : ' · rough — verify';
    note.textContent = `Auto-detected ${size}${c.confirmed ? ' ✓' : conf}`;
    note.title = describeCalibration(c);
    if (!c.confirmed && c.confidence !== 'high') note.classList.add('warn');
    link.textContent = c.confirmed || c.confidence === 'high' ? 'change' : 'check';
  }
}

function renderChart(nDays, title) {
  $('chartTitle').textContent = title;
  const keys = lastNDays(nDays);
  const vals = keys.map((k) => meters(Object.values(daily[k] || {}).reduce((a, v) => a + (v.px || 0), 0)));
  const max = Math.max(1e-9, ...vals);
  const wrap = $('bars');
  wrap.classList.toggle('dense', nDays > 10);
  wrap.innerHTML = '';
  const today = dateKey();
  keys.forEach((k, i) => {
    const v = vals[i];
    const col = document.createElement('div');
    col.className = 'bar-col' + (v > 0 ? ' has' : '') + (k === today ? ' today' : '');
    const h = v > 0 ? Math.max(6, (v / max) * 100) : 3;
    const date = new Date(k + 'T00:00:00');
    const lbl = nDays <= 7
      ? date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)
      : (i % 7 === nDays % 7 || k === today ? String(date.getDate()) : '');
    col.innerHTML = `<div class="tip">${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${fmt(v, true).text}</div>
      <div class="b" style="height:${h}%"></div><div class="lbl">${lbl}</div>`;
    wrap.appendChild(col);
  });
}

function renderSites(perHost, totalPx) {
  const list = $('siteList');
  list.innerHTML = '';
  const rows = Object.entries(perHost)
    .filter(([, v]) => v.px > 0)
    .sort((a, b) => b[1].px - a[1].px);
  $('sitesEmpty').hidden = rows.length > 0;
  $('sitesCount').textContent = rows.length ? `${rows.length} site${rows.length > 1 ? 's' : ''}` : '';
  const dark = document.documentElement.dataset.theme === 'dark';
  for (const [host, v] of rows) {
    const s = sites[host] || { name: host, color: '#8B5CF6' };
    const color = (dark && s.colorDark) ? s.colorDark : s.color;
    const share = totalPx > 0 ? (v.px / totalPx) * 100 : 0;
    const li = document.createElement('li');
    li.className = 'site';
    const initial = (s.name || host).trim().charAt(0).toUpperCase();
    const swatchFg = isLight(color) ? '#111' : '#fff';
    li.innerHTML = `
      <div class="swatch" style="background:${color};color:${swatchFg}">${initial}</div>
      <div class="name">${escapeHtml(s.name || host)}</div>
      <div class="val">${fmt(meters(v.px)).text}</div>
      <div class="track"><div style="width:${share.toFixed(1)}%;background:${color}"></div></div>
      <div class="sub">${share.toFixed(0)}% of total · ${formatDuration(v.ms)} · ${bestComparison(meters(v.px)).text}</div>`;
    list.appendChild(li);
  }
}

function isLight(hex) {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

// ---- interactions ----
function setRange(r) {
  range = r;
  const tabs = [...document.querySelectorAll('.segmented [role="tab"]')];
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.range === r)));
  const idx = tabs.findIndex((t) => t.dataset.range === r);
  document.querySelector('.segmented .thumb').style.transform = `translateX(${idx * 100}%)`;
  render();
}

document.querySelector('.segmented').addEventListener('click', (e) => {
  const b = e.target.closest('[role="tab"]');
  if (b) setRange(b.dataset.range);
});

$('themeBtn').addEventListener('click', async () => {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  settings = { ...settings, theme: next };
  await chrome.storage.local.set({ settings });
  applyTheme(next);
  render();
});

const openOptions = () => chrome.runtime.openOptionsPage();
$('settingsBtn').addEventListener('click', openOptions);
$('calibLink').addEventListener('click', (e) => { e.preventDefault(); openOptions(); });

// Live-update while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !booted) return;
  if (changes.daily || changes.totals || changes.sites) loadData().then(render);
  if (changes.settings) {
    settings = changes.settings.newValue || settings;
    ppi = ppiFromDiagonal(settings.diagonalInches);
    applyTheme(settings.theme || 'system');
    render();
  }
});

// ---- boot ----
(async () => {
  settings = await loadSettings();
  // First run (or new screen): detect the physical screen size before any conversion.
  settings = await ensureCalibration({ units: 'metric', theme: 'system', badge: true, ...settings });
  applyTheme(settings.theme || 'system');
  ppi = ppiFromDiagonal(settings.diagonalInches);
  await loadData();
  booted = true;
  setRange('today');
})();
