/**
 * Pixel → real-world distance conversion, formatting, and fun comparisons.
 *
 * Browsers don't expose physical PPI, so we derive it from the screen's
 * pixel resolution and a user-supplied diagonal size (default 24").
 *   PPI  = sqrt(w² + h²) / diagonalInches       (w,h in device pixels)
 *   m    = devicePx / PPI × 0.0254
 */
export const INCH_M = 0.0254;
/** Last-resort guard only — real installs auto-detect the screen (see detect.js). */
export const DEFAULT_DIAGONAL = 15.6;

export const SCREEN_PRESETS = [
  { label: '13" laptop', inches: 13.3 },
  { label: '14" laptop', inches: 14 },
  { label: '15.6" laptop', inches: 15.6 },
  { label: '16" laptop', inches: 16 },
  { label: '21.5" monitor', inches: 21.5 },
  { label: '24" monitor', inches: 24 },
  { label: '27" monitor', inches: 27 },
  { label: '32" monitor', inches: 32 },
  { label: '34" ultrawide', inches: 34 },
];

export function deviceResolution(scr = globalThis.screen, dpr = globalThis.devicePixelRatio || 1) {
  const w = (scr?.width || 1920) * dpr;
  const h = (scr?.height || 1080) * dpr;
  return { w: Math.round(w), h: Math.round(h), dpr };
}

export function ppiFromDiagonal(diagonalInches, res = deviceResolution()) {
  const d = Number(diagonalInches) > 0 ? Number(diagonalInches) : DEFAULT_DIAGONAL;
  return Math.hypot(res.w, res.h) / d;
}

export function pxToMeters(devicePx, ppi) {
  if (!ppi || ppi <= 0) return 0;
  return (devicePx / ppi) * INCH_M;
}

const FT_PER_M = 3.28084;
const MI_PER_M = 0.000621371;

