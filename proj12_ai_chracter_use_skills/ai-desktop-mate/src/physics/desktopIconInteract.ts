import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { scene } from '../core/scene';
import { appState, getDesktopFloorY } from '../core/state';
import { fireAnimationTrigger } from '../core/animationBinder';
import {
  spawnDriftSmoke,
  spawnParticles,
  spawnScanEffect,
  spawnShockwave,
} from '../core/particles';
import { playJumpSound, playSuccessChimeSound } from '../core/soundFx';
import { isWaterPoolActive, triggerStopSwimming } from '../core/waterPool';

export interface DesktopIconItem {
  index: number;
  name: string;
  x: number;
  y: number;
}

export interface DesktopIconList {
  icons: DesktopIconItem[];
  spacing_x: number;
  spacing_y: number;
  auto_arrange: boolean;
}

interface ActiveIconDrag {
  icon: DesktopIconItem;
  phase: 'approaching' | 'grabbing' | 'dragging';
  startX: number;
  startY: number;
  destX: number;
  destY: number;
  curX: number;
  curY: number;
  dpr: number;
  timer: number;
  duration: number;
  comEmitTimer: number;
  particleTimer: number;
}

let speakCb: ((msg: string) => void) | null = null;
const savedOriginalPositions = new Map<string, { x: number; y: number }>();
let cachedIconList: DesktopIconList | null = null;
let activeDrag: ActiveIconDrag | null = null;
let isArrangingIcons = false;

let tetherGroup: THREE.Group | null = null;
let tetherLine: THREE.Line | null = null;
let ringGroup: THREE.Group | null = null;
let tetherPulse = 0;

export function registerDesktopIconSpeakCallback(cb: (msg: string) => void) {
  speakCb = cb;
}

function speak(msg: string) {
  if (speakCb) {
    speakCb(msg);
  }
}

export function isDesktopIconTaskActive(): boolean {
  return activeDrag !== null || isArrangingIcons;
}

function ensureTetherVisuals() {
  if (tetherGroup) return;

  tetherGroup = new THREE.Group();

  const lineGeo = new THREE.BufferGeometry();
  const positions = new Float32Array([0, 0, 10, 0, 0, 10]);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.92,
  });
  tetherLine = new THREE.Line(lineGeo, lineMat);
  tetherGroup.add(tetherLine);

  ringGroup = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(26, 32, 28);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);

  const discGeo = new THREE.CircleGeometry(24, 24);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);

  ringGroup.add(discMesh, ringMesh);
  tetherGroup.add(ringGroup);

  tetherGroup.visible = false;
  scene.add(tetherGroup);
}

function updateTetherVisuals(charX: number, charY: number, iconCenterX: number, iconCenterY: number, delta: number) {
  ensureTetherVisuals();
  if (!tetherGroup || !tetherLine || !ringGroup) return;

  tetherGroup.visible = true;
  tetherPulse += delta * 6.0;

  const posAttr = tetherLine.geometry.getAttribute('position') as THREE.BufferAttribute;
  posAttr.setXYZ(0, charX, -(charY - 45), 10);
  posAttr.setXYZ(1, iconCenterX, -iconCenterY, 10);
  posAttr.needsUpdate = true;

  ringGroup.position.set(iconCenterX, -iconCenterY, 10);
  ringGroup.rotation.z += delta * 2.8;
  const s = 1 + Math.sin(tetherPulse) * 0.1;
  ringGroup.scale.setScalar(s);
}

function hideTetherVisuals() {
  if (tetherGroup) {
    tetherGroup.visible = false;
  }
}

export async function fetchDesktopIcons(): Promise<DesktopIconList | null> {
  try {
    const res = await invoke<DesktopIconList>('list_desktop_icons');
    cachedIconList = res;
    if (res && res.icons) {
      for (const icon of res.icons) {
        if (icon.name && !savedOriginalPositions.has(icon.name)) {
          savedOriginalPositions.set(icon.name, { x: icon.x, y: icon.y });
        }
      }
    }
    return res;
  } catch (err) {
    console.warn('[WARN] list_desktop_icons failed:', err);
    return null;
  }
}

export function getCachedDesktopIcons(): DesktopIconItem[] {
  return cachedIconList?.icons || [];
}

