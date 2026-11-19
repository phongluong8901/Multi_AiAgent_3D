import { invoke } from '@tauri-apps/api/core';
import { appState } from '../core/state';
import { WinRect } from '../core/types';
import { spawnFrameHighlight, spawnParticles } from '../core/particles';

let speakCb: ((msg: string) => void) | null = null;

export function registerWindowSpeakCallback(cb: (msg: string) => void) {
  speakCb = cb;
}

function speak(msg: string) {
  if (speakCb) {
    speakCb(msg);
  }
}

export function findTargetWindow(): WinRect | null {
  // Ưu tiên 1: Cửa sổ đang Active (người dùng vừa click vào, ví dụ Chrome/VS Code)
  if (appState.activeWindowHwnd !== null) {
    const active = appState.openWindows.find(
      (w) => w.hwnd === appState.activeWindowHwnd
    );
    if (active) return active;
  }

  // Ưu tiên 2: Cửa sổ nhân vật đang ngồi lên
  if (appState.attachedWindowHwnd !== null) {
    const attached = appState.openWindows.find(
      (w) => w.hwnd === appState.attachedWindowHwnd
    );
    if (attached) return attached;
  }

  if (appState.openWindows.length === 0) return null;

  let best: WinRect | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const win of appState.openWindows) {
    const cx = win.x + win.width * 0.5;
    const cy = win.y + win.height * 0.5;
    const dx = Math.max(0, Math.abs(appState.posX - cx) - win.width * 0.5);
    const dy = Math.max(0, Math.abs(appState.posY - cy) - win.height * 0.5);
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = win;
    }
  }

  return best;
}

async function applyWin32WindowOp(
  hwnd: number,
  action: 'push' | 'resize_delta' | 'shrink' | 'expand' | 'minimize' | 'maximize' | 'restore',
  dx = 0,
  dy = 0
): Promise<WinRect | null> {
  const dpr = window.devicePixelRatio || 1;
  try {
    const updatedRaw = await invoke<WinRect>('interact_window', {
      hwnd,
      action,
      dx: Math.round(dx * dpr),
      dy: Math.round(dy * dpr),
    });

    const updated: WinRect = {
      ...updatedRaw,
      x: updatedRaw.x / dpr,
      y: updatedRaw.y / dpr,
      width: updatedRaw.width / dpr,
      height: updatedRaw.height / dpr,
    };

    const idx = appState.openWindows.findIndex((w) => w.hwnd === hwnd);
    if (idx !== -1) {
      appState.openWindows[idx] = updated;
    }
    return updated;
  } catch (err: unknown) {
    const msg = typeof err === 'string' ? err : String(err);
    speak(msg);
    return null;
  }
}

export function startPhysicalPush(
  dirX: -1 | 1,
  explicitHwnd?: number,
  steps = 10,
  silent = false
): boolean {
  const target =
    explicitHwnd !== undefined
      ? appState.openWindows.find((w) => w.hwnd === explicitHwnd) || null
      : findTargetWindow();

  if (!target) {
    if (!silent) speak('[THÔNG BÁO] Không tìm thấy cửa sổ nào đang mở để đẩy.');
    return false;
  }

  appState.attachedWindowHwnd = null;
  const side: 'left' | 'right' = dirX > 0 ? 'left' : 'right';
  const targetX = Math.max(
    32,
    Math.min(appState.W - 32, side === 'left' ? target.x - 24 : target.x + target.width + 24)
  );
  const targetY = Math.min(appState.H - 48, Math.max(180, target.y + target.height * 0.65));

  const dist = Math.hypot(targetX - appState.posX, targetY - appState.posY);
  const needsApproach = dist > 36;

  appState.velX = 0;
  appState.velY = 0;

  if (needsApproach) {
    appState.walkDir = targetX >= appState.posX ? 1 : -1;
    appState.setState(Math.abs(targetY - appState.posY) > 65 ? 'JUMPING' : 'WALKING');
  } else {
    appState.posX = targetX;
    appState.posY = targetY;
    appState.walkDir = dirX;
    appState.setState('PUSHING');
  }

  appState.activeWindowTask = {
    hwnd: target.hwnd,
    mode: 'push',
    phase: needsApproach ? 'approaching' : 'acting',
    targetX,
    targetY,
    dirX,
    stepsRemaining: steps,
    stepTimer: 0,
    side,
  };

  if (!silent) {
    const dirText = dirX > 0 ? 'sang phải' : 'sang trái';
    speak(`[ĐANG TỚI ĐẨY] Chờ chút, tớ đang chạy lại đẩy "${target.title.slice(0, 22)}" ${dirText}!`);
  }
  return true;
}

