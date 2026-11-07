/* =========================================================
   MARGYN — Audio Engine v2 (Premium Synthesis)
   ---------------------------------------------------------
   Pure Web Audio synthesis. No external files, no codecs,
   safe for Electron / asar builds.

   What changed vs v1:
   - FM "glass bell" voices, soft keys, plucks, pads
   - Filtered-noise "tick" and "swish" for tactile UI feedback
   - Master chain: tone filter -> compressor -> soft limiter
   - Generated stereo room reverb (convolver) for depth/air
   - Natural envelopes (no harsh linear/square beeps)
   - Musical, consonant note choices (C major / add9 family)
   - Public API is 100% unchanged
========================================================= */

let audioCtx: AudioContext | null = null;
// Sound is OFF on first run
let isAudioEnabled = false;

/* ---------------------------------------------------------
   Public: enable / disable
--------------------------------------------------------- */
export const setAudioEnabled = (enabled: boolean) => {
  isAudioEnabled = enabled;
};

/* ---------------------------------------------------------
   Audio graph (built once per context)
--------------------------------------------------------- */
interface Graph {
  input: GainNode; // dry bus
  reverbIn: GainNode; // reverb send bus
  noise: AudioBuffer;
}

let graph: Graph | null = null;

function makeImpulse(ctx: AudioContext, seconds: number, decay: number) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const preDelay = Math.floor(rate * 0.012);
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let lp = 0;
    for (let i = preDelay; i < len; i++) {
      const t = (i - preDelay) / (len - preDelay);
      const white = Math.random() * 2 - 1;
      // one-pole lowpass -> darker, smoother tail (less "metallic")
      lp += (white - lp) * 0.45;
      data[i] = lp * Math.pow(1 - t, decay);
    }
  }
  return ir;
}

function makeNoise(ctx: AudioContext) {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function buildGraph(ctx: AudioContext): Graph {
  // Master: tone filter -> compressor -> final gain -> out
  const master = ctx.createGain();
  master.gain.value = 0.9;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 24;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;

  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 9500; // tames harsh highs
  tone.Q.value = 0.4;

  const input = ctx.createGain();
  input.connect(tone);

  // Reverb
  const reverbIn = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(ctx, 1.7, 3.2);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  reverbIn.connect(convolver);
  convolver.connect(wet);
  wet.connect(tone);

  tone.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);

  return { input, reverbIn, noise: makeNoise(ctx) };
}

/* ---------------------------------------------------------
   Prewarm — call from any user gesture (first click etc.)
   Creates context AND resumes if suspended.
--------------------------------------------------------- */
export const prewarmAudio = () => {
  if (typeof window === "undefined") return;
  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx({ latencyHint: "interactive" });
        graph = buildGraph(audioCtx);
      }
    } catch (e) {
      console.warn("AudioContext unavailable:", e);
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
};

