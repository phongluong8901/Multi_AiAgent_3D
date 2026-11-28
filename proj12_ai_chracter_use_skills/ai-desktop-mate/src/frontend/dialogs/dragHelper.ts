import { appState } from '../../core/state';

let nextDialogZ = 10032;

export function bringDialogToFront(el: HTMLElement | null) {
  if (!el || el.id === 'speech-bubble' || el.id === 'companion-dock') return;
  if (nextDialogZ >= 10085) {
    nextDialogZ = 10032;
  }
  nextDialogZ += 1;
  el.style.zIndex = String(nextDialogZ);
}

export interface DialogInteractOptions {
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  /** Giữ vị trí tự động bám theo nhân vật khi chỉ kéo giãn kích thước (vd: #speech-bubble) */
  keepFollowOnResize?: boolean;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | '';

const CURSOR_MAP: Record<Exclude<ResizeDir, ''>, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
};

function detectResizeDir(
  el: HTMLElement,
  clientX: number,
  clientY: number
): ResizeDir {
  if (el.classList.contains('dws-maximized')) return '';
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return '';

  const edge = 7;
  const corner = 15;
  const dxLeft = clientX - r.left;
  const dxRight = r.right - clientX;
  const dyTop = clientY - r.top;
  const dyBottom = r.bottom - clientY;

  if (dxLeft < -2 || dxRight < -2 || dyTop < -2 || dyBottom < -2) {
    return '';
  }

  // Góc ưu tiên cao hơn để kéo chéo 2 chiều dễ dàng (kể cả góc dưới-phải có grip)
  if (dyBottom <= corner && dxRight <= corner) return 'se';
  if (dyBottom <= corner && dxLeft <= corner) return 'sw';
  if (dyTop <= corner && dxRight <= corner) return 'ne';
  if (dyTop <= corner && dxLeft <= corner) return 'nw';

  // Tránh đè lên thanh cuộn dọc của hộp thoại có scrollbar ở giữa cạnh phải
  const hasVertScroll = el.scrollHeight > el.clientHeight + 4;
  const rightEdgeZone = hasVertScroll ? 4 : edge;

  if (dxLeft <= edge) return 'w';
  if (dxRight <= rightEdgeZone) return 'e';
  if (dyTop <= edge) return 'n';
  if (dyBottom <= edge) return 's';
  return '';
}

