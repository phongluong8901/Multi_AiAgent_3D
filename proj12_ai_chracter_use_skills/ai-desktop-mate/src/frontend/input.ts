import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { appState, getDesktopFloorY } from '../core/state';
import { fireAnimationTrigger } from '../core/animationBinder';
import { playHappyChirpSound } from '../core/soundFx';
import { camera, getRenderViewport } from '../core/scene';
import { DragSample, DesktopState } from '../core/types';
import { spawnParticles, clearLadder, showParachute } from '../core/particles';
import { triggerBlackHoleTeleport, setIgnoreWindowCollision } from '../physics/physics';
import {
  leftTelemetryPanel,
  rightActionPanel,
  speechBubble,
  companionDock,
  studioPanel,
  longMemoryPanel,
  notificationPanel,
  fileInput,
  setFileDragHoverMode,
  speakMessage,
  triggerHeadpat,
  toggleBubbleVisibility,
  saveStudioConfigToSqlite,
  syncHitboxToRust,
} from './ui';
import { loadVrmFromBuffer } from '../characters/vrmManager';
import { isP2pDuelActive, performP2pSkill } from '../core/p2pArena';

const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let dragDeltaX = 0;
let dragDeltaY = 0;
let pointerDownPos = { x: 0, y: 0 };
const dragSamples: DragSample[] = [];

let lastPatX = 0;
let lastPatDir = 0;
let patStrokes = 0;
let lastPatTime = 0;
let pokeReplyIdx = 0;
const POKE_REPLIES = [
  'Quạc! Nhột quá, bạn cần tớ hỗ trợ gì nào?',
  'Hihi chọc tớ hả? Kéo thả file vào tớ hoặc gõ lệnh ở dưới nhé!',
  'MicroDuck sẵn sàng! Double-click vào tớ để ẩn/hiện nhanh khung chat nha!',
  'Ối nhột! Muốn xem tớ diễn trò thì mở bảng Hành động hoặc Quản lý Hoạt ảnh nhé!',
  'Quạc quạc! Hệ thống cảm biến vẫn nhạy 100%, chủ nhân cứ sai bảo!',
];

export function checkMouseIntersect(clientX: number, clientY: number): boolean {
  const vp = getRenderViewport();
  if (
    clientX < vp.left ||
    clientX > vp.left + vp.width ||
    clientY < vp.top ||
    clientY > vp.top + vp.height
  ) {
    return false;
  }
  mouseNDC.x = ((clientX - vp.left) / vp.width) * 2 - 1;
  mouseNDC.y = -((clientY - vp.top) / vp.height) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObject(appState.hitBoxMesh, true);
  return hits.length > 0;
}

export function isInsideInteractiveUi(target: EventTarget | null): boolean {
  if (!target) return false;
  const node = target as Node;
  if (appState.isLeftPanelOpen && leftTelemetryPanel.contains(node)) return true;
  if (appState.isRightPanelOpen && rightActionPanel.contains(node)) return true;
  if (appState.isBubbleVisible && speechBubble.contains(node)) return true;
  if (companionDock.contains(node)) return true;
  if (appState.isStudioOpen && studioPanel.contains(node)) return true;
  if (appState.isLongMemoryOpen && longMemoryPanel.contains(node)) return true;
  if (appState.isNotificationManagerOpen && notificationPanel && notificationPanel.contains(node)) return true;
  if (appState.isOcrSnipMode) return true;
  if (appState.isP2pArenaOpen && target instanceof Element && target.closest('#p2p-arena-panel')) return true;
  if (appState.isPcControlOpen && target instanceof Element && target.closest('#pc-control-modal')) return true;
  if (appState.isOcrModalOpen && target instanceof Element && target.closest('#ocr-translate-modal')) return true;
  if (appState.isToolForgeOpen && target instanceof Element && target.closest('#tool-forge-modal')) return true;
  if (appState.isTarotModalOpen && target instanceof Element && target.closest('#tarot-modal')) return true;
  if (appState.isMiniScreenOpen && target instanceof Element && target.closest('#mini-screen-panel')) return true;
  if (target instanceof Element && target.closest('#ocr-snip-overlay')) return true;
  if (target instanceof Element && target.closest('#p2p-pk-controller')) return true;
  if (target instanceof Element && target.closest('#p2p-return-pill')) return true;
  if (target instanceof Element && target.closest('#p2p-victim-banner')) return true;
  if (target instanceof Element && target.closest('#sticky-notes-widget')) return true;
  if (target instanceof Element && target.closest('#file-dashboard-modal')) return true;
  if (target instanceof Element && target.closest('#file-ingest-mouth-hud')) return true;
  if (target instanceof Element && target.closest('#duck-workspace-modal')) return true;
  if (target instanceof Element && target.closest('#duck-lightbox-modal')) return true;
  if (target instanceof Element && target.closest('#english-coach-modal')) return true;
  if (target instanceof Element && target.closest('#smart-dropzone-modal')) return true;
  if (target instanceof Element && target.closest('#anim-manager-modal')) return true;
  if (target instanceof Element && target.closest('#p2p-ultraview-modal')) return true;
  return false;
}

