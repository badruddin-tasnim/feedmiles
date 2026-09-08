/**
 * Screen-size detection.
 *
 * No web API exposes a monitor's physical size, so this is an informed estimate:
 *  1. KNOWN_PANELS — resolution (device px) + OS scaling (DPR) + platform match a
 *     table of common displays. Operating systems pick scaling from physical PPI,
 *     so the combination is a strong fingerprint.
 *  2. Optional precise mode — Window Management API gives `isInternal` (built-in
 *     laptop panel vs external monitor) and a label that often contains the
 *     monitor model number, which encodes the size (DELL U2415 → 24").
 *  3. Fallback formula — platform baseline PPI × DPR.
 *
 * All functions are pure except detectPrecise(); pass explicit inputs for tests.
 */

const COMMON_DPR = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3];
export function roundDpr(dpr) {
  const d = Number(dpr) || 1;
  return COMMON_DPR.reduce((best, x) => (Math.abs(x - d) < Math.abs(best - d) ? x : best), 1);
}

/** os: 'mac' | 'win' | 'cros' | 'linux' | 'android' | 'ios' | 'other' */
export function platformInfo(nav = globalThis.navigator) {
  const p = (nav?.userAgentData?.platform || nav?.platform || '').toLowerCase();
  const ua = (nav?.userAgent || '').toLowerCase();
  let os = 'other';
  if (p.includes('mac') || ua.includes('mac os')) os = 'mac';
  else if (p.includes('win')) os = 'win';
  else if (p.includes('cros') || ua.includes('cros')) os = 'cros';
  else if (p.includes('android') || ua.includes('android')) os = 'android';
  else if (/iphone|ipad|ipod/.test(p) || /iphone|ipad/.test(ua)) os = 'ios';
  else if (p.includes('linux')) os = 'linux';
  const touch = (nav?.maxTouchPoints || 0) > 0;
  const mobile = !!nav?.userAgentData?.mobile || os === 'android' || os === 'ios';
  return { os, touch, mobile };
}

/**
 * Known displays. w/h are DEVICE pixels (landscape), dpr may be a number or array.
 * Order within the same fingerprint = likelihood (first wins without hints).
 * kind: 'laptop' | 'desktop' | 'tablet'. conf: confidence when this entry is chosen unambiguously.
 */
