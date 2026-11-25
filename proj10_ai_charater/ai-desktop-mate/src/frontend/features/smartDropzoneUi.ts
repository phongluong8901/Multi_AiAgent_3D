import { invoke } from '@tauri-apps/api/core';
import { appState } from '../../core/state';
import { IngestedFileAnalysis } from '../../core/types';
import { fireAnimationTrigger } from '../../core/animationBinder';
import { spawnParticles } from '../../core/particles';
import { playAlertBeep, playSuccessChimeSound } from '../../core/soundFx';
import { handleDroppedAnyFile, summarizeLastIngestedFile } from '../../backend/assistant';

export interface DropzoneActionResult {
  ok: boolean;
  action: string;
  message: string;
  output_path: string;
  extra_text: string;
}

export interface SmartDropzoneHost {
  closeOthers: () => void;
  syncHitbox: () => void;
  openDashboard: (analysis: IngestedFileAnalysis) => void;
  openOcrWithText: (text: string, imagePath?: string) => void;
  sendChatPrompt: (prompt: string) => void;
  speakMessage: (msg: string) => void;
}

interface ActionSpec {
  id: string;
  title: string;
  sub: string;
  accent: 'sky' | 'purple' | 'emerald' | 'amber';
  iconSvg: string;
  run: () => Promise<void>;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'ico', 'tif', 'tiff']);
const CODE_LOG_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'cs',
  'html', 'css', 'sql', 'sh', 'ps1', 'yaml', 'yml', 'toml', 'log', 'err', 'trace',
]);
const DATA_DOC_EXTS = new Set([
  'csv', 'tsv', 'xlsx', 'xls', 'json', 'pdf', 'txt', 'md', 'docx', 'doc', 'srt', 'vtt', 'xml',
]);
const STOPWORDS_EN = new Set([
  'about', 'above', 'after', 'again', 'against', 'all', 'also', 'always', 'among', 'another',
  'because', 'before', 'being', 'below', 'between', 'both', 'could', 'doing', 'during', 'each',
  'either', 'every', 'first', 'found', 'from', 'further', 'having', 'here', 'itself', 'just',
  'large', 'later', 'Might', 'might', 'more', 'most', 'never', 'other', 'our', 'over', 'place',
  'point', 'right', 'same', 'shall', 'should', 'since', 'small', 'some', 'state', 'still',
  'such', 'system', 'their', 'them', 'then', 'there', 'these', 'they', 'thing', 'think', 'this',
  'those', 'three', 'through', 'under', 'until', 'using', 'value', 'very', 'water', 'where',
  'which', 'while', 'world', 'would', 'write', 'years', 'your', 'string', 'number', 'false',
  'const', 'return', 'import', 'export', 'class', 'public', 'private', 'static', 'async', 'await',
]);

let hostRef: SmartDropzoneHost | null = null;
let initialized = false;
let currentItems: Array<File | string> = [];
let lastOsPathDropAt = 0;
let isBusyRunning = false;

function itemBaseName(item: File | string): string {
  if (typeof item === 'string') {
    const trimmed = item.replace(/[\\/]+$/, '');
    return trimmed.split(/[\\/]/).pop() || item;
  }
  return item.name || 'dropped_file';
}

function itemExt(item: File | string): string {
  const base = itemBaseName(item);
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx + 1).toLowerCase() : '';
}

