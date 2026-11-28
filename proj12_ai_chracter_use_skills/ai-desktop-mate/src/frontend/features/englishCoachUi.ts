import { invoke } from '@tauri-apps/api/core';
import { appState } from '../../core/state';
import { EnglishVocabItem } from '../../core/types';
import { fireAnimationTrigger, previewClip } from '../../core/animationBinder';
import { spawnParticles } from '../../core/particles';
import { playAlertBeep, playSuccessChimeSound } from '../../core/soundFx';
import { speakEnglishTts, stopDuckVoiceTts } from './voiceTts';
import {
  askEnglishCoachAi,
  getCurrentEnglishVocabItem,
  playEnglishVocabAudio,
  setCurrentEnglishVocabItem,
  translateEnglishItemToVi,
} from '../../backend/assistant';

export type EngCoachTab = 'learn' | 'srs' | 'quiz' | 'speak';
type SrsFilterMode = 'due' | 'starred' | 'all';
type QuizMode = 'mc' | 'cloze' | 'dictation';

interface EngStreakMeta {
  streak: number;
  lastDate: string;
  dailyDate: string;
  dailyCount: number;
  dailyGoal: number;
}

interface EngRoleplayTurn {
  role: 'user' | 'assistant';
  content: string;
  engine?: string;
}

interface EngCoachHost {
  closeOthers: () => void;
  syncHitbox: () => void;
  dragBind?: (el: HTMLElement | null) => void;
}

const STREAK_STORAGE_KEY = 'mate_eng_streak_v1';

const FALLBACK_QUIZ_DISTRACTORS: EnglishVocabItem[] = [
  {
    word: 'pragmatic',
    phonetic: '/præɡˈmæt.ɪk/',
    part_of_speech: 'adj',
    definition_en: 'dealing with things sensibly and realistically',
    meaning_vi: 'thực tế, thiết thực',
    example_en: 'We need a pragmatic approach to ship on time.',
    example_vi: 'Chúng ta cần cách tiếp cận thực tế để giao sản phẩm đúng hạn.',
    audio_url: '',
    topic: 'business',
    synonyms: ['practical', 'realistic'],
    level: 'C1',
  },
  {
    word: 'mitigate',
    phonetic: '/ˈmɪt.ɪ.ɡeɪt/',
    part_of_speech: 'verb',
    definition_en: 'make less severe, harmful, or painful',
    meaning_vi: 'giảm nhẹ, làm dịu bớt',
    example_en: 'Strict caching helps mitigate database latency.',
    example_vi: 'Bộ nhớ đệm chặt chẽ giúp giảm nhẹ độ trễ cơ sở dữ liệu.',
    audio_url: '',
    topic: 'technology',
    synonyms: ['alleviate', 'reduce'],
    level: 'C1',
  },
  {
    word: 'ubiquitous',
    phonetic: '/juːˈbɪk.wɪ.təs/',
    part_of_speech: 'adj',
    definition_en: 'present, appearing, or found everywhere',
    meaning_vi: 'phổ biến khắp nơi',
    example_en: 'Smartphones have become ubiquitous in modern workplaces.',
    example_vi: 'Điện thoại thông minh đã trở nên phổ biến khắp nơi ở công sở hiện đại.',
    audio_url: '',
    topic: 'ielts',
    synonyms: ['omnipresent', 'pervasive'],
    level: 'C1',
  },
  {
    word: 'collaborate',
    phonetic: '/kəˈlæb.ə.reɪt/',
    part_of_speech: 'verb',
    definition_en: 'work jointly on an activity or project',
    meaning_vi: 'hợp tác, cộng tác',
    example_en: 'Engineers and designers collaborate closely on UX.',
    example_vi: 'Kỹ sư và nhà thiết kế hợp tác chặt chẽ về trải nghiệm người dùng.',
    audio_url: '',
    topic: 'daily',
    synonyms: ['cooperate', 'partner'],
    level: 'B2',
  },
];

let initialized = false;
let coachHost: EngCoachHost | null = null;
let activeTab: EngCoachTab = 'learn';
let srsFilter: SrsFilterMode = 'due';
let quizMode: QuizMode = 'mc';
let currentCard: EnglishVocabItem | null = null;
let srsDeck: EnglishVocabItem[] = [];
let searchResults: EnglishVocabItem[] = [];
let cloudTotalWords = 0;

let quizScore = 0;
let quizTotal = 0;
let quizStreak = 0;
let quizTarget: EnglishVocabItem | null = null;
let quizAnswered = false;

let speakSampleMode: 'example' | 'word' = 'example';
let recognition: any = null;
let isMicListening = false;
let roleplayHistory: EngRoleplayTurn[] = [];

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function yesterdayIsoDate(): string {
  const now = new Date(Date.now() - 86_400_000);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readStreakMeta(): EngStreakMeta {
  const today = todayIsoDate();
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EngStreakMeta>;
      const sameDay = parsed.dailyDate === today;
      return {
        streak: Number(parsed.streak) || 0,
        lastDate: String(parsed.lastDate || ''),
        dailyDate: today,
        dailyCount: sameDay ? Number(parsed.dailyCount) || 0 : 0,
        dailyGoal: Math.max(5, Number(parsed.dailyGoal) || 10),
      };
    }
  } catch {
    // ignore storage parse issues
  }
  return { streak: 0, lastDate: '', dailyDate: today, dailyCount: 0, dailyGoal: 10 };
}

function bumpDailyProgress(delta = 1): EngStreakMeta {
  const today = todayIsoDate();
  const yest = yesterdayIsoDate();
  const meta = readStreakMeta();
  meta.dailyCount += delta;
  if (meta.lastDate !== today) {
    meta.streak = meta.lastDate === yest ? meta.streak + 1 : 1;
    meta.lastDate = today;
  }
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore quota issues
  }
  renderKpiBadges();
  return meta;
}

