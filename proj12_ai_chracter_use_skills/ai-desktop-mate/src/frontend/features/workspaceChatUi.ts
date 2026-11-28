import { invoke } from '@tauri-apps/api/core';
import { fireAnimationTrigger } from '../../core/animationBinder';
import {
  EditableSkillFileInfo,
  PackCatalogSummary,
  RichTurnMeta,
  RouterStatusPayload,
  SkillEvolutionPayload,
  SkillSourcePayload,
  WorkspaceOutputFile,
  WsChatMessageRecord,
  WsChatSessionSummary,
} from '../../core/types';
import { makeDialogDraggable } from '../dialogs/dragHelper';

interface StoredTableData {
  headers: string[];
  rows: string[][];
}

let activeSessionId = '';
let studioMode: 'create' | 'rewrite' = 'create';
let selectedPack = 'auto_skills';
let selectedModule = '';
let editableSkillsCache: EditableSkillFileInfo[] = [];
const tablesRegistry = new Map<string, StoredTableData>();
const imageDataUrlCache = new Map<string, string>();
let tableCounter = 0;

let sendChatCallback: ((text: string) => void) | null = null;
let syncHitboxCallback: (() => void) | null = null;
let onSpeakCallback: ((msg: string) => void) | null = null;

function escHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(s: string): string {
  const el = document.createElement('div');
  el.innerHTML = s || '';
  return (el.textContent || '').trim();
}

function parseMdRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isMdTableSep(line: string): boolean {
  return /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line);
}