function getContext(): AudioContext | null {
  prewarmAudio();
  if (!audioCtx || !graph) return null;
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
/** MIDI note -> frequency. n(69) = 440Hz, n(72) = C5 */
const n = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type VoiceKind =
  | "bell" // FM glass bell — premium "ding"
  | "keys" // soft electric-piano-ish tone
  | "pluck" // short, bright, muted pluck
  | "pad" // slow detuned swell
  | "thud" // pitched-down soft body hit
  | "tick" // filtered noise click
  | "swish"; // filtered noise sweep

interface Voice {
  kind: VoiceKind;
  freq: number; // Hz (center freq for noise kinds)
  start: number; // offset seconds
  duration: number; // seconds
  volume: number; // 0..1
  attack?: number; // seconds
  pan?: number; // -1..1
  reverb?: number; // 0..1 send amount
  glide?: number; // end-frequency multiplier (thud / swish)
}

function playVoices(voices: Voice[]) {
  if (!isAudioEnabled) return;
  const ctx = getContext();
  if (!ctx || !graph) return;
  for (const v of voices) {
    try {
      renderVoice(ctx, graph, v);
    } catch {
      /* ignore individual voice failures */
    }
  }
}

function renderVoice(ctx: AudioContext, g: Graph, v: Voice) {
  const t0 = ctx.currentTime + v.start + 0.005;
  const dur = v.duration;
  const attack = Math.min(v.attack ?? 0.006, dur * 0.45);
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];

  // Envelope node — every voice flows through it
  const env = ctx.createGain();
  nodes.push(env);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(v.volume, t0 + attack);
  // natural exponential-style decay
  env.gain.setTargetAtTime(0, t0 + attack, Math.max(dur - attack, 0.02) / 4.5);

  const stopAt = t0 + dur * 1.25 + 0.08;

  const osc = (
    type: OscillatorType,
    freq: number,
    level: number,
    detuneCents = 0,
    dest: AudioNode = env,
  ) => {
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.detune.value = detuneCents;
    gn.gain.value = level;
    o.connect(gn);
    gn.connect(dest);
    o.start(t0);
    o.stop(stopAt);
    sources.push(o);
    nodes.push(o, gn);
    return o;
  };

  switch (v.kind) {
    /* ---- Glass bell: 2-op FM + soft upper partial ---- */
    case "bell": {
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(v.freq, t0);

      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.setValueAtTime(v.freq * 3.5, t0);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(v.freq * 1.6, t0);
      modGain.gain.setTargetAtTime(0, t0, dur / 6); // index decays -> mellow tail

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      const cg = ctx.createGain();
      cg.gain.value = 1;
      carrier.connect(cg);
      cg.connect(env);

      carrier.start(t0);
      mod.start(t0);
      carrier.stop(stopAt);
      mod.stop(stopAt);
      sources.push(carrier, mod);
      nodes.push(carrier, mod, modGain, cg);

      // shimmer partial (octave) that fades faster
      const shimmer = ctx.createGain();
      shimmer.gain.setValueAtTime(0.22, t0);
      shimmer.gain.setTargetAtTime(0, t0, dur / 9);
      nodes.push(shimmer);
      const so = ctx.createOscillator();
      so.type = "sine";
      so.frequency.setValueAtTime(v.freq * 2, t0);
      so.connect(shimmer);
      shimmer.connect(env);
      so.start(t0);
      so.stop(stopAt);
      sources.push(so);
      nodes.push(so);
      break;
    }

    /* ---- Soft keys: warm, rounded, slightly chorused ---- */
    case "keys": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(Math.min(v.freq * 9, 7000), t0);
      lp.frequency.setTargetAtTime(v.freq * 2.5, t0, dur / 4);
      lp.Q.value = 0.5;
      lp.connect(env);
      nodes.push(lp);

      osc("sine", v.freq, 0.7, -4, lp);
      osc("sine", v.freq, 0.5, 5, lp);
      osc("triangle", v.freq * 2, 0.22, 0, lp);
      osc("sine", v.freq * 3, 0.07, 0, lp);
      break;
    }

    /* ---- Pluck: bright transient that closes quickly ---- */
    case "pluck": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(Math.min(v.freq * 10, 9000), t0);
      lp.frequency.exponentialRampToValueAtTime(
        Math.max(v.freq * 1.8, 200),
        t0 + dur * 0.7,
      );
      lp.Q.value = 1.1;
      lp.connect(env);
      nodes.push(lp);

      osc("triangle", v.freq, 0.75, 0, lp);
      osc("sine", v.freq * 2, 0.28, 3, lp);
      osc("sine", v.freq * 0.5, 0.25, 0, lp);
      break;
    }

    /* ---- Pad: detuned saws under a gentle low-pass ---- */
    case "pad": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(500, t0);
      lp.frequency.linearRampToValueAtTime(1900, t0 + dur * 0.5);
      lp.Q.value = 0.7;
      lp.connect(env);
      nodes.push(lp);

      osc("sawtooth", v.freq, 0.22, -9, lp);
      osc("sawtooth", v.freq, 0.22, 9, lp);
      osc("sine", v.freq * 0.5, 0.4, 0, lp);
      break;
    }

    /* ---- Thud: soft pitched-down body ---- */
    case "thud": {
      const o = osc("sine", v.freq, 0.9);
      o.frequency.setValueAtTime(v.freq, t0);
      o.frequency.exponentialRampToValueAtTime(
        Math.max(v.freq * (v.glide ?? 0.45), 20),
        t0 + dur * 0.8,
      );
      osc("triangle", v.freq * 2, 0.18);
      break;
    }

    /* ---- Tick: tiny filtered-noise transient ---- */
    case "tick": {
      const src = ctx.createBufferSource();
      src.buffer = g.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = v.freq;
      bp.Q.value = 1.4;
      src.connect(bp);
      bp.connect(env);
      src.start(t0, Math.random() * 0.8);
      src.stop(stopAt);
      sources.push(src);
      nodes.push(src, bp);
      break;
    }

    /* ---- Swish: noise band sweeping up or down ---- */
    case "swish": {
      const src = ctx.createBufferSource();
      src.buffer = g.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 2.2;
      bp.frequency.setValueAtTime(v.freq, t0);
      bp.frequency.exponentialRampToValueAtTime(
        Math.max(v.freq * (v.glide ?? 2), 60),
        t0 + dur,
      );
      src.connect(bp);
      bp.connect(env);
      src.start(t0, Math.random() * 0.5);
      src.stop(stopAt);
      sources.push(src);
      nodes.push(src, bp);
      break;
    }
  }

  /* ---- Output routing: pan + dry + reverb send ---- */
  let tail: AudioNode = env;
  if (v.pan && typeof ctx.createStereoPanner === "function") {
    const p = ctx.createStereoPanner();
    p.pan.value = v.pan;
    env.connect(p);
    tail = p;
    nodes.push(p);
  }
  tail.connect(g.input);

  const send = v.reverb ?? 0.25;
  if (send > 0) {
    const sg = ctx.createGain();
    sg.gain.value = send;
    tail.connect(sg);
    sg.connect(g.reverbIn);
    nodes.push(sg);
  }

  // Free memory when the voice finishes
  const last = sources[0];
  if (last) {
    last.onended = () => {
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          /* already disconnected */
        }
      }
    };
  }
}