function isWordDueNow(item: EnglishVocabItem, nowSec: number): boolean {
  const next = item.next_review_at || 0;
  return next <= 0 || next <= nowSec;
}

function formatDueCountdown(nextReviewAt?: number): string {
  if (!nextReviewAt || nextReviewAt <= 0) return 'Sẵn sàng ôn';
  const diffSec = nextReviewAt - Math.floor(Date.now() / 1000);
  if (diffSec <= 0) return 'Cần ôn ngay';
  const hours = Math.floor(diffSec / 3600);
  if (hours < 24) return `Còn ${Math.max(1, hours)} giờ`;
  const days = Math.round(diffSec / 86400);
  return `Còn ${days} ngày`;
}

function masteryLabel(level?: number): string {
  const m = level ?? 0;
  if (m >= 4) return 'Thành thạo';
  if (m === 3) return 'Vững';
  if (m === 2) return 'Đang nhớ';
  if (m === 1) return 'Mới học';
  return 'Mới lưu';
}

function renderKpiBadges() {
  const meta = readStreakMeta();
  const nowSec = Math.floor(Date.now() / 1000);
  const dueCount = srsDeck.filter((item) => isWordDueNow(item, nowSec)).length;

  const mongoBadge = document.getElementById('eng-coach-mongo-badge');
  const streakBadge = document.getElementById('eng-coach-streak-badge');
  const dailyBadge = document.getElementById('eng-coach-daily-badge');
  const dueBadge = document.getElementById('eng-coach-due-badge');
  const srsCountBadge = document.getElementById('eng-srs-count-badge');

  if (mongoBadge) {
    mongoBadge.textContent =
      cloudTotalWords > 0
        ? `Kho Cloud: ${cloudTotalWords.toLocaleString('en-US')} từ`
        : 'Kho Cloud: Offline Deck';
  }
  if (streakBadge) {
    streakBadge.textContent = `Chuỗi: ${meta.streak} ngày`;
  }
  if (dailyBadge) {
    dailyBadge.textContent = `Hôm nay: ${meta.dailyCount}/${meta.dailyGoal} từ`;
  }
  if (dueBadge) {
    dueBadge.textContent = `Cần ôn SRS: ${dueCount}`;
  }
  if (srsCountBadge) {
    srsCountBadge.textContent = String(srsDeck.length);
  }
}

async function refreshCloudStatsAndSrs() {
  const [statsRes, deckRes] = await Promise.all([
    invoke<{ ok?: boolean; total_words?: number }>('fetch_english_vocab_cloud_stats').catch(() => ({
      ok: false,
      total_words: 0,
    })),
    invoke<EnglishVocabItem[]>('vocab_list_words', { limit: 250 }).catch(() => [] as EnglishVocabItem[]),
  ]);

  if (statsRes && typeof statsRes.total_words === 'number' && statsRes.total_words > 0) {
    cloudTotalWords = statsRes.total_words;
  }
  srsDeck = Array.isArray(deckRes) ? deckRes : [];
  const srcBadge = document.getElementById('eng-coach-source-badge');
  if (srcBadge) {
    srcBadge.textContent =
      cloudTotalWords > 0
        ? `[MONGO CLOUD: ${cloudTotalWords.toLocaleString('en-US')}]`
        : '[OFFLINE DECK + ONLINE API]';
  }
  renderKpiBadges();
  renderSrsList();
}

function renderFlashcard(item: EnglishVocabItem, resetFlip = true) {
  currentCard = item;
  setCurrentEnglishVocabItem(item);

  const inner = document.getElementById('eng-flashcard-inner');
  if (resetFlip && inner) inner.classList.remove('is-flipped');

  const setText = (id: string, value: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('eng-fc-level', item.level || 'B2');
  setText('eng-fc-topic', item.topic || 'general');
  setText('eng-fc-pos', item.part_of_speech || 'word');
  setText('eng-fc-word', item.word);
  setText('eng-fc-ipa', item.phonetic || '/.../');
  setText('eng-fc-back-title', `${item.word} ${item.phonetic || ''}`.trim());
  setText('eng-fc-vi', item.meaning_vi || '(Chưa có nghĩa tiếng Việt — nhấn Dịch AI Sâu)');
  setText('eng-fc-en', item.definition_en || 'Click AI Translate to inspect full English definition.');
  setText('eng-fc-example', item.example_en || `We actively practice "${item.word}" every day.`);
  setText('eng-fc-example-vi', item.example_vi || '');

  const synEl = document.getElementById('eng-fc-synonyms');
  if (synEl) {
    const syns = Array.isArray(item.synonyms) ? item.synonyms.filter(Boolean).slice(0, 6) : [];
    if (syns.length > 0) {
      synEl.style.display = 'block';
      synEl.textContent = `Đồng nghĩa: ${syns.join(', ')}`;
    } else {
      synEl.style.display = 'none';
      synEl.textContent = '';
    }
  }

  const collocBox = document.getElementById('eng-fc-collocation-box');
  if (collocBox) {
    collocBox.textContent =
      'Nhấn "Hỏi AI Collocations" để lấy cụm từ hay đi kèm, sắc thái dùng trong IELTS/Tech & lỗi cần tránh.';
  }

  const starBtn = document.getElementById('btn-eng-fc-star');
  if (starBtn) {
    const isStar = Boolean(item.is_starred);
    starBtn.style.color = isStar ? '#facc15' : '#94a3b8';
    const poly = starBtn.querySelector('polygon');
    if (poly) poly.setAttribute('fill', isStar ? '#facc15' : 'none');
  }

  syncSpeakTargetFromCard();
}

function renderSearchResults(items: EnglishVocabItem[], query: string) {
  searchResults = items;
  const box = document.getElementById('eng-search-results');
  if (!box) return;
  box.innerHTML = '';
  if (!query.trim()) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'flex';

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size: 11px; color: #94a3b8; padding: 4px 6px;';
    empty.textContent = `Không thấy "${query}" trong MongoDB / Offline Deck. Nhấn "Dịch AI Sâu" hoặc gõ từ tiếng Anh chuẩn hơn.`;
    box.appendChild(empty);
    return;
  }

  items.slice(0, 14).forEach((item) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'eng-search-item';

    const left = document.createElement('span');
    left.textContent = `${item.word} ${item.phonetic || ''}`.trim();
    left.style.fontWeight = '700';

    const right = document.createElement('span');
    right.style.cssText = 'color: #6ee7b7; font-size: 10.5px; max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    right.textContent = item.meaning_vi || item.definition_en || item.topic;

    row.appendChild(left);
    row.appendChild(right);
    row.addEventListener('click', () => {
      renderFlashcard(item, true);
      box.style.display = 'none';
      playEnglishVocabAudio(item, { slow: false });
    });
    box.appendChild(row);
  });
}

