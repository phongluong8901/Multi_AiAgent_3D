/**
 * UI Motion - Hiệu ứng chuyển động nhẹ cho giao diện (Ripple, Spring Modal, State Pop, Clip Badge).
 * Thiết kế event-driven / MutationObserver cục bộ, hoàn toàn KHÔNG chạy vòng lặp khi idle.
 */
import { getActiveClipLabels, onAnimationFired } from '../core/animationBinder';

let initialized = false;

const MODAL_AND_PANEL_IDS = [
  'studio-panel',
  'long-memory-panel',
  'notification-panel',
  'p2p-arena-panel',
  'pc-control-modal',
  'ocr-translate-modal',
  'tool-forge-modal',
  'tarot-modal',
  'anim-manager-modal',
  'left-telemetry-panel',
  'right-action-panel',
  'mini-screen-panel',
  'speech-bubble',
];

function isElementVisible(el: HTMLElement): boolean {
  const d = el.style.display;
  if (d === 'none') return false;
  if (d) return true;
  return !el.classList.contains('collapsed') && !el.classList.contains('hidden');
}

const classCleanupTimers = new WeakMap<HTMLElement, number>();

function triggerClassOnce(el: HTMLElement, cls: string) {
  const prevTimer = classCleanupTimers.get(el);
  if (prevTimer !== undefined) {
    window.clearTimeout(prevTimer);
    classCleanupTimers.delete(el);
  }
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const cleanup = () => {
    el.classList.remove(cls);
    const t = classCleanupTimers.get(el);
    if (t !== undefined) {
      window.clearTimeout(t);
      classCleanupTimers.delete(el);
    }
  };
  el.addEventListener('animationend', cleanup, { once: true });
  classCleanupTimers.set(el, window.setTimeout(cleanup, 450));
}

export function initUiMotion() {
  if (initialized) return;
  initialized = true;

  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Click ripple cho các nút tương tác chính (bỏ qua khi Eco Mode)
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (prefersReduced || document.body.classList.contains('eco-mode')) return;
      const target = e.target as HTMLElement | null;
      const btn = target?.closest(
        '.action-btn, .btn-footer, .btn-mini-action, .studio-btn-primary, .studio-tab-btn, .dock-btn, .chat-chip, .tarot-pick-card'
      ) as HTMLElement | null;
      if (!btn || (btn as HTMLButtonElement).disabled) return;

      const rect = btn.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const ripple = document.createElement('span');
      ripple.className = 'ui-ripple';
      ripple.style.left = `${Math.round(e.clientX - rect.left)}px`;
      ripple.style.top = `${Math.round(e.clientY - rect.top)}px`;
      btn.appendChild(ripple);

      const cleanup = () => {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      };
      ripple.addEventListener('animationend', cleanup, { once: true });
      window.setTimeout(cleanup, 540);
    },
    { passive: true }
  );

  // 2. Pop-in cho Modal & Panel khi chuyển từ ẩn -> hiện
  const visibilityMap = new Map<string, boolean>();
  const panelObserver = new MutationObserver((records) => {
    if (document.body.classList.contains('eco-mode')) return;
    for (const r of records) {
      const el = r.target as HTMLElement;
      const shown = isElementVisible(el);
      const was = visibilityMap.get(el.id) ?? false;
      visibilityMap.set(el.id, shown);
      if (shown && !was) {
        triggerClassOnce(el, 'ui-pop-in');
      }
    }
  });

  const attachPanelObservers = () => {
    for (const id of MODAL_AND_PANEL_IDS) {
      const el = document.getElementById(id);
      if (!el || visibilityMap.has(id)) continue;
      visibilityMap.set(id, isElementVisible(el));
      panelObserver.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  };
  attachPanelObservers();
  window.setTimeout(attachPanelObservers, 1200);

  // 3. Nảy nhẹ badge trạng thái khi đổi state
  const stateBadge = document.getElementById('state-badge');
  if (stateBadge) {
    let lastText = stateBadge.textContent || '';
    const stateObserver = new MutationObserver(() => {
      const next = stateBadge.textContent || '';
      if (next === lastText) return;
      lastText = next;
      if (!document.body.classList.contains('eco-mode')) {
        triggerClassOnce(stateBadge, 'badge-pop');
      }
    });
    stateObserver.observe(stateBadge, { childList: true, characterData: true, subtree: true });
  }

  // 4. Đồng bộ vòng sáng Dock & #active-clip-badge khi clip chạy / dừng
  let badgePollTimer: number | null = null;
  let dockFiringTimer: number | null = null;

  const syncActiveClipBadge = () => {
    const badge = document.getElementById('active-clip-badge');
    if (!badge) return;
    const labels = getActiveClipLabels();
    if (labels.length === 0) {
      badge.style.display = 'none';
      badge.textContent = '';
      if (badgePollTimer !== null) {
        window.clearInterval(badgePollTimer);
        badgePollTimer = null;
      }
      return;
    }
    const label = labels[labels.length - 1];
    if (badge.textContent !== label) {
      badge.textContent = label;
    }
    if (badge.style.display === 'none') {
      badge.style.display = 'inline-flex';
    }
    if (badgePollTimer === null) {
      badgePollTimer = window.setInterval(syncActiveClipBadge, 320);
    }
  };

  onAnimationFired((_b, _clip) => {
    const dockAnimBtn = document.getElementById('dock-btn-anim');
    if (dockAnimBtn && !document.body.classList.contains('eco-mode')) {
      triggerClassOnce(dockAnimBtn, 'firing');
      if (dockFiringTimer !== null) window.clearTimeout(dockFiringTimer);
      dockFiringTimer = window.setTimeout(() => {
        dockAnimBtn.classList.remove('firing');
        dockFiringTimer = null;
      }, 680);
    }
    syncActiveClipBadge();
  });

  window.addEventListener('duck-anim-stopped', () => {
    const badge = document.getElementById('active-clip-badge');
    if (badge) {
      badge.style.display = 'none';
      badge.textContent = '';
    }
    if (badgePollTimer !== null) {
      window.clearInterval(badgePollTimer);
      badgePollTimer = null;
    }
  });
}
