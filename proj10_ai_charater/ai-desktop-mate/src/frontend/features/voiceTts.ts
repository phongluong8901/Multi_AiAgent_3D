import { invoke } from '@tauri-apps/api/core';
import { appState } from '../../core/state';
import { getSoundVolume } from '../../core/soundFx';

let duckVoiceMuted = localStorage.getItem('mate_duck_voice_muted') === 'true';
let duckVoiceSessionId = 0;
let activeDuckTtsAudio: HTMLAudioElement | null = null;

let sharedAudioCtx: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;
let timeDomainBuf: Uint8Array<ArrayBuffer> | null = null;
let freqDomainBuf: Uint8Array<ArrayBuffer> | null = null;
let connectedAudioSource: MediaElementAudioSourceNode | null = null;
let syntheticSpeechActive = false;
let syntheticBoundaryPulse = 0;
let smoothLipLevel = 0;
let smoothLipSharp = 0;

function ensureVoiceAnalyser(): AnalyserNode | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtxCtor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }
  if (!sharedAnalyser) {
    sharedAnalyser = sharedAudioCtx.createAnalyser();
    sharedAnalyser.fftSize = 256;
    sharedAnalyser.smoothingTimeConstant = 0.45;
    sharedAnalyser.connect(sharedAudioCtx.destination);
    timeDomainBuf = new Uint8Array(new ArrayBuffer(sharedAnalyser.fftSize));
    freqDomainBuf = new Uint8Array(new ArrayBuffer(sharedAnalyser.frequencyBinCount));
  }
  return sharedAnalyser;
}

function disconnectActiveSource() {
  if (connectedAudioSource) {
    try {
      connectedAudioSource.disconnect();
    } catch { }
    connectedAudioSource = null;
  }
}

function attachAudioToAnalyser(audio: HTMLAudioElement) {
  disconnectActiveSource();
  try {
    const analyser = ensureVoiceAnalyser();
    if (analyser && sharedAudioCtx) {
      const src = sharedAudioCtx.createMediaElementSource(audio);
      src.connect(analyser);
      connectedAudioSource = src;
    }
  } catch {
    // fallback: audio still plays through default element output
  }
}

export function isDuckVoiceMuted(): boolean {
  return duckVoiceMuted;
}

export function setDuckVoiceMuted(muted: boolean) {
  duckVoiceMuted = muted;
  localStorage.setItem('mate_duck_voice_muted', muted ? 'true' : 'false');
  if (muted) {
    stopDuckVoiceTts();
  }
}

export function stopDuckVoiceTts() {
  duckVoiceSessionId++;
  syntheticSpeechActive = false;
  syntheticBoundaryPulse = 0;
  disconnectActiveSource();
  if (activeDuckTtsAudio) {
    try {
      activeDuckTtsAudio.pause();
      activeDuckTtsAudio.src = '';
    } catch { }
    activeDuckTtsAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch { }
  }
  appState.isRealAudioLipSync = false;
  appState.speechAudioLevel = 0;
  appState.speechFormantSharpness = 0;
}

