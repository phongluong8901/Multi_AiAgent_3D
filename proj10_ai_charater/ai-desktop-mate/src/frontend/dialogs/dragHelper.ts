import { appState } from '../../core/state';

export function makeDialogDraggable(
  dialogEl: HTMLElement | null,
  handleSelector: string,
  onSyncHitbox: (force: boolean) => void
) {
  if (!dialogEl) return;
  const handle = dialogEl.querySelector(handleSelector) as HTMLElement | null;
  if (!handle) return;
  handle.classList.add('dialog-drag-handle');
  if (!handle.title) {
    handle.title = 'Kéo để di chuyển hộp thoại (Double-click để căn giữa lại)';
  }

  let dragging = false;
  let offX = 0;
  let offY = 0;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
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
    dialogEl.classList.remove('dialog-dragged');
    dialogEl.style.left = '';
    dialogEl.style.top = '';
    dialogEl.style.right = '';
    dialogEl.style.bottom = '';
    dialogEl.style.transform = '';
    onSyncHitbox(true);
  });
}
