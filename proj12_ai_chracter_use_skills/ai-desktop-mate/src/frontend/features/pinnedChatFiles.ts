import { IngestedFileAnalysis } from '../../core/types';

export interface PinnedChatFile {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSizeKb: number;
  analysis: IngestedFileAnalysis;
  pinnedAt: number;
}

export interface PinnedChatFilesUiDeps {
  openDashboard: (analysis: IngestedFileAnalysis) => void;
  summarizeFile: (analysis: IngestedFileAnalysis) => void;
  syncHitbox: () => void;
  updatePlaceholder: (placeholder: string) => void;
  speakMessage: (msg: string) => void;
}

export const MAX_PINNED_FILES = 5;
export const DEFAULT_CHAT_PLACEHOLDER = 'Hỏi đáp hoặc kéo thả file vào Vịt để ghim xử lý...';

const pinnedFiles: PinnedChatFile[] = [];
let deps: PinnedChatFilesUiDeps | null = null;
let idSeq = 0;

function normalizeDedupeKey(analysis: IngestedFileAnalysis): string {
  return (analysis.file_path || analysis.file_name || '').trim().toLowerCase();
}

function getShortTypeBadge(fileType: string, fileName: string): { label: string; cls: string } {
  const upper = (fileType || '').trim().toUpperCase();
  const lower = (fileName || '').trim().toLowerCase();
  if (upper === 'CSV' || lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    return { label: 'CSV', cls: 'badge-csv' };
  }
  if (upper === 'EXCEL' || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return { label: 'XLSX', cls: 'badge-excel' };
  }
  if (upper === 'PDF' || lower.endsWith('.pdf')) {
    return { label: 'PDF', cls: 'badge-pdf' };
  }
  if (upper === 'IMAGE' || /\.(png|jpe?g|webp|bmp|gif)$/.test(lower)) {
    return { label: 'IMG', cls: 'badge-image' };
  }
  return { label: upper.slice(0, 4) || 'TXT', cls: 'badge-text' };
}

function createPaperclipSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '11');
  svg.setAttribute('height', '11');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute(
    'd',
    'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'
  );
  svg.appendChild(path);
  return svg;
}

function createCloseSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const l1 = document.createElementNS(ns, 'line');
  l1.setAttribute('x1', '18');
  l1.setAttribute('y1', '6');
  l1.setAttribute('x2', '6');
  l1.setAttribute('y2', '18');
  const l2 = document.createElementNS(ns, 'line');
  l2.setAttribute('x1', '6');
  l2.setAttribute('y1', '6');
  l2.setAttribute('x2', '18');
  l2.setAttribute('y2', '18');
  svg.appendChild(l1);
  svg.appendChild(l2);
  return svg;
}

export function initPinnedChatFilesUi(nextDeps: PinnedChatFilesUiDeps): void {
  deps = nextDeps;
  renderPinnedChatFilesBar();
}

export function pinFileToChatBar(analysis: IngestedFileAnalysis): PinnedChatFile {
  const dedupeKey = normalizeDedupeKey(analysis);
  const existingIdx = pinnedFiles.findIndex(
    (item) => normalizeDedupeKey(item.analysis) === dedupeKey && dedupeKey !== ''
  );

  const now = Date.now();
  let item: PinnedChatFile;
  if (existingIdx >= 0) {
    const prev = pinnedFiles.splice(existingIdx, 1)[0];
    item = {
      ...prev,
      fileName: analysis.file_name,
      filePath: analysis.file_path || '',
      fileType: analysis.file_type,
      fileSizeKb: analysis.file_size_kb,
      analysis,
      pinnedAt: now,
    };
  } else {
    if (pinnedFiles.length >= MAX_PINNED_FILES) {
      pinnedFiles.shift();
    }
    idSeq += 1;
    item = {
      id: `pin_${now}_${idSeq}`,
      fileName: analysis.file_name,
      filePath: analysis.file_path || '',
      fileType: analysis.file_type,
      fileSizeKb: analysis.file_size_kb,
      analysis,
      pinnedAt: now,
    };
  }

  pinnedFiles.push(item);
  renderPinnedChatFilesBar();
  return item;
}

