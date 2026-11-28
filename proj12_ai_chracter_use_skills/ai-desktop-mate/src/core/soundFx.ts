import { appState } from './state';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let audioSuspendTimer: number | null = null;

let soundEnabled: boolean = localStorage.getItem('mate_sound_fx_enabled') !== 'false';
let soundVolume: number = Number(localStorage.getItem('mate_sound_volume') || '0.7') || 0.7;

function scheduleAudioAutoSuspend(delayMs = 2600) {
  if (audioSuspendTimer !== null) {
    window.clearTimeout(audioSuspendTimer);
  }
  audioSuspendTimer = window.setTimeout(() => {
    audioSuspendTimer = null;
    if (audioCtx && audioCtx.state === 'running') {
      void audioCtx.suspend().catch(() => {});
    }
  }, delayMs);
}

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
    void audioCtx.resume().catch(() => {});
  }
  if (audioCtx) {
    scheduleAudioAutoSuspend(2600);
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

/**
 * Âm thanh bốc và lật thẻ Tarot 3D huyền bí (Celestial Harp Sweep + Chime Cát/Hung)
 */
export function playTarotFlipSound(posX?: number, fortuneCode = 'binh_hoa') {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  const panner = createPanNode(ctx, posX ?? appState.posX);
  panner.connect(masterGain);

  // Sweep lúc lá bài xoay vòng & lật
  const sweepNotes = [392, 493.88, 587.33, 783.99];
  sweepNotes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + i * 0.09;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24 * soundVolume, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.3);
  });

  // Hợp âm kết quả khi thẻ lộ mặt (t = +0.55s)
  const chord =
    fortuneCode === 'dai_cat' || fortuneCode === 'tieu_cat'
      ? [523.25, 659.25, 783.99, 1046.5]
      : fortuneCode === 'binh_hoa'
      ? [440, 554.37, 659.25]
      : [293.66, 349.23, 440];

  chord.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + 0.52 + idx * 0.06;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.28 * soundVolume, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.58);
  });
}

function withAudioOut(posX?: number): { ctx: AudioContext; out: StereoPannerNode | GainNode; now: number } | null {
  if (!soundEnabled) return null;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return null;
  const out = createPanNode(ctx, posX ?? appState.posX);
  out.connect(masterGain);
  return { ctx, out, now: ctx.currentTime };
}

/** 1. Tiếng kêu cao dần ở cuối kiểu hỏi thăm ("quack?") */
export function playCuriousQuackSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(270, now);
  osc.frequency.exponentialRampToValueAtTime(430, now + 0.16);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(980, now);
  filter.Q.setValueAtTime(3.2, now);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.38 * soundVolume, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.2);
}

/** 2. Chuỗi 3 tiếng líu ríu vui nhộn nhanh */
export function playHappyChirpSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  [0, 0.11, 0.22].forEach((offset, idx) => {
    const t = now + offset;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const baseF = 340 + idx * 45;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseF, t);
    osc.frequency.exponentialRampToValueAtTime(500 + idx * 55, t + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150, t);
    filter.Q.setValueAtTime(3.0, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.32 * soundVolume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.105);
  });
}

/** 3. Tiếng kêu giật mình ngắn, sắc, âm lượng cao hơn nhẹ */
export function playStartledSquawkSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(560, now);
  osc.frequency.exponentialRampToValueAtTime(340, now + 0.12);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1350, now);
  filter.Q.setValueAtTime(2.6, now);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.55 * soundVolume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.14);
}

/** 4. Hai tiếng lầm bầm tần số trầm ngắt quãng khi dỗi / ngại */
export function playShyMutterSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  [0, 0.22].forEach((offset) => {
    const t = now + offset;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, t);
    osc.frequency.exponentialRampToValueAtTime(135, t + 0.13);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.24 * soundVolume, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.16);
  });
}

/** 5. Hai tiếng gõ mỏ cực khẽ ("tock-tock") */
export function playBeakTapSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  [0, 0.13].forEach((offset) => {
    const t = now + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.045);

    gain.gain.setValueAtTime(0.005, t);
    gain.gain.linearRampToValueAtTime(0.18 * soundVolume, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.065);
  });
}

