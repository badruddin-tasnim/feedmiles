/**
 * FeedMiles — content script
 * Measures how many pixels the user physically scrolls on this page
 * (window AND inner scroll containers — Instagram/Facebook/TikTok feeds
 * often scroll a div, not the document) and reports batched totals to
 * the background worker in *device pixels* so calibration can be applied later.
 */
(() => {
  if (window.__feedMilesLoaded) return;
  window.__feedMilesLoaded = true;

  const HOST = location.hostname;
  const FLUSH_MS = 2000;
  // Anything larger than this in a single scroll event is almost certainly a
  // programmatic jump (route change, "back to top", anchor) — not human scrolling.
  const MAX_DELTA_PER_EVENT = 4000;

  let dpr = window.devicePixelRatio || 1;
  let pendingCss = 0;          // CSS pixels accumulated since last flush
  let activeMs = 0;            // time the tab was visible & recently scrolled
  let lastScrollAt = 0;
  let lastTick = performance.now();
  let enabled = true;
  let dead = false;            // extension reloaded / context invalidated

  const lastPos = new WeakMap(); // element -> {x, y}

  function positionOf(target) {
    if (target === document || target === window || target === document.documentElement || target === document.body) {
      return { el: document, x: window.scrollX || 0, y: window.scrollY || 0 };
    }
    if (target instanceof Element) {
      return { el: target, x: target.scrollLeft || 0, y: target.scrollTop || 0 };
    }
    return null;
  }

  function onScroll(e) {
    if (!enabled) return;
    const p = positionOf(e.target);
    if (!p) return;
    const prev = lastPos.get(p.el);
    lastPos.set(p.el, { x: p.x, y: p.y });
    if (!prev) return; // first observation: establish baseline
    const d = Math.abs(p.y - prev.y) + Math.abs(p.x - prev.x);
    if (d <= 0 || d > MAX_DELTA_PER_EVENT) return;
    pendingCss += d;
    lastScrollAt = performance.now();
  }

  // Capture phase catches scroll events from every scrollable element,
  // even though `scroll` doesn't bubble.
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });

  // DPR can change when the window is moved between monitors / zoomed.
  window.addEventListener('resize', () => { dpr = window.devicePixelRatio || 1; }, { passive: true });

  function send(msg) {
    if (dead) return;
    try {
      chrome.runtime.sendMessage(msg, () => {
        if (chrome.runtime.lastError) {
          // Extension was reloaded/uninstalled; stop trying.
          if (/context invalidated|receiving end/i.test(chrome.runtime.lastError.message || '')) dead = true;
        }
      });
    } catch (_) {
      dead = true;
    }
  }

  // Count "active" time: visible tab that scrolled within the last 30s.
  function accrue(visible = document.visibilityState === 'visible') {
    const now = performance.now();
    if (visible && lastScrollAt > 0 && now - lastScrollAt < 30000) {
      activeMs += now - lastTick;
    }
    lastTick = now;
  }

  function flush() {
    accrue();
    if (pendingCss <= 0 && activeMs <= 0) return;
    const cssPx = pendingCss;
    const devicePx = cssPx * dpr;
    const ms = activeMs;
    pendingCss = 0;
    activeMs = 0;
    send({ type: 'scroll', host: HOST, cssPx, devicePx, ms, at: Date.now() });
  }

  const timer = setInterval(flush, FLUSH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      accrue(true);   // the tab was visible right up to this moment
      flush();
    } else {
      lastTick = performance.now(); // don't count the time we were hidden
    }
  });
  window.addEventListener('pagehide', () => { accrue(true); flush(); });

  // Ask the background whether this host is currently tracked; it can also
  // push updates when the user toggles a site in settings.
  send({ type: 'hello', host: HOST });
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'site-state' && typeof msg.enabled === 'boolean') {
        enabled = msg.enabled;
        if (!enabled) pendingCss = 0;
      }
      if (msg && msg.type === 'milestone') showToast(msg);
    });
  } catch (_) { /* ignore */ }

  // ---------- in-page milestone toast (top-right, just under the toolbar icon) ----------
  let toastHost = null;
  let toastTimer = 0;
  function showToast({ emoji, title, body }) {
    if (document.visibilityState !== 'visible') return;
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.id = 'feedmiles-toast-host';
      toastHost.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;pointer-events:none;';
      const shadow = toastHost.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host { all: initial; }
          .t {
            pointer-events: auto; box-sizing: border-box;
            display: flex; gap: 12px; align-items: flex-start;
            width: min(360px, calc(100vw - 24px));
            padding: 13px 14px 13px 14px; border-radius: 16px;
            background: rgba(255,255,255,.92); color: #0f1222;
            border: 1px solid rgba(15,18,34,.08);
            box-shadow: 0 1px 2px rgba(15,18,34,.06), 0 18px 40px -16px rgba(15,18,34,.35);
            backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
            font: 500 13.5px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
            transform: translateY(-14px) scale(.98); opacity: 0;
            transition: transform .32s cubic-bezier(.2,.8,.2,1), opacity .25s;
          }
          .t.in { transform: none; opacity: 1; }
          .arrow { position: absolute; top: -6px; right: 28px; width: 12px; height: 12px; transform: rotate(45deg);
            background: inherit; border-left: 1px solid rgba(15,18,34,.08); border-top: 1px solid rgba(15,18,34,.08); }
          .e { font-size: 26px; line-height: 1; margin-top: 1px; }
          .x { flex: 1; min-width: 0; }
          .h { font-weight: 700; font-size: 14px; letter-spacing: -.01em; }
          .b { margin-top: 3px; color: #5b6178; font-size: 12.5px; }
          .bar { position: absolute; left: 14px; right: 14px; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; overflow: hidden; }
          .bar i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg,#6366f1,#a855f7,#ec4899);
            transform-origin: left; animation: drain 7s linear forwards; }
          @keyframes drain { to { transform: scaleX(0); } }
          button { all: unset; cursor: pointer; color: #9298ae; font-size: 15px; line-height: 1; padding: 2px 4px; border-radius: 6px; }
          button:hover { background: rgba(15,18,34,.06); color: #0f1222; }
          .t { position: relative; }
          @media (prefers-color-scheme: dark) {
            .t { background: rgba(20,23,35,.9); color: #f2f3f8; border-color: rgba(255,255,255,.1); box-shadow: 0 18px 40px -16px rgba(0,0,0,.7); }
            .b { color: #a4a9bd; } .arrow { border-color: rgba(255,255,255,.1); }
            button:hover { background: rgba(255,255,255,.08); color: #fff; }
          }
          @media (prefers-reduced-motion: reduce) { .t { transition: none; } .bar i { animation: none; } }
        </style>
        <div class="t" role="status" aria-live="polite">
          <div class="arrow"></div>
          <div class="e"></div>
          <div class="x"><div class="h"></div><div class="b"></div></div>
          <button aria-label="Dismiss">✕</button>
          <div class="bar"><i></i></div>
        </div>`;
      (document.body || document.documentElement).appendChild(toastHost);
      shadow.querySelector('button').addEventListener('click', hideToast);
    }
    const root = toastHost.shadowRoot;
    root.querySelector('.e').textContent = emoji || '📏';
    root.querySelector('.h').textContent = title || 'Milestone reached';
    root.querySelector('.b').textContent = body || '';
    const bar = root.querySelector('.bar i');
    bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    const el = root.querySelector('.t');
    requestAnimationFrame(() => el.classList.add('in'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 7000);
  }
  function hideToast() {
    if (!toastHost) return;
    toastHost.shadowRoot.querySelector('.t').classList.remove('in');
    clearTimeout(toastTimer);
  }

  window.addEventListener('unload', () => clearInterval(timer));
})();