export function sampleActiveVoiceLipSync(delta: number) {
  const safeDt = Math.max(0.001, Math.min(0.05, delta));

  if (
    activeDuckTtsAudio &&
    !activeDuckTtsAudio.paused &&
    !activeDuckTtsAudio.ended &&
    connectedAudioSource &&
    sharedAnalyser &&
    timeDomainBuf &&
    freqDomainBuf
  ) {
    sharedAnalyser.getByteTimeDomainData(timeDomainBuf);
    sharedAnalyser.getByteFrequencyData(freqDomainBuf);

    let sumSq = 0;
    for (let i = 0; i < timeDomainBuf.length; i++) {
      const n = (timeDomainBuf[i] - 128) / 128;
      sumSq += n * n;
    }
    const rms = Math.sqrt(sumSq / timeDomainBuf.length);
    const gated = rms < 0.014 ? 0 : Math.min(1, (rms - 0.014) * 5.6);

    let lowEnergy = 0;
    for (let i = 1; i <= 5 && i < freqDomainBuf.length; i++) {
      lowEnergy += freqDomainBuf[i];
    }
    let highEnergy = 0;
    for (let i = 6; i <= 26 && i < freqDomainBuf.length; i++) {
      highEnergy += freqDomainBuf[i];
    }
    const totalEnergy = lowEnergy + highEnergy + 1;
    const targetSharp = Math.min(1, highEnergy / totalEnergy);

    const rate = gated > smoothLipLevel ? 28 : 15;
    const k = Math.min(1, 1 - Math.exp(-rate * safeDt));
    smoothLipLevel += (gated - smoothLipLevel) * k;
    smoothLipSharp += (targetSharp - smoothLipSharp) * k;

    appState.isRealAudioLipSync = true;
    appState.speechAudioLevel = smoothLipLevel;
    appState.speechFormantSharpness = smoothLipSharp;
    appState.speechLipSyncTimer = Math.max(appState.speechLipSyncTimer, 0.14);
    return;
  }

  if (syntheticSpeechActive && appState.speechLipSyncTimer > 0) {
    syntheticBoundaryPulse = Math.max(0, syntheticBoundaryPulse - safeDt * 5.8);
    const target = Math.min(1, 0.22 + syntheticBoundaryPulse * 0.72);
    const k = Math.min(1, 1 - Math.exp(-22 * safeDt));
    smoothLipLevel += (target - smoothLipLevel) * k;
    smoothLipSharp += (0.45 - smoothLipSharp) * k;
    appState.isRealAudioLipSync = true;
    appState.speechAudioLevel = smoothLipLevel;
    appState.speechFormantSharpness = smoothLipSharp;
    return;
  }

  if (smoothLipLevel > 0.01 || appState.isRealAudioLipSync) {
    const k = Math.min(1, 1 - Math.exp(-18 * safeDt));
    smoothLipLevel += (0 - smoothLipLevel) * k;
    smoothLipSharp += (0 - smoothLipSharp) * k;
    if (smoothLipLevel <= 0.015) {
      smoothLipLevel = 0;
      smoothLipSharp = 0;
      appState.isRealAudioLipSync = false;
    }
    appState.speechAudioLevel = smoothLipLevel;
    appState.speechFormantSharpness = smoothLipSharp;
  }
}