/** Format meters into a {value, unit, text} triple in metric or imperial. */
export function formatDistance(meters, units = 'metric', opts = {}) {
  const m = Math.max(0, Number(meters) || 0);
  const compact = !!opts.compact;
  let value, unit;
  if (units === 'imperial') {
    const ft = m * FT_PER_M;
    if (ft < 1000) { value = ft; unit = 'ft'; }
    else { value = m * MI_PER_M; unit = 'mi'; }
  } else {
    if (m < 1) { value = m * 100; unit = 'cm'; }
    else if (m < 1000) { value = m; unit = 'm'; }
    else { value = m / 1000; unit = 'km'; }
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const text = value.toLocaleString(undefined, { maximumFractionDigits: compact ? Math.min(digits, 1) : digits, minimumFractionDigits: 0 });
  return { value, unit, text: `${text} ${unit}` };
}

/** Very short form for the toolbar badge (max ~4 chars). */
export function badgeText(meters, units = 'metric') {
  const m = Math.max(0, Number(meters) || 0);
  if (m === 0) return '';
  if (units === 'imperial') {
    const ft = m * FT_PER_M;
    if (ft < 1000) return `${Math.round(ft)}ft`;
    const mi = m * MI_PER_M;
    return mi < 10 ? `${mi.toFixed(1)}mi` : `${Math.round(mi)}mi`;
  }
  if (m < 1000) return `${Math.round(m)}m`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)}k` : km < 1000 ? `${Math.round(km)}k` : `${(km / 1000).toFixed(1)}M`;
}

export function formatDuration(ms) {
  const s = Math.round((ms || 0) / 1000);
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

/** Real-world objects, sorted ascending by length in meters. */
export const COMPARISONS = [
  { name: 'a banana', m: 0.18, emoji: '🍌' },
  { name: 'a baseball bat', m: 0.86, emoji: '⚾' },
  { name: 'a person', m: 1.7, emoji: '🧍' },
  { name: 'a giraffe', m: 5.5, emoji: '🦒' },
  { name: 'a school bus', m: 12, emoji: '🚌' },
  { name: 'a T-rex', m: 12.3, emoji: '🦖' },
  { name: 'a blue whale', m: 30, emoji: '🐋' },
  { name: 'a Boeing 747', m: 70, emoji: '✈️' },
  { name: 'the Statue of Liberty', m: 93, emoji: '🗽' },
  { name: 'a football pitch', m: 105, emoji: '⚽' },
  { name: 'Big Ben', m: 96, emoji: '🕰️' },
  { name: 'the Great Pyramid', m: 139, emoji: '🔺' },
  { name: 'the Eiffel Tower', m: 330, emoji: '🗼' },
  { name: 'the Empire State Building', m: 443, emoji: '🏙️' },
  { name: 'the Burj Khalifa', m: 828, emoji: '🏗️' },
  { name: 'the Golden Gate Bridge', m: 2737, emoji: '🌉' },
  { name: 'a 5K run', m: 5000, emoji: '🏃' },
  { name: 'Mount Everest', m: 8849, emoji: '🏔️' },
  { name: 'the Grand Canyon depth ×2', m: 3600, emoji: '🏜️' },
  { name: 'a half marathon', m: 21097, emoji: '🎽' },
  { name: 'a marathon', m: 42195, emoji: '🏅' },
  { name: 'the English Channel', m: 33800, emoji: '🌊' },
  { name: 'the width of Manhattan ×10', m: 37000, emoji: '🗺️' },
  { name: 'the Karman line (edge of space)', m: 100000, emoji: '🚀' },
  { name: 'Dhaka → Chittagong', m: 250000, emoji: '🚆' },
  { name: 'London → Paris', m: 344000, emoji: '🚄' },
  { name: 'the ISS orbit altitude', m: 408000, emoji: '🛰️' },
  { name: 'New York → LA', m: 3940000, emoji: '🛫' },
  { name: 'the Earth\'s circumference', m: 40075000, emoji: '🌍' },
  { name: 'the way to the Moon', m: 384400000, emoji: '🌕' },
].sort((a, b) => a.m - b.m);

/**
 * Pick the most evocative comparison for a distance.
 * Returns {emoji, times, name, text} e.g. "≈ 3.2× the Eiffel Tower".
 */
export function bestComparison(meters) {
  const m = Math.max(0, meters || 0);
  if (m <= 0) return { emoji: '🛋️', times: 0, name: 'nothing yet', text: 'Nothing scrolled yet — your thumbs are rested.' };
  // Largest object that fits at least once, else fraction of the smallest.
  let pick = COMPARISONS[0];
  for (const c of COMPARISONS) {
    if (c.m <= m) pick = c;
    else break;
  }
  const times = m / pick.m;
  let text;
  if (times < 1) text = `${Math.round(times * 100)}% of ${pick.name}`;
  else if (times < 10) text = `${times.toFixed(1)}× ${pick.name}`;
  else text = `${Math.round(times).toLocaleString()}× ${pick.name}`;
  return { emoji: pick.emoji, times, name: pick.name, text: `≈ ${text}` };
}

/** The next object to "unlock": progress toward it in [0,1]. */
export function nextMilestone(meters) {
  const m = Math.max(0, meters || 0);
  const next = COMPARISONS.find((c) => c.m > m) || COMPARISONS[COMPARISONS.length - 1];
  const idx = COMPARISONS.indexOf(next);
  const prevM = idx > 0 ? COMPARISONS[idx - 1].m : 0;
  const progress = next.m > prevM ? Math.min(1, Math.max(0, (m - prevM) / (next.m - prevM))) : 1;
  return { ...next, remaining: Math.max(0, next.m - m), progress };
}

/** Local-date key YYYY-MM-DD. */
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function lastNDays(n, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from);
    d.setDate(d.getDate() - i);
    out.push(dateKey(d));
  }
  return out;
}