export const KNOWN_PANELS = [
  // ---------- macOS (logical × 2 = device px; scaled modes included) ----------
  { os: 'mac', w: 2940, h: 1912, dpr: 2, inches: 13.6, name: 'MacBook Air 13" (M2/M3/M4)', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 2560, h: 1664, dpr: 2, inches: 13.6, name: 'MacBook Air 13" (M2/M3/M4)', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 3024, h: 1964, dpr: 2, inches: 14.2, name: 'MacBook Pro 14"', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 3456, h: 2234, dpr: 2, inches: 16.2, name: 'MacBook Pro 16"', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 3420, h: 2214, dpr: 2, inches: 15.3, name: 'MacBook Air 15"', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 2880, h: 1864, dpr: 2, inches: 15.3, name: 'MacBook Air 15"', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 3072, h: 1920, dpr: 2, inches: 16.0, name: 'MacBook Pro 16" (2019)', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 3584, h: 2240, dpr: 2, inches: 16.0, name: 'MacBook Pro 16" (2019)', kind: 'laptop', conf: 'medium' },
  { os: 'mac', w: 2560, h: 1600, dpr: 2, inches: 13.3, name: 'MacBook Air / Pro 13"', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 2880, h: 1800, dpr: 2, inches: 13.3, name: 'MacBook Air / Pro 13" (scaled)', kind: 'laptop', conf: 'medium' },
  { os: 'mac', w: 2880, h: 1800, dpr: 2, inches: 15.4, name: 'MacBook Pro 15"', kind: 'laptop', conf: 'medium' },
  { os: 'mac', w: 3360, h: 2100, dpr: 2, inches: 13.3, name: 'MacBook 13" (more space)', kind: 'laptop', conf: 'medium' },
  { os: 'mac', w: 2304, h: 1440, dpr: 2, inches: 12.0, name: 'MacBook 12"', kind: 'laptop', conf: 'high' },
  { os: 'mac', w: 4480, h: 2520, dpr: 2, inches: 24.0, name: 'iMac 24"', kind: 'desktop', conf: 'high' },
  { os: 'mac', w: 5120, h: 2880, dpr: 2, inches: 27.0, name: 'iMac 27" / Studio Display', kind: 'desktop', conf: 'high' },
  { os: 'mac', w: 6016, h: 3384, dpr: 2, inches: 32.0, name: 'Pro Display XDR', kind: 'desktop', conf: 'high' },
  { os: 'mac', w: 4096, h: 2304, dpr: 2, inches: 21.5, name: 'iMac 21.5" 4K', kind: 'desktop', conf: 'high' },
  { os: 'mac', w: 3840, h: 2160, dpr: 2, inches: 27.0, name: '27" 4K monitor (Retina scaled)', kind: 'desktop', conf: 'medium' },
  { os: 'mac', w: 3840, h: 2160, dpr: 1, inches: 32.0, name: '32" 4K monitor', kind: 'desktop', conf: 'medium' },
  { os: 'mac', w: 2560, h: 1440, dpr: 1, inches: 27.0, name: '27" QHD monitor', kind: 'desktop', conf: 'high' },
  { os: 'mac', w: 1920, h: 1080, dpr: 1, inches: 24.0, name: '24" Full HD monitor', kind: 'desktop', conf: 'medium' },
  { os: 'mac', w: 3440, h: 1440, dpr: 1, inches: 34.0, name: '34" ultrawide', kind: 'desktop', conf: 'high' },

  // ---------- Windows / ChromeOS / Linux laptops ----------
  { w: 1366, h: 768, dpr: 1, inches: 15.6, name: '15.6" HD laptop', kind: 'laptop', conf: 'medium' },
  { w: 1366, h: 768, dpr: 1, inches: 14.0, name: '14" HD laptop', kind: 'laptop', conf: 'medium' },
  { w: 1920, h: 1080, dpr: 1.25, inches: 15.6, name: '15.6" Full HD laptop', kind: 'laptop', conf: 'high' },
  { w: 1920, h: 1080, dpr: 1.5, inches: 14.0, name: '14" Full HD laptop', kind: 'laptop', conf: 'high' },
  { w: 1920, h: 1080, dpr: 1.75, inches: 13.3, name: '13.3" Full HD laptop', kind: 'laptop', conf: 'high' },
  { w: 1920, h: 1080, dpr: 2, inches: 13.3, name: '13" Full HD laptop', kind: 'laptop', conf: 'medium' },
  { w: 1920, h: 1200, dpr: 1.5, inches: 14.0, name: '14" 16:10 laptop', kind: 'laptop', conf: 'high' },
  { w: 1920, h: 1200, dpr: 1.25, inches: 16.0, name: '16" 16:10 laptop', kind: 'laptop', conf: 'high' },
  { w: 1920, h: 1200, dpr: 1.75, inches: 13.3, name: '13" 16:10 laptop', kind: 'laptop', conf: 'medium' },
  { w: 2560, h: 1600, dpr: 1.5, inches: 16.0, name: '16" 2.5K laptop', kind: 'laptop', conf: 'high' },
  { w: 2560, h: 1600, dpr: 1.75, inches: 14.0, name: '14" 2.5K laptop', kind: 'laptop', conf: 'high' },
  { w: 2560, h: 1600, dpr: 2, inches: 13.3, name: '13" 2.5K laptop', kind: 'laptop', conf: 'medium' },
  { w: 2560, h: 1440, dpr: 1.5, inches: 15.6, name: '15.6" / 16" QHD laptop', kind: 'laptop', conf: 'medium' },
  { w: 2560, h: 1440, dpr: 1.75, inches: 14.0, name: '14" QHD laptop', kind: 'laptop', conf: 'medium' },
  { w: 2880, h: 1800, dpr: 2, inches: 14.0, name: '14" 2.8K laptop', kind: 'laptop', conf: 'high' },
  { w: 2880, h: 1800, dpr: 1.75, inches: 15.6, name: '15.6" 2.8K laptop', kind: 'laptop', conf: 'medium' },
  { w: 2880, h: 1620, dpr: [1.75, 2], inches: 16.0, name: '16" 2.8K laptop', kind: 'laptop', conf: 'medium' },
  { w: 3200, h: 2000, dpr: 2, inches: 14.5, name: '14.5" 3.2K laptop', kind: 'laptop', conf: 'medium' },
  { w: 3456, h: 2160, dpr: [2, 2.5], inches: 15.6, name: '15.6" 3.5K OLED laptop', kind: 'laptop', conf: 'high' },
  { w: 3840, h: 2400, dpr: [2, 2.5], inches: 16.0, name: '16" 4K laptop', kind: 'laptop', conf: 'medium' },
  { w: 3840, h: 2160, dpr: [2.5, 3], inches: 15.6, name: '15.6" 4K laptop', kind: 'laptop', conf: 'high' },
  { w: 3840, h: 2160, dpr: 2, inches: 15.6, name: '15.6" 4K laptop', kind: 'laptop', conf: 'medium' },
  { w: 3840, h: 2160, dpr: 2, inches: 27.0, name: '27" 4K monitor (200%)', kind: 'desktop', conf: 'medium' },
  { w: 1600, h: 900, dpr: 1, inches: 17.3, name: '17.3" HD+ laptop', kind: 'laptop', conf: 'low' },
  { w: 1600, h: 900, dpr: 1, inches: 20.0, name: '20" HD+ monitor', kind: 'desktop', conf: 'low' },
  // Surface family
  { w: 2256, h: 1504, dpr: 1.5, inches: 13.5, name: 'Surface Laptop 13.5"', kind: 'laptop', conf: 'high' },
  { w: 2496, h: 1664, dpr: 1.5, inches: 13.8, name: 'Surface Laptop 13.8"', kind: 'laptop', conf: 'medium' },
  { w: 2496, h: 1664, dpr: 1.5, inches: 15.0, name: 'Surface Laptop 15"', kind: 'laptop', conf: 'medium' },
  { w: 2880, h: 1920, dpr: 2, inches: 13.0, name: 'Surface Pro 13"', kind: 'tablet', conf: 'high' },
  { w: 2736, h: 1824, dpr: 2, inches: 12.3, name: 'Surface Pro 12.3"', kind: 'tablet', conf: 'high' },
  { w: 3000, h: 2000, dpr: 2, inches: 13.5, name: 'Surface Book 13.5"', kind: 'laptop', conf: 'high' },
  { w: 3240, h: 2160, dpr: 2, inches: 15.0, name: 'Surface Book 15"', kind: 'laptop', conf: 'high' },
  { w: 1920, h: 1280, dpr: 1.5, inches: 12.4, name: 'Surface Laptop Go', kind: 'laptop', conf: 'high' },
  { w: 1920, h: 1280, dpr: 1.5, inches: 10.5, name: 'Surface Go', kind: 'tablet', conf: 'medium' },

  // ---------- Desktop monitors (Windows/Linux/ChromeOS) ----------
  { w: 1920, h: 1080, dpr: 1, inches: 24.0, name: '24" Full HD monitor', kind: 'desktop', conf: 'medium' },
  { w: 1920, h: 1080, dpr: 1, inches: 15.6, name: '15.6" Full HD laptop (100%)', kind: 'laptop', conf: 'medium' },
  { w: 1920, h: 1080, dpr: 1, inches: 21.5, name: '21.5" Full HD monitor', kind: 'desktop', conf: 'low' },
  { w: 1920, h: 1200, dpr: 1, inches: 24.0, name: '24" 16:10 monitor', kind: 'desktop', conf: 'medium' },
  { w: 2560, h: 1440, dpr: 1, inches: 27.0, name: '27" QHD monitor', kind: 'desktop', conf: 'high' },
  { w: 2560, h: 1440, dpr: 1.25, inches: 27.0, name: '27" QHD monitor (125%)', kind: 'desktop', conf: 'medium' },
  { w: 2560, h: 1440, dpr: 1.25, inches: 24.0, name: '24" QHD monitor', kind: 'desktop', conf: 'medium' },
  { w: 2560, h: 1600, dpr: 1, inches: 30.0, name: '30" 16:10 monitor', kind: 'desktop', conf: 'medium' },
  { w: 3840, h: 2160, dpr: 1.5, inches: 27.0, name: '27" 4K monitor (150%)', kind: 'desktop', conf: 'medium' },
  { w: 3840, h: 2160, dpr: 1.25, inches: 32.0, name: '32" 4K monitor', kind: 'desktop', conf: 'medium' },
  { w: 3840, h: 2160, dpr: 1, inches: 43.0, name: '43" 4K monitor / TV', kind: 'desktop', conf: 'low' },
  { w: 2560, h: 1080, dpr: 1, inches: 29.0, name: '29" ultrawide', kind: 'desktop', conf: 'high' },
  { w: 3440, h: 1440, dpr: 1, inches: 34.0, name: '34" ultrawide', kind: 'desktop', conf: 'high' },
  { w: 3840, h: 1600, dpr: 1, inches: 38.0, name: '38" ultrawide', kind: 'desktop', conf: 'high' },
  { w: 5120, h: 1440, dpr: 1, inches: 49.0, name: '49" super-ultrawide', kind: 'desktop', conf: 'high' },
  { w: 5120, h: 2160, dpr: [1, 1.25], inches: 40.0, name: '40" 5K2K ultrawide', kind: 'desktop', conf: 'high' },
  { w: 1680, h: 1050, dpr: 1, inches: 22.0, name: '22" 16:10 monitor', kind: 'desktop', conf: 'medium' },
  { w: 1440, h: 900, dpr: 1, inches: 19.0, name: '19" 16:10 monitor', kind: 'desktop', conf: 'low' },
  { w: 1280, h: 1024, dpr: 1, inches: 19.0, name: '19" 5:4 monitor', kind: 'desktop', conf: 'medium' },
  { w: 1280, h: 800, dpr: 1, inches: 14.0, name: '14" WXGA laptop', kind: 'laptop', conf: 'low' },
];