/** 6. Tiếng ngáp dài hạ tông mềm mượt */
export function playSleepyYawnSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  const osc = ctx.createOscillator();
  const tri = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(370, now);
  osc.frequency.exponentialRampToValueAtTime(145, now + 0.72);

  tri.type = 'triangle';
  tri.frequency.setValueAtTime(370, now);
  tri.frequency.exponentialRampToValueAtTime(145, now + 0.72);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(720, now);

  gain.gain.setValueAtTime(0.005, now);
  gain.gain.linearRampToValueAtTime(0.28 * soundVolume, now + 0.16);
  gain.gain.linearRampToValueAtTime(0.22 * soundVolume, now + 0.48);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.74);

  osc.connect(filter);
  tri.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(now);
  tri.start(now);
  osc.stop(now + 0.75);
  tri.stop(now + 0.75);
}

/** 7. Âm thanh vươn vai tăng dần cao độ, kết thúc bằng 1 tiếng kêu gọn */
export function playWakeStretchSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  // Phần vươn vai tăng cao độ
  const stretchOsc = ctx.createOscillator();
  const stretchGain = ctx.createGain();
  stretchOsc.type = 'sine';
  stretchOsc.frequency.setValueAtTime(190, now);
  stretchOsc.frequency.exponentialRampToValueAtTime(440, now + 0.55);

  stretchGain.gain.setValueAtTime(0.005, now);
  stretchGain.gain.linearRampToValueAtTime(0.26 * soundVolume, now + 0.15);
  stretchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);

  stretchOsc.connect(stretchGain);
  stretchGain.connect(out);
  stretchOsc.start(now);
  stretchOsc.stop(now + 0.58);

  // Tiếng kêu gọn kết thúc ở +0.62s
  const endT = now + 0.62;
  const chirpOsc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const chirpGain = ctx.createGain();
  chirpOsc.type = 'sawtooth';
  chirpOsc.frequency.setValueAtTime(360, endT);
  chirpOsc.frequency.exponentialRampToValueAtTime(460, endT + 0.08);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1050, endT);
  filter.Q.setValueAtTime(3.0, endT);

  chirpGain.gain.setValueAtTime(0.005, endT);
  chirpGain.gain.linearRampToValueAtTime(0.34 * soundVolume, endT + 0.015);
  chirpGain.gain.exponentialRampToValueAtTime(0.001, endT + 0.11);

  chirpOsc.connect(filter);
  filter.connect(chirpGain);
  chirpGain.connect(out);
  chirpOsc.start(endT);
  chirpOsc.stop(endT + 0.12);
}

/** 8. Tiếng rù trầm liên tục rất nhỏ tạo cảm giác tập trung rình mồi */
export function playStalkPurrSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(92, now);

  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(22, now);
  lfoGain.gain.setValueAtTime(10, now);

  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  gain.gain.setValueAtTime(0.005, now);
  gain.gain.linearRampToValueAtTime(0.20 * soundVolume, now + 0.1);
  gain.gain.linearRampToValueAtTime(0.18 * soundVolume, now + 0.42);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + 0.56);
  lfo.stop(now + 0.56);
}

/** 9. Tiếng kêu tự hào nhưng bị "nghẹt" nhẹ vì đang ngậm vật */
export function playProudMuffledQuackSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  [0, 0.15].forEach((offset, idx) => {
    const t = now + offset;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(idx === 0 ? 290 : 330, t);
    osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 340 : 390, t + 0.1);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(560, t);
    filter.Q.setValueAtTime(1.8, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.34 * soundVolume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.13);
  });
}

/** 10. Tiếng kêu trượt tông từ cao xuống thấp khi ăn vạ ("weee-ooo") */
export function playDramaticFlopSound(posX?: number) {
  const audio = withAudioOut(posX);
  if (!audio) return;
  const { ctx, out, now } = audio;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.exponentialRampToValueAtTime(115, now + 0.65);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, now);
  filter.frequency.exponentialRampToValueAtTime(450, now + 0.65);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.38 * soundVolume, now + 0.04);
  gain.gain.linearRampToValueAtTime(0.28 * soundVolume, now + 0.45);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.66);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.67);
}


