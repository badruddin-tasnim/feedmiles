/**
 * Predefined social platforms + host matching helpers.
 * Used by background (module), popup and options.
 */
export const PRESET_SITES = [
  { host: 'facebook.com',  name: 'Facebook',  color: '#1877F2', aliases: ['fb', 'facebook', 'm.facebook.com'] },
  { host: 'instagram.com', name: 'Instagram', color: '#E1306C', aliases: ['ig', 'insta', 'instagram'] },
  { host: 'x.com',         name: 'X / Twitter', color: '#0F1419', colorDark: '#E7E9EA', aliases: ['x', 'twitter', 'twitter.com'] },
  { host: 'tiktok.com',    name: 'TikTok',    color: '#FE2C55', aliases: ['tiktok', 'tik tok'] },
  { host: 'youtube.com',   name: 'YouTube',   color: '#FF0000', aliases: ['yt', 'youtube', 'shorts'] },
  { host: 'reddit.com',    name: 'Reddit',    color: '#FF4500', aliases: ['reddit'] },
  { host: 'linkedin.com',  name: 'LinkedIn',  color: '#0A66C2', aliases: ['linkedin'] },
  { host: 'threads.net',   name: 'Threads',   color: '#101010', colorDark: '#F3F5F7', aliases: ['threads', 'threads.com'] },
  { host: 'pinterest.com', name: 'Pinterest', color: '#E60023', aliases: ['pinterest', 'pin'] },
];

/** Hosts that should be attributed to another preset (mirrors / old domains). */
export const HOST_MERGE = {
  'twitter.com': 'x.com',
  'threads.com': 'threads.net',
};

const CUSTOM_PALETTE = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#F43F5E', '#3B82F6', '#84CC16', '#EC4899'];

export function colorForCustom(host) {
  let h = 0;
  for (const ch of host) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CUSTOM_PALETTE[h % CUSTOM_PALETTE.length];
}

/** Strip protocol / www / paths and return a bare registrable-ish host. */
export function normalizeHost(input) {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  // Known alias words → preset host
  for (const p of PRESET_SITES) {
    if (s === p.host || p.aliases.includes(s)) return p.host;
  }
  if (!/^[a-z]+:\/\//.test(s)) s = 'https://' + s;
  let host;
  try { host = new URL(s).hostname; } catch { return null; }
  host = host.replace(/^www\./, '').replace(/^m\./, '');
  if (!host.includes('.')) host += '.com'; // "9gag" → 9gag.com
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  return HOST_MERGE[host] || host;
}

/**
 * Given a page hostname (e.g. "m.facebook.com", "old.reddit.com") and the
 * map of tracked sites, find the matching tracked host or null.
 */
export function matchTrackedHost(pageHost, sites) {
  let h = String(pageHost || '').toLowerCase().replace(/^www\./, '');
  if (HOST_MERGE[h]) h = HOST_MERGE[h];
  // Walk up the domain: a.b.example.com → b.example.com → example.com
  const parts = h.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    let candidate = parts.slice(i).join('.');
    candidate = HOST_MERGE[candidate] || candidate;
    if (sites[candidate]) return candidate;
  }
  return null;
}

export function prettyName(host) {
  const preset = PRESET_SITES.find((p) => p.host === host);
  if (preset) return preset.name;
  const base = host.split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Initial `sites` map seeded on install. */
export function defaultSites() {
  const out = {};
  for (const p of PRESET_SITES) {
    out[p.host] = { name: p.name, color: p.color, colorDark: p.colorDark || p.color, enabled: true, custom: false };
  }
  return out;
}