/** Baseline PPI at 100% scaling per platform, used by the fallback formula. */
const BASE_PPI = { mac: 110, win: 96, cros: 96, linux: 96, android: 160, ios: 163, other: 96 };

function fallbackEstimate({ w, h, dpr, os, touch, mobile }) {
  let ppi;
  if (mobile) ppi = BASE_PPI[os] * dpr;
  else if (dpr <= 1) ppi = os === 'mac' ? 110 : (touch ? 141 : 92); // desktop-ish vs 15.6" touch laptop
  else ppi = (os === 'mac' ? 110 : 96) * dpr + (os === 'mac' ? 0 : 20); // Windows scaling lags physical PPI
  const inches = Math.hypot(w, h) / ppi;
  return {
    inches: Math.round(inches * 10) / 10,
    confidence: 'low',
    method: 'formula',
    device: mobile ? 'Mobile display' : `${Math.round(inches)}" display (estimated)`,
    kind: mobile ? 'tablet' : (dpr > 1 || touch ? 'laptop' : 'desktop'),
  };
}

/**
 * @param {object} input
 * @param {number} input.w device px width (landscape)   @param {number} input.h device px height
 * @param {number} input.dpr                              @param {string} input.os
 * @param {boolean} [input.touch] @param {boolean} [input.mobile]
 * @param {'laptop'|'desktop'|null} [input.kindHint]  from Window Management isInternal
 * @returns {{inches:number, confidence:'high'|'medium'|'low', method:string, device:string, kind:string}}
 */