/* =========================================================
   SESSION
========================================================= */

export const playStartSound = () => {
  // Rising Cmaj9 arpeggio with a warm pad underneath
  playVoices([
    {
      kind: "pad",
      freq: n(48),
      start: 0,
      duration: 1.4,
      volume: 0.05,
      attack: 0.25,
      reverb: 0.5,
    },
    {
      kind: "bell",
      freq: n(72),
      start: 0.0,
      duration: 0.9,
      volume: 0.13,
      pan: -0.15,
      reverb: 0.4,
    },
    {
      kind: "bell",
      freq: n(76),
      start: 0.07,
      duration: 0.9,
      volume: 0.12,
      pan: 0.1,
      reverb: 0.4,
    },
    {
      kind: "bell",
      freq: n(79),
      start: 0.14,
      duration: 0.95,
      volume: 0.12,
      pan: -0.1,
      reverb: 0.45,
    },
    {
      kind: "bell",
      freq: n(83),
      start: 0.22,
      duration: 1.0,
      volume: 0.11,
      pan: 0.15,
      reverb: 0.5,
    },
    {
      kind: "bell",
      freq: n(86),
      start: 0.3,
      duration: 1.4,
      volume: 0.1,
      pan: 0,
      reverb: 0.6,
    },
  ]);
};

export const playEndSound = () => {
  // Gentle falling resolution
  playVoices([
    {
      kind: "pad",
      freq: n(43),
      start: 0,
      duration: 1.3,
      volume: 0.045,
      attack: 0.2,
      reverb: 0.5,
    },
    {
      kind: "bell",
      freq: n(79),
      start: 0.0,
      duration: 0.8,
      volume: 0.12,
      pan: 0.1,
      reverb: 0.45,
    },
    {
      kind: "bell",
      freq: n(76),
      start: 0.11,
      duration: 0.85,
      volume: 0.12,
      pan: -0.1,
      reverb: 0.45,
    },
    {
      kind: "bell",
      freq: n(72),
      start: 0.23,
      duration: 1.3,
      volume: 0.12,
      pan: 0,
      reverb: 0.6,
    },
  ]);
};

export const playTimerEndSound = () => {
  // Pleasant but noticeable double chime
  const chime = (offset: number, high: boolean) => [
    {
      kind: "bell" as const,
      freq: n(79),
      start: offset,
      duration: 0.7,
      volume: 0.14,
      pan: -0.1,
      reverb: 0.4,
    },
    {
      kind: "bell" as const,
      freq: n(84),
      start: offset + 0.13,
      duration: 0.8,
      volume: 0.14,
      pan: 0.1,
      reverb: 0.45,
    },
    {
      kind: "bell" as const,
      freq: n(high ? 91 : 88),
      start: offset + 0.26,
      duration: high ? 1.4 : 1.0,
      volume: 0.14,
      pan: 0,
      reverb: 0.55,
    },
  ];
  playVoices([
    {
      kind: "pad",
      freq: n(48),
      start: 0,
      duration: 1.8,
      volume: 0.04,
      attack: 0.1,
      reverb: 0.5,
    },
    ...chime(0, false),
    ...chime(0.85, true),
  ]);
};

