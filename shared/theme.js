/** Applies light/dark theme from settings ('system' | 'light' | 'dark'). */
export function applyTheme(theme) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const resolve = () => (theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme);
  document.documentElement.dataset.theme = resolve();
  if (theme === 'system') {
    mq.onchange = () => { document.documentElement.dataset.theme = resolve(); };
  } else {
    mq.onchange = null;
  }
}

export async function loadSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  return settings;
}

/**
 * Extension pages know the real screen size; the service worker doesn't.
 * Stash it in settings so the badge uses the same PPI as the popup.
 */
export async function syncScreenIntoSettings(settings) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(screen.width * dpr);
  const h = Math.round(screen.height * dpr);
  if (settings.screenW !== w || settings.screenH !== h) {
    const next = { ...settings, screenW: w, screenH: h };
    await chrome.storage.local.set({ settings: next });
    return next;
  }
  return settings;
}