export function estimateScreen(input) {
  let { w, h } = input;
  if (h > w) [w, h] = [h, w]; // portrait monitors → landscape fingerprint
  const dpr = roundDpr(input.dpr);
  const os = input.os || 'other';
  const kindHint = input.kindHint || (input.touch && os !== 'mac' ? 'laptop' : null);

  let matches = KNOWN_PANELS.filter((p) =>
    p.w === w && p.h === h && [].concat(p.dpr).includes(dpr) && (!p.os || p.os === os) && !(os === 'mac' && !p.os && p.kind !== 'desktop'),
  );
  if (!matches.length) return fallbackEstimate({ w, h, dpr, os, touch: input.touch, mobile: input.mobile });

  const distinct = new Set(matches.map((m) => m.inches));
  let pick = matches[0];
  let confidence = pick.conf;
  if (distinct.size > 1) {
    const hinted = kindHint ? matches.filter((m) => (kindHint === 'laptop' ? m.kind !== 'desktop' : m.kind === 'desktop')) : [];
    if (hinted.length) { pick = hinted[0]; confidence = new Set(hinted.map((m) => m.inches)).size > 1 ? 'medium' : pick.conf; }
    else confidence = confidence === 'high' ? 'medium' : confidence;
  } else if (kindHint && pick.kind !== 'tablet' && ((kindHint === 'laptop') !== (pick.kind === 'laptop'))) {
    confidence = 'low'; // hint contradicts table
  }
  return { inches: pick.inches, confidence, method: 'table', device: pick.name, kind: pick.kind };
}