export function startPhysicalResize(
  mode: 'shrink' | 'expand',
  explicitHwnd?: number,
  steps = 8,
  silent = false
): boolean {
  const target =
    explicitHwnd !== undefined
      ? appState.openWindows.find((w) => w.hwnd === explicitHwnd) || null
      : findTargetWindow();

  if (!target) {
    if (!silent) speak('[THÔNG BÁO] Không tìm thấy cửa sổ nào để thay đổi kích thước.');
    return false;
  }

  appState.attachedWindowHwnd = null;
  const targetX = Math.min(appState.W - 36, target.x + target.width + 22);
  const targetY = Math.min(appState.H - 48, Math.max(180, target.y + target.height * 0.65));

  const dist = Math.hypot(targetX - appState.posX, targetY - appState.posY);
  const needsApproach = dist > 36;

  appState.velX = 0;
  appState.velY = 0;

  if (needsApproach) {
    appState.walkDir = targetX >= appState.posX ? 1 : -1;
    appState.setState(Math.abs(targetY - appState.posY) > 65 ? 'JUMPING' : 'WALKING');
  } else {
    appState.posX = targetX;
    appState.posY = targetY;
    appState.walkDir = -1;
    appState.setState(mode === 'expand' ? 'PULLING' : 'PUSHING');
  }

  appState.activeWindowTask = {
    hwnd: target.hwnd,
    mode,
    phase: needsApproach ? 'approaching' : 'acting',
    targetX,
    targetY,
    dirX: mode === 'expand' ? 1 : -1,
    stepsRemaining: steps,
    stepTimer: 0,
    side: 'right',
  };

  if (!silent) {
    if (mode === 'expand') {
      speak(`[ĐANG TỚI KÉO] Tớ đang chạy qua mép "${target.title.slice(0, 22)}" để kéo to ra!`);
    } else {
      speak(`[ĐANG TỚI ÉP] Tớ đang chạy qua mép "${target.title.slice(0, 22)}" để ép nhỏ lại!`);
    }
  }
  return true;
}

let taskInFlight = false;

export function stepActiveWindowTask(delta: number) {
  const task = appState.activeWindowTask;
  if (!task) return;

  if (task.phase === 'approaching') {
    const dx = task.targetX - appState.posX;
    const dy = task.targetY - appState.posY;
    const dist = Math.hypot(dx, dy);

    if (dist <= 16) {
      appState.posX = task.targetX;
      appState.posY = task.targetY;
      task.phase = 'acting';
      task.stepTimer = 0.065;
      appState.walkDir = task.mode === 'push' ? task.dirX : -1;
      appState.setState(task.mode === 'expand' ? 'PULLING' : 'PUSHING');
      spawnParticles(appState.posX, appState.posY - 30, 6, 0x38bdf8);
      return;
    }

    const moveSpeed = Math.max(360, dist * 3.8) * delta;
    const ratio = Math.min(1, moveSpeed / dist);
    appState.posX += dx * ratio;
    appState.posY += dy * ratio;
    appState.walkDir = dx >= 0 ? 1 : -1;
    return;
  }

  if (appState.state !== 'PUSHING' && appState.state !== 'PULLING') {
    appState.activeWindowTask = null;
    return;
  }

  task.stepTimer += delta;
  if (task.stepTimer < 0.065 || taskInFlight) {
    return;
  }
  task.stepTimer = 0;

  if (task.stepsRemaining <= 0) {
    appState.activeWindowTask = null;
    appState.setState('FALLING');
    return;
  }

  task.stepsRemaining--;
  taskInFlight = true;

  if (task.mode === 'push') {
    const stepDx = task.dirX * 14;
    void applyWin32WindowOp(task.hwnd, 'push', stepDx, 0).then((updated) => {
      taskInFlight = false;
      if (updated && appState.state === 'PUSHING') {
        appState.posX = task.side === 'left' ? updated.x - 22 : updated.x + updated.width + 22;
        spawnParticles(appState.posX, appState.posY - 55, 2, 0x818cf8);
      } else {
        appState.activeWindowTask = null;
        if (appState.state === 'PUSHING') appState.setState('FALLING');
      }
    });
  } else {
    const deltaPx = task.mode === 'expand' ? 20 : -20;
    void applyWin32WindowOp(task.hwnd, 'resize_delta', deltaPx, Math.round(deltaPx * 0.65)).then(
      (updated) => {
        taskInFlight = false;
        if (updated && (appState.state === 'PULLING' || appState.state === 'PUSHING')) {
          appState.posX = Math.min(appState.W - 36, updated.x + updated.width + 20);
          spawnParticles(appState.posX, appState.posY - 55, 2, 0x38bdf8);
        } else {
          appState.activeWindowTask = null;
          if (appState.state === 'PULLING' || appState.state === 'PUSHING') {
            appState.setState('FALLING');
          }
        }
      }
    );
  }
}