/* =========================================================
   FEEDBACK
========================================================= */

export const playSuccessSound = () => {
  // Bright perfect-fourth lift
  playVoices([
    {
      kind: "keys",
      freq: n(79),
      start: 0,
      duration: 0.3,
      volume: 0.1,
      pan: -0.1,
      reverb: 0.3,
    },
    {
      kind: "bell",
      freq: n(84),
      start: 0.07,
      duration: 0.75,
      volume: 0.12,
      pan: 0.1,
      reverb: 0.45,
    },
  ]);
};

export const playErrorSound = () => {
  // Soft, low, descending — clearly "no", but never harsh
  playVoices([
    {
      kind: "keys",
      freq: n(58),
      start: 0,
      duration: 0.22,
      volume: 0.17,
      reverb: 0.2,
    },
    {
      kind: "keys",
      freq: n(53),
      start: 0.12,
      duration: 0.4,
      volume: 0.17,
      reverb: 0.25,
    },
    {
      kind: "thud",
      freq: n(41),
      start: 0,
      duration: 0.25,
      volume: 0.1,
      glide: 0.8,
      reverb: 0.1,
    },
  ]);
};

export const playWarningSound = () => {
  // Two quick soft taps then a question-like lift
  playVoices([
    {
      kind: "pluck",
      freq: n(69),
      start: 0,
      duration: 0.18,
      volume: 0.13,
      reverb: 0.25,
    },
    {
      kind: "pluck",
      freq: n(69),
      start: 0.11,
      duration: 0.18,
      volume: 0.13,
      reverb: 0.25,
    },
    {
      kind: "pluck",
      freq: n(76),
      start: 0.22,
      duration: 0.3,
      volume: 0.12,
      reverb: 0.35,
    },
  ]);
};

export const playClickSound = () => {
  // Crisp, tactile, very quiet
  playVoices([
    {
      kind: "tick",
      freq: 3200,
      start: 0,
      duration: 0.03,
      volume: 0.07,
      reverb: 0,
    },
    {
      kind: "pluck",
      freq: n(91),
      start: 0,
      duration: 0.06,
      volume: 0.03,
      reverb: 0.1,
    },
  ]);
};

/* =========================================================
   DOCUMENT
========================================================= */

export const playOpenSound = () => {
  playVoices([
    {
      kind: "swish",
      freq: 700,
      start: 0,
      duration: 0.18,
      volume: 0.035,
      glide: 3.2,
      attack: 0.08,
      reverb: 0.2,
    },
    {
      kind: "pluck",
      freq: n(79),
      start: 0.04,
      duration: 0.18,
      volume: 0.1,
      pan: -0.1,
      reverb: 0.3,
    },
    {
      kind: "pluck",
      freq: n(84),
      start: 0.1,
      duration: 0.28,
      volume: 0.1,
      pan: 0.1,
      reverb: 0.35,
    },
  ]);
};

export const playCloseSound = () => {
  playVoices([
    {
      kind: "swish",
      freq: 2200,
      start: 0,
      duration: 0.18,
      volume: 0.035,
      glide: 0.3,
      attack: 0.04,
      reverb: 0.2,
    },
    {
      kind: "pluck",
      freq: n(84),
      start: 0.0,
      duration: 0.18,
      volume: 0.1,
      pan: 0.1,
      reverb: 0.3,
    },
    {
      kind: "pluck",
      freq: n(79),
      start: 0.07,
      duration: 0.28,
      volume: 0.09,
      pan: -0.1,
      reverb: 0.35,
    },
  ]);
};

export const playSwitchSound = () => {
  playVoices([
    {
      kind: "tick",
      freq: 2600,
      start: 0,
      duration: 0.025,
      volume: 0.05,
      reverb: 0,
    },
    {
      kind: "pluck",
      freq: n(88),
      start: 0.0,
      duration: 0.09,
      volume: 0.07,
      pan: -0.15,
      reverb: 0.2,
    },
    {
      kind: "pluck",
      freq: n(91),
      start: 0.04,
      duration: 0.12,
      volume: 0.06,
      pan: 0.15,
      reverb: 0.25,
    },
  ]);
};

/* =========================================================
   NOTIFICATION / CELEBRATION
========================================================= */