export function unpinChatFile(id: string): void {
  const idx = pinnedFiles.findIndex((item) => item.id === id);
  if (idx >= 0) {
    const removed = pinnedFiles.splice(idx, 1)[0];
    renderPinnedChatFilesBar();
    deps?.speakMessage(`[GHIM] Đã bỏ ghim "${removed.fileName}" khỏi thanh chat.`);
  }
}

export function clearPinnedChatFiles(): void {
  if (pinnedFiles.length === 0) return;
  pinnedFiles.length = 0;
  renderPinnedChatFilesBar();
}

export function getPinnedChatFiles(): PinnedChatFile[] {
  return pinnedFiles.slice();
}

export function getPinnedAnalyses(): IngestedFileAnalysis[] {
  return pinnedFiles.map((item) => item.analysis);
}

export function getPrimaryPinnedFile(): PinnedChatFile | null {
  return pinnedFiles.length > 0 ? pinnedFiles[pinnedFiles.length - 1] : null;
}

export function formatPinnedFilesChatTag(): string {
  if (pinnedFiles.length === 0) return '';
  const shown = pinnedFiles
    .slice(-3)
    .map((f) => f.fileName)
    .join(', ');
  const extra = pinnedFiles.length > 3 ? ` (+${pinnedFiles.length - 3})` : '';
  return `[GHIM: ${shown}${extra}] `;
}

export function buildPinnedFilesPromptContext(isRichModel: boolean): string {
  if (pinnedFiles.length === 0) return '';
  const totalBudget = isRichModel ? 3600 : 950;
  const perFileExcerptLimit = Math.max(220, Math.floor(totalBudget / pinnedFiles.length));

  const sections: string[] = [
    `[CÁC FILE ĐANG GHIM TRONG THANH CHAT (${pinnedFiles.length} file)]`,
  ];

  pinnedFiles.forEach((item, idx) => {
    const a = item.analysis;
    const diskPath = item.filePath
      ? item.filePath
      : '(chưa có đường dẫn đĩa - chỉ đọc nội dung trích xuất)';
    const colsLine =
      a.columns && a.columns.length > 0
        ? a.columns.slice(0, 20).join(', ')
        : '(không có danh sách cột)';
    const statsLine =
      a.numeric_stats && a.numeric_stats.length > 0
        ? a.numeric_stats
            .slice(0, 6)
            .map((s) => `${s.column}: min=${s.min}..max=${s.max}, avg=${s.avg}`)
            .join(' | ')
        : '';
    const rawTrimmed = (a.raw_excerpt || '').trim().slice(0, perFileExcerptLimit);

    const lines = [
      `${idx + 1}. File: "${item.fileName}" | Loại: ${item.fileType} | Dung lượng: ${item.fileSizeKb} KB | Đường dẫn đĩa: ${diskPath}`,
      `   Tổng quan: ${a.quick_overview}`,
      `   Cấu trúc/Cột (${a.row_count} dòng x ${a.col_count} cột): ${colsLine}`,
    ];
    if (statsLine) {
      lines.push(`   Thống kê số: ${statsLine}`);
    }
    if (rawTrimmed) {
      lines.push(`   Trích xuất nội dung:\n${rawTrimmed}`);
    }
    sections.push(lines.join('\n'));
  });

  sections.push(
    [
      'HƯỚNG DẪN XỬ LÝ FILE ĐANG GHIM:',
      '- Nếu người dùng hỏi đáp, phân tích, tóm tắt, dịch thuật, tính toán hoặc trích xuất thông tin từ file đang ghim: trả lời trực tiếp, đầy đủ và chính xác dựa trên dữ liệu trích xuất ở trên.',
      '- Nếu người dùng yêu cầu chỉnh sửa, thêm dòng, xóa dòng, lọc và lưu lại, hoặc chuyển đổi file trên đĩa: gọi [TOOL:custom_skill:{"id":"<skill_id>","args":{...}}] với chính xác "Đường dẫn đĩa" ở trên nếu đã có Custom Skill phù hợp; nếu chưa có skill phù hợp thì gọi [TOOL:forge_tool:{"request":"..."}].',
      '- Nếu người dùng yêu cầu mở file đang ghim bằng ứng dụng mặc định trên Windows: gọi [TOOL:open_file:{"path":"<Đường dẫn đĩa>"}].',
    ].join('\n')
  );

  return `\n\n${sections.join('\n\n')}`;
}