/**
 * Pull a screen size out of a monitor label / model number.
 * "DELL U2415" → 24, "LG ULTRAGEAR 27GN800" → 27, "Built-in Retina Display" → null.
 */
export function parseInchesFromLabel(label) {
  const s = String(label || '');
  // Explicit: 27", 27-inch, 27in
  const explicit = s.match(/(\d{2}(?:\.\d)?)\s?(?:"|”|-?inch(?:es)?\b|in\b)/i);
  if (explicit) { const v = parseFloat(explicit[1]); if (v >= 10 && v <= 65) return v; }
  // Model numbers: tokens mixing letters and digits; first 2-digit run in 17..65
  for (const tok of s.split(/[\s,/()]+/)) {
    if (!/\d/.test(tok) || !/[A-Za-z]/.test(tok) || /^\d+p$/i.test(tok) || /^\d+k$/i.test(tok)) continue;
    const runs = tok.match(/\d+/g) || [];
    for (const r of runs) {
      for (let i = 0; i + 2 <= r.length && i < 2; i++) {
        const v = parseInt(r.slice(i, i + 2), 10);
        if (v >= 17 && v <= 65) return v;
      }
    }
  }
  return null;
}

/**
 * Precise detection via the Window Management API (Chrome 100+, prompts once).
 * Resolves {supported, granted, isInternal, label, inchesFromLabel, w, h, dpr} for the current screen.
 */
export async function detectPrecise() {
  if (typeof window === 'undefined' || typeof window.getScreenDetails !== 'function') return { supported: false };
  try {
    const details = await window.getScreenDetails();
    const cur = details.currentScreen;
    const dpr = cur.devicePixelRatio || window.devicePixelRatio || 1;
    return {
      supported: true, granted: true,
      isInternal: !!cur.isInternal, label: cur.label || '',
      inchesFromLabel: parseInchesFromLabel(cur.label),
      w: Math.round(cur.width * dpr), h: Math.round(cur.height * dpr), dpr,
      screens: details.screens.length,
    };
  } catch (e) {
    return { supported: true, granted: false, error: e?.name || String(e) };
  }
}

/** Human label for the calibration card. */
export function describeCalibration(c) {
  if (!c) return 'Not calibrated';
  if (c.mode === 'manual') return `Set manually · ${c.inches}"`;
  const conf = { high: 'high confidence', medium: 'medium confidence', low: 'rough estimate' }[c.confidence] || '';
  return `${c.device || `${c.inches}" display`} · ${conf}`;
}
