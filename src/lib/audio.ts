/* =========================================================
   MARGYN — Audio Engine
========================================================= */

let audioCtx: AudioContext | null = null;
let isAudioEnabled = true;

// Export a way to toggle audio globally
export const setAudioEnabled = (enabled: boolean) => {
  isAudioEnabled = enabled;
};

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, startTime: number, duration: number, volume: number) {
  if (!isAudioEnabled) return; // Block if disabled
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

  gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration);
}

export const playStartSound = () => {
  try {
    playTone(261.63, 0, 1.5, 0.1);    // C4
    playTone(329.63, 0.15, 1.5, 0.1); // E4
    playTone(392.00, 0.3, 2, 0.08);   // G4
  } catch (e) { console.error(e); }
};

export const playEndSound = () => {
  try {
    playTone(392.00, 0, 1.5, 0.1);    // G4
    playTone(329.63, 0.15, 1.5, 0.1); // E4
    playTone(261.63, 0.3, 2, 0.08);   // C4
  } catch (e) { console.error(e); }
};