export function makeDialogResizable(
  dialogEl: HTMLElement | null,
  onSyncHitbox: (force: boolean) => void,
  opts?: DialogInteractOptions
) {
  if (!dialogEl || dialogEl.dataset.resizableBound === '1') return;
  dialogEl.dataset.resizableBound = '1';
  dialogEl.classList.add('dialog-resizable');

  const minW = opts?.minWidth ?? 280;
  const minH = opts?.minHeight ?? 150;
  const keepFollow = Boolean(opts?.keepFollowOnResize);

  let resizingDir: ResizeDir = '';
  let startX = 0;
  let startY = 0;
  let startRect = { left: 0, top: 0, width: 0, height: 0 };

  dialogEl.addEventListener(
    'pointermove',
    (e) => {
      if (resizingDir) {
        const vw = appState.W || window.innerWidth || 1920;
        const vh = appState.H || window.innerHeight || 1080;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = startRect.left;
        let newTop = startRect.top;
        let newW = startRect.width;
        let newH = startRect.height;

        if (resizingDir.includes('e')) {
          newW = Math.min(vw - newLeft - 8, Math.max(minW, startRect.width + dx));
        }
        if (resizingDir.includes('s')) {
          newH = Math.min(vh - newTop - 8, Math.max(minH, startRect.height + dy));
        }
        if (resizingDir.includes('w')) {
          const maxDeltaLeft = startRect.width - minW;
          const clampedDx = Math.max(8 - startRect.left, Math.min(maxDeltaLeft, dx));
          newLeft = startRect.left + clampedDx;
          newW = startRect.width - clampedDx;
        }
        if (resizingDir.includes('n')) {
          const maxDeltaTop = startRect.height - minH;
          const clampedDy = Math.max(8 - startRect.top, Math.min(maxDeltaTop, dy));
          newTop = startRect.top + clampedDy;
          newH = startRect.height - clampedDy;
        }

        dialogEl.style.width = `${Math.round(newW)}px`;
        dialogEl.style.height = `${Math.round(newH)}px`;
        dialogEl.style.maxWidth = 'calc(100vw - 16px)';
        dialogEl.style.maxHeight = 'calc(100vh - 16px)';

        if (!keepFollow || dialogEl.classList.contains('dialog-dragged')) {
          dialogEl.style.left = `${Math.round(newLeft)}px`;
          dialogEl.style.top = `${Math.round(newTop)}px`;
          delete dialogEl.dataset.lastPos;
        }

        onSyncHitbox(false);
        return;
      }

      const dir = detectResizeDir(dialogEl, e.clientX, e.clientY);
      dialogEl.style.cursor = dir ? CURSOR_MAP[dir] : '';
    },
    { passive: true }
  );

  dialogEl.addEventListener('pointerleave', () => {
    if (!resizingDir) {
      dialogEl.style.cursor = '';
    }
  });

  dialogEl.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      const dir = detectResizeDir(dialogEl, e.clientX, e.clientY);
      if (!dir) return;

      e.preventDefault();
      e.stopPropagation();

      const r = dialogEl.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;

      resizingDir = dir;
      startX = e.clientX;
      startY = e.clientY;
      startRect = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };

      dialogEl.classList.remove('ui-pop-in');
      dialogEl.classList.add('dialog-resized');

      if (!keepFollow || dir.includes('w') || dir.includes('n')) {
        dialogEl.classList.add('dialog-dragged');
        dialogEl.style.left = `${Math.round(r.left)}px`;
        dialogEl.style.top = `${Math.round(r.top)}px`;
        dialogEl.style.right = 'auto';
        dialogEl.style.bottom = 'auto';
        dialogEl.style.transform = 'none';
      }

      dialogEl.style.width = `${Math.round(r.width)}px`;
      dialogEl.style.height = `${Math.round(r.height)}px`;
      dialogEl.style.maxWidth = 'calc(100vw - 16px)';
      dialogEl.style.maxHeight = 'calc(100vh - 16px)';
      dialogEl.style.cursor = CURSOR_MAP[dir];

      try {
        dialogEl.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    true
  );

  const finishResize = (e: PointerEvent) => {
    if (!resizingDir) return;
    resizingDir = '';
    dialogEl.style.cursor = '';
    try {
      if (dialogEl.hasPointerCapture(e.pointerId)) {
        dialogEl.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    onSyncHitbox(true);
  };

  dialogEl.addEventListener('pointerup', finishResize);
  dialogEl.addEventListener('pointercancel', finishResize);
}

export function resetDialogPositionAndSize(
  dialogEl: HTMLElement | null,
  onSyncHitbox?: (force: boolean) => void
) {
  if (!dialogEl) return;
  dialogEl.classList.remove('dialog-dragged', 'dialog-resized');
  dialogEl.style.left = '';
  dialogEl.style.top = '';
  dialogEl.style.right = '';
  dialogEl.style.bottom = '';
  dialogEl.style.width = '';
  dialogEl.style.height = '';
  dialogEl.style.maxWidth = '';
  dialogEl.style.maxHeight = '';
  dialogEl.style.transform = '';
  delete dialogEl.dataset.lastPos;
  onSyncHitbox?.(true);
}

export function makeDialogDraggable(
  dialogEl: HTMLElement | null,
  handleSelector: string,
  onSyncHitbox: (force: boolean) => void,
  opts?: DialogInteractOptions
) {
  if (!dialogEl) return;

  if (dialogEl.dataset.zFrontBound !== '1') {
    dialogEl.dataset.zFrontBound = '1';
    dialogEl.addEventListener(
      'pointerdown',
      () => {
        bringDialogToFront(dialogEl);
      },
      true
    );
  }

  if (opts?.resizable !== false) {
    makeDialogResizable(dialogEl, onSyncHitbox, opts);
  }

  const handle = dialogEl.querySelector(handleSelector) as HTMLElement | null;
  if (!handle || handle.dataset.dragBound === '1') return;
  handle.dataset.dragBound = '1';
  handle.classList.add('dialog-drag-handle');
  if (!handle.title) {
    handle.title =
      'Kéo tiêu đề để di chuyển | Kéo viền/góc để co giãn | Double-click để đặt lại mặc định';
  }

  let dragging = false;
  let offX = 0;
  let offY = 0;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (detectResizeDir(dialogEl, e.clientX, e.clientY)) return;
    if (
      (e.target as Element | null)?.closest(
        'button, input, select, textarea, a, label, option'
      )
    ) {
      return;
    }
    const r = dialogEl.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    dragging = true;
    dialogEl.classList.remove('ui-pop-in');
    dialogEl.classList.add('dialog-dragged');
    dialogEl.style.left = `${Math.round(r.left)}px`;
    dialogEl.style.top = `${Math.round(r.top)}px`;
    dialogEl.style.right = 'auto';
    dialogEl.style.bottom = 'auto';
    dialogEl.style.transform = 'none';
    delete dialogEl.dataset.lastPos;
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const w = dialogEl.offsetWidth || 440;
    const maxX = Math.max(8, appState.W - Math.min(w, appState.W - 16) - 8);
    const maxY = Math.max(8, appState.H - 48);
    const nx = Math.max(8, Math.min(maxX, e.clientX - offX));
    const ny = Math.max(8, Math.min(maxY, e.clientY - offY));
    dialogEl.style.left = `${Math.round(nx)}px`;
    dialogEl.style.top = `${Math.round(ny)}px`;
    delete dialogEl.dataset.lastPos;
    onSyncHitbox(false);
  });

  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    onSyncHitbox(true);
  };
  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);

  handle.addEventListener('dblclick', (e) => {
    if (
      (e.target as Element | null)?.closest(
        'button, input, select, textarea, a, label, option'
      )
    ) {
      return;
    }
    resetDialogPositionAndSize(dialogEl, onSyncHitbox);
  });
}