export function renderPinnedChatFilesBar(): void {
  const bar = document.getElementById('chat-pinned-files-bar');
  if (!bar) return;

  if (pinnedFiles.length === 0) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    deps?.updatePlaceholder(DEFAULT_CHAT_PLACEHOLDER);
    deps?.syncHitbox();
    return;
  }

  const latest = pinnedFiles[pinnedFiles.length - 1];
  bar.style.display = 'flex';
  bar.innerHTML = '';

  const placeholderText =
    pinnedFiles.length === 1
      ? `Nhập yêu cầu xử lý "${latest.fileName}"...`
      : `Nhập yêu cầu xử lý ${pinnedFiles.length} file đang ghim...`;
  deps?.updatePlaceholder(placeholderText);

  const header = document.createElement('div');
  header.className = 'pinned-files-header';

  const label = document.createElement('div');
  label.className = 'pinned-files-label';
  label.appendChild(createPaperclipSvg());
  const labelText = document.createElement('span');
  labelText.textContent = `ĐÃ GHIM (${pinnedFiles.length})`;
  label.appendChild(labelText);

  const actions = document.createElement('div');
  actions.className = 'pinned-files-actions';

  const btnSummarize = document.createElement('button');
  btnSummarize.type = 'button';
  btnSummarize.className = 'pinned-mini-btn';
  btnSummarize.textContent = 'Tóm tắt';
  btnSummarize.title = `Tóm tắt nhanh "${latest.fileName}"`;
  btnSummarize.addEventListener('click', () => {
    deps?.summarizeFile(latest.analysis);
  });

  const btnDash = document.createElement('button');
  btnDash.type = 'button';
  btnDash.className = 'pinned-mini-btn';
  btnDash.textContent = 'Dashboard';
  btnDash.title = `Mở File Analytics Dashboard cho "${latest.fileName}"`;
  btnDash.addEventListener('click', () => {
    deps?.openDashboard(latest.analysis);
  });

  const btnClear = document.createElement('button');
  btnClear.type = 'button';
  btnClear.className = 'pinned-mini-btn pinned-mini-btn-danger';
  btnClear.textContent = 'Bỏ ghim';
  btnClear.title = 'Xóa toàn bộ file đang ghim khỏi thanh chat';
  btnClear.addEventListener('click', () => {
    clearPinnedChatFiles();
    deps?.speakMessage('[GHIM] Đã bỏ ghim tất cả file khỏi thanh chat.');
  });

  actions.appendChild(btnSummarize);
  actions.appendChild(btnDash);
  actions.appendChild(btnClear);

  header.appendChild(label);
  header.appendChild(actions);
  bar.appendChild(header);

  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'pinned-files-chips';

  for (const item of pinnedFiles) {
    const chip = document.createElement('div');
    chip.className = 'pinned-file-chip';
    chip.title = `${item.filePath || item.fileName} (${item.fileSizeKb} KB) — Bấm để mở Dashboard`;

    const badgeInfo = getShortTypeBadge(item.fileType, item.fileName);
    const badge = document.createElement('span');
    badge.className = `pinned-file-badge ${badgeInfo.cls}`;
    badge.textContent = badgeInfo.label;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'pinned-file-name';
    nameSpan.textContent = item.fileName;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'pinned-file-remove';
    removeBtn.title = `Bỏ ghim "${item.fileName}"`;
    removeBtn.appendChild(createCloseSvg());
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      unpinChatFile(item.id);
    });

    chip.addEventListener('click', () => {
      deps?.openDashboard(item.analysis);
    });

    chip.appendChild(badge);
    chip.appendChild(nameSpan);
    chip.appendChild(removeBtn);
    chipsWrap.appendChild(chip);
  }

  bar.appendChild(chipsWrap);
  deps?.syncHitbox();
}
