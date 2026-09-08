/**
 * Offscreen document: the only place an MV3 extension can play audio.
 * Synthesises a soft two-note chime with Web Audio — no audio file, no autoplay issues.
 */
let ctx;

function chime(volume = 0.4) {
  ctx ??= new AudioContext();
  const master = ctx.createGain();
  // Perceptual volume: cap well below "alert" loudness.
  master.gain.value = 0.08 + 0.17 * Math.min(1, Math.max(0, volume));
  master.connect(ctx.destination);

  const notes = [[659.25, 0.00], [880.00, 0.16]]; // E5 → A5, gentle rising interval
  for (const [freq, at] of notes) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + at;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(1, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  }
  // Subtle warm undertone so it doesn't sound like a sterile beep.
  const low = ctx.createOscillator();
  const lowEnv = ctx.createGain();
  low.type = 'triangle';
  low.frequency.value = 329.63;
  lowEnv.gain.setValueAtTime(0.0001, ctx.currentTime);
  lowEnv.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.05);
  lowEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
  low.connect(lowEnv).connect(master);
  low.start();
  low.stop(ctx.currentTime + 0.75);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'play-chime' && msg.target === 'offscreen') {
    try { chime(msg.volume); } catch (e) { console.warn('chime failed', e); }
  }
});