async function handleDrawRandomCard() {
  const topicSel = document.getElementById('eng-coach-topic-select') as HTMLSelectElement | null;
  const lvlSel = document.getElementById('eng-coach-level-select') as HTMLSelectElement | null;
  const topic = topicSel?.value || 'random';
  const level = lvlSel?.value || '';
  const excludeWords = srsDeck.slice(0, 80).map((w) => w.word);

  const btn = document.getElementById('btn-eng-random-card') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    let fetched = await invoke<EnglishVocabItem>('fetch_real_english_lesson', {
      topic,
      level: level || null,
      excludeWords,
    });
    if (!fetched.meaning_vi || fetched.meaning_vi.toLowerCase() === fetched.word.toLowerCase()) {
      fetched = await translateEnglishItemToVi(fetched, false);
    }
    renderFlashcard(fetched, true);
    playEnglishVocabAudio(fetched, { slow: false });
  } catch (err) {
    const colloc = document.getElementById('eng-fc-collocation-box');
    if (colloc) colloc.textContent = `[WARN] Không rút được thẻ mới: ${String(err)}`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleSearchVocab(autoOpenFirst = false) {
  const input = document.getElementById('eng-search-input') as HTMLInputElement | null;
  const topicSel = document.getElementById('eng-coach-topic-select') as HTMLSelectElement | null;
  const lvlSel = document.getElementById('eng-coach-level-select') as HTMLSelectElement | null;
  const q = input?.value.trim() || '';
  if (!q) {
    renderSearchResults([], '');
    return;
  }

  const results = await invoke<EnglishVocabItem[]>('search_english_vocab', {
    query: q,
    topic: topicSel?.value && topicSel.value !== 'random' ? topicSel.value : null,
    level: lvlSel?.value || null,
    limit: 16,
  }).catch(() => [] as EnglishVocabItem[]);

  if (autoOpenFirst && results.length > 0) {
    let first = results[0];
    if (!first.meaning_vi) {
      first = await translateEnglishItemToVi(first, false).catch(() => first);
    }
    renderFlashcard(first, true);
    renderSearchResults(results, q);
    return;
  }
  renderSearchResults(results, q);
}

async function handleSaveCurrentCardToSrs(silent = false) {
  if (!currentCard || !currentCard.word.trim()) return;
  let cardToSave = { ...currentCard };
  if (!cardToSave.meaning_vi) {
    cardToSave = await translateEnglishItemToVi(cardToSave, false).catch(() => cardToSave);
    renderFlashcard(cardToSave, false);
  }
  const updatedList = await invoke<EnglishVocabItem[]>('vocab_save_word', { item: cardToSave }).catch(
    () => srsDeck
  );
  srsDeck = updatedList;
  bumpDailyProgress(1);
  renderKpiBadges();
  renderSrsList();

  if (!silent) {
    playSuccessChimeSound(appState.posX);
    spawnParticles(appState.posX, appState.posY - 90, 12, 0x34d399);
    const btn = document.getElementById('btn-eng-fc-save');
    if (btn) {
      btn.textContent = 'Đã Lưu Sổ!';
      window.setTimeout(() => {
        btn.textContent = 'Lưu Vào Sổ SRS';
      }, 1400);
    }
  }
}

async function handleGradeSrsQuality(quality: number) {
  if (!currentCard || !currentCard.word.trim()) return;
  await invoke<EnglishVocabItem[]>('vocab_save_word', { item: currentCard }).catch(() => null);
  const reviewed = await invoke<EnglishVocabItem>('vocab_record_review', {
    word: currentCard.word,
    quality,
  }).catch(() => currentCard!);

  bumpDailyProgress(1);
  if (quality >= 4) {
    playSuccessChimeSound(appState.posX);
    previewClip(quality === 5 ? 'celebrate_backhop' : 'cheer');
    spawnParticles(appState.posX, appState.posY - 90, 14, 0x38bdf8);
  }

  await refreshCloudStatsAndSrs();
  const nextDue = srsDeck.find((item) => item.word !== reviewed.word && isWordDueNow(item, Math.floor(Date.now() / 1000)));
  if (nextDue) {
    renderFlashcard(nextDue, true);
  } else {
    await handleDrawRandomCard();
  }
}

function renderSrsList() {
  const listEl = document.getElementById('eng-srs-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const nowSec = Math.floor(Date.now() / 1000);
  const filtered = srsDeck.filter((item) => {
    if (srsFilter === 'due') return isWordDueNow(item, nowSec);
    if (srsFilter === 'starred') return Boolean(item.is_starred);
    return true;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding: 16px; text-align: center; color: #94a3b8; font-size: 11.5px;';
    empty.textContent =
      srsFilter === 'due'
        ? 'Tuyệt vời! Bạn đã ôn hết từ tới hạn hôm nay. Nhấn "Tất Cả Sổ" hoặc qua tab Flashcard thêm từ mới.'
        : 'Chưa có từ nào trong mục này.';
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'eng-srs-row';

    const info = document.createElement('div');
    info.style.cssText = 'min-width: 0; flex: 1;';

    const topLine = document.createElement('div');
    topLine.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-wrap: wrap;';
    const strong = document.createElement('strong');
    strong.style.cssText = 'color: #f8fafc; font-size: 12.5px;';
    strong.textContent = item.word;
    const ipa = document.createElement('span');
    ipa.style.cssText = 'color: #7dd3fc; font-size: 10.5px;';
    ipa.textContent = item.phonetic || '';
    const stageBadge = document.createElement('span');
    stageBadge.className = 'badge';
    stageBadge.style.cssText = 'font-size: 9px; padding: 1px 6px;';
    stageBadge.textContent = `${masteryLabel(item.mastery_level)} • ${formatDueCountdown(item.next_review_at)}`;
    topLine.appendChild(strong);
    if (item.phonetic) topLine.appendChild(ipa);
    topLine.appendChild(stageBadge);

    const sub = document.createElement('div');
    sub.style.cssText = 'color: #6ee7b7; font-size: 11px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    sub.textContent = item.meaning_vi || item.definition_en || '(Chưa dịch)';

    info.appendChild(topLine);
    info.appendChild(sub);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 4px; flex-shrink: 0;';

    const btnSpeak = document.createElement('button');
    btnSpeak.type = 'button';
    btnSpeak.className = 'btn-mini-action';
    btnSpeak.textContent = 'Đọc';
    btnSpeak.addEventListener('click', () => playEnglishVocabAudio(item));

    const btnStar = document.createElement('button');
    btnStar.type = 'button';
    btnStar.className = 'btn-mini-action';
    btnStar.textContent = item.is_starred ? 'Bỏ Sao' : 'Sao';
    if (item.is_starred) btnStar.style.color = '#facc15';
    btnStar.addEventListener('click', async () => {
      const next = !item.is_starred;
      await invoke<boolean>('vocab_toggle_star', { word: item.word, starred: next }).catch(() => next);
      await refreshCloudStatsAndSrs();
    });

    const btnStudy = document.createElement('button');
    btnStudy.type = 'button';
    btnStudy.className = 'btn-mini-action eng-btn-accent';
    btnStudy.textContent = 'Ôn';
    btnStudy.addEventListener('click', () => {
      renderFlashcard(item, true);
      setCoachTab('learn');
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-mini-action';
    btnDel.style.color = '#fca5a5';
    btnDel.textContent = 'Xóa';
    btnDel.addEventListener('click', async () => {
      srsDeck = await invoke<EnglishVocabItem[]>('vocab_delete_word', { word: item.word }).catch(() => srsDeck);
      renderKpiBadges();
      renderSrsList();
    });

    actions.appendChild(btnSpeak);
    actions.appendChild(btnStar);
    actions.appendChild(btnStudy);
    actions.appendChild(btnDel);

    row.appendChild(info);
    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

function updateQuizScoreUi() {
  const lbl = document.getElementById('eng-quiz-score-label');
  if (lbl) lbl.textContent = `Điểm: ${quizScore}/${quizTotal} | Chuỗi: ${quizStreak}`;
}

function maskWordInSentence(sentence: string, word: string): string {
  const cleanWord = word.trim();
  if (!cleanWord) return sentence;
  const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}[a-z]*\\b`, 'gi');
  if (re.test(sentence)) {
    return sentence.replace(re, '______');
  }
  return `Fill the blank word meaning "${cleanWord}": ${sentence} (______)`;
}

async function buildNextQuizQuestion() {
  quizAnswered = false;
  const fbEl = document.getElementById('eng-quiz-feedback');
  if (fbEl) {
    fbEl.style.display = 'none';
    fbEl.textContent = '';
  }

  const pool = [...srsDeck, ...searchResults, ...FALLBACK_QUIZ_DISTRACTORS];
  const uniqueMap = new Map<string, EnglishVocabItem>();
  for (const item of pool) {
    if (item && item.word) uniqueMap.set(item.word.toLowerCase(), item);
  }
  let candidates = Array.from(uniqueMap.values());
  if (candidates.length < 4) {
    for (const d of FALLBACK_QUIZ_DISTRACTORS) uniqueMap.set(d.word.toLowerCase(), d);
    candidates = Array.from(uniqueMap.values());
  }

  let pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (!pick.meaning_vi || pick.meaning_vi.toLowerCase() === pick.word.toLowerCase()) {
    pick = await translateEnglishItemToVi(pick, false).catch(() => pick);
  }
  quizTarget = pick;

  const promptEl = document.getElementById('eng-quiz-prompt');
  const hintEl = document.getElementById('eng-quiz-subhint');
  const optsEl = document.getElementById('eng-quiz-options');
  const inputWrap = document.getElementById('eng-quiz-input-wrap');
  const textInp = document.getElementById('eng-quiz-text-input') as HTMLInputElement | null;

  if (!promptEl || !hintEl || !optsEl || !inputWrap) return;
  optsEl.innerHTML = '';

  if (quizMode === 'mc') {
    optsEl.style.display = 'grid';
    inputWrap.style.display = 'none';
    promptEl.textContent = `Từ "${pick.word}" (${pick.phonetic || pick.part_of_speech}) có nghĩa tiếng Việt là gì?`;
    hintEl.textContent = pick.definition_en ? `Gợi ý EN: ${pick.definition_en}` : `Chủ đề: ${pick.topic}`;

    const distractors = candidates
      .filter((c) => c.word.toLowerCase() !== pick.word.toLowerCase() && (c.meaning_vi || c.definition_en))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const choices = [pick, ...distractors].sort(() => Math.random() - 0.5);

    choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eng-quiz-opt-btn';
      btn.textContent = choice.meaning_vi || choice.definition_en || choice.word;
      btn.addEventListener('click', () => {
        if (quizAnswered) return;
        const ok = choice.word.toLowerCase() === pick.word.toLowerCase();
        finishQuizAttempt(ok, pick, btn);
      });
      optsEl.appendChild(btn);
    });
    playEnglishVocabAudio(pick);
  } else if (quizMode === 'cloze') {
    optsEl.style.display = 'none';
    inputWrap.style.display = 'flex';
    const ex = pick.example_en || `Teams rely on ${pick.word} to succeed.`;
    promptEl.textContent = maskWordInSentence(ex, pick.word);
    hintEl.textContent = `Nghĩa tiếng Việt: ${pick.meaning_vi || pick.definition_en} (${pick.part_of_speech || 'word'}, bắt đầu bằng "${pick.word[0]}")`;
    if (textInp) {
      textInp.value = '';
      textInp.focus();
    }
  } else {
    optsEl.style.display = 'none';
    inputWrap.style.display = 'flex';
    promptEl.textContent = 'Chế độ Nghe Chép Chính Tả: Nghe Vịt đọc và gõ lại đúng từ tiếng Anh bên dưới.';
    hintEl.textContent = `Nghĩa: ${pick.meaning_vi || pick.definition_en} • Loại từ: ${pick.part_of_speech || 'word'}`;
    if (textInp) {
      textInp.value = '';
      textInp.focus();
    }
    playEnglishVocabAudio(pick, { slow: false });
  }
}

function finishQuizAttempt(isCorrect: boolean, target: EnglishVocabItem, clickedBtn?: HTMLButtonElement) {
  quizAnswered = true;
  quizTotal += 1;
  if (isCorrect) {
    quizScore += 1;
    quizStreak += 1;
    bumpDailyProgress(1);
    playSuccessChimeSound(appState.posX);
    previewClip(quizStreak >= 3 ? 'celebrate_backhop' : 'cheer');
    spawnParticles(appState.posX, appState.posY - 95, 16, 0x34d399);
    if (clickedBtn) clickedBtn.classList.add('is-correct');
  } else {
    quizStreak = 0;
    playAlertBeep(appState.posX);
    previewClip('facepalm');
    if (clickedBtn) clickedBtn.classList.add('is-wrong');
    document.querySelectorAll('#eng-quiz-options .eng-quiz-opt-btn').forEach((node) => {
      if ((node.textContent || '') === (target.meaning_vi || target.definition_en || target.word)) {
        node.classList.add('is-correct');
      }
    });
  }

  updateQuizScoreUi();
  void invoke('vocab_record_review', {
    word: target.word,
    quality: isCorrect ? 4 : 2,
  })
    .then(() => refreshCloudStatsAndSrs())
    .catch(() => null);

  const fbEl = document.getElementById('eng-quiz-feedback');
  if (fbEl) {
    fbEl.style.display = 'block';
    fbEl.textContent = isCorrect
      ? `[CHÍNH XÁC] ${target.word} ${target.phonetic || ''} = ${target.meaning_vi}. VD: "${target.example_en}"`
      : `[CHƯA ĐÚNG] Đáp án là "${target.word}" ${target.phonetic || ''} = ${target.meaning_vi}. VD: "${target.example_en}"`;
  }
}

function syncSpeakTargetFromCard() {
  const targetTextEl = document.getElementById('eng-speak-target-text');
  const targetIpaEl = document.getElementById('eng-speak-target-ipa');
  if (!targetTextEl || !targetIpaEl) return;

  if (!currentCard) return;
  if (speakSampleMode === 'example' && currentCard.example_en) {
    targetTextEl.textContent = currentCard.example_en;
    targetIpaEl.textContent = `Từ trọng tâm: ${currentCard.word} ${currentCard.phonetic || ''} — ${currentCard.meaning_vi || ''}`;
  } else {
    targetTextEl.textContent = currentCard.word;
    targetIpaEl.textContent = `${currentCard.phonetic || ''} (${currentCard.part_of_speech || 'word'}) — ${currentCard.meaning_vi || ''}`;
  }
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreSpokenTranscript() {
  const targetText = document.getElementById('eng-speak-target-text')?.textContent?.trim() || '';
  const spokenText = (document.getElementById('eng-speak-transcript') as HTMLTextAreaElement | null)?.value.trim() || '';
  const scoreBox = document.getElementById('eng-speak-score-box');
  if (!scoreBox || !targetText) return;

  if (!spokenText) {
    scoreBox.textContent = 'Chưa có câu đọc để chấm. Bật Mic (en-US) hoặc gõ câu bạn vừa đọc rồi nhấn Chấm Điểm.';
    return;
  }

  const targetWords = normalizeWords(targetText);
  const spokenSet = new Set(normalizeWords(spokenText));
  let hits = 0;

  scoreBox.innerHTML = '';
  const summary = document.createElement('div');
  summary.style.cssText = 'margin-bottom: 4px; font-weight: 700;';

  const tokenWrap = document.createElement('div');
  tokenWrap.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px;';

  targetWords.forEach((tok) => {
    const matched = spokenSet.has(tok);
    if (matched) hits += 1;
    const span = document.createElement('span');
    span.className = matched ? 'eng-tok-hit' : 'eng-tok-miss';
    span.textContent = tok;
    tokenWrap.appendChild(span);
  });

  const pct = targetWords.length > 0 ? Math.round((hits / targetWords.length) * 100) : 0;
  summary.textContent = `Độ khớp phát âm: ${pct}% (${hits}/${targetWords.length} từ)`;
  summary.style.color = pct >= 80 ? '#6ee7b7' : pct >= 50 ? '#fde68a' : '#fca5a5';

  scoreBox.appendChild(summary);
  scoreBox.appendChild(tokenWrap);

  if (pct >= 75) {
    bumpDailyProgress(1);
    playSuccessChimeSound(appState.posX);
    previewClip('wing_flutter_joy');
  }
}

function toggleMicShadowing() {
  const btn = document.getElementById('btn-speak-mic-toggle');
  const statusEl = document.getElementById('eng-speak-mic-status');
  const transcriptEl = document.getElementById('eng-speak-transcript') as HTMLTextAreaElement | null;

  if (isMicListening && recognition) {
    try {
      recognition.stop();
    } catch {
      // ignore
    }
    isMicListening = false;
    if (btn) btn.textContent = 'Bật Mic Nói (en-US)';
    if (statusEl) statusEl.textContent = 'Đã dừng Mic';
    scoreSpokenTranscript();
    return;
  }

  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    if (statusEl) statusEl.textContent = 'WebView chưa hỗ trợ Web Speech Recognition — hãy gõ câu thử vào ô dưới';
    return;
  }

  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    isMicListening = true;
    if (btn) btn.textContent = 'Dừng Mic...';
    if (statusEl) statusEl.textContent = 'Đang nghe tiếng Anh (en-US)...';
  };
  recognition.onresult = (ev: any) => {
    let text = '';
    for (let i = 0; i < ev.results.length; i += 1) {
      text += ev.results[i][0].transcript + ' ';
    }
    if (transcriptEl) transcriptEl.value = text.trim();
  };
  recognition.onerror = (ev: any) => {
    isMicListening = false;
    if (btn) btn.textContent = 'Bật Mic Nói (en-US)';
    if (statusEl) statusEl.textContent = `Lỗi Mic: ${String(ev?.error || 'no-speech')}`;
  };
  recognition.onend = () => {
    isMicListening = false;
    if (btn) btn.textContent = 'Bật Mic Nói (en-US)';
    if (statusEl) statusEl.textContent = 'Đã chấm xong phiên nói';
    scoreSpokenTranscript();
  };

  stopDuckVoiceTts();
  recognition.start();
}

function renderRoleplayHistory() {
  const box = document.getElementById('eng-roleplay-history');
  if (!box) return;
  box.innerHTML = '';

  if (roleplayHistory.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size: 11px; color: #94a3b8; padding: 8px;';
    empty.textContent = 'Nhấn "AI Mở Lời" để Duck đóng vai giám khảo / đồng nghiệp luyện nói tiếng Anh trực tiếp với bạn.';
    box.appendChild(empty);
    return;
  }

  roleplayHistory.forEach((turn) => {
    const card = document.createElement('div');
    card.className = `eng-rp-msg ${turn.role === 'user' ? 'is-user' : ''}`;

    const head = document.createElement('div');
    head.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;';
    const who = document.createElement('strong');
    who.style.cssText = turn.role === 'user' ? 'color: #7dd3fc;' : 'color: #6ee7b7;';
    who.textContent = turn.role === 'user' ? 'Bạn' : `Duck Coach (${turn.engine || 'AI'})`;
    head.appendChild(who);

    if (turn.role === 'assistant') {
      const btnListen = document.createElement('button');
      btnListen.type = 'button';
      btnListen.className = 'btn-mini-action';
      btnListen.style.padding = '1px 7px';
      btnListen.textContent = 'Nghe';
      btnListen.addEventListener('click', () => {
        const englishLine = turn.content.split('VN_HINT:')[0].trim();
        void speakEnglishTts(englishLine, false);
      });
      head.appendChild(btnListen);
    }

    const body = document.createElement('div');
    body.style.whiteSpace = 'pre-wrap';
    body.textContent = turn.content;

    card.appendChild(head);
    card.appendChild(body);
    box.appendChild(card);
  });

  box.scrollTop = box.scrollHeight;
}

async function sendRoleplayTurn(customPrompt?: string) {
  const sel = document.getElementById('eng-roleplay-scenario') as HTMLSelectElement | null;
  const inp = document.getElementById('eng-roleplay-input') as HTMLInputElement | null;
  const scenario = sel?.value || 'Daily Conversation';
  const userText = customPrompt ?? inp?.value.trim() ?? '';
  if (!userText) return;

  if (!customPrompt && inp) inp.value = '';
  roleplayHistory.push({ role: 'user', content: userText });
  renderRoleplayHistory();

  const btnSend = document.getElementById('btn-roleplay-send') as HTMLButtonElement | null;
  const btnPrompt = document.getElementById('btn-roleplay-new-prompt') as HTMLButtonElement | null;
  if (btnSend) btnSend.disabled = true;
  if (btnPrompt) btnPrompt.disabled = true;

  try {
    const contextHint = currentCard
      ? `${scenario} (try weaving in "${currentCard.word}" naturally)`
      : scenario;
    const res = await askEnglishCoachAi(
      contextHint,
      userText,
      roleplayHistory.slice(-6).map((t) => ({ role: t.role, content: t.content }))
    );
    roleplayHistory.push({ role: 'assistant', content: res.reply, engine: res.engine });
    renderRoleplayHistory();
    const spokenPart = res.reply.split(/VN_HINT:|Gợi ý:/i)[0].trim();
    if (spokenPart) void speakEnglishTts(spokenPart, false);
  } catch (err) {
    roleplayHistory.push({ role: 'assistant', content: `[AI OFFLINE] ${String(err)}` });
    renderRoleplayHistory();
  } finally {
    if (btnSend) btnSend.disabled = false;
    if (btnPrompt) btnPrompt.disabled = false;
  }
}

export function setCoachTab(tab: EngCoachTab) {
  activeTab = tab;
  document.querySelectorAll('#english-coach-modal [data-eng-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-eng-tab') === tab);
  });
  const paneIds: Record<EngCoachTab, string> = {
    learn: 'eng-pane-learn',
    srs: 'eng-pane-srs',
    quiz: 'eng-pane-quiz',
    speak: 'eng-pane-speak',
  };
  (Object.keys(paneIds) as EngCoachTab[]).forEach((k) => {
    const el = document.getElementById(paneIds[k]);
    if (el) el.style.display = k === tab ? 'block' : 'none';
  });

  if (tab === 'srs') {
    void refreshCloudStatsAndSrs();
  } else if (tab === 'quiz' && !quizTarget) {
    void buildNextQuizQuestion();
  } else if (tab === 'speak') {
    syncSpeakTargetFromCard();
    renderRoleplayHistory();
  }
}

export function toggleEnglishCoachModal(
  forceState?: boolean,
  options?: { tab?: EngCoachTab; wordQuery?: string }
) {
  const modal = document.getElementById('english-coach-modal');
  appState.isEnglishCoachOpen =
    forceState !== undefined ? forceState : !appState.isEnglishCoachOpen;

  if (appState.isEnglishCoachOpen) {
    coachHost?.closeOthers();
    fireAnimationTrigger('event', 'panel:english-coach-modal', 'enter');
    setCoachTab(options?.tab || activeTab || 'learn');

    const activeVocab = currentCard || getCurrentEnglishVocabItem();
    if (activeVocab) {
      renderFlashcard(activeVocab, true);
    } else if (!options?.wordQuery) {
      void handleDrawRandomCard();
    }

    void refreshCloudStatsAndSrs();

    if (options?.wordQuery) {
      const inp = document.getElementById('eng-search-input') as HTMLInputElement | null;
      if (inp) inp.value = options.wordQuery;
      void handleSearchVocab(true);
    }
  } else if (isMicListening && recognition) {
    try {
      recognition.stop();
    } catch {
      // ignore
    }
    isMicListening = false;
  }

  if (modal) {
    modal.style.display = appState.isEnglishCoachOpen ? 'block' : 'none';
  }
  document.getElementById('dock-btn-english')?.classList.toggle('active', appState.isEnglishCoachOpen);
  document.getElementById('btn-open-english-coach')?.classList.toggle('active', appState.isEnglishCoachOpen);
  coachHost?.syncHitbox();
}

export async function openEnglishCoachWithWord(wordOrText: string) {
  const cleanWord = wordOrText
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase() || '';
  if (!cleanWord) {
    toggleEnglishCoachModal(true, { tab: 'learn' });
    return;
  }

  toggleEnglishCoachModal(true, { tab: 'learn', wordQuery: cleanWord });
  const results = await invoke<EnglishVocabItem[]>('search_english_vocab', {
    query: cleanWord,
    topic: null,
    level: null,
    limit: 8,
  }).catch(() => [] as EnglishVocabItem[]);

  let chosen = results.find((r) => r.word.toLowerCase() === cleanWord) || results[0];
  if (!chosen) {
    chosen = {
      word: cleanWord,
      phonetic: '',
      part_of_speech: 'word',
      definition_en: '',
      meaning_vi: '',
      example_en: '',
      example_vi: '',
      audio_url: '',
      topic: 'ocr',
      synonyms: [],
      level: 'B2',
    };
  }
  chosen = await translateEnglishItemToVi(chosen, !chosen.meaning_vi).catch(() => chosen);
  renderFlashcard(chosen, true);
  await handleSaveCurrentCardToSrs(false);
}

export function initEnglishCoachUi(host: EngCoachHost) {
  coachHost = host;
  if (initialized) return;
  initialized = true;

  const modalEl = document.getElementById('english-coach-modal');
  coachHost.dragBind?.(modalEl);

  document.getElementById('btn-close-english-coach')?.addEventListener('click', () => {
    toggleEnglishCoachModal(false);
  });

  document.querySelectorAll('#english-coach-modal [data-eng-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = (btn.getAttribute('data-eng-tab') || 'learn') as EngCoachTab;
      setCoachTab(tab);
    });
  });

  document.getElementById('eng-flashcard-inner')?.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement)?.closest('button')) return;
    document.getElementById('eng-flashcard-inner')?.classList.toggle('is-flipped');
  });

  document.getElementById('btn-eng-fc-flip')?.addEventListener('click', () => {
    document.getElementById('eng-flashcard-inner')?.classList.toggle('is-flipped');
  });

  document.getElementById('btn-eng-fc-speak')?.addEventListener('click', () => {
    playEnglishVocabAudio(currentCard, { slow: false });
  });

  document.getElementById('btn-eng-fc-slow')?.addEventListener('click', () => {
    playEnglishVocabAudio(currentCard, { slow: true });
  });

  document.getElementById('btn-eng-fc-speak-ex')?.addEventListener('click', () => {
    if (currentCard?.example_en) {
      void speakEnglishTts(currentCard.example_en, false);
    }
  });

  document.getElementById('btn-eng-fc-star')?.addEventListener('click', async () => {
    if (!currentCard) return;
    const nextStar = !currentCard.is_starred;
    currentCard = { ...currentCard, is_starred: nextStar };
    await invoke('vocab_save_word', { item: currentCard }).catch(() => null);
    await invoke('vocab_toggle_star', { word: currentCard.word, starred: nextStar }).catch(() => nextStar);
    renderFlashcard(currentCard, false);
    void refreshCloudStatsAndSrs();
  });

  document.getElementById('btn-eng-fc-save')?.addEventListener('click', () => {
    void handleSaveCurrentCardToSrs(false);
  });

  document.getElementById('btn-eng-fc-translate')?.addEventListener('click', async () => {
    if (!currentCard) return;
    const btn = document.getElementById('btn-eng-fc-translate') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      const translated = await translateEnglishItemToVi(currentCard, true);
      renderFlashcard(translated, false);
      document.getElementById('eng-flashcard-inner')?.classList.add('is-flipped');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('btn-eng-fc-ai-colloc')?.addEventListener('click', async () => {
    if (!currentCard) return;
    const box = document.getElementById('eng-fc-collocation-box');
    const btn = document.getElementById('btn-eng-fc-ai-colloc') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    if (box) box.textContent = 'Đang hỏi AI phân tích collocation & sắc thái...';
    document.getElementById('eng-flashcard-inner')?.classList.add('is-flipped');
    try {
      const res = await askEnglishCoachAi(
        'Collocation & Usage Coach',
        `Explain the English word "${currentCard.word}" succinctly in Vietnamese + 3 high-value collocations and 1 IELTS/tech sentence. Keep under 75 words.`,
        []
      );
      if (box) box.textContent = `[${res.engine}] ${res.reply}`;
    } catch (err) {
      if (box) box.textContent = `[AI OFFLINE] ${String(err)}`;
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('btn-eng-random-card')?.addEventListener('click', () => {
    void handleDrawRandomCard();
  });

  document.getElementById('btn-eng-search-go')?.addEventListener('click', () => {
    void handleSearchVocab(false);
  });

  document.getElementById('eng-search-input')?.addEventListener('keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Enter') {
      void handleSearchVocab(true);
    }
  });

  document.querySelectorAll('#english-coach-modal [data-srs-q]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = Number(btn.getAttribute('data-srs-q') || '4');
      void handleGradeSrsQuality(q);
    });
  });

  document.querySelectorAll('#english-coach-modal [data-srs-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      srsFilter = (btn.getAttribute('data-srs-filter') || 'due') as SrsFilterMode;
      document.querySelectorAll('#english-coach-modal [data-srs-filter]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      renderSrsList();
    });
  });

  document.getElementById('btn-eng-srs-start-session')?.addEventListener('click', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const dueItem = srsDeck.find((item) => isWordDueNow(item, nowSec)) || srsDeck[0];
    if (dueItem) {
      renderFlashcard(dueItem, true);
      setCoachTab('learn');
      playEnglishVocabAudio(dueItem);
    }
  });

  document.querySelectorAll('#english-coach-modal [data-quiz-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      quizMode = (btn.getAttribute('data-quiz-mode') || 'mc') as QuizMode;
      document.querySelectorAll('#english-coach-modal [data-quiz-mode]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      void buildNextQuizQuestion();
    });
  });

  document.getElementById('btn-quiz-next')?.addEventListener('click', () => {
    void buildNextQuizQuestion();
  });

  document.getElementById('btn-quiz-play-audio')?.addEventListener('click', () => {
    if (quizTarget) playEnglishVocabAudio(quizTarget, { slow: false });
  });

  const submitTextQuiz = () => {
    if (quizAnswered || !quizTarget) return;
    const inp = document.getElementById('eng-quiz-text-input') as HTMLInputElement | null;
    const answer = (inp?.value || '').trim().toLowerCase();
    if (!answer) return;
    const ok = answer === quizTarget.word.trim().toLowerCase();
    finishQuizAttempt(ok, quizTarget);
  };

  document.getElementById('btn-quiz-submit-text')?.addEventListener('click', submitTextQuiz);
  document.getElementById('eng-quiz-text-input')?.addEventListener('keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Enter') submitTextQuiz();
  });

  document.getElementById('btn-speak-listen-sample')?.addEventListener('click', () => {
    const txt = document.getElementById('eng-speak-target-text')?.textContent?.trim();
    if (txt) void speakEnglishTts(txt, false);
  });

  document.getElementById('btn-speak-use-example')?.addEventListener('click', () => {
    speakSampleMode = speakSampleMode === 'example' ? 'word' : 'example';
    syncSpeakTargetFromCard();
  });

  document.getElementById('btn-speak-mic-toggle')?.addEventListener('click', toggleMicShadowing);
  document.getElementById('btn-speak-score-now')?.addEventListener('click', scoreSpokenTranscript);

  document.getElementById('btn-roleplay-new-prompt')?.addEventListener('click', () => {
    const scenario = (document.getElementById('eng-roleplay-scenario') as HTMLSelectElement | null)?.value || 'Daily Conversation';
    void sendRoleplayTurn(
      `Start a fresh ${scenario} roleplay turn: ask me 1 short engaging question in English (under 30 words), followed by "VN_HINT: <short Vietnamese tip>".`
    );
  });

  document.getElementById('btn-roleplay-send')?.addEventListener('click', () => {
    void sendRoleplayTurn();
  });
  document.getElementById('eng-roleplay-input')?.addEventListener('keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Enter') {
      void sendRoleplayTurn();
    }
  });
}