function resolveIconMatch(icons: DesktopIconItem[], queryName?: string): DesktopIconItem | null {
  if (!icons.length) return null;
  const raw = (queryName || '').trim().toLowerCase();
  if (!raw || raw === 'random' || raw === 'ngẫu nhiên' || raw === 'bất kỳ') {
    // Chọn icon có vị trí hợp lệ trên màn hình
    const valid = icons.filter((i) => i.name.trim().length > 0);
    const pool = valid.length > 0 ? valid : icons;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let search = raw;
  if (search.includes('thùng rác') || search.includes('recycle')) search = 'recycle';
  else if (search.includes('máy tính') || search.includes('this pc') || search.includes('my computer')) search = 'this pc';
  else if (search.includes('mạng') || search.includes('network')) search = 'network';

  const compactSearch = search.replace(/\s+/g, '');
  const exact = icons.find((i) => i.name.toLowerCase() === search);
  if (exact) return exact;

  const partial = icons.find((i) => {
    const n = i.name.toLowerCase();
    return n.includes(search) || n.replace(/\s+/g, '').includes(compactSearch);
  });
  if (partial) return partial;

  return null;
}

export async function startDragDesktopIcon(
  queryName?: string,
  destScreenPos?: { x: number; y: number }
): Promise<boolean> {
  if (isArrangingIcons) {
    speak('[ICON DESKTOP] Đang sắp xếp toàn bộ icon, đợi tớ một xíu nhé!');
    return false;
  }

  if (isWaterPoolActive()) {
    triggerStopSwimming(false);
  }
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;

  const list = await fetchDesktopIcons();
  if (!list || !list.icons || list.icons.length === 0) {
    speak('[ICON DESKTOP] Không tìm thấy icon nào ngoài màn hình Desktop.');
    return false;
  }

  const matched = resolveIconMatch(list.icons, queryName);
  const icon = matched || list.icons[Math.floor(Math.random() * list.icons.length)];

  const dpr = window.devicePixelRatio || 1;
  const startX = icon.x / dpr;
  const startY = icon.y / dpr;

  let destX: number;
  let destY: number;
  if (destScreenPos) {
    destX = Math.max(80, Math.min(appState.W - 140, destScreenPos.x));
    destY = Math.max(80, Math.min(appState.H - 160, destScreenPos.y));
  } else {
    const goRight = startX < appState.W * 0.48;
    const shiftX = 280 + Math.random() * 180;
    destX = goRight
      ? Math.min(appState.W - 160, startX + shiftX)
      : Math.max(80, startX - shiftX);
    const minY = 90;
    const maxY = Math.max(200, appState.H - 180);
    destY = Math.max(minY, Math.min(maxY, startY + (Math.random() - 0.5) * 220));
    if (Math.hypot(destX - startX, destY - startY) < 240) {
      destX = startX < appState.W * 0.5 ? appState.W - 200 : 120;
    }
  }

  try {
    await invoke<boolean>('begin_desktop_icon_drag');
  } catch (err) {
    console.warn('[WARN] begin_desktop_icon_drag error:', err);
  }

  activeDrag = {
    icon,
    phase: 'approaching',
    startX,
    startY,
    destX,
    destY,
    curX: startX,
    curY: startY,
    dpr,
    timer: 0,
    duration: 2.2,
    comEmitTimer: 0,
    particleTimer: 0,
  };

  appState.velX = 0;
  appState.velY = 0;
  appState.walkDir = startX + 42 >= appState.posX ? 1 : -1;
  appState.setState(Math.abs(startY + 56 - appState.posY) > 65 ? 'JUMPING' : 'WALKING');
  playJumpSound(appState.posX);

  speak(`[ICON DESKTOP] Đang chạy lại ngoạm icon "${icon.name}" ngoài Desktop...`);
  return true;
}

function finalizeSingleIconDrag(drag: ActiveIconDrag) {
  const physX = Math.round(drag.destX * drag.dpr);
  const physY = Math.round(drag.destY * drag.dpr);
  const targetName = drag.icon.name;
  const idx = drag.icon.index;

  hideTetherVisuals();
  playSuccessChimeSound(appState.posX);
  spawnParticles(drag.destX + 36, drag.destY + 36, 16, 0x38bdf8);
  spawnShockwave(drag.destX + 36, drag.destY + 36, 0x34d399);

  appState.setState('FALLING');
  appState.setExpression('happy', 3.2);
  appState.changeMood(6);
  appState.changeEnergy(-3);

  void (async () => {
    try {
      await invoke('place_desktop_icon', { index: idx, x: physX, y: physY });
      await invoke('end_desktop_icon_drag');
    } catch (err) {
      console.warn('[WARN] finalize desktop icon drag failed:', err);
    }
    speak(
      `[HOÀN TẤT KÉO ICON] Đã kéo ứng dụng "${targetName}" tới vị trí mới (${Math.round(drag.destX)}, ${Math.round(drag.destY)})!`
    );
  })();
}

export function stepDesktopIconDrag(delta: number): boolean {
  if (!activeDrag) return false;
  const drag = activeDrag;

  if (drag.phase === 'approaching') {
    const targetCharX = drag.startX + 42;
    const targetCharY = drag.startY + 56;
    const dx = targetCharX - appState.posX;
    const dy = targetCharY - appState.posY;
    const dist = Math.hypot(dx, dy);

    if (dist <= 18) {
      appState.posX = targetCharX;
      appState.posY = targetCharY;
      drag.phase = 'grabbing';
      drag.timer = 0;

      appState.setState('PULLING');
      appState.walkDir = drag.destX >= drag.startX ? 1 : -1;
      spawnShockwave(drag.startX + 36, drag.startY + 36, 0x38bdf8);
      spawnParticles(drag.startX + 36, drag.startY + 36, 10, 0xfbbf24);
      playJumpSound(appState.posX);
      updateTetherVisuals(appState.posX, appState.posY, drag.startX + 36, drag.startY + 36, delta);
      speak(`[KÉO ICON DESKTOP] Đã ngoạm lấy icon "${drag.icon.name}"! Đang kéo đi trên màn hình Desktop...`);
      return true;
    }

    const stepDist = Math.max(420, dist * 3.8) * delta;
    const ratio = Math.min(1, stepDist / dist);
    appState.posX += dx * ratio;
    appState.posY += dy * ratio;
    appState.walkDir = dx >= 0 ? 1 : -1;
    appState.setState(Math.abs(dy) > 40 ? 'JUMPING' : 'WALKING');
    return true;
  }

  if (drag.phase === 'grabbing') {
    drag.timer += delta;
    updateTetherVisuals(appState.posX, appState.posY, drag.startX + 36, drag.startY + 36, delta);
    if (drag.timer >= 0.35) {
      drag.phase = 'dragging';
      drag.timer = 0;
      drag.comEmitTimer = 0.04;
    }
    return true;
  }

  // phase === 'dragging'
  drag.timer += delta;
  const rawT = Math.min(1, drag.timer / drag.duration);
  // Smoothstep easing for tactile acceleration & deceleration
  const t = rawT * rawT * (3 - 2 * rawT);

  drag.curX = drag.startX + (drag.destX - drag.startX) * t;
  drag.curY = drag.startY + (drag.destY - drag.startY) * t;

  const pullDirX = drag.destX >= drag.startX ? 1 : -1;
  appState.walkDir = pullDirX;
  appState.posX = Math.max(36, Math.min(appState.W - 36, drag.curX + pullDirX * 48));
  appState.posY = Math.max(85, Math.min(getDesktopFloorY(), drag.curY + 56));
  appState.setState('PULLING');

  const iconCenterX = drag.curX + 36;
  const iconCenterY = drag.curY + 36;
  updateTetherVisuals(appState.posX, appState.posY, iconCenterX, iconCenterY, delta);

  drag.comEmitTimer += delta;
  if (drag.comEmitTimer >= 0.032) {
    drag.comEmitTimer = 0;
    const physX = Math.round(drag.curX * drag.dpr);
    const physY = Math.round(drag.curY * drag.dpr);
    void invoke('move_desktop_icon', { index: drag.icon.index, x: physX, y: physY }).catch(() => { });
  }

  drag.particleTimer += delta;
  if (drag.particleTimer >= 0.08) {
    drag.particleTimer = 0;
    spawnParticles(iconCenterX, iconCenterY, 2, 0x38bdf8);
    spawnDriftSmoke(appState.posX, appState.posY, -pullDirX);
  }

  if (rawT >= 1) {
    const done = drag;
    activeDrag = null;
    finalizeSingleIconDrag(done);
  }

  return true;
}

export async function arrangeDesktopIcons(mode: 'circle' | 'grid' | 'restore'): Promise<boolean> {
  if (activeDrag || isArrangingIcons) {
    speak('[ICON DESKTOP] Vui lòng đợi thao tác kéo icon hiện tại xong đã nhé!');
    return false;
  }

  if (isWaterPoolActive()) {
    triggerStopSwimming(false);
  }
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;

  const list = await fetchDesktopIcons();
  if (!list || !list.icons || list.icons.length === 0) {
    speak('[ICON DESKTOP] Không tìm thấy icon nào ngoài màn hình Desktop để sắp xếp.');
    return false;
  }

  isArrangingIcons = true;
  fireAnimationTrigger('tool', 'desktop_icon', 'start');
  try {
    await invoke<boolean>('begin_desktop_icon_drag').catch(() => false);

    const dpr = window.devicePixelRatio || 1;
    const physW = Math.round((appState.W || window.innerWidth) * dpr);
    const physH = Math.round((appState.H || window.innerHeight) * dpr);
    const spacingX = Math.max(72, list.spacing_x || 80);
    const spacingY = Math.max(82, list.spacing_y || 96);

    const targets: Array<{ icon: DesktopIconItem; tx: number; ty: number }> = [];
    const maxRows = Math.max(2, Math.floor((physH - 110) / spacingY));

    if (mode === 'circle') {
      const cx = physW * 0.5 - 38;
      const cy = physH * 0.46 - 46;
      const radius = Math.min(physW, physH) * 0.30;
      const n = list.icons.length;
      list.icons.forEach((icon, i) => {
        const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
        targets.push({
          icon,
          tx: Math.round(cx + Math.cos(angle) * radius),
          ty: Math.round(cy + Math.sin(angle) * radius),
        });
      });
    } else if (mode === 'grid') {
      list.icons.forEach((icon, i) => {
        const col = Math.floor(i / maxRows);
        const row = i % maxRows;
        targets.push({
          icon,
          tx: Math.round(24 + col * spacingX),
          ty: Math.round(24 + row * spacingY),
        });
      });
    } else {
      // restore
      list.icons.forEach((icon, i) => {
        const saved = savedOriginalPositions.get(icon.name);
        if (saved) {
          targets.push({ icon, tx: saved.x, ty: saved.y });
        } else {
          const col = Math.floor(i / maxRows);
          const row = i % maxRows;
          targets.push({
            icon,
            tx: Math.round(24 + col * spacingX),
            ty: Math.round(24 + row * spacingY),
          });
        }
      });
    }

    const modeLabels: Record<typeof mode, string> = {
      circle: 'Xếp Vòng Tròn',
      grid: 'Xếp Lưới Gọn Gàng',
      restore: 'Trả Về Vị Trí Cũ',
    };
    speak(`[ICON DESKTOP] Đang ${modeLabels[mode]} cho ${targets.length} icon ngoài màn hình Desktop...`);

    appState.posX = appState.W * 0.5;
    appState.posY = appState.H * 0.5;
    appState.setState('SPIN');
    spawnScanEffect(appState.posX, appState.posY - 40);
    spawnShockwave(appState.posX, appState.posY - 20, 0x38bdf8);

    const steps = 18;
    for (let s = 1; s <= steps; s++) {
      const p = s / steps;
      const ease = p * p * (3 - 2 * p);
      for (const t of targets) {
        const cx = Math.round(t.icon.x + (t.tx - t.icon.x) * ease);
        const cy = Math.round(t.icon.y + (t.ty - t.icon.y) * ease);
        void invoke('move_desktop_icon', { index: t.icon.index, x: cx, y: cy }).catch(() => { });
      }
      if (s % 4 === 0) {
        spawnParticles(appState.posX, appState.posY - 50, 8, 0x38bdf8);
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    for (const t of targets) {
      await invoke('place_desktop_icon', { index: t.icon.index, x: t.tx, y: t.ty }).catch(() => { });
    }
    await invoke('end_desktop_icon_drag').catch(() => { });

    playSuccessChimeSound(appState.posX);
    spawnShockwave(appState.posX, appState.posY - 20, 0x34d399);
    appState.setState('FALLING');
    appState.setExpression('happy', 3.2);
    appState.changeMood(8);

    speak(`[HOÀN TẤT] Đã ${modeLabels[mode]} cho ${targets.length} ứng dụng ngoài Desktop!`);
    return true;
  } catch (err) {
    speak(`[LỖI ICON DESKTOP] ${String(err)}`);
    return false;
  } finally {
    isArrangingIcons = false;
  }
}