function extractBestEnglishVocabCandidate(rawText: string): string {
  const matches = rawText.match(/\b[a-zA-Z]{5,15}\b/g) || [];
  const freq = new Map<string, number>();
  for (const token of matches) {
    const w = token.toLowerCase();
    if (STOPWORDS_EN.has(w)) continue;
    if (/^(http|https|xmlns|width|height|style|color|table|tbody|thead|input|button|error)$/.test(w)) {
      continue;
    }
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  let best = '';
  let bestScore = -1;
  for (const [word, count] of freq.entries()) {
    const lenBonus = word.length >= 7 && word.length <= 13 ? 3 : 1;
    const score = lenBonus + Math.min(count, 4);
    if (score > bestScore) {
      bestScore = score;
      best = word;
    }
  }
  return best || 'pragmatic';
}

function setStatusBox(text: string, tone: 'info' | 'ok' | 'err' = 'info', revealPath = '', copyHash = '') {
  const box = document.getElementById('sdz-status-box');
  if (!box) return;
  if (!text) {
    box.style.display = 'none';
    box.innerHTML = '';
    hostRef?.syncHitbox();
    return;
  }
  box.style.display = 'block';
  box.className = `sdz-status-box sdz-tone-${tone}`;
  box.innerHTML = '';

  const textDiv = document.createElement('div');
  textDiv.className = 'sdz-status-text';
  textDiv.textContent = text;
  box.appendChild(textDiv);

  if (revealPath || copyHash) {
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;';

    if (revealPath) {
      const btnOpen = document.createElement('button');
      btnOpen.type = 'button';
      btnOpen.className = 'action-btn';
      btnOpen.style.cssText = 'padding:4px 9px;font-size:10.5px;border-color:rgba(56,189,248,0.5);color:#7dd3fc;';
      btnOpen.textContent = 'Mở Vị Trí File Kết Quả';
      btnOpen.addEventListener('click', () => {
        void invoke('execute_dropzone_action', {
          paths: [revealPath],
          action: 'reveal_explorer',
          optionParam: null,
        }).catch(() => {});
      });
      btnRow.appendChild(btnOpen);
    }

    if (copyHash) {
      const btnCopy = document.createElement('button');
      btnCopy.type = 'button';
      btnCopy.className = 'action-btn';
      btnCopy.style.cssText = 'padding:4px 9px;font-size:10.5px;border-color:rgba(52,211,153,0.5);color:#6ee7b7;';
      btnCopy.textContent = 'Copy Báo Cáo SHA-256';
      btnCopy.addEventListener('click', () => {
        void invoke('set_clipboard_text', { text: copyHash }).then(() => {
          btnCopy.textContent = 'Đã Copy!';
          window.setTimeout(() => {
            btnCopy.textContent = 'Copy Báo Cáo SHA-256';
          }, 1400);
        });
      });
      btnRow.appendChild(btnCopy);
    }

    box.appendChild(btnRow);
  }
  hostRef?.syncHitbox();
}

const SVG_PIN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
const SVG_CHART = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
const SVG_SPARK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const SVG_BUG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
const SVG_BOOK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
const SVG_SCAN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>';
const SVG_IMG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
const SVG_ZIP = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>';
const SVG_RENAME = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
const SVG_SHIELD = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
const SVG_FOLDER = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

async function runNativeDropzoneCmd(
  paths: string[],
  action: string,
  optionParam?: string
): Promise<DropzoneActionResult | null> {
  if (isBusyRunning) return null;
  isBusyRunning = true;
  setStatusBox('[ĐANG XỬ LÝ] Vịt đang thực thi tác vụ trực tiếp trên hệ thống...', 'info');
  fireAnimationTrigger('event', 'file_drop', 'enter');
  try {
    const res = await invoke<DropzoneActionResult>('execute_dropzone_action', {
      paths,
      action,
      optionParam: optionParam ?? null,
    });
    playSuccessChimeSound(appState.posX);
    spawnParticles(appState.posX, appState.posY - 105, 14, 0x38bdf8);
    hostRef?.speakMessage(`[DROPZONE] ${res.message}`);
    return res;
  } catch (err) {
    playAlertBeep();
    const errText = `[LỖI THAO TÁC] ${String(err)}`;
    setStatusBox(errText, 'err');
    hostRef?.speakMessage(errText);
    return null;
  } finally {
    isBusyRunning = false;
  }
}

function renderDropzoneContent() {
  const summaryEl = document.getElementById('sdz-file-summary');
  const badgeEl = document.getElementById('sdz-category-badge');
  const paramBar = document.getElementById('sdz-param-bar');
  const imgFmtWrap = document.getElementById('sdz-img-fmt-wrap');
  const renameWrap = document.getElementById('sdz-rename-wrap');
  const gridEl = document.getElementById('sdz-actions-grid');
  if (!gridEl || !summaryEl) return;

  setStatusBox('');

  const names = currentItems.map(itemBaseName);
  const exts = currentItems.map(itemExt);
  const osPaths = currentItems.filter((x): x is string => typeof x === 'string');
  const imgPaths = osPaths.filter((p) => IMAGE_EXTS.has(itemExt(p)));
  const hasAnyImage = exts.some((e) => IMAGE_EXTS.has(e));
  const hasCodeOrLog = exts.some((e) => CODE_LOG_EXTS.has(e));
  const hasDataOrDoc = exts.some((e) => DATA_DOC_EXTS.has(e));

  let catLabel = '[TỆP ĐA NĂNG]';
  if (currentItems.length > 1) {
    catLabel = `[NHIỀU TỆP: ${currentItems.length}]`;
  } else if (hasAnyImage) {
    catLabel = '[HÌNH ẢNH]';
  } else if (hasCodeOrLog) {
    catLabel = '[CODE / LOG]';
  } else if (hasDataOrDoc) {
    catLabel = '[TÀI LIỆU / BẢNG BIỂU]';
  }
  if (badgeEl) badgeEl.textContent = catLabel;

  summaryEl.innerHTML = '';
  const countSpan = document.createElement('div');
  countSpan.className = 'sdz-summary-head';
  countSpan.textContent =
    currentItems.length === 1
      ? `Tệp vừa thả: ${names[0]}`
      : `Đã thả ${currentItems.length} mục cùng lúc:`;
  summaryEl.appendChild(countSpan);

  if (currentItems.length > 1) {
    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'sdz-file-chips';
    names.forEach((n) => {
      const chip = document.createElement('span');
      chip.className = 'sdz-file-chip';
      chip.textContent = n;
      chipsWrap.appendChild(chip);
    });
    summaryEl.appendChild(chipsWrap);
  } else if (osPaths.length === 1) {
    const pathSub = document.createElement('div');
    pathSub.className = 'sdz-summary-path';
    pathSub.textContent = osPaths[0];
    summaryEl.appendChild(pathSub);
  }

  const showImgParam = imgPaths.length > 0;
  const showRenameParam = osPaths.length >= 2;
  if (imgFmtWrap) imgFmtWrap.style.display = showImgParam ? 'flex' : 'none';
  if (renameWrap) renameWrap.style.display = showRenameParam ? 'flex' : 'none';
  if (paramBar) paramBar.style.display = showImgParam || showRenameParam ? 'flex' : 'none';

  const actions: ActionSpec[] = [];

  actions.push({
    id: 'pin_chat',
    title: currentItems.length > 1 ? `Ghim Cả ${currentItems.length} Tệp Vào Chat` : 'Ghim Vào Thanh Chat AI',
    sub: 'Nạp ngữ cảnh tệp để hỏi đáp, lọc dữ liệu hoặc nhờ Vịt xử lý',
    accent: 'purple',
    iconSvg: SVG_PIN,
    run: async () => {
      if (isBusyRunning) return;
      isBusyRunning = true;
      closeSmartDropzoneModal();
      try {
        for (const item of currentItems) {
          await handleDroppedAnyFile(item);
        }
      } finally {
        isBusyRunning = false;
      }
    },
  });

  if (hasDataOrDoc || (!hasAnyImage && currentItems.length === 1)) {
    actions.push({
      id: 'open_dashboard',
      title: 'Mở Dashboard Phân Tích & Biểu Đồ',
      sub: 'Vẽ biểu đồ cột/tương quan, thống kê Min/Avg/Max & đọc bảng',
      accent: 'sky',
      iconSvg: SVG_CHART,
      run: async () => {
        if (isBusyRunning || currentItems.length === 0) return;
        isBusyRunning = true;
        closeSmartDropzoneModal();
        try {
          const analysis = await handleDroppedAnyFile(currentItems[0]);
          if (analysis) {
            hostRef?.openDashboard(analysis);
          }
        } finally {
          isBusyRunning = false;
        }
      },
    });
  }

  actions.push({
    id: 'ai_summarize',
    title: 'Tóm Tắt Nhanh Nội Dung Bằng AI',
    sub: 'Đọc lướt toàn văn và rút ra các ý chính quan trọng nhất',
    accent: 'emerald',
    iconSvg: SVG_SPARK,
    run: async () => {
      if (isBusyRunning || currentItems.length === 0) return;
      isBusyRunning = true;
      closeSmartDropzoneModal();
      try {
        const analysis = await handleDroppedAnyFile(currentItems[0]);
        if (analysis) {
          await summarizeLastIngestedFile(analysis);
        }
      } finally {
        isBusyRunning = false;
      }
    },
  });

  if (hasCodeOrLog) {
    actions.push({
      id: 'ai_debug_code',
      title: 'AI Soi Bug Code & Chẩn Đoán Log',
      sub: 'Tìm nguyên nhân lỗi, điểm nghẽn hiệu năng và đề xuất bản vá',
      accent: 'amber',
      iconSvg: SVG_BUG,
      run: async () => {
        if (isBusyRunning || currentItems.length === 0) return;
        isBusyRunning = true;
        closeSmartDropzoneModal();
        try {
          const analysis = await handleDroppedAnyFile(currentItems[0]);
          if (analysis) {
            hostRef?.sendChatPrompt(
              `Hãy soi kỹ file "${analysis.file_name}" vừa ghim: chỉ ra lỗi tiềm ẩn / nguyên nhân crash (nếu là log) và đề xuất cách sửa ngắn gọn, chính xác.`
            );
          }
        } finally {
          isBusyRunning = false;
        }
      },
    });
  }

  if (hasDataOrDoc || hasCodeOrLog) {
    actions.push({
      id: 'extract_vocab',
      title: 'Trích Từ Vựng Tiếng Anh Vào SRS',
      sub: 'Lọc từ học thuật/chuyên ngành từ tài liệu đưa vào English Coach',
      accent: 'sky',
      iconSvg: SVG_BOOK,
      run: async () => {
        if (isBusyRunning || currentItems.length === 0) return;
        isBusyRunning = true;
        setStatusBox('[ENGLISH] Đang quét từ vựng nổi bật trong tài liệu...', 'info');
        try {
          const analysis = await handleDroppedAnyFile(currentItems[0]);
          closeSmartDropzoneModal();
          if (analysis) {
            const candidate = extractBestEnglishVocabCandidate(
              `${analysis.raw_excerpt || ''} ${analysis.columns.join(' ')}`
            );
            window.dispatchEvent(
              new CustomEvent('duck-open-english-coach', {
                detail: { tab: 'learn', wordQuery: candidate },
              })
            );
          }
        } finally {
          isBusyRunning = false;
        }
      },
    });
  }

  if (imgPaths.length > 0) {
    actions.push({
      id: 'img_ocr',
      title: 'Quét Chữ OCR & Dịch Thuật Ảnh',
      sub: 'Trích xuất văn bản trong ảnh bằng Windows OCR và dịch tự động',
      accent: 'sky',
      iconSvg: SVG_SCAN,
      run: async () => {
        const res = await runNativeDropzoneCmd([imgPaths[0]], 'img_ocr');
        if (res && res.ok) {
          closeSmartDropzoneModal();
          hostRef?.openOcrWithText(res.extra_text || '', res.output_path);
        }
      },
    });

    actions.push({
      id: 'img_compress',
      title: imgPaths.length > 1 ? `Nén Nhẹ ${imgPaths.length} Ảnh (JPEG)` : 'Nén Giảm Dung Lượng Ảnh',
      sub: 'Thu gọn kích thước & tối ưu dung lượng gửi mail / upload web',
      accent: 'emerald',
      iconSvg: SVG_IMG,
      run: async () => {
        const res = await runNativeDropzoneCmd(imgPaths, 'img_compress');
        if (res) {
          setStatusBox(`[HOÀN TẤT] ${res.message}\nLưu tại: ${res.output_path}`, 'ok', res.output_path);
        }
      },
    });

    actions.push({
      id: 'img_convert',
      title: 'Đổi Đuôi Ảnh Theo Định Dạng Đích',
      sub: 'Chuyển sang .PNG, .JPG, .ICO (Icon App 128px) hoặc .BMP',
      accent: 'purple',
      iconSvg: SVG_IMG,
      run: async () => {
        const fmt =
          (document.getElementById('sdz-img-format') as HTMLSelectElement | null)?.value || 'png';
        const res = await runNativeDropzoneCmd(imgPaths, 'img_convert', fmt);
        if (res) {
          setStatusBox(`[HOÀN TẤT] ${res.message}\nLưu tại: ${res.output_path}`, 'ok', res.output_path);
        }
      },
    });
  }

  if (osPaths.length > 0) {
    actions.push({
      id: 'zip_bundle',
      title: osPaths.length > 1 ? `Đóng Gói ${osPaths.length} Mục Thành .ZIP` : 'Nén Tệp / Thư Mục Thành .ZIP',
      sub: 'Tạo gói nén chuẩn .zip ngay cùng thư mục gốc',
      accent: 'amber',
      iconSvg: SVG_ZIP,
      run: async () => {
        const res = await runNativeDropzoneCmd(osPaths, 'zip_bundle');
        if (res) {
          setStatusBox(`[ĐÃ ĐÓNG GÓI .ZIP] ${res.message}\nĐường dẫn: ${res.output_path}`, 'ok', res.output_path);
        }
      },
    });
  }

  if (osPaths.length >= 2) {
    actions.push({
      id: 'batch_rename',
      title: `Đổi Tên Hàng Loạt (${osPaths.length} Mục)`,
      sub: 'Đánh số thứ tự 01, 02... gọn gàng theo tiền tố bên trên',
      accent: 'purple',
      iconSvg: SVG_RENAME,
      run: async () => {
        const prefix =
          (document.getElementById('sdz-rename-prefix') as HTMLInputElement | null)?.value.trim() ||
          'duck_item';
        const res = await runNativeDropzoneCmd(osPaths, 'batch_rename', prefix);
        if (res) {
          setStatusBox(
            `[ĐỔI TÊN XONG] ${res.message}${res.extra_text ? `\n${res.extra_text}` : ''}`,
            'ok',
            res.output_path
          );
        }
      },
    });
  }

  if (osPaths.length > 0) {
    actions.push({
      id: 'sha256_info',
      title: 'Kiểm Tra Mã Băm SHA-256 & Kích Thước',
      sub: 'Tính chữ ký toàn vẹn SHA-256 trực tiếp không cần mở PowerShell',
      accent: 'sky',
      iconSvg: SVG_SHIELD,
      run: async () => {
        const res = await runNativeDropzoneCmd(osPaths, 'sha256_info');
        if (res) {
          const fullTxt = res.extra_text || res.message;
          setStatusBox(`[SHA-256 CHECKSUM]\n${fullTxt}`, 'ok', '', fullTxt);
        }
      },
    });

    actions.push({
      id: 'reveal_explorer',
      title: 'Mở Thư Mục Chứa Tệp (Explorer)',
      sub: 'Nhảy thẳng tới vị trí tệp trong Windows File Explorer',
      accent: 'emerald',
      iconSvg: SVG_FOLDER,
      run: async () => {
        await runNativeDropzoneCmd([osPaths[0]], 'reveal_explorer');
        closeSmartDropzoneModal();
      },
    });
  }

  gridEl.innerHTML = '';
  for (const act of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `sdz-act-btn sdz-accent-${act.accent}`;
    btn.innerHTML = `
      <span class="sdz-act-icon">${act.iconSvg}</span>
      <span class="sdz-act-text">
        <span class="sdz-act-title">${act.title}</span>
        <span class="sdz-act-sub">${act.sub}</span>
      </span>
    `;
    btn.addEventListener('click', () => {
      void act.run();
    });
    gridEl.appendChild(btn);
  }
}

export function closeSmartDropzoneModal() {
  appState.isSmartDropzoneOpen = false;
  const modal = document.getElementById('smart-dropzone-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  hostRef?.syncHitbox();
}

export function openSmartDropzoneForItems(items: Array<File | string>) {
  if (!items || items.length === 0) return;

  const incomingHasOsPath = items.some((x) => typeof x === 'string');
  const now = performance.now();
  if (incomingHasOsPath) {
    lastOsPathDropAt = now;
  } else if (now - lastOsPathDropAt < 450 && appState.isSmartDropzoneOpen) {
    // Bỏ qua sự kiện DOM File trùng lặp ngay sau khi Tauri đã cung cấp đường dẫn gốc OS
    return;
  }

  currentItems = items.slice(0, 12);
  const modal = document.getElementById('smart-dropzone-modal');
  if (!modal) return;

  hostRef?.closeOthers();
  appState.isSmartDropzoneOpen = true;
  modal.style.display = 'block';
  renderDropzoneContent();

  appState.setExpression('happy', 2.6);
  spawnParticles(appState.posX, appState.posY - 105, 14, 0xa855f7);
  playSuccessChimeSound(appState.posX);
  hostRef?.syncHitbox();
}

export function initSmartDropzoneUi(host: SmartDropzoneHost) {
  hostRef = host;
  if (initialized) return;
  initialized = true;

  document.getElementById('btn-close-smart-dropzone')?.addEventListener('click', () => {
    closeSmartDropzoneModal();
  });
}