function splitVietnameseTtsChunks(text: string): string[] {
  const cleaned = text
    .replace(/\[TOOL:[^\]]*\]/gi, ' ')
    .replace(/^(\[[^\]]+\]\s*)+/g, '')
    .replace(/https?:\/\/\S+/gi, ' liên kết web ')
    .replace(/[`*_#>~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const sentences = cleaned
    .split(/(?<=[.!?;:\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const s of sentences) {
    if (s.length <= 175) {
      chunks.push(s);
    } else {
      const words = s.split(' ');
      let buf = '';
      for (const w of words) {
        if ((buf + ' ' + w).trim().length > 175) {
          if (buf.trim()) chunks.push(buf.trim());
          buf = w;
        } else {
          buf = (buf + ' ' + w).trim();
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
    }
  }
  return chunks.slice(0, 14);
}

function speakBrowserFallback(
  text: string,
  lang: 'vi-VN' | 'en-US',
  rate: number,
  sessionId: number
): Promise<void> {
  return new Promise((resolve) => {
    if (
      duckVoiceMuted ||
      sessionId !== duckVoiceSessionId ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      resolve();
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = rate;
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = lang.slice(0, 2).toLowerCase();
      const matched = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
      if (matched) utter.voice = matched;
      const vol = getSoundVolume();
      utter.volume = vol > 0 ? Math.max(0.45, vol) : 0.85;
      appState.speechLipSyncTimer = Math.max(
        appState.speechLipSyncTimer,
        Math.min(4.2, text.length * 0.065)
      );
      syntheticSpeechActive = true;
      syntheticBoundaryPulse = 0.8;
      utter.onboundary = () => {
        if (sessionId === duckVoiceSessionId) {
          syntheticBoundaryPulse = 0.95;
        }
      };
      const finish = () => {
        if (sessionId === duckVoiceSessionId) {
          syntheticSpeechActive = false;
        }
        resolve();
      };
      utter.onend = finish;
      utter.onerror = finish;
      window.speechSynthesis.speak(utter);
    } catch {
      syntheticSpeechActive = false;
      resolve();
    }
  });
}

function playEncodedAudioChunk(
  src: string,
  mySession: number,
  playbackRate = 1.0
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (duckVoiceMuted || mySession !== duckVoiceSessionId) {
      resolve(false);
      return;
    }
    const audio = new Audio(src);
    if (!src.startsWith('data:')) {
      audio.crossOrigin = 'anonymous';
    }
    const vol = getSoundVolume();
    audio.volume = vol > 0 ? Math.max(0.45, vol) : 0.88;
    audio.playbackRate = playbackRate;
    activeDuckTtsAudio = audio;
    attachAudioToAnalyser(audio);
    appState.speechLipSyncTimer = Math.max(appState.speechLipSyncTimer, 2.0);

    let settled = false;
    const cleanup = (ok: boolean) => {
      if (settled) return;
      settled = true;
      disconnectActiveSource();
      if (activeDuckTtsAudio === audio) {
        activeDuckTtsAudio = null;
      }
      resolve(ok);
    };
    audio.onended = () => cleanup(true);
    audio.onerror = () => cleanup(false);
    void audio.play().catch(() => cleanup(false));
  });
}

export async function speakVietnameseTts(rawText: string) {
  if (duckVoiceMuted) return;
  const chunks = splitVietnameseTtsChunks(rawText);
  if (chunks.length === 0) return;

  stopDuckVoiceTts();
  const mySession = duckVoiceSessionId;

  for (const chunk of chunks) {
    if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
    let played = false;
    try {
      const dataUri = await invoke<string>('fetch_vietnamese_tts_audio', { text: chunk });
      if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
      appState.speechLipSyncTimer = Math.max(
        appState.speechLipSyncTimer,
        Math.min(4.0, chunk.length * 0.075)
      );
      played = await playEncodedAudioChunk(dataUri, mySession, 1.0);
    } catch {
      played = false;
    }
    if (!played && !duckVoiceMuted && mySession === duckVoiceSessionId) {
      await speakBrowserFallback(chunk, 'vi-VN', 1.02, mySession);
    }
  }
}

export async function speakEnglishTts(
  rawText: string,
  slow = false,
  directAudioUrl = ''
): Promise<void> {
  const clean = rawText
    .replace(/[`*_#>~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || duckVoiceMuted) return;

  stopDuckVoiceTts();
  const mySession = duckVoiceSessionId;

  if (!slow && directAudioUrl.trim()) {
    const ok = await playEncodedAudioChunk(directAudioUrl.trim(), mySession, 1.0);
    if (ok || mySession !== duckVoiceSessionId) return;
  }

  const slices: string[] = [];
  if (clean.length <= 185) {
    slices.push(clean);
  } else {
    const parts = clean.split(/(?<=[.!?;])\s+/);
    let buf = '';
    for (const p of parts) {
      if ((buf + ' ' + p).trim().length > 185) {
        if (buf.trim()) slices.push(buf.trim());
        buf = p;
      } else {
        buf = (buf + ' ' + p).trim();
      }
    }
    if (buf.trim()) slices.push(buf.trim());
  }

  for (const seg of slices.slice(0, 6)) {
    if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
    let played = false;
    try {
      const dataUri = await invoke<string>('fetch_english_tts_audio', { text: seg, slow });
      if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
      appState.speechLipSyncTimer = Math.max(
        appState.speechLipSyncTimer,
        Math.min(4.5, seg.length * (slow ? 0.11 : 0.08))
      );
      played = await playEncodedAudioChunk(dataUri, mySession, slow ? 0.88 : 1.0);
    } catch {
      played = false;
    }
    if (!played && !duckVoiceMuted && mySession === duckVoiceSessionId) {
      await speakBrowserFallback(seg, 'en-US', slow ? 0.68 : 0.94, mySession);
    }
  }
}
