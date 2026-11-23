import { invoke } from '@tauri-apps/api/core';
import { appState } from '../../core/state';
import { getSoundVolume } from '../../core/soundFx';

let duckVoiceMuted = localStorage.getItem('mate_duck_voice_muted') === 'true';
let duckVoiceSessionId = 0;
let activeDuckTtsAudio: HTMLAudioElement | null = null;

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

function speakBrowserFallbackVi(text: string, sessionId: number): Promise<void> {
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
      utter.lang = 'vi-VN';
      utter.rate = 1.02;
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
      if (viVoice) utter.voice = viVoice;
      const vol = getSoundVolume();
      utter.volume = vol > 0 ? Math.max(0.45, vol) : 0.85;
      appState.speechLipSyncTimer = Math.max(appState.speechLipSyncTimer, Math.min(3.5, text.length * 0.06));
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
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
    try {
      const dataUri = await invoke<string>('fetch_vietnamese_tts_audio', { text: chunk });
      if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
      await new Promise<void>((resolve) => {
        const audio = new Audio(dataUri);
        const vol = getSoundVolume();
        audio.volume = vol > 0 ? Math.max(0.45, vol) : 0.88;
        activeDuckTtsAudio = audio;
        appState.speechLipSyncTimer = Math.max(appState.speechLipSyncTimer, Math.min(4.0, chunk.length * 0.075));
        const cleanup = () => {
          if (activeDuckTtsAudio === audio) {
            activeDuckTtsAudio = null;
          }
          resolve();
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        void audio.play().catch(async () => {
          cleanup();
          await speakBrowserFallbackVi(chunk, mySession);
        });
      });
    } catch {
      if (duckVoiceMuted || mySession !== duckVoiceSessionId) return;
      await speakBrowserFallbackVi(chunk, mySession);
    }
  }
}
