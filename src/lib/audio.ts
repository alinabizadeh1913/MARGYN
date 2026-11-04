let audioCtx: AudioContext | null = null;
let isAudioEnabled = true;

export const setAudioEnabled = (enabled: boolean) => {
  isAudioEnabled = enabled;
};

// Pre-warm the audio context on first interaction to prevent lag later
export const prewarmAudio = () => {
  if (!audioCtx) {
    try {
      audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    } catch (e) {}
  }
};

function getContext() {
  prewarmAudio();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx!;
}

function playTone(
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
) {
  if (!isAudioEnabled || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime);

  gain.gain.setValueAtTime(0, audioCtx.currentTime + startTime);
  gain.gain.linearRampToValueAtTime(
    volume,
    audioCtx.currentTime + startTime + 0.05,
  );
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + startTime + duration,
  );

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(audioCtx.currentTime + startTime);
  osc.stop(audioCtx.currentTime + startTime + duration);
}

export const playStartSound = () => {
  playTone(261.63, 0, 1.5, 0.1);
  playTone(329.63, 0.15, 1.5, 0.1);
  playTone(392.0, 0.3, 2, 0.08);
};

export const playEndSound = () => {
  playTone(392.0, 0, 1.5, 0.1);
  playTone(329.63, 0.15, 1.5, 0.1);
  playTone(261.63, 0.3, 2, 0.08);
};