export const playNotificationSound = () => {
  // Classic "ding-ding" but glassy and clean
  playVoices([
    {
      kind: "bell",
      freq: n(88),
      start: 0,
      duration: 0.5,
      volume: 0.1,
      pan: -0.1,
      reverb: 0.4,
    },
    {
      kind: "bell",
      freq: n(95),
      start: 0.12,
      duration: 0.9,
      volume: 0.09,
      pan: 0.1,
      reverb: 0.55,
    },
  ]);
};

export const playCompleteSound = () => {
  // Triumphant sparkle run with pad bloom
  playVoices([
    {
      kind: "pad",
      freq: n(48),
      start: 0,
      duration: 1.8,
      volume: 0.05,
      attack: 0.2,
      reverb: 0.55,
    },
    {
      kind: "pad",
      freq: n(55),
      start: 0.05,
      duration: 1.8,
      volume: 0.035,
      attack: 0.25,
      reverb: 0.55,
    },
    {
      kind: "bell",
      freq: n(72),
      start: 0.0,
      duration: 0.6,
      volume: 0.11,
      pan: -0.2,
      reverb: 0.4,
    },
    {
      kind: "bell",
      freq: n(76),
      start: 0.08,
      duration: 0.6,
      volume: 0.11,
      pan: 0.2,
      reverb: 0.4,
    },
    {
      kind: "bell",
      freq: n(79),
      start: 0.16,
      duration: 0.7,
      volume: 0.11,
      pan: -0.15,
      reverb: 0.45,
    },
    {
      kind: "bell",
      freq: n(84),
      start: 0.25,
      duration: 0.8,
      volume: 0.11,
      pan: 0.15,
      reverb: 0.5,
    },
    {
      kind: "bell",
      freq: n(88),
      start: 0.35,
      duration: 1.0,
      volume: 0.1,
      pan: -0.05,
      reverb: 0.55,
    },
    {
      kind: "bell",
      freq: n(96),
      start: 0.48,
      duration: 1.6,
      volume: 0.08,
      pan: 0.05,
      reverb: 0.7,
    },
  ]);
};

/* =========================================================
   DESTRUCTIVE / RESET
========================================================= */

export const playDeleteSound = () => {
  // Soft downward "whoomp" with a paper-like sweep
  playVoices([
    {
      kind: "swish",
      freq: 2600,
      start: 0,
      duration: 0.22,
      volume: 0.045,
      glide: 0.2,
      attack: 0.02,
      reverb: 0.15,
    },
    {
      kind: "thud",
      freq: 190,
      start: 0.02,
      duration: 0.28,
      volume: 0.22,
      glide: 0.4,
      reverb: 0.2,
    },
    {
      kind: "keys",
      freq: n(55),
      start: 0.06,
      duration: 0.25,
      volume: 0.07,
      reverb: 0.2,
    },
  ]);
};

export const playResetSound = () => {
  // Quick rewind swoosh into a settled note
  playVoices([
    {
      kind: "swish",
      freq: 500,
      start: 0,
      duration: 0.22,
      volume: 0.04,
      glide: 4,
      attack: 0.1,
      reverb: 0.2,
    },
    {
      kind: "pluck",
      freq: n(76),
      start: 0.1,
      duration: 0.2,
      volume: 0.1,
      pan: -0.1,
      reverb: 0.3,
    },
    {
      kind: "pluck",
      freq: n(69),
      start: 0.18,
      duration: 0.35,
      volume: 0.1,
      pan: 0.1,
      reverb: 0.4,
    },
  ]);
};

/* =========================================================
   TOGGLES
========================================================= */

export const playToggleOnSound = () => {
  playVoices([
    {
      kind: "pluck",
      freq: n(79),
      start: 0,
      duration: 0.09,
      volume: 0.09,
      reverb: 0.2,
    },
    {
      kind: "pluck",
      freq: n(84),
      start: 0.05,
      duration: 0.14,
      volume: 0.09,
      reverb: 0.3,
    },
  ]);
};

export const playToggleOffSound = () => {
  playVoices([
    {
      kind: "pluck",
      freq: n(84),
      start: 0,
      duration: 0.09,
      volume: 0.08,
      reverb: 0.2,
    },
    {
      kind: "pluck",
      freq: n(77),
      start: 0.05,
      duration: 0.14,
      volume: 0.08,
      reverb: 0.3,
    },
  ]);
};
