/**
 * Calibration lifecycle shared by popup and options.
 *
 * settings.diagonalInches   — the number the conversion uses
 * settings.calibration      — { mode: 'auto'|'manual', inches, confidence, method, device, kind,
 *                              confirmed, screenW, screenH, dpr, os, screenChanged, updatedAt }
 */
import { estimateScreen, platformInfo, roundDpr } from './detect.js';

export function currentScreenSignature() {
  const dpr = window.devicePixelRatio || 1;
  let w = Math.round(screen.width * dpr), h = Math.round(screen.height * dpr);
  return { w, h, dpr: roundDpr(dpr), rawDpr: dpr };
}

export function autoCalibration(extra = {}) {
  const sig = currentScreenSignature();
  const { os, touch, mobile } = platformInfo();
  const est = estimateScreen({ w: sig.w, h: sig.h, dpr: sig.dpr, os, touch, mobile, kindHint: extra.kindHint || null });
  return {
    mode: 'auto', inches: est.inches, confidence: est.confidence, method: est.method,
    device: est.device, kind: est.kind, confirmed: false,
    screenW: sig.w, screenH: sig.h, dpr: sig.dpr, os, screenChanged: false, updatedAt: Date.now(),
  };
}

/**
 * Make sure settings carry a calibration for the screen we're on.
 * - none yet → auto-detect (first run, or upgrade from a version without calibration)
 * - auto + screen changed → re-detect silently
 * - manual + screen changed → keep value, flag screenChanged for the UI
 * Returns the (possibly updated) settings and persists them if changed.
 */
export async function ensureCalibration(settings) {
  const sig = currentScreenSignature();
  let cal = settings.calibration;
  let next = settings;

  if (!cal) {
    // Upgrade path: if a user had changed the old fixed default, respect it as manual.
    if (settings.diagonalInches && settings.diagonalInches !== 24) {
      cal = { mode: 'manual', inches: settings.diagonalInches, confirmed: true, screenW: sig.w, screenH: sig.h, dpr: sig.dpr, updatedAt: Date.now() };
    } else {
      cal = autoCalibration();
    }
    next = { ...settings, calibration: cal, diagonalInches: cal.inches };
  } else {
    const changed = cal.screenW !== sig.w || cal.screenH !== sig.h || cal.dpr !== sig.dpr;
    if (changed && cal.mode === 'auto') {
      cal = autoCalibration();
      next = { ...settings, calibration: cal, diagonalInches: cal.inches };
    } else if (changed && cal.mode === 'manual' && !cal.screenChanged) {
      cal = { ...cal, screenChanged: true };
      next = { ...settings, calibration: cal };
    }
  }

  // Keep the service worker's view of the screen in sync for the badge.
  if (next.screenW !== sig.w || next.screenH !== sig.h) next = { ...next, screenW: sig.w, screenH: sig.h };

  if (next !== settings) await chrome.storage.local.set({ settings: next });
  return next;
}

export async function setManualCalibration(settings, inches) {
  const sig = currentScreenSignature();
  const cal = { mode: 'manual', inches, confirmed: true, screenW: sig.w, screenH: sig.h, dpr: sig.dpr, screenChanged: false, updatedAt: Date.now() };
  const next = { ...settings, calibration: cal, diagonalInches: inches };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function setAutoCalibration(settings, extra = {}) {
  const cal = { ...autoCalibration(extra), ...extra.override };
  const next = { ...settings, calibration: cal, diagonalInches: cal.inches };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function confirmCalibration(settings) {
  const next = { ...settings, calibration: { ...settings.calibration, confirmed: true, screenChanged: false } };
  await chrome.storage.local.set({ settings: next });
  return next;
}