export async function performWindowAction(
  action: 'minimize' | 'maximize' | 'restore',
  explicitHwnd?: number,
  silent = false
): Promise<boolean> {
  const target =
    explicitHwnd !== undefined
      ? appState.openWindows.find((w) => w.hwnd === explicitHwnd) || null
      : findTargetWindow();

  if (!target) {
    if (!silent) speak('[THÔNG BÁO] Không tìm thấy cửa sổ nào đang mở để tương tác.');
    return false;
  }

  const updated = await applyWin32WindowOp(target.hwnd, action);
  if (!updated) {
    if (!silent) speak('[LỖI] Không thể thay đổi trạng thái cửa sổ này.');
    return false;
  }

  if (appState.attachedWindowHwnd === target.hwnd && action === 'minimize') {
    appState.attachedWindowHwnd = null;
    appState.setState('FALLING');
  }

  if (!silent) {
    spawnParticles(appState.posX, appState.posY - 80, 6, 0x38bdf8);
    if (action === 'minimize') {
      speak(`[HẠ CỬA SỔ] Đã thu gọn "${target.title.slice(0, 22)}" xuống Taskbar.`);
    }
  }
  return true;
}

export async function minimizeMultipleWindows() {
  const targets = appState.openWindows.slice(0, 4);
  if (targets.length === 0) {
    speak('[THÔNG BÁO] Màn hình đã gọn gàng, không còn cửa sổ nào.');
    return;
  }
  let count = 0;
  for (const w of targets) {
    const ok = await performWindowAction('minimize', w.hwnd, true);
    if (ok) count++;
  }
  appState.attachedWindowHwnd = null;
  appState.setState('FALLING');
  spawnParticles(appState.posX, appState.posY - 90, 12, 0x38bdf8);
  speak(`[DỌN MÀN HÌNH] Đã thu gọn ${count} cửa sổ xuống Taskbar cho bạn!`);
}

export async function arrangeDesktopWindows(
  layout: 'split_2' | 'grid' | 'cascade' | 'center'
): Promise<boolean> {
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  appState.attachedLedgeOffsetY = 0;

  try {
    const rawList = await invoke<WinRect[]>('arrange_desktop_windows', { layout });
    if (!rawList || rawList.length === 0) {
      speak('[THÔNG BÁO] Không tìm thấy cửa sổ ứng dụng nào đang mở để sắp xếp.');
      return false;
    }

    const dpr = window.devicePixelRatio || 1;
    const mapped = rawList.map((w) => ({
      ...w,
      x: w.x / dpr,
      y: w.y / dpr,
      width: w.width / dpr,
      height: w.height / dpr,
    }));

    mapped.forEach((win) => {
      spawnFrameHighlight(win.x, win.y, win.width, win.height);
      const idx = appState.openWindows.findIndex((item) => item.hwnd === win.hwnd);
      if (idx !== -1) {
        appState.openWindows[idx] = win;
      }
    });

    appState.velY = -10;
    appState.velX = 0;
    appState.setState('SCANNING');
    appState.setExpression('happy', 3.0);
    appState.changeEnergy(-4);
    appState.changeMood(5);
    spawnParticles(appState.posX, appState.posY - 90, 16, 0x38bdf8);

    const layoutNames: Record<typeof layout, string> = {
      split_2: 'Chia Đôi 2 App (50/50)',
      grid: 'Xếp Lưới Gọn Gàng',
      cascade: 'Xếp Tầng Cascade',
      center: 'Căn Giữa App Active',
    };
    speak(`[SẮP XẾP DESKTOP] Đã ${layoutNames[layout]} cho ${mapped.length} cửa sổ ứng dụng trên màn hình!`);
    return true;
  } catch (err) {
    speak(`[LỖI SẮP XẾP] ${String(err)}`);
    return false;
  }
}

let lastProximityCooldown = 0;

export function checkProximityWindowPush() {
  if (!appState.windowInteractEnabled || appState.activeWindowTask !== null) return;

  const now = performance.now();
  if (now - lastProximityCooldown < 6000) return;

  const isMovingHoriz =
    appState.state === 'WALKING' ||
    ((appState.state === 'FALLING' || appState.state === 'JUMPING') &&
      Math.abs(appState.velX) > 4.5);

  if (!isMovingHoriz) return;

  const rawDir = appState.state === 'WALKING' ? appState.walkDir : Math.sign(appState.velX);
  if (rawDir === 0) return;
  const moveDir: -1 | 1 = rawDir > 0 ? 1 : -1;

  const charCenterY = appState.posY - 55 * appState.modelScale;

  for (const win of appState.openWindows) {
    if (win.hwnd === appState.attachedWindowHwnd) continue;
    if (win.width >= appState.W - 40 && win.height >= appState.H - 80) continue;

    const withinVert = charCenterY >= win.y + 16 && charCenterY <= win.y + win.height - 10;
    if (!withinVert) continue;

    const hitLeftEdge =
      moveDir > 0 && appState.posX >= win.x - 24 && appState.posX <= win.x + 14;
    const hitRightEdge =
      moveDir < 0 &&
      appState.posX <= win.x + win.width + 24 &&
      appState.posX >= win.x + win.width - 14;

    if (hitLeftEdge || hitRightEdge) {
      lastProximityCooldown = now;
      startPhysicalPush(moveDir, win.hwnd, 6, true);
      break;
    }
  }
}
