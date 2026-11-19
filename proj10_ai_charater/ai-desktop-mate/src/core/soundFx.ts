import { appState } from './state';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

let soundEnabled: boolean = localStorage.getItem('mate_sound_fx_enabled') !== 'false';
let soundVolume: number = Number(localStorage.getItem('mate_sound_volume') || '0.7') || 0.7;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = soundEnabled ? soundVolume : 0;
      masterGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  localStorage.setItem('mate_sound_fx_enabled', String(enabled));
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(enabled ? soundVolume : 0, audioCtx.currentTime);
  }
}

export function getSoundVolume(): number {
  return soundVolume;
}

export function setSoundVolume(volume: number) {
  const clamped = Math.max(0, Math.min(1, volume));
  soundVolume = clamped;
  localStorage.setItem('mate_sound_volume', String(clamped));
  if (masterGain && audioCtx && soundEnabled) {
    masterGain.gain.setValueAtTime(clamped, audioCtx.currentTime);
  }
}

function createPanNode(ctx: AudioContext, posX?: number): StereoPannerNode | GainNode {
  if (ctx.createStereoPanner && typeof posX === 'number' && appState.W > 0) {
    try {
      const panner = ctx.createStereoPanner();
      const pan = Math.max(-0.85, Math.min(0.85, (posX / appState.W) * 2 - 1));
      panner.pan.setValueAtTime(pan, ctx.currentTime);
      return panner;
    } catch {
      // Fallback nếu browser không hỗ trợ
    }
  }
  return ctx.createGain();
}

/**
 * Âm thanh đáp đất / đáp lên cửa sổ (Soft Physical Thud + Resonant Squish)
 */
export function playLandSound(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  // 1. Thud trầm (Sine wave pitch drop)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);

  oscGain.gain.setValueAtTime(0.55 * soundVolume, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.18);

  // 2. Tiếng nén tiếp xúc (Soft lowpass noise tap)
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(450, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3 * soundVolume, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);
}

/**
 * Âm thanh nhảy xuống hồ bơi 3D (Water Splash + Bubbles)
 */
export function playWaterSplashSound(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  // 1. Tiếng xáo trộn bọt nước (Bandpass white noise burst)
  const bufferSize = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(1400, now);
  bandpass.frequency.exponentialRampToValueAtTime(320, now + 0.35);
  bandpass.Q.setValueAtTime(2.5, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.7 * soundVolume, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);

  // 2. Tiếng bọt khí trầm (Underwater Plop / Sine Drop)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(480, now);
  osc.frequency.exponentialRampToValueAtTime(160, now + 0.28);

  oscGain.gain.setValueAtTime(0.5 * soundVolume, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.32);
}

/**
 * Âm thanh bơi lên cạn / rũ lông (Water Emerge & Droplets)
 */
export function playWaterEmergeSound(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  const pitches = [550, 720, 890];
  pitches.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + idx * 0.06;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, t + 0.08);

    gain.gain.setValueAtTime(0.35 * soundVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.11);
  });
}

/**
 * Âm thanh bật nhảy (Jump Sweep)
 */
export function playJumpSound(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.16);

  gain.gain.setValueAtTime(0.45 * soundVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.2);
}

/**
 * Âm thanh lộn nhào / xoay tròn / lướt gió (Acrobatic Whoosh)
 */
export function playWhooshSound(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  const bufferSize = Math.floor(ctx.sampleRate * 0.28);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(600, now);
  filter.frequency.exponentialRampToValueAtTime(2200, now + 0.14);
  filter.frequency.exponentialRampToValueAtTime(500, now + 0.28);
  filter.Q.setValueAtTime(2.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.5 * soundVolume, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  noise.start(now);
}

/**
 * Âm thanh quăng cần câu ứng dụng/file (Cyber Rod Cast Whip)
 */
export function playCastRodSound(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(2400, now);
  osc.frequency.exponentialRampToValueAtTime(650, now + 0.22);

  gain.gain.setValueAtTime(0.4 * soundVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  osc.connect(gain);
  gain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Âm thanh chuông thành công (Harmonic Major Chord Chime: C6 - E6 - G6)
 */
export function playSuccessChimeSound(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  const chord = [1046.5, 1318.5, 1567.98]; // C6, E6, G6
  chord.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + idx * 0.055;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.35 * soundVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.75);
  });
}

/**
 * Âm thanh tiếng quạc quạc robot NVIDIA MicroDuck (Cyber Droid Quack)
 */
export function playDuckQuackSound(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  [0, 0.13].forEach((delay) => {
    const t = now + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.09);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, t);
    filter.Q.setValueAtTime(3.8, t);

    gain.gain.setValueAtTime(0.4 * soundVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.11);
  });
}

/**
 * Âm thanh cảnh báo / thông báo hệ thống (Double Cyber Beep)
 */
export function playAlertBeep(posX?: number) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  [784, 1046].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + idx * 0.1;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.35 * soundVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.09);
  });
}