export function renderRichMarkdownHtml(md: string): string {
  let html = escHtml(md || '');
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" style="color:#38bdf8;">$1</a>'
  );

  const lines = html.split('\n');
  const out: string[] = [];
  let inList = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('|') && i + 1 < lines.length && isMdTableSep(lines[i + 1])) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      const headers = parseMdRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|') && !isMdTableSep(lines[i])) {
        rows.push(parseMdRow(lines[i]));
        i++;
      }
      const tid = `dws_tbl_${++tableCounter}`;
      tablesRegistry.set(tid, { headers, rows });
      const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${headers.map((_, ci) => `<td>${r[ci] || ''}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      out.push(`
        <div class="dws-table-wrap">
          <div class="dws-table-bar">
            <span>Bảng dữ liệu (${rows.length} dòng x ${headers.length} cột)</span>
            <div style="display:flex; gap:5px;">
              <button class="action-btn dws-tbl-zoom-btn" type="button" data-tid="${tid}" style="padding:2px 7px; font-size:10px;">Phóng to</button>
              <button class="action-btn dws-tbl-csv-btn" type="button" data-tid="${tid}" style="padding:2px 7px; font-size:10px;">Tải CSV</button>
              <button class="action-btn dws-tbl-copy-btn" type="button" data-tid="${tid}" style="padding:2px 7px; font-size:10px;">Sao chép</button>
            </div>
          </div>
          <div style="overflow-x:auto;"><table class="dws-table">${thead}${tbody}</table></div>
        </div>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${line.replace(/^\s*[-*]\s+/, '')}</li>`);
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (/^###\s+/.test(line)) {
        out.push(`<h4 style="margin:6px 0 4px;color:#bae6fd;">${line.replace(/^###\s+/, '')}</h4>`);
      } else if (/^##\s+/.test(line)) {
        out.push(`<h3 style="margin:8px 0 5px;color:#7dd3fc;">${line.replace(/^##\s+/, '')}</h3>`);
      } else if (line.trim() === '---') {
        out.push('<hr style="border-color:#334155;margin:8px 0;"/>');
      } else if (line.trim() !== '') {
        out.push(`<p>${line}</p>`);
      }
    }
    i++;
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

export function isWorkspaceModalOpen(): boolean {
  const el = document.getElementById('duck-workspace-modal');
  return Boolean(
    el &&
    el.style.display !== 'none' &&
    el.style.display !== '' &&
    window.getComputedStyle(el).display !== 'none'
  );
}

export function isLightboxModalOpen(): boolean {
  const el = document.getElementById('duck-lightbox-modal');
  return Boolean(
    el &&
    el.style.display !== 'none' &&
    el.style.display !== '' &&
    window.getComputedStyle(el).display !== 'none'
  );
}

export type WorkspaceMainTab = 'chat' | 'studio' | 'hub';
export type StudioEngineType = 'python' | 'sandbox';

let onOpenBeforeShowCallback: (() => void) | null = null;

export function setStudioEngine(engine: StudioEngineType) {
  document.getElementById('btn-dws-engine-python')?.classList.toggle('active', engine === 'python');
  document.getElementById('btn-dws-engine-sandbox')?.classList.toggle('active', engine === 'sandbox');
  const pyWrap = document.getElementById('dws-studio-python-wrap');
  const sbWrap = document.getElementById('dws-studio-sandbox-wrap');
  if (pyWrap) pyWrap.style.display = engine === 'python' ? 'flex' : 'none';
  if (sbWrap) sbWrap.style.display = engine === 'sandbox' ? 'flex' : 'none';
  if (engine === 'sandbox') {
    const draftSec = document.getElementById('tf-draft-section');
    if (draftSec) draftSec.style.display = 'flex';
  }
  syncHitboxCallback?.();
}

export function toggleWorkspaceModal(
  force?: boolean,
  tab?: WorkspaceMainTab,
  engine?: StudioEngineType
) {
  const el = document.getElementById('duck-workspace-modal');
  if (!el) return;
  const isCurrentlyOpen = el.style.display !== 'none' && el.style.display !== '';
  const next = typeof force === 'boolean' ? force : !isCurrentlyOpen;
  if (next) {
    onOpenBeforeShowCallback?.();
  }
  el.style.display = next ? 'flex' : 'none';
  // Khi mở hội thoại to -> tắt alwaysOnTop để hành xử như cửa sổ Windows bình thường (kích hoạt Zalo là Zalo lên trên);
  // khi thu nhỏ/đóng -> bật lại alwaysOnTop cho con Vịt pet.
  void invoke('set_window_always_on_top', { alwaysOnTop: !next }).catch(() => {});
  document.getElementById('dock-btn-chat')?.classList.toggle('active', next);
  if (next) {
    if (tab) switchWorkspaceTab(tab);
    if (engine) setStudioEngine(engine);
    void refreshWorkspaceSidebarData();
    if (editableSkillsCache.length === 0) {
      void loadEditableSkillsIntoSelect();
    }
  }
  syncHitboxCallback?.();
}

export function switchWorkspaceTab(tab: WorkspaceMainTab) {
  document.getElementById('dws-tab-btn-chat')?.classList.toggle('active', tab === 'chat');
  document.getElementById('dws-tab-btn-studio')?.classList.toggle('active', tab === 'studio');
  document.getElementById('dws-tab-btn-hub')?.classList.toggle('active', tab === 'hub');
  document.getElementById('dws-view-chat')?.classList.toggle('active', tab === 'chat');
  document.getElementById('dws-view-studio')?.classList.toggle('active', tab === 'studio');
  document.getElementById('dws-view-hub')?.classList.toggle('active', tab === 'hub');
  if (tab === 'studio' && editableSkillsCache.length === 0) {
    void loadEditableSkillsIntoSelect();
  }
  syncHitboxCallback?.();
}

function openImageLightbox(dataUrl: string, title: string) {
  const modal = document.getElementById('duck-lightbox-modal');
  const titleEl = document.getElementById('dws-lightbox-title');
  const bodyEl = document.getElementById('dws-lightbox-body');
  const dlEl = document.getElementById('dws-lightbox-download') as HTMLAnchorElement | null;
  if (!modal || !bodyEl) return;
  if (titleEl) titleEl.textContent = title || 'Xem ảnh chi tiết';
  if (dlEl) {
    dlEl.style.display = 'inline-flex';
    dlEl.href = dataUrl;
    dlEl.download = title || 'duck_output.png';
  }
  bodyEl.innerHTML = `<img src="${dataUrl}" alt="${escHtml(title)}" style="max-width:88vw; max-height:76vh; border-radius:8px; object-fit:contain; display:block; margin:0 auto;" />`;
  modal.style.display = 'flex';
  syncHitboxCallback?.();
}

function openTableLightbox(tid: string) {
  const tbl = tablesRegistry.get(tid);
  const modal = document.getElementById('duck-lightbox-modal');
  const titleEl = document.getElementById('dws-lightbox-title');
  const bodyEl = document.getElementById('dws-lightbox-body');
  const dlEl = document.getElementById('dws-lightbox-download');
  if (!tbl || !modal || !bodyEl) return;
  if (titleEl) titleEl.textContent = `Bảng dữ liệu phóng to (${tbl.rows.length} dòng x ${tbl.headers.length} cột)`;
  if (dlEl) dlEl.style.display = 'none';
  const thead = `<thead><tr>${tbl.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${tbl.rows
    .map((r) => `<tr>${tbl.headers.map((_, ci) => `<td>${r[ci] || ''}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  bodyEl.innerHTML = `<table class="dws-table" style="font-size:13px;">${thead}${tbody}</table>`;
  modal.style.display = 'flex';
  syncHitboxCallback?.();
}

function closeLightbox() {
  const modal = document.getElementById('duck-lightbox-modal');
  if (modal) modal.style.display = 'none';
  syncHitboxCallback?.();
}

function downloadTableAsCsv(tid: string) {
  const tbl = tablesRegistry.get(tid);
  if (!tbl) return;
  const escCsv = (v: string) => `"${stripTags(v).replace(/"/g, '""')}"`;
  const lines = [
    tbl.headers.map(escCsv).join(','),
    ...tbl.rows.map((r) => tbl.headers.map((_, ci) => escCsv(r[ci] || '')).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${tid}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function resolveImageDataUrl(filePath: string): Promise<string | null> {
  if (imageDataUrlCache.has(filePath)) {
    return imageDataUrlCache.get(filePath)!;
  }
  try {
    const url = await invoke<string>('workspace_read_image_data_url', { filePath });
    imageDataUrlCache.set(filePath, url);
    return url;
  } catch {
    return null;
  }
}

export function openStudioForSuggestedSkill(modName: string, reqText: string) {
  toggleWorkspaceModal(true, 'studio', 'python');
  setStudioMode('create');
  const modInp = document.getElementById('dws-new-mod-input') as HTMLInputElement | null;
  const reqInp = document.getElementById('dws-requirement') as HTMLTextAreaElement | null;
  const errInp = document.getElementById('dws-error-ctx') as HTMLTextAreaElement | null;
  if (modInp) modInp.value = modName;
  if (reqInp) reqInp.value = reqText;
  if (errInp) errInp.value = '';
}

export async function openStudioForExistingSkill(
  pack: string,
  modName: string,
  errorCtx: string
) {
  toggleWorkspaceModal(true, 'studio', 'python');
  setStudioMode('rewrite');
  await loadEditableSkillsIntoSelect();
  const sel = document.getElementById('dws-skill-select') as HTMLSelectElement | null;
  const key = `${pack}/${modName}`;
  if (sel) {
    const hasOpt = Array.from(sel.options).some((o) => o.value === key);
    if (hasOpt) sel.value = key;
  }
  selectedPack = pack || 'auto_skills';
  selectedModule = modName;
  const errInp = document.getElementById('dws-error-ctx') as HTMLTextAreaElement | null;
  if (errInp) errInp.value = errorCtx;
  await loadSelectedSkillSource(selectedPack, selectedModule);
}

function splitSkillPackBlocks(raw: string): {
  prose: string;
  packBlocks: Array<{ label: string; payload: string }>;
} {
  const packBlocks: Array<{ label: string; payload: string }> = [];
  const prose = raw
    .replace(
      /\[SKILL PACK\s+([^\]]+)\]\s*(\[\s*\{[\s\S]*|\{\s*"[\s\S]*)/g,
      (_m, label: string, payload: string) => {
        packBlocks.push({
          label: label.replace(/`/g, '').trim(),
          payload: payload.trim(),
        });
        return '';
      }
    )
    .trim();
  return { prose, packBlocks };
}

function parseJsonOrRecoverRows(payload: string): {
  headers: string[];
  rows: string[][];
} | null {
  const trimmed = payload.trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Nếu chuỗi JSON bị cắt cụt bằng "..." -> cố khôi phục các object hoàn chỉnh trong mảng hoặc cặp key/value
    if (trimmed.startsWith('[')) {
      const recovered: Record<string, unknown>[] = [];
      const objMatches = trimmed.match(/\{[^{}]*\}/g);
      if (objMatches && objMatches.length > 0) {
        for (const m of objMatches) {
          try {
            const o = JSON.parse(m);
            if (o && typeof o === 'object' && !Array.isArray(o)) {
              recovered.push(o as Record<string, unknown>);
            }
          } catch {
            // skip partial object
          }
        }
      }
      if (recovered.length > 0) parsed = recovered;
    } else if (trimmed.startsWith('{')) {
      const recoveredObj: Record<string, unknown> = {};
      // Bắt các trường chuỗi hoàn chỉnh "key": "value" (kể cả có \n)
      const strPairRx = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      let sm: RegExpExecArray | null;
      while ((sm = strPairRx.exec(trimmed)) !== null) {
        try {
          recoveredObj[sm[1]] = JSON.parse(`"${sm[2]}"`);
        } catch {
          recoveredObj[sm[1]] = sm[2];
        }
      }
      // Bắt thêm các trường số / boolean hoàn chỉnh
      const primPairRx = /"([^"]+)"\s*:\s*(-?\d+(?:\.\d+)?|true|false)/g;
      let pm: RegExpExecArray | null;
      while ((pm = primPairRx.exec(trimmed)) !== null) {
        if (!(pm[1] in recoveredObj)) recoveredObj[pm[1]] = pm[2];
      }
      if (Object.keys(recoveredObj).length > 0) parsed = recoveredObj;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;

  // Trường hợp 1: Mảng các object -> Bảng đa cột (Zing MP3, Processes, Search...)
  if (Array.isArray(parsed)) {
    const objs = parsed.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object' && !Array.isArray(x)));
    if (objs.length === 0) return null;
    const keySet = new Set<string>();
    for (const o of objs.slice(0, 30)) {
      for (const k of Object.keys(o)) keySet.add(k);
    }
    const headers = Array.from(keySet).slice(0, 8);
    const rows = objs.slice(0, 50).map((o) =>
      headers.map((h) => {
        const v = o[h];
        if (v === null || v === undefined) return '';
        return typeof v === 'object' ? JSON.stringify(v) : String(v);
      })
    );
    return { headers, rows };
  }

  // Trường hợp 2: Object key-value (vd XSKT có trường "details": "ĐB: ...\n1: ...") -> Bảng 2 cột rõ ràng
  const obj = parsed as Record<string, unknown>;
  const rows: string[][] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.includes('\n') && v.includes(':')) {
      for (const line of v.split(/\r?\n/)) {
        const clean = line.trim();
        if (!clean) continue;
        const colonIdx = clean.indexOf(':');
        if (colonIdx > 0 && colonIdx < 24) {
          rows.push([clean.slice(0, colonIdx).trim(), clean.slice(colonIdx + 1).trim()]);
        } else {
          rows.push([k, clean]);
        }
      }
    } else if (Array.isArray(v)) {
      rows.push([k, v.slice(0, 6).map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' | ')]);
    } else if (typeof v === 'object') {
      rows.push([k, JSON.stringify(v)]);
    } else {
      rows.push([k, String(v)]);
    }
  }
  if (rows.length === 0) return null;
  return { headers: ['Mục', 'Giá trị'], rows };
}

let packTableSeq = 0;

function appendPackDetailsDom(
  container: HTMLElement,
  packBlocks: Array<{ label: string; payload: string }>
) {
  for (const blk of packBlocks) {
    const tableData = parseJsonOrRecoverRows(blk.payload);
    if (tableData && tableData.rows.length > 0) {
      const tid = `tbl_pack_${++packTableSeq}`;
      tablesRegistry.set(tid, { headers: tableData.headers, rows: tableData.rows });

      const wrap = document.createElement('div');
      wrap.className = 'dws-table-wrap';

      const bar = document.createElement('div');
      bar.className = 'dws-table-bar';
      const titleSpan = document.createElement('span');
      titleSpan.textContent = `${blk.label} (${tableData.rows.length} dòng)`;
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:5px;';

      const mkBtn = (text: string, onClick: () => void) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'action-btn';
        b.style.cssText = 'padding:2px 7px;font-size:10px;';
        b.textContent = text;
        b.addEventListener('click', onClick);
        return b;
      };
      actions.appendChild(mkBtn('Phóng To', () => openTableLightbox(tid)));
      actions.appendChild(mkBtn('Tải CSV', () => downloadTableAsCsv(tid)));
      actions.appendChild(
        mkBtn('Copy', () => {
          const tsv = [
            tableData.headers.join('\t'),
            ...tableData.rows.map((r) => r.join('\t')),
          ].join('\n');
          void navigator.clipboard?.writeText(tsv).catch(() => {});
        })
      );
      bar.appendChild(titleSpan);
      bar.appendChild(actions);
      wrap.appendChild(bar);

      const scrollDiv = document.createElement('div');
      scrollDiv.style.cssText = 'overflow-x:auto;max-height:280px;overflow-y:auto;';
      const table = document.createElement('table');
      table.className = 'dws-table';
      const thead = document.createElement('thead');
      const htr = document.createElement('tr');
      for (const h of tableData.headers) {
        const th = document.createElement('th');
        th.textContent = h;
        htr.appendChild(th);
      }
      thead.appendChild(htr);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const row of tableData.rows) {
        const tr = document.createElement('tr');
        for (const cell of row) {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      scrollDiv.appendChild(table);
      wrap.appendChild(scrollDiv);
      container.appendChild(wrap);
      continue;
    }

    const details = document.createElement('details');
    details.className = 'dws-raw-pack-details';
    const summary = document.createElement('summary');
    summary.textContent = `Dữ liệu công cụ: ${blk.label}`;
    const pre = document.createElement('pre');
    pre.textContent = blk.payload;
    details.appendChild(summary);
    details.appendChild(pre);
    container.appendChild(details);
  }
}

async function appendWorkspaceMessageDom(
  role: 'user' | 'assistant',
  content: string,
  meta: RichTurnMeta | null,
  animateReveal = false
) {
  const box = document.getElementById('dws-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `dws-msg ${role}`;

  if (role === 'user') {
    div.textContent = content;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return;
  }

  const contentWrap = document.createElement('div');
  contentWrap.className = 'dws-md';
  const { prose, packBlocks } = splitSkillPackBlocks(content);
  if (animateReveal && prose.length > 0 && prose.length <= 4000) {
    div.classList.add('dws-streaming');
    box.appendChild(div);
    div.appendChild(contentWrap);
    let idx = 0;
    const step = Math.max(14, Math.ceil(prose.length / 42));
    await new Promise<void>((resolve) => {
      const tick = () => {
        idx = Math.min(prose.length, idx + step);
        const partial = prose.slice(0, idx);
        contentWrap.innerHTML =
          renderRichMarkdownHtml(partial) +
          (idx < prose.length ? '<span class="dws-stream-cursor"></span>' : '');
        box.scrollTop = box.scrollHeight;
        if (idx < prose.length) {
          requestAnimationFrame(tick);
        } else {
          div.classList.remove('dws-streaming');
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  } else {
    if (prose) {
      contentWrap.innerHTML = renderRichMarkdownHtml(prose);
    }
    div.appendChild(contentWrap);
  }
  if (packBlocks.length > 0) {
    appendPackDetailsDom(div, packBlocks);
  }

  // Bind table buttons inside rendered markdown
  div.querySelectorAll('.dws-tbl-zoom-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tid = btn.getAttribute('data-tid') || '';
      if (tid) openTableLightbox(tid);
    });
  });
  div.querySelectorAll('.dws-tbl-csv-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tid = btn.getAttribute('data-tid') || '';
      if (tid) downloadTableAsCsv(tid);
    });
  });
  div.querySelectorAll('.dws-tbl-copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tid = btn.getAttribute('data-tid') || '';
      const tbl = tablesRegistry.get(tid);
      if (!tbl) return;
      const tsv = [
        tbl.headers.map(stripTags).join('\t'),
        ...tbl.rows.map((r) => tbl.headers.map((_, ci) => stripTags(r[ci] || '')).join('\t')),
      ].join('\n');
      void navigator.clipboard.writeText(tsv).then(() => {
        btn.textContent = 'Đã chép';
        setTimeout(() => {
          btn.textContent = 'Sao chép';
        }, 1300);
      });
    });
  });

  // 1. Inline Images (charts, screenshots from outputs/)
  if (meta?.image_paths && meta.image_paths.length > 0) {
    const imgGrid = document.createElement('div');
    imgGrid.className = 'dws-img-grid';
    div.appendChild(imgGrid);

    for (const fp of meta.image_paths) {
      const dataUrl = await resolveImageDataUrl(fp);
      if (!dataUrl) continue;
      const fileName = fp.split(/[\\/]/).pop() || 'output.png';
      const card = document.createElement('div');
      card.className = 'dws-img-card';

      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = fileName;
      img.title = 'Bấm để phóng to Lightbox';
      img.addEventListener('click', () => openImageLightbox(dataUrl, fileName));

      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:10.5px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      lbl.textContent = fileName;

      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';

      const zoomBtn = document.createElement('button');
      zoomBtn.type = 'button';
      zoomBtn.className = 'action-btn';
      zoomBtn.style.cssText = 'padding:2px 7px;font-size:10px;';
      zoomBtn.textContent = 'Phóng to';
      zoomBtn.addEventListener('click', () => openImageLightbox(dataUrl, fileName));

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'action-btn';
      openBtn.style.cssText = 'padding:2px 7px;font-size:10px;';
      openBtn.textContent = 'Mở File';
      openBtn.addEventListener('click', () => {
        void invoke('workspace_open_output_file', { filePath: fp });
      });

      btns.appendChild(zoomBtn);
      btns.appendChild(openBtn);
      bar.appendChild(lbl);
      bar.appendChild(btns);
      card.appendChild(img);
      card.appendChild(bar);
      imgGrid.appendChild(card);
    }
  }

  // 2. Suggested Missing Skill Banner (1-Click Auto-Birth + Retry OR Open Tab 2)
  if (meta?.suggested_skill) {
    const sug = meta.suggested_skill;
    const sugBox = document.createElement('div');
    sugBox.className = 'dws-suggest-box';

    const info = document.createElement('div');
    info.innerHTML = `
      <div style="font-weight:700;font-size:12px;color:#93c5fd;">[ĐỀ XUẤT TỰ ĐẺ SKILL MỚI] <code>${escHtml(sug.module_name)}</code></div>
      <div style="font-size:11.5px;color:#cbd5e1;margin-top:2px;">${escHtml(sug.requirement)}</div>
    `;

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

    const quickBirthBtn = document.createElement('button');
    quickBirthBtn.type = 'button';
    quickBirthBtn.className = 'studio-btn-primary';
    quickBirthBtn.style.cssText = 'padding:5px 10px;font-size:11px;';
    quickBirthBtn.textContent = 'Tự Đẻ & Chạy Lại Ngay';
    quickBirthBtn.addEventListener('click', async () => {
      quickBirthBtn.disabled = true;
      quickBirthBtn.textContent = 'Đang đẻ code + Pytest...';
      fireAnimationTrigger('tool', 'hologram_code', 'start');
      try {
        const evRes = await invoke<SkillEvolutionPayload>('evolver_evolve_skill', {
          mode: 'create',
          pack: 'auto_skills',
          moduleName: sug.module_name,
          requirement: sug.requirement,
          errorContext: '',
          model: null,
          maxFixRounds: 3,
          liveSmokeTest: true,
        });
        if (evRes.ok) {
          quickBirthBtn.textContent = `Đã đẻ ${evRes.version}! Đang chạy lại...`;
          onSpeakCallback?.(
            `[SKILL EVOLVER] Đã tự đẻ thành công ${evRes.module_name} (${evRes.version}), vượt qua Pytest và nạp nóng ${evRes.total_tools_after_reload} tools!`
          );
          await loadEditableSkillsIntoSelect();
          if (meta.user_prompt) {
            sendChatCallback?.(meta.user_prompt);
          }
        } else {
          quickBirthBtn.disabled = false;
          quickBirthBtn.textContent = 'Cần chỉnh thêm (Mở Tab 2)';
          openStudioForSuggestedSkill(sug.module_name, sug.requirement);
          const logEl = document.getElementById('dws-studio-log');
          if (logEl) logEl.textContent = evRes.logs.join('\n') + '\n\n' + evRes.pytest_output;
        }
      } catch (err) {
        quickBirthBtn.disabled = false;
        quickBirthBtn.textContent = 'Lỗi (Thử lại)';
        onSpeakCallback?.(`[EVOLVER ERR] ${String(err)}`);
      }
    });

    const studioBtn = document.createElement('button');
    studioBtn.type = 'button';
    studioBtn.className = 'action-btn';
    studioBtn.style.cssText = 'padding:5px 9px;font-size:11px;';
    studioBtn.textContent = 'Mở Tab 2 Tùy Chỉnh';
    studioBtn.addEventListener('click', () => {
      openStudioForSuggestedSkill(sug.module_name, sug.requirement);
    });

    actions.appendChild(quickBirthBtn);
    actions.appendChild(studioBtn);
    sugBox.appendChild(info);
    sugBox.appendChild(actions);
    div.appendChild(sugBox);
  }

  // 3. Tool Execution Trace + 1-Click Auto-Heal & Edit in Tab 2
  if (meta && (meta.trace.length > 0 || meta.routed_tools.length > 0)) {
    const details = document.createElement('details');
    details.className = 'dws-trace-box';
    if (meta.trace.some((t) => !t.ok)) details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = `[TRACE] engine=${meta.engine} | ${(meta.elapsed_ms / 1000).toFixed(2)}s | routed=${meta.routed_tools.length} | tools=${meta.trace.length}`;
    details.appendChild(summary);

    if (meta.routed_tools.length > 0) {
      const rLine = document.createElement('div');
      rLine.style.cssText = 'margin-top:5px;color:#94a3b8;font-size:11px;';
      rLine.textContent = `BM25 Routed: ${meta.routed_tools.join(', ')}`;
      details.appendChild(rLine);
    }

    for (const tr of meta.trace) {
      const row = document.createElement('div');
      row.className = 'dws-trace-row';

      const left = document.createElement('div');
      const stColor = tr.ok ? '#34d399' : '#f87171';
      const memNote = tr.mem_ref ? ` [${tr.mem_ref}]` : '';
      left.innerHTML = `<code>${escHtml(tr.tool)}</code> <span style="color:#94a3b8;">${escHtml(JSON.stringify(tr.args || {}))}</span> <strong style="color:${stColor};margin-left:6px;">${tr.ok ? 'OK' : 'ERROR'} (${tr.elapsed_ms}ms)${escHtml(memNote)}</strong>`;

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;gap:5px;align-items:center;';

      if (!tr.ok) {
        const healBtn = document.createElement('button');
        healBtn.type = 'button';
        healBtn.className = 'studio-btn-primary';
        healBtn.style.cssText = 'padding:3px 8px;font-size:10.5px;';
        healBtn.textContent = 'Tự Vá & Chạy Lại';
        healBtn.addEventListener('click', async () => {
          healBtn.disabled = true;
          healBtn.textContent = 'Đang tự vá + Pytest...';
          const errCtx = `Tool vừa gọi: ${tr.tool}\nTham số: ${JSON.stringify(tr.args || {})}\nLỗi: ${tr.error || ''}`;
          try {
            const evRes = await invoke<SkillEvolutionPayload>('evolver_evolve_skill', {
              mode: 'rewrite',
              pack: tr.pack || 'auto_skills',
              moduleName: tr.module_name,
              requirement: `Khắc phục triệt để lỗi khi thực thi yêu cầu: "${meta.user_prompt}"`,
              errorContext: errCtx,
              model: null,
              maxFixRounds: 3,
              liveSmokeTest: true,
            });
            if (evRes.ok) {
              healBtn.textContent = `Đã vá (${evRes.version})! Đang chạy lại...`;
              if (meta.user_prompt) sendChatCallback?.(meta.user_prompt);
            } else {
              healBtn.disabled = false;
              healBtn.textContent = 'Mở Tab 2 Xem Log';
              await openStudioForExistingSkill(tr.pack, tr.module_name, errCtx);
            }
          } catch {
            healBtn.disabled = false;
            healBtn.textContent = 'Tự Vá & Chạy Lại';
          }
        });
        right.appendChild(healBtn);
      }

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'action-btn';
      editBtn.style.cssText = 'padding:3px 8px;font-size:10.5px;';
      editBtn.textContent = 'Sửa / Nâng Cấp Skill';
      editBtn.addEventListener('click', () => {
        const errCtx = tr.error
          ? `Tool vừa gọi: ${tr.tool}\nTham số: ${JSON.stringify(tr.args || {})}\nLỗi: ${tr.error}`
          : `Tool vừa gọi: ${tr.tool}\nTham số: ${JSON.stringify(tr.args || {})}`;
        void openStudioForExistingSkill(tr.pack, tr.module_name, errCtx);
      });
      right.appendChild(editBtn);

      row.appendChild(left);
      row.appendChild(right);
      if (!tr.ok && tr.error) {
        const errDiv = document.createElement('div');
        errDiv.style.cssText =
          'width:100%;margin-top:4px;padding:6px 8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.35);border-radius:5px;color:#fca5a5;font-family:Consolas,monospace;font-size:11px;white-space:pre-wrap;';
        errDiv.textContent = tr.error;
        row.appendChild(errDiv);
      }
      details.appendChild(row);
    }
    div.appendChild(details);
  }

  // 4. Quick Habit / Rule Feedback Bar
  const fbWrap = document.createElement('div');
  fbWrap.style.cssText = 'margin-top:7px;display:flex;flex-direction:column;gap:5px;';
  const fbToggleRow = document.createElement('div');
  fbToggleRow.style.cssText = 'display:flex;justify-content:flex-end;';
  const fbBtn = document.createElement('button');
  fbBtn.type = 'button';
  fbBtn.className = 'action-btn';
  fbBtn.style.cssText = 'padding:2px 8px;font-size:10px;color:#94a3b8;';
  fbBtn.textContent = 'Góp ý / Dạy thói quen';

  const fbInputRow = document.createElement('div');
  fbInputRow.style.cssText = 'display:none;gap:6px;align-items:center;';
  const fbInp = document.createElement('input');
  fbInp.type = 'text';
  fbInp.className = 'studio-input';
  fbInp.style.fontSize = '11px';
  fbInp.placeholder = 'Nhập quy tắc cho lần sau (vd: Luôn trả lời kèm bảng Markdown và đổi sang VND)...';
  const fbSave = document.createElement('button');
  fbSave.type = 'button';
  fbSave.className = 'studio-btn-primary';
  fbSave.style.cssText = 'padding:4px 10px;font-size:11px;white-space:nowrap;';
  fbSave.textContent = 'Lưu Quy Tắc';

  fbBtn.addEventListener('click', () => {
    fbInputRow.style.display = fbInputRow.style.display === 'none' ? 'flex' : 'none';
  });
  fbSave.addEventListener('click', async () => {
    const val = fbInp.value.trim();
    if (!val) return;
    await invoke('cog_upsert_rule', {
      ruleKey: '',
      ruleText: val,
      source: 'workspace_feedback',
    }).catch(() => { });
    fbInp.value = '';
    fbInputRow.style.display = 'none';
    fbBtn.textContent = 'Đã lưu vào Cognitive Memory';
  });

  fbToggleRow.appendChild(fbBtn);
  fbInputRow.appendChild(fbInp);
  fbInputRow.appendChild(fbSave);
  fbWrap.appendChild(fbToggleRow);
  fbWrap.appendChild(fbInputRow);
  div.appendChild(fbWrap);

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function loadSessionMessages(sessionId: string) {
  activeSessionId = sessionId;
  const box = document.getElementById('dws-messages');
  if (!box) return;
  box.innerHTML = '';
  try {
    const rows = await invoke<WsChatMessageRecord[]>('ws_session_load', { sessionId });
    if (rows.length === 0) {
      const welcome = document.createElement('div');
      welcome.className = 'dws-msg assistant';
      welcome.innerHTML =
        '<div class="dws-md"><p><strong>[WORKSPACE SẴN SÀNG]</strong> Hỏi đáp, phân tích biểu đồ ảnh, xem Trace 250+ tools hoặc yêu cầu Vịt tự đẻ Skill Python mới ngay tại đây.</p></div>';
      box.appendChild(welcome);
    } else {
      for (const r of rows) {
        let parsedMeta: RichTurnMeta | null = null;
        if (r.meta_json && r.meta_json !== '{}') {
          try {
            parsedMeta = JSON.parse(r.meta_json) as RichTurnMeta;
          } catch {
            parsedMeta = null;
          }
        }
        await appendWorkspaceMessageDom(
          r.role === 'user' ? 'user' : 'assistant',
          r.content,
          parsedMeta
        );
      }
    }
  } catch {
    // ignore
  }
}

export async function refreshWorkspaceSidebarData() {
  try {
    const [sessions, outputs, rStatus, packCat] = await Promise.all([
      invoke<WsChatSessionSummary[]>('ws_session_list').catch(() => [] as WsChatSessionSummary[]),
      invoke<WorkspaceOutputFile[]>('workspace_list_outputs').catch(
        () => [] as WorkspaceOutputFile[]
      ),
      invoke<RouterStatusPayload>('router_get_status').catch(() => null),
      invoke<PackCatalogSummary>('pack_get_catalog').catch(() => null),
    ]);

    if (packCat) {
      const pill = document.getElementById('dws-tools-pill');
      if (pill) pill.textContent = `[${packCat.total_tools} SKILLS ACTIVE]`;
    }

    if (!activeSessionId && sessions.length > 0) {
      activeSessionId = sessions[0].session_id;
      await loadSessionMessages(activeSessionId);
    }

    const sessBox = document.getElementById('dws-session-list');
    if (sessBox) {
      sessBox.innerHTML = '';
      for (const s of sessions) {
        const row = document.createElement('div');
        row.className = `dws-list-item${s.session_id === activeSessionId ? ' active' : ''}`;
        const titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
        titleSpan.textContent = s.title;

        const rightWrap = document.createElement('div');
        rightWrap.style.cssText = 'display:flex;align-items:center;gap:5px;flex-shrink:0;';
        const cnt = document.createElement('span');
        cnt.style.cssText = 'font-size:10px;color:#94a3b8;';
        cnt.textContent = String(s.message_count);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.style.cssText =
          'border:none;background:transparent;color:#94a3b8;cursor:pointer;font-size:11px;padding:0 2px;';
        delBtn.textContent = 'x';
        delBtn.title = 'Xóa phiên này';
        delBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const nextList = await invoke<WsChatSessionSummary[]>('ws_session_delete', {
            sessionId: s.session_id,
          }).catch(() => [] as WsChatSessionSummary[]);
          if (s.session_id === activeSessionId && nextList.length > 0) {
            activeSessionId = nextList[0].session_id;
            await loadSessionMessages(activeSessionId);
          }
          await refreshWorkspaceSidebarData();
        });

        rightWrap.appendChild(cnt);
        rightWrap.appendChild(delBtn);
        row.appendChild(titleSpan);
        row.appendChild(rightWrap);
        row.addEventListener('click', async () => {
          await loadSessionMessages(s.session_id);
          await refreshWorkspaceSidebarData();
        });
        sessBox.appendChild(row);
      }
    }

    const outBox = document.getElementById('dws-output-list');
    if (outBox) {
      outBox.innerHTML = '';
      if (outputs.length === 0) {
        outBox.innerHTML = '<div style="font-size:11px;color:#64748b;">Chưa có tệp xuất ra.</div>';
      } else {
        for (const f of outputs.slice(0, 25)) {
          const item = document.createElement('div');
          item.className = 'dws-list-item';
          item.title = `${f.name} (${f.size_kb} KB)`;
          item.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(f.name)}</span><span style="font-size:10px;color:#7dd3fc;">${f.is_image ? 'Xem' : 'Mở'}</span>`;
          item.addEventListener('click', async () => {
            if (f.is_image) {
              const durl = await resolveImageDataUrl(f.path);
              if (durl) openImageLightbox(durl, f.name);
            } else {
              void invoke('workspace_open_output_file', { filePath: f.path });
            }
          });
          outBox.appendChild(item);
        }
      }
    }

    const rBox = document.getElementById('dws-router-mini');
    if (rBox && rStatus) {
      rBox.innerHTML = '';
      for (const ep of rStatus.endpoints.slice(0, 12)) {
        const div = document.createElement('div');
        div.className = 'dws-list-item';
        const col =
          ep.status === 'healthy' ? '#34d399' : ep.status === 'cooldown' ? '#fbbf24' : '#f87171';
        div.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;">${escHtml(ep.endpoint_id)}</span><span style="color:${col};font-size:9.5px;font-weight:700;">${ep.status.toUpperCase()}</span>`;
        rBox.appendChild(div);
      }
    }
  } catch {
    // ignore
  }
}

// ============================================================================
// Tab 2: SkillEvolver Studio Helpers
// ============================================================================

function setStudioMode(mode: 'create' | 'rewrite') {
  studioMode = mode;
  const createBtn = document.getElementById('btn-dws-mode-create');
  const rewriteBtn = document.getElementById('btn-dws-mode-rewrite');
  if (createBtn) {
    createBtn.className = mode === 'create' ? 'studio-btn-primary' : 'action-btn';
  }
  if (rewriteBtn) {
    rewriteBtn.className = mode === 'rewrite' ? 'studio-btn-primary' : 'action-btn';
  }
  const newBox = document.getElementById('dws-new-skill-box');
  const exBox = document.getElementById('dws-existing-skill-box');
  if (newBox) newBox.style.display = mode === 'create' ? 'block' : 'none';
  if (exBox) exBox.style.display = mode === 'rewrite' ? 'block' : 'none';
}

function switchStudioEditorTab(which: 'skill' | 'test') {
  const sEd = document.getElementById('dws-editor-skill');
  const tEd = document.getElementById('dws-editor-test');
  const sBtn = document.getElementById('btn-dws-code-skill');
  const tBtn = document.getElementById('btn-dws-code-test');
  if (sEd) sEd.style.display = which === 'skill' ? 'block' : 'none';
  if (tEd) tEd.style.display = which === 'test' ? 'block' : 'none';
  if (sBtn) sBtn.className = which === 'skill' ? 'studio-btn-primary' : 'action-btn';
  if (tBtn) tBtn.className = which === 'test' ? 'studio-btn-primary' : 'action-btn';
}

async function loadEditableSkillsIntoSelect() {
  try {
    editableSkillsCache = await invoke<EditableSkillFileInfo[]>('evolver_list_skills');
    const sel = document.getElementById('dws-skill-select') as HTMLSelectElement | null;
    if (!sel) return;
    sel.innerHTML = '';
    for (const item of editableSkillsCache) {
      const opt = document.createElement('option');
      opt.value = `${item.pack}/${item.module_name}`;
      const verTag = item.active_version ? ` [${item.active_version}]` : '';
      opt.textContent = `${item.pack} / ${item.module_name}${verTag}`;
      sel.appendChild(opt);
    }
    if (editableSkillsCache.length > 0 && !selectedModule) {
      selectedPack = editableSkillsCache[0].pack;
      selectedModule = editableSkillsCache[0].module_name;
    }
  } catch {
    // ignore
  }
}

async function loadSelectedSkillSource(pack: string, modName: string, version?: string) {
  try {
    const src = await invoke<SkillSourcePayload>('evolver_get_skill_source', {
      pack,
      moduleName: modName,
      version: version || null,
    });
    selectedPack = src.pack;
    selectedModule = src.module_name;
    const sEd = document.getElementById('dws-editor-skill') as HTMLTextAreaElement | null;
    const tEd = document.getElementById('dws-editor-test') as HTMLTextAreaElement | null;
    const sBtn = document.getElementById('btn-dws-code-skill');
    const tBtn = document.getElementById('btn-dws-code-test');
    if (sEd) sEd.value = src.skill_code;
    if (tEd) tEd.value = src.test_code;
    if (sBtn) sBtn.textContent = `${src.module_name}.py`;
    if (tBtn) tBtn.textContent = `test_${src.module_name}.py`;

    const verSel = document.getElementById('dws-version-select') as HTMLSelectElement | null;
    const actBtn = document.getElementById('btn-dws-activate-ver') as HTMLButtonElement | null;
    if (verSel) {
      verSel.innerHTML = '';
      if (src.versions.length === 0) {
        verSel.innerHTML = '<option value="">Bản gốc (chưa tạo version)</option>';
        if (actBtn) actBtn.disabled = true;
      } else {
        for (const v of src.versions) {
          const opt = document.createElement('option');
          opt.value = v.version;
          opt.selected = v.version === (version || src.active_version);
          opt.textContent = `${v.version}${v.is_active ? ' (Đang chạy)' : ''} - ${v.source}`;
          verSel.appendChild(opt);
        }
        if (actBtn) {
          actBtn.disabled = verSel.value === src.active_version;
        }
      }
    }
  } catch (err) {
    const logEl = document.getElementById('dws-studio-log');
    if (logEl) logEl.textContent = `[READ ERR] ${String(err)}`;
  }
}

export function initWorkspaceChatUi(opts: {
  onSendChat: (text: string) => void;
  onSyncHitbox: () => void;
  onSpeak: (msg: string) => void;
  onBeforeOpen?: () => void;
  onOpenWebChat?: () => void;
}) {
  sendChatCallback = opts.onSendChat;
  syncHitboxCallback = opts.onSyncHitbox;
  onSpeakCallback = opts.onSpeak;
  onOpenBeforeShowCallback = opts.onBeforeOpen || null;

  const modalEl = document.getElementById('duck-workspace-modal');
  makeDialogDraggable(modalEl, '#dws-drag-header', () => syncHitboxCallback?.(), {
    minWidth: 560,
    minHeight: 380,
  });

  document.getElementById('dws-tab-btn-chat')?.addEventListener('click', () => {
    switchWorkspaceTab('chat');
  });
  document.getElementById('dws-tab-btn-studio')?.addEventListener('click', () => {
    switchWorkspaceTab('studio');
  });
  document.getElementById('dws-tab-btn-hub')?.addEventListener('click', () => {
    switchWorkspaceTab('hub');
  });
  document.getElementById('btn-dws-engine-python')?.addEventListener('click', () => {
    setStudioEngine('python');
  });
  document.getElementById('btn-dws-engine-sandbox')?.addEventListener('click', () => {
    setStudioEngine('sandbox');
  });
  document.getElementById('btn-dws-jump-create-skill')?.addEventListener('click', () => {
    switchWorkspaceTab('studio');
  });
  document.getElementById('btn-dws-open-web-sync')?.addEventListener('click', () => {
    opts.onOpenWebChat?.();
  });
  document.querySelectorAll('.dws-quick-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-dws-cmd');
      if (cmd) sendChatCallback?.(cmd);
    });
  });
  document.getElementById('btn-dws-maximize')?.addEventListener('click', (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    if (!modalEl) return;
    const isMax = modalEl.classList.toggle('dws-maximized');
    btn.textContent = isMax ? 'Thu Vừa' : 'Phóng To';
    syncHitboxCallback?.();
  });
  document.getElementById('btn-dws-close')?.addEventListener('click', () => {
    toggleWorkspaceModal(false);
  });

  document.getElementById('btn-dws-lightbox-close')?.addEventListener('click', closeLightbox);
  document.getElementById('duck-lightbox-modal')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) closeLightbox();
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (isLightboxModalOpen()) {
        closeLightbox();
      } else if (isWorkspaceModalOpen()) {
        toggleWorkspaceModal(false);
      }
    }
  });

  // Session & Outputs controls
  document.getElementById('btn-dws-new-session')?.addEventListener('click', async () => {
    const created = await invoke<WsChatSessionSummary>('ws_session_create', {
      title: 'Phiên mới',
    }).catch(() => null);
    if (created) {
      activeSessionId = created.session_id;
      await loadSessionMessages(activeSessionId);
      await refreshWorkspaceSidebarData();
    }
  });
  document.getElementById('btn-dws-refresh-outputs')?.addEventListener('click', () => {
    void refreshWorkspaceSidebarData();
  });

  // Send message from Workspace Input
  const submitWorkspaceChat = () => {
    const inp = document.getElementById('dws-chat-input') as HTMLTextAreaElement | null;
    const text = inp?.value.trim() || '';
    if (!text) return;
    if (inp) inp.value = '';
    sendChatCallback?.(text);
  };
  document.getElementById('btn-dws-send')?.addEventListener('click', submitWorkspaceChat);
  document.getElementById('dws-chat-input')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      submitWorkspaceChat();
    }
  });

  let liveStreamReceivedText = false;

  const ensureLiveStreamBubble = (initialText = 'Duck AI đang suy luận & chạy công cụ...') => {
    const box = document.getElementById('dws-messages');
    if (!box) return null;
    let el = document.getElementById('dws-live-stream-msg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dws-live-stream-msg';
      el.className = 'dws-msg assistant dws-streaming';
      el.innerHTML = `<div class="dws-md"><p style="color:#94a3b8;">${escHtml(initialText)}<span class="dws-stream-cursor"></span></p></div>`;
      box.appendChild(el);
      box.scrollTop = box.scrollHeight;
    }
    return el;
  };

  // Listen to global Duck chat turns (so both compact bubble AND Workspace stay 100% synced!)
  window.addEventListener('duck-ws-user-message', async (ev: Event) => {
    const detail = (ev as CustomEvent<{ text: string }>).detail;
    if (!detail?.text) return;
    if (!activeSessionId) {
      const list = await invoke<WsChatSessionSummary[]>('ws_session_list').catch(
        () => [] as WsChatSessionSummary[]
      );
      if (list.length > 0) activeSessionId = list[0].session_id;
    }
    if (activeSessionId) {
      await invoke('ws_session_append', {
        sessionId: activeSessionId,
        role: 'user',
        content: detail.text,
        metaJson: '{}',
      }).catch(() => { });
    }
    await appendWorkspaceMessageDom('user', detail.text, null);
    liveStreamReceivedText = false;
    ensureLiveStreamBubble();
  });

  window.addEventListener('duck-ws-stream-chunk', (ev: Event) => {
    const detail = (ev as CustomEvent<{ text?: string }>).detail;
    const txt = detail?.text || '';
    if (!txt.trim()) return;
    const liveEl = document.getElementById('dws-live-stream-msg');
    if (!liveEl) return;
    liveStreamReceivedText = true;
    const md = liveEl.querySelector('.dws-md');
    if (md) {
      const { prose } = splitSkillPackBlocks(txt);
      md.innerHTML =
        renderRichMarkdownHtml(prose || txt) +
        '<span class="dws-stream-cursor"></span>';
    }
    const box = document.getElementById('dws-messages');
    if (box) box.scrollTop = box.scrollHeight;
  });

  window.addEventListener('duck-ws-assistant-message', async (ev: Event) => {
    const detail = (ev as CustomEvent<{ content: string; meta: RichTurnMeta }>).detail;
    if (!detail) return;
    document.getElementById('dws-live-stream-msg')?.remove();
    const shouldAnimate = !liveStreamReceivedText && isWorkspaceModalOpen();
    liveStreamReceivedText = false;
    if (activeSessionId) {
      await invoke('ws_session_append', {
        sessionId: activeSessionId,
        role: 'assistant',
        content: detail.content,
        metaJson: JSON.stringify(detail.meta || {}),
      }).catch(() => { });
    }
    await appendWorkspaceMessageDom('assistant', detail.content, detail.meta, shouldAnimate);
    if (isWorkspaceModalOpen()) {
      void refreshWorkspaceSidebarData();
    }
  });

  // Tab 2 Studio Bindings
  document.getElementById('btn-dws-mode-create')?.addEventListener('click', () => {
    setStudioMode('create');
  });
  document.getElementById('btn-dws-mode-rewrite')?.addEventListener('click', async () => {
    setStudioMode('rewrite');
    await loadEditableSkillsIntoSelect();
    if (selectedPack && selectedModule) {
      await loadSelectedSkillSource(selectedPack, selectedModule);
    }
  });
  document.getElementById('dws-skill-select')?.addEventListener('change', (ev) => {
    const val = (ev.target as HTMLSelectElement).value;
    const [pk, md] = val.split('/');
    if (pk && md) {
      void loadSelectedSkillSource(pk, md);
    }
  });
  document.getElementById('btn-dws-code-skill')?.addEventListener('click', () => {
    switchStudioEditorTab('skill');
  });
  document.getElementById('btn-dws-code-test')?.addEventListener('click', () => {
    switchStudioEditorTab('test');
  });
  document.getElementById('dws-version-select')?.addEventListener('change', (ev) => {
    const ver = (ev.target as HTMLSelectElement).value;
    if (selectedPack && selectedModule && ver) {
      void loadSelectedSkillSource(selectedPack, selectedModule, ver);
    }
  });

  document.getElementById('btn-dws-run-evolve')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    const logEl = document.getElementById('dws-studio-log');
    const req =
      (document.getElementById('dws-requirement') as HTMLTextAreaElement | null)?.value.trim() ||
      '';
    const errCtx =
      (document.getElementById('dws-error-ctx') as HTMLTextAreaElement | null)?.value.trim() || '';
    const rounds =
      Number((document.getElementById('dws-max-rounds') as HTMLInputElement | null)?.value || 3) ||
      3;
    const smoke = Boolean(
      (document.getElementById('dws-live-smoke') as HTMLInputElement | null)?.checked
    );

    let targetPack = 'auto_skills';
    let targetMod = '';
    if (studioMode === 'create') {
      targetMod =
        (document.getElementById('dws-new-mod-input') as HTMLInputElement | null)?.value.trim() ||
        '';
    } else {
      targetPack = selectedPack || 'auto_skills';
      targetMod = selectedModule;
    }

    if (!targetMod || !req) {
      if (logEl) {
        logEl.textContent = '[WARN] Vui lòng nhập Tên Module và Yêu Cầu Chức Năng trước khi chạy.';
      }
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Đang chạy Coder -> AST -> Pytest -> Smoke Probe...';
    if (logEl) {
      logEl.textContent = `[RUNNING] Mode=${studioMode.toUpperCase()} | Target=${targetPack}/${targetMod}\nĐang gọi 9Router sinh mã Python + Unit Test Pytest...`;
    }
    fireAnimationTrigger('tool', 'hologram_code', 'start');

    try {
      const res = await invoke<SkillEvolutionPayload>('evolver_evolve_skill', {
        mode: studioMode,
        pack: targetPack,
        moduleName: targetMod,
        requirement: req,
        errorContext: errCtx,
        model: null,
        maxFixRounds: rounds,
        liveSmokeTest: smoke,
      });

      const sEd = document.getElementById('dws-editor-skill') as HTMLTextAreaElement | null;
      const tEd = document.getElementById('dws-editor-test') as HTMLTextAreaElement | null;
      if (sEd && res.skill_code) sEd.value = res.skill_code;
      if (tEd && res.test_code) tEd.value = res.test_code;

      if (logEl) {
        logEl.textContent = `${res.logs.join('\n')}\n\n=== PYTEST & PROBE OUTPUT ===\n${res.pytest_output}`;
      }
      if (res.ok) {
        selectedPack = res.pack;
        selectedModule = res.module_name;
        await loadEditableSkillsIntoSelect();
        await loadSelectedSkillSource(res.pack, res.module_name);
        const pill = document.getElementById('dws-tools-pill');
        if (pill && res.total_tools_after_reload > 0) {
          pill.textContent = `[${res.total_tools_after_reload} SKILLS ACTIVE]`;
        }
        onSpeakCallback?.(
          `[SKILL STUDIO PASS] Đã hoàn tất ${res.module_name} (${res.version}) sau ${res.rounds_used} vòng và Hot-Reload vào bộ não Vịt!`
        );
      }
    } catch (err) {
      if (logEl) logEl.textContent = `[ERROR] ${String(err)}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'AI Tự Đẻ Code + Pytest + Smoke Probe + Hot-Reload';
    }
  });

  document.getElementById('btn-dws-manual-save')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    const logEl = document.getElementById('dws-studio-log');
    const sCode =
      (document.getElementById('dws-editor-skill') as HTMLTextAreaElement | null)?.value || '';
    const tCode =
      (document.getElementById('dws-editor-test') as HTMLTextAreaElement | null)?.value || '';
    const modName =
      studioMode === 'create'
        ? (document.getElementById('dws-new-mod-input') as HTMLInputElement | null)?.value.trim() ||
        selectedModule
        : selectedModule;
    if (!modName || !sCode.trim()) return;

    btn.disabled = true;
    try {
      const res = await invoke<SkillEvolutionPayload>('evolver_manual_save', {
        pack: studioMode === 'create' ? 'auto_skills' : selectedPack,
        moduleName: modName,
        skillCode: sCode,
        testCode: tCode,
      });
      if (logEl) {
        logEl.textContent = `${res.logs.join('\n')}\n\n${res.pytest_output}`;
      }
      if (res.ok) {
        await loadEditableSkillsIntoSelect();
        await loadSelectedSkillSource(res.pack, res.module_name);
      }
    } catch (err) {
      if (logEl) logEl.textContent = `[SAVE ERR] ${String(err)}`;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-dws-activate-ver')?.addEventListener('click', async () => {
    const ver =
      (document.getElementById('dws-version-select') as HTMLSelectElement | null)?.value || '';
    const logEl = document.getElementById('dws-studio-log');
    if (!selectedPack || !selectedModule || !ver) return;
    const res = await invoke<SkillEvolutionPayload>('evolver_activate_version', {
      pack: selectedPack,
      moduleName: selectedModule,
      version: ver,
    });
    if (logEl) logEl.textContent = res.logs.join('\n');
    await loadSelectedSkillSource(selectedPack, selectedModule);
  });

  document.getElementById('btn-dws-minimize')?.addEventListener('click', () => {
    toggleWorkspaceModal(false);
    window.dispatchEvent(new CustomEvent('duck-chat-switch-compact'));
  });

  document.getElementById('btn-dws-publish-cloud')?.addEventListener('click', async () => {
    const logEl = document.getElementById('dws-studio-log');
    const pack = studioMode === 'create' ? 'auto_skills' : selectedPack || 'auto_skills';
    const modName =
      studioMode === 'create'
        ? (document.getElementById('dws-new-mod-input') as HTMLInputElement | null)?.value.trim() ||
          selectedModule
        : selectedModule;
    if (!modName) {
      if (logEl) logEl.textContent = '[CLOUD] Hãy chọn hoặc lưu 1 Python Skill trước khi đẩy lên MongoDB.';
      return;
    }
    const btn = document.getElementById('btn-dws-publish-cloud') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      const doc = await invoke<{ skill_key: string; name: string }>('cloud_publish_pack_skill', {
        pack,
        moduleName: modName,
      });
      if (logEl) {
        logEl.textContent = `[CLOUD OK] Đã đẩy ${doc.name} (${doc.skill_key}) lên MongoDB — các máy khác có thể tải về chạy local ngay.`;
      }
    } catch (err) {
      if (logEl) logEl.textContent = `[CLOUD ERR] ${String(err)}`;
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('btn-dws-hot-reload')?.addEventListener('click', async () => {
    const logEl = document.getElementById('dws-studio-log');
    const cat = await invoke<PackCatalogSummary>('pack_reload_catalog');
    const pill = document.getElementById('dws-tools-pill');
    if (pill) pill.textContent = `[${cat.total_tools} SKILLS ACTIVE]`;
    if (logEl) logEl.textContent = `[HOT-RELOAD OK] Đã nạp lại ${cat.total_tools} tools từ đĩa.`;
  });

  document.getElementById('btn-dws-delete-skill')?.addEventListener('click', async () => {
    if (!selectedPack || !selectedModule) return;
    const logEl = document.getElementById('dws-studio-log');
    const res = await invoke<SkillEvolutionPayload>('evolver_delete_skill', {
      pack: selectedPack,
      moduleName: selectedModule,
    });
    if (logEl) logEl.textContent = res.logs.join('\n');
    selectedModule = '';
    await loadEditableSkillsIntoSelect();
  });

  // Load initial default session in background
  void refreshWorkspaceSidebarData();
}
