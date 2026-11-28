import { invoke } from '@tauri-apps/api/core';
import { appState } from '../../core/state';

export interface VoiceAndWatcherCallbacks {
  bubbleInput: HTMLInputElement | null;
  btnSendMsg: HTMLButtonElement | null;
  speakMessage: (text: string) => void;
  toggleBubbleVisibility: (force?: boolean) => void;
  showSuggestionButtons: (
    onAccept: () => void,
    onDismiss: () => void,
    acceptLabel?: string,
    dismissLabel?: string
  ) => void;
}

export function initVoicePushToTalk(cb: VoiceAndWatcherCallbacks) {
  const btnVoicePtt = document.getElementById('btn-voice-ptt') as HTMLButtonElement | null;
  const SpeechRecCtor =
    (
      window as unknown as {
        SpeechRecognition?: new () => unknown;
        webkitSpeechRecognition?: new () => unknown;
      }
    ).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => unknown })
      .webkitSpeechRecognition;

  if (!btnVoicePtt || !SpeechRecCtor) {
    if (btnVoicePtt) {
      btnVoicePtt.disabled = true;
      btnVoicePtt.style.opacity = '0.4';
      btnVoicePtt.title = 'WebView hiện tại không hỗ trợ Web Speech API';
    }
    return;
  }

  type SpeechRecLike = {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((ev: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
    onerror: ((ev: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
  const rec = new SpeechRecCtor() as SpeechRecLike;
  rec.lang = 'vi-VN';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let pttActive = false;

  const stopPttUi = () => {
    pttActive = false;
    btnVoicePtt.classList.remove('ptt-listening');
  };

  rec.onresult = (ev) => {
    let transcript = '';
    for (let i = 0; i < ev.results.length; i++) {
      transcript += ev.results[i][0].transcript;
    }
    if (cb.bubbleInput) {
      cb.bubbleInput.value = transcript;
    }
    const last = ev.results[ev.results.length - 1];
    if (last?.isFinal) {
      stopPttUi();
      const clean = transcript.trim();
      if (clean && cb.btnSendMsg) {
        cb.btnSendMsg.click();
      }
    }
  };
  rec.onerror = (ev) => {
    stopPttUi();
    if (ev.error && ev.error !== 'no-speech' && ev.error !== 'aborted') {
      cb.speakMessage(`[VOICE PTT] Không nhận diện được giọng nói (${ev.error}).`);
    }
  };
  rec.onend = () => stopPttUi();

  const togglePtt = () => {
    if (pttActive) {
      rec.stop();
      stopPttUi();
      return;
    }
    try {
      pttActive = true;
      btnVoicePtt.classList.add('ptt-listening');
      if (!appState.isBubbleVisible) cb.toggleBubbleVisibility(true);
      cb.speakMessage('[VOICE PTT] Đang nghe lệnh tiếng Việt của bạn...');
      rec.start();
    } catch {
      stopPttUi();
    }
  };

  btnVoicePtt.addEventListener('click', togglePtt);
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      togglePtt();
    }
  });
}

export function initProactiveErrorWatcher(cb: VoiceAndWatcherCallbacks) {
  let lastWatchedErrorClip = '';
  const errorSignatureRx =
    /(Traceback \(most recent call last\)|error\[E\d+\]|TypeError:|ReferenceError:|SyntaxError:|UnhandledPromiseRejection|npm error|FATAL ERROR|panic at |Exception:|CS\d{4}:|TS\d{4}:)/i;

  const checkClipboardForErrorAndSuggest = async () => {
    if (appState.isChatting) return;
    try {
      const clip = (await invoke<string>('get_clipboard_text')).trim();
      if (!clip || clip.length < 18 || clip === lastWatchedErrorClip) return;
      if (!errorSignatureRx.test(clip)) return;
      lastWatchedErrorClip = clip;
      const previewLine =
        clip
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l.length > 0)
          ?.slice(0, 88) || 'Stacktrace / Error';
      if (!appState.isBubbleVisible) cb.toggleBubbleVisibility(true);
      cb.speakMessage(
        `[ERROR WATCHER] Phát hiện lỗi trong Clipboard: "${previewLine}". Nhờ Vịt phân tích & sửa không?`
      );
      cb.showSuggestionButtons(
        () => {
          if (cb.bubbleInput && cb.btnSendMsg) {
            cb.bubbleInput.value = `Phân tích và hướng dẫn sửa lỗi sau:\n${clip.slice(0, 1800)}`;
            cb.btnSendMsg.click();
          }
        },
        () => {},
        'Phân tích lỗi',
        'Bỏ qua'
      );
    } catch {
      // ignore clipboard errors
    }
  };

  window.addEventListener('focus', () => {
    void checkClipboardForErrorAndSuggest();
  });
  window.setInterval(() => {
    if (appState.isBubbleVisible) {
      void checkClipboardForErrorAndSuggest();
    }
  }, 15000);
}