async function handleFileSelect(file: File) {
  const buffer = await file.arrayBuffer();
  await loadVrmFromBuffer(buffer, file.name);
  await saveStudioConfigToSqlite('custom_vrm', '');
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F4') {
      fileInput.click();
    } else if (e.key === 'Escape' && appState.blackHoleWarpMode) {
      appState.blackHoleWarpMode = false;
      document.body.style.cursor = 'default';
      void invoke('set_manual_interactive', { interactive: false }).catch(() => { });
      syncHitboxToRust(true);
      speakMessage('[PORTAL] Đã hủy chế độ triệu hồi Hố Đen.');
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      localStorage.setItem('mate_active_character_type', 'custom_vrm');
      void handleFileSelect(file);
    }
  });

  let domDragDepth = 0;
  const recentTauriDropKeys = new Map<string, number>();

  const markTauriDropped = (fileName: string) => {
    const key = fileName.trim().toLowerCase();
    if (key) {
      recentTauriDropKeys.set(key, performance.now());
    }
  };

  const wasRecentlyTauriDropped = (fileName: string): boolean => {
    const key = fileName.trim().toLowerCase();
    const ts = recentTauriDropKeys.get(key);
    if (!ts) return false;
    if (performance.now() - ts < 1500) {
      return true;
    }
    recentTauriDropKeys.delete(key);
    return false;
  };

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    domDragDepth++;
    const itemName = e.dataTransfer?.files?.[0]?.name || '';
    if (!appState.isFileDragHovering) {
      setFileDragHoverMode(true, itemName);
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!appState.isFileDragHovering) {
      setFileDragHoverMode(true);
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    domDragDepth = Math.max(0, domDragDepth - 1);
    if (domDragDepth === 0) {
      setFileDragHoverMode(false);
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    domDragDepth = 0;
    setFileDragHoverMode(false);
    const files = Array.from(e.dataTransfer?.files || []).slice(0, 5);
    if (files.length === 0) return;

    const docFiles: File[] = [];
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.vrm') || lower.endsWith('.glb')) {
        void handleFileSelect(file);
      } else {
        docFiles.push(file);
      }
    }

    if (docFiles.length > 0) {
      window.setTimeout(() => {
        const freshFiles = docFiles.filter((docFile) => !wasRecentlyTauriDropped(docFile.name));
        if (freshFiles.length > 0) {
          window.dispatchEvent(
            new CustomEvent('duck-smart-dropzone-open', { detail: { items: freshFiles } })
          );
        }
      }, 80);
    }
  });

  // Lắng nghe sự kiện Drag & Drop OS gốc của Tauri v2 (kéo file PDF/CSV/Excel/Ảnh từ Desktop/Explorer vào WebView2)
  void getCurrentWebview()
    .onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === 'enter') {
        const paths = payload.paths || [];
        const firstPath = paths[0] || '';
        const baseName = firstPath.split(/[\\/]/).pop() || '';
        const hint =
          paths.length > 1 ? `${baseName} (+${paths.length - 1} file)` : baseName;
        setFileDragHoverMode(true, hint);
      } else if (payload.type === 'over') {
        if (!appState.isFileDragHovering) {
          setFileDragHoverMode(true);
        }
      } else if (payload.type === 'leave') {
        setFileDragHoverMode(false);
      } else if (payload.type === 'drop') {
        setFileDragHoverMode(false);
        const paths = (payload.paths || []).filter(Boolean).slice(0, 12);
        if (paths.length > 0) {
          const docPaths: string[] = [];
          for (const droppedPath of paths) {
            const baseName = droppedPath.split(/[\\/]/).pop() || '';
            const lower = baseName.toLowerCase();
            if (lower.endsWith('.vrm') || lower.endsWith('.glb')) {
              continue;
            }
            markTauriDropped(baseName);
            docPaths.push(droppedPath);
          }
          if (docPaths.length > 0) {
            window.dispatchEvent(
              new CustomEvent('duck-smart-dropzone-open', { detail: { items: docPaths } })
            );
          }
        }
      }
    })
    .catch(() => { });

  window.addEventListener('mousemove', (e) => {
    if (appState.isFileDragHovering && domDragDepth === 0) {
      setFileDragHoverMode(false);
    }

    if (appState.state === 'DRAGGING') {
      if ((e.buttons & 1) === 0) {
        appState.triggerSquash(0.92, 1.08);
        appState.setState('FALLING');
        document.body.style.cursor = 'default';
        syncHitboxToRust(true);
        return;
      }

      const prevX = appState.posX;
      appState.posX = Math.max(50, Math.min(appState.W - 50, e.clientX - dragDeltaX));
      appState.posY = Math.max(75, Math.min(getDesktopFloorY(), e.clientY - dragDeltaY));

      const moveDx = appState.posX - prevX;
      appState.dragSway = THREE.MathUtils.clamp(
        appState.dragSway * 0.8 + moveDx * 0.035,
        -0.55,
        0.55
      );

      const now = performance.now();
      dragSamples.push({ x: e.clientX, y: e.clientY, t: now });
      while (dragSamples.length > 0 && now - dragSamples[0].t > 85) {
        dragSamples.shift();
      }

      syncHitboxToRust(true);
      return;
    }

    const headCenterY = appState.posY - 118 * appState.modelScale;
    const inHeadZone =
      Math.abs(e.clientX - appState.posX) < 48 * appState.modelScale &&
      Math.abs(e.clientY - headCenterY) < 45 * appState.modelScale;

    if (inHeadZone) {
      const now = performance.now();
      const dx = e.clientX - lastPatX;
      if (Math.abs(dx) > 5) {
        const dir = dx > 0 ? 1 : -1;
        if (dir !== lastPatDir) {
          if (now - lastPatTime < 900) {
            patStrokes++;
          } else {
            patStrokes = 1;
          }
          lastPatDir = dir;
          lastPatTime = now;
          if (patStrokes >= 3 && appState.state !== 'HEADPAT') {
            patStrokes = 0;
            triggerHeadpat();
          }
        }
        lastPatX = e.clientX;
      }
    }

    if (appState.blackHoleWarpMode) {
      document.body.style.cursor = 'crosshair';
      return;
    }

    if (isP2pDuelActive()) {
      appState.globalCursorX = e.clientX;
      appState.globalCursorY = e.clientY;
      if (!isInsideInteractiveUi(e.target)) {
        document.body.style.cursor = 'crosshair';
        return;
      }
    }

    if (!isInsideInteractiveUi(e.target) && checkMouseIntersect(e.clientX, e.clientY)) {
      document.body.style.cursor = 'grab';
    } else {
      document.body.style.cursor = 'default';
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (isInsideInteractiveUi(e.target)) return;

    if (appState.blackHoleWarpMode) {
      e.preventDefault();
      e.stopPropagation();
      appState.blackHoleWarpMode = false;
      document.body.style.cursor = 'default';
      void invoke('set_manual_interactive', { interactive: false }).catch(() => { });
      syncHitboxToRust(true);
      triggerBlackHoleTeleport(e.clientX, e.clientY);
      return;
    }

    if (isP2pDuelActive()) {
      e.preventDefault();
      appState.globalCursorX = e.clientX;
      appState.globalCursorY = e.clientY;
      performP2pSkill('laser', e.clientX, e.clientY);
      return;
    }

    if (checkMouseIntersect(e.clientX, e.clientY)) {
      appState.activeWindowTask = null;
      showParachute(false);
      clearLadder();
      appState.setState('DRAGGING');
      appState.setExpression('surprised', 2.2);
      appState.triggerSquash(0.86, 1.18);
      appState.attachedWindowHwnd = null;
      appState.velX = 0;
      appState.velY = 0;
      appState.dragSway = 0;
      dragDeltaX = e.clientX - appState.posX;
      dragDeltaY = e.clientY - appState.posY;
      pointerDownPos = { x: e.clientX, y: e.clientY };

      dragSamples.length = 0;
      dragSamples.push({ x: e.clientX, y: e.clientY, t: performance.now() });

      document.body.style.cursor = 'grabbing';
      speakMessage('Á á đang bị nhấc lên rồi! Hãy thử ném nhẹ tớ xem sao!');
      syncHitboxToRust(true);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (appState.state !== 'DRAGGING') return;

    const movedDist = Math.hypot(
      e.clientX - pointerDownPos.x,
      e.clientY - pointerDownPos.y
    );
    if (movedDist < 5) {
      appState.velX = 0;
      appState.velY = -7.5;
      appState.triggerSquash(1.22, 0.80);
      appState.setExpression('happy', 2.6);
      appState.setState('JUMPING');
      playHappyChirpSound(appState.posX);
      spawnParticles(appState.posX, appState.posY - 90, 8, 0x38bdf8);
      appState.changeMood(2);
      fireAnimationTrigger('event', 'duck_poke', 'enter');
      const reply = POKE_REPLIES[pokeReplyIdx % POKE_REPLIES.length];
      pokeReplyIdx++;
      speakMessage(reply);
    } else {
      const now = performance.now();
      const valid = dragSamples.filter((s) => now - s.t <= 85);
      if (valid.length >= 2) {
        const first = valid[0];
        const last = valid[valid.length - 1];
        const dtFrames = Math.max(1, (last.t - first.t) / 16.67);
        appState.velX = THREE.MathUtils.clamp((last.x - first.x) / dtFrames, -28, 28);
        appState.velY = THREE.MathUtils.clamp((last.y - first.y) / dtFrames, -28, 28);
      } else {
        appState.velX = 0;
        appState.velY = 0;
      }
      appState.triggerSquash(0.90, 1.12);
      appState.setState('FALLING');
      fireAnimationTrigger('event', 'duck_drag_end', 'enter');
    }

    document.body.style.cursor = 'grab';
    syncHitboxToRust(true);
  });

  const cancelStuckOverlayCapture = () => {
    domDragDepth = 0;
    if (appState.isFileDragHovering) {
      setFileDragHoverMode(false);
    }
    if (appState.state === 'DRAGGING') {
      appState.velX = 0;
      appState.velY = 0;
      appState.setState('FALLING');
      document.body.style.cursor = 'default';
      syncHitboxToRust(true);
    }
  };
  window.addEventListener('blur', cancelStuckOverlayCapture);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelStuckOverlayCapture();
  });

  window.addEventListener('dblclick', (e) => {
    if (isInsideInteractiveUi(e.target)) return;
    if (checkMouseIntersect(e.clientX, e.clientY)) {
      toggleBubbleVisibility();
    }
  });

  let lastAttachedWinPos: { hwnd: number; x: number; y: number } | null = null;
  let lastSeenBeatSeq = -1;

  const scheduleDesktopStatePoll = () => {
    const isBusyTracking =
      appState.attachedWindowHwnd !== null ||
      appState.activeWindowTask !== null ||
      appState.state === 'DRAGGING' ||
      appState.state === 'PUSHING' ||
      appState.state === 'PULLING' ||
      appState.state === 'CLIMBING' ||
      appState.state === 'FLYING_ROCKET' ||
      appState.state === 'PARACHUTING' ||
      appState.state === 'SWINGING_WINDOW';
    const isMusicActive =
      appState.audioVisualizer3dEnabled && appState.systemAudioPeak > 0.028;
    const nextDelay = document.hidden
      ? 1000
      : isBusyTracking || isMusicActive
        ? 55
        : appState.ecoMode
          ? 180
          : 100;
    window.setTimeout(() => {
      void pollDesktopStateOnce(isBusyTracking);
    }, nextDelay);
  };

  async function pollDesktopStateOnce(fastWindowScan = false) {
    if (document.hidden) {
      scheduleDesktopStatePoll();
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    try {
      const res = await invoke<DesktopState>('get_desktop_state', {
        fastWindowScan,
      });
      appState.globalCursorX = res.cursor_x;
      appState.globalCursorY = res.cursor_y;
      appState.systemAudioPeak = res.audio_peak ?? 0;
      appState.systemAudioLeft = res.audio_left ?? appState.systemAudioPeak;
      appState.systemAudioRight = res.audio_right ?? appState.systemAudioPeak;
      appState.systemAudioBpm = res.audio_bpm ?? 0;
      if (typeof res.audio_beat_seq === 'number') {
        if (lastSeenBeatSeq !== -1 && res.audio_beat_seq !== lastSeenBeatSeq) {
          appState.systemAudioBeatSeq = res.audio_beat_seq;
          appState.audioBeatPulse = 1.0;
        }
        lastSeenBeatSeq = res.audio_beat_seq;
      }
      appState.keyPressTotal = res.key_press_total ?? 0;
      appState.cursorIdleMs = res.cursor_idle_ms ?? 0;
      appState.activeWindowHwnd = res.active_hwnd > 0 ? res.active_hwnd : null;

      appState.openWindows = res.windows.map((w) => ({
        ...w,
        x: w.x / dpr,
        y: w.y / dpr,
        width: w.width / dpr,
        height: w.height / dpr,
      }));

      if (appState.attachedWindowHwnd !== null) {
        const targetWin = appState.openWindows.find(
          (w) => w.hwnd === appState.attachedWindowHwnd
        );
        const actualLedgeY = targetWin ? targetWin.y + appState.attachedLedgeOffsetY : 0;
        const topEdgeInvalid =
          targetWin &&
          appState.attachedLedgeOffsetY === 0 &&
          (targetWin.is_maximized ||
            actualLedgeY < 42 ||
            (targetWin.x <= 10 && targetWin.width >= appState.W - 60));

        if (!targetWin || topEdgeInvalid) {
          // Cửa sổ bị đóng, thu nhỏ, hoặc mép ngoài bị phóng to sát trần
          const leavingHwnd = appState.attachedWindowHwnd;
          appState.attachedWindowHwnd = null;
          appState.attachedLedgeOffsetY = 0;
          lastAttachedWinPos = null;
          appState.setState('FALLING');
          appState.setExpression('surprised', 2.8);
          spawnParticles(appState.posX, appState.posY - 35, 10, 0xf87171);
          if (leavingHwnd) setIgnoreWindowCollision(leavingHwnd, 1.5);
          speakMessage('Cửa sổ thay đổi kích thước hoặc đóng mất rồi, tớ nhảy xuống mặt sàn nhé!');
        } else {
          const deltaX =
            lastAttachedWinPos && lastAttachedWinPos.hwnd === targetWin.hwnd
              ? targetWin.x - lastAttachedWinPos.x
              : 0;
          const deltaY =
            lastAttachedWinPos && lastAttachedWinPos.hwnd === targetWin.hwnd
              ? targetWin.y - lastAttachedWinPos.y
              : 0;
          lastAttachedWinPos = { hwnd: targetWin.hwnd, x: targetWin.x, y: targetWin.y };

          // XỬ LÝ MÔ PHỎNG VẬT LÝ NHƯ THẬT KHI KÉO CỬA SỔ:
          // 1. Khi người dùng kéo cửa sổ dịch xuống (deltaY > 1.5 hoặc mép cửa sổ tụt xuống dưới chân vịt):
          // Không ghim cứng chân vịt vào cửa sổ. Giá đỡ tụt xuống -> vịt lập tức rơi tự do theo trọng lực (FALLING),
          // và sẽ rơi thẳng xuống bề mặt cửa sổ đang bị kéo xuống đó!
          if (deltaY > 1.5 || actualLedgeY > appState.posY + 3) {
            appState.attachedWindowHwnd = null;
            appState.attachedLedgeOffsetY = 0;
            lastAttachedWinPos = null;
            appState.setState('FALLING');
            appState.setExpression('surprised', 1.8);
            // Vận tốc rơi ban đầu tự nhiên theo độ giật kéo cửa sổ
            appState.velY = Math.max(1.8, deltaY * 0.22);
            if (Math.abs(deltaX) > 1) {
              appState.velX = Math.max(-10, Math.min(10, deltaX * 0.35));
            }
            return;
          }

          // 2. Khi người dùng kéo cửa sổ dịch lên trên (deltaY < -1.5):
          // Bề mặt cửa sổ nâng đỡ và đẩy nhân vật lên
          if (deltaY < -1.5) {
            appState.posY = actualLedgeY;
            if (deltaY < -6) {
              appState.squashX = 0.92;
              appState.squashY = 1.1;
            }
          } else {
            appState.posY = actualLedgeY;
          }

          // 3. Khi kéo ngang: Di chuyển tự nhiên cùng cửa sổ theo ma sát bề mặt
          if (Math.abs(deltaX) > 0.5) {
            appState.posX += deltaX;
          }

          const leftLedge = targetWin.x;
          const rightLedge = targetWin.x + targetWin.width;

          // 4. Chỉ rơi xuống khỏi cửa sổ khi chân vịt ra khỏi phạm vi vật lý mép ngang (hết thanh ngang)
          if (appState.posX < leftLedge - 6 || appState.posX > rightLedge + 6) {
            const leavingHwnd = appState.attachedWindowHwnd;
            appState.attachedWindowHwnd = null;
            appState.attachedLedgeOffsetY = 0;
            lastAttachedWinPos = null;
            appState.velX =
              Math.abs(deltaX) > 2
                ? Math.max(-10, Math.min(10, deltaX * 0.45))
                : appState.walkDir * 3.2;
            appState.velY = 2.0;
            appState.setState('FALLING');
            appState.setExpression('surprised', 3.0);
            spawnParticles(appState.posX, appState.posY - 35, 12, 0xf87171);
            setIgnoreWindowCollision(leavingHwnd, 1.6);
            speakMessage(
              `Úi úi! Hết thanh ngang của "${targetWin.title.slice(0, 18)}" làm tớ hụt chân rơi xuống rồi!`
            );
            return;
          }

          appState.attachedOffsetX = appState.posX - targetWin.x;
          appState.attachedWinTitle = targetWin.title;
        }
      } else {
        lastAttachedWinPos = null;
      }
    } catch {
      // Bỏ qua khi chạy ngoài môi trường Tauri
    } finally {
      scheduleDesktopStatePoll();
    }
  }

  scheduleDesktopStatePoll();
}

