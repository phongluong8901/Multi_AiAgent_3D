import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { appState } from '../core/state';
import { camera } from '../core/scene';
import { DragSample, DesktopState } from '../core/types';
import { spawnParticles, clearLadder, showParachute } from '../core/particles';
import {
  leftTelemetryPanel,
  rightActionPanel,
  speechBubble,
  companionDock,
  studioPanel,
  longMemoryPanel,
  fileInput,
  speakMessage,
  triggerHeadpat,
  toggleBubbleVisibility,
  syncHitboxToRust,
} from './ui';
import { loadVrmFromBuffer } from '../characters/vrmManager';

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

export function checkMouseIntersect(clientX: number, clientY: number): boolean {
  mouseNDC.x = (clientX / appState.W) * 2 - 1;
  mouseNDC.y = -(clientY / appState.H) * 2 + 1;
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
  return false;
}

async function handleFileSelect(file: File) {
  const buffer = await file.arrayBuffer();
  await loadVrmFromBuffer(buffer, file.name);
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F4') {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.vrm') || file.name.endsWith('.glb'))) {
      void handleFileSelect(file);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (appState.state === 'DRAGGING') {
      const prevX = appState.posX;
      appState.posX = e.clientX - dragDeltaX;
      appState.posY = e.clientY - dragDeltaY;

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

    if (!isInsideInteractiveUi(e.target) && checkMouseIntersect(e.clientX, e.clientY)) {
      document.body.style.cursor = 'grab';
    } else {
      document.body.style.cursor = 'default';
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (isInsideInteractiveUi(e.target)) return;

    if (checkMouseIntersect(e.clientX, e.clientY)) {
      appState.activeWindowTask = null;
      showParachute(false);
      clearLadder();
      appState.setState('DRAGGING');
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
      appState.velY = -9;
      appState.setState('JUMPING');
      spawnParticles(appState.posX, appState.posY - 90, 6, 0x38bdf8);
      appState.changeMood(2);
      speakMessage('Chọc vào tớ à? Cần gì hãy hỏi tớ nhé!');
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
      appState.setState('FALLING');
    }

    document.body.style.cursor = 'grab';
    syncHitboxToRust(true);
  });

  window.addEventListener('dblclick', (e) => {
    if (isInsideInteractiveUi(e.target)) return;
    if (checkMouseIntersect(e.clientX, e.clientY)) {
      toggleBubbleVisibility();
    }
  });

  setInterval(async () => {
    const dpr = window.devicePixelRatio || 1;
    try {
      const res = await invoke<DesktopState>('get_desktop_state');
      appState.globalCursorX = res.cursor_x / dpr;
      appState.globalCursorY = res.cursor_y / dpr;
      appState.activeWindowHwnd = res.active_hwnd > 0 ? res.active_hwnd : null;

      appState.openWindows = res.windows.map((w) => ({
        ...w,
        x: w.x / dpr,
        y: w.y / dpr,
        width: w.width / dpr,
        height: w.height / dpr,
      }));

      if (
        appState.state === 'SITTING_WINDOW' &&
        appState.attachedWindowHwnd !== null
      ) {
        const targetWin = appState.openWindows.find(
          (w) => w.hwnd === appState.attachedWindowHwnd
        );
        if (targetWin) {
          appState.posX = targetWin.x + appState.attachedOffsetX;
          appState.posY = targetWin.y + appState.attachedLedgeOffsetY;
          appState.attachedWinTitle = targetWin.title;
        } else {
          appState.attachedWindowHwnd = null;
          appState.setState('FALLING');
          speakMessage('Cửa sổ vừa bị đóng. Tớ đang nhảy xuống đây!');
        }
      }
    } catch {
      // Bỏ qua khi chạy ngoài môi trường Tauri
    }
  }, 100);
}

