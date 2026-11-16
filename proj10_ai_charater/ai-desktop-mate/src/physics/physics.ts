import { invoke } from '@tauri-apps/api/core';
import { appState } from '../core/state';
import { FrameZone } from '../core/types';
import {
  clearFoodItem,
  clearLadder,
  showParachute,
  spawnFoodItem,
  spawnFrameHighlight,
  spawnLadder,
  spawnParticles,
  spawnScanEffect,
  spawnShockwave,
} from '../core/particles';
import {
  checkProximityWindowPush,
  findTargetWindow,
  startPhysicalPush,
  startPhysicalResize,
  stepActiveWindowTask,
} from './windowInteract';

let uiSpeakCallback: ((msg: string) => void) | null = null;
let foodTimer = 0;
let frameZoneIdx = 0;

export function registerPhysicsSpeakCallback(cb: (msg: string) => void) {
  uiSpeakCallback = cb;
}

function speak(msg: string) {
  if (uiSpeakCallback) {
    uiSpeakCallback(msg);
  }
}

export function triggerSpawnRandomFood(announce = true) {
  const minX = 110;
  const maxX = Math.max(minX + 40, appState.W - 110);
  let foodX = minX + Math.random() * (maxX - minX);
  let foodY = Math.max(150, Math.min(appState.H - 60, 150 + Math.random() * (appState.H - 210)));

  if (appState.openWindows.length > 0 && Math.random() < 0.45) {
    const w = appState.openWindows[Math.floor(Math.random() * appState.openWindows.length)];
    const innerMinX = Math.max(minX, w.x + 50);
    const innerMaxX = Math.min(maxX, Math.max(innerMinX + 20, w.x + w.width - 50));
    foodX = innerMinX + Math.random() * (innerMaxX - innerMinX);
    foodY = Math.random() < 0.5 ? Math.max(120, w.y) : Math.min(appState.H - 60, w.y + w.height * 0.45);
  }

  spawnFoodItem(foodX, foodY);
  if (announce) {
    speak('Ồ! Đồ ăn vừa xuất hiện trên màn hình kìa, để tớ nhảy & leo lên lấy nhé!');
  }
}

function consumeFoodNow() {
  clearFoodItem();
  appState.velX = 0;
  appState.velY = 0;
  appState.setState('EATING');
  appState.setExpression('happy', 3.5);
  appState.changeHunger(38);
  appState.changeEnergy(32);
  appState.changeMood(10);
  spawnParticles(appState.posX, appState.posY - 90, 14, 0xfbbf24);
  speak('Măm măm! Leo trèo vất vả mới lấy được miếng bánh, ngon tuyệt cú mèo!');
}

function launchJumpToTarget(targetX: number, targetY: number) {
  appState.attachedWindowHwnd = null;
  appState.attachedLedgeOffsetY = 0;
  appState.attachedZoneLabel = '';
  const flightFrames = 34;
  appState.velX = Math.max(-22, Math.min(22, (targetX - appState.posX) / flightFrames));
  appState.velY = Math.min(
    -11,
    Math.max(
      -29,
      (targetY - appState.posY - 0.5 * appState.gravity * flightFrames * flightFrames) / flightFrames
    )
  );
  appState.squashX = 0.86;
  appState.squashY = 1.18;
  appState.setState('JUMPING');
  spawnParticles(appState.posX, appState.posY - 10, 6, 0x38bdf8);
  spawnShockwave(appState.posX, appState.posY, 0x38bdf8);
}

export async function triggerExploreInsideWindow() {
  const target = findTargetWindow();
  if (!target) {
    speak('Hãy click vào Chrome, VS Code hoặc Folder trước rồi tớ quét khung cho nhé!');
    return;
  }

  try {
    const rawZones = await invoke<FrameZone[]>('scan_window_frames', {
      hwnd: target.hwnd,
    });
    if (!rawZones || rawZones.length === 0) {
      speak('Không quét được khung bên trong cửa sổ này!');
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const raw = rawZones[frameZoneIdx % rawZones.length];
    frameZoneIdx = (frameZoneIdx + 1) % rawZones.length;

    const zone: FrameZone = {
      label: raw.label,
      x: raw.x / dpr,
      y: raw.y / dpr,
      width: raw.width / dpr,
      height: raw.height / dpr,
      ledge_offset_y: raw.ledge_offset_y / dpr,
    };

    appState.activeWindowTask = null;
    appState.attachedWindowHwnd = target.hwnd;
    appState.attachedWinTitle = target.title;
    appState.attachedZoneLabel = zone.label;
    appState.attachedLedgeOffsetY = zone.ledge_offset_y;
    appState.posX = zone.x + zone.width * 0.5;
    appState.posY = target.y + zone.ledge_offset_y;
    appState.attachedOffsetX = appState.posX - target.x;
    appState.velX = 0;
    appState.velY = 0;

    spawnFrameHighlight(zone.x, zone.y, zone.width, zone.height);
    spawnScanEffect(appState.posX, appState.posY);
    appState.setState('SCANNING');
    appState.setExpression('happy', 2.8);
    appState.changeEnergy(-3);
    speak(`Đã quét & nhảy vào [${zone.label}] của "${target.title.slice(0, 22)}"!`);
  } catch (err) {
    speak(`[LỖI QUÉT KHUNG] ${String(err)}`);
  }
}

export async function triggerInteractInsideWindow() {
  const target = findTargetWindow();
  if (!target) {
    speak('Chưa phát hiện cửa sổ nào đang active để tác động!');
    return;
  }

  const proc = (target.process_name ?? '').toLowerCase();
  const titleLower = target.title.toLowerCase();
  let action: 'vs_terminal' | 'next_tab' | 'refresh' | 'scroll_down' = 'scroll_down';

  if (proc === 'code.exe' || titleLower.includes('visual studio code')) {
    action = 'vs_terminal';
  } else if (
    proc === 'chrome.exe' ||
    proc === 'msedge.exe' ||
    titleLower.includes('chrome') ||
    titleLower.includes('edge')
  ) {
    action = 'next_tab';
  } else if (proc === 'explorer.exe') {
    action = 'refresh';
  }

  spawnFrameHighlight(target.x, target.y, target.width, target.height);
  spawnScanEffect(appState.posX, appState.posY);

  try {
    const res = await invoke<string>('trigger_app_hotkey', {
      hwnd: target.hwnd,
      action,
    });
    appState.setState('WAVING');
    appState.setExpression('happy', 2.5);
    speak(`[${target.title.slice(0, 18)}] ${res}!`);
  } catch (err) {
    speak(`[LỖI TÁC ĐỘNG] ${String(err)}`);
  }
}

export function triggerJumpToWindow() {
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  appState.changeEnergy(-7);
  appState.changeHunger(-4);
  const candidates = appState.openWindows.filter(
    (w) => w.y > 120 && w.y < appState.H - 110 && w.width > 240
  );

  if (candidates.length === 0) {
    appState.velX = (Math.random() - 0.5) * 10;
    appState.velY = -16;
    appState.setState('JUMPING');
    spawnParticles(appState.posX, appState.posY - 10, 6, 0x38bdf8);
    speak('Không thấy cửa sổ nào thuận tiện, tớ nhảy tại chỗ đây!');
    return;
  }

  const activeWin = candidates.find((w) => w.hwnd === appState.activeWindowHwnd);
  const targetWin =
    activeWin ?? candidates[Math.floor(Math.random() * candidates.length)];
  const targetX = targetWin.x + Math.min(targetWin.width - 60, Math.max(60, targetWin.width * 0.5));
  const targetY = targetWin.y;

  const flightFrames = 38;
  appState.velX = (targetX - appState.posX) / flightFrames;
  appState.velY =
    (targetY - appState.posY - 0.5 * appState.gravity * flightFrames * flightFrames) / flightFrames;
  appState.velY = Math.min(-10, Math.max(-28, appState.velY));
  appState.velX = Math.max(-24, Math.min(24, appState.velX));

  appState.squashX = 0.86;
  appState.squashY = 1.18;
  appState.setState('JUMPING');
  spawnParticles(appState.posX, appState.posY - 10, 8, 0x818cf8);
  spawnShockwave(appState.posX, appState.posY, 0x818cf8);
  speak(`Chuẩn bị nhảy lên mép "${targetWin.title.slice(0, 24)}"!`);
}

export function stepPhysicsAndRoam(delta: number) {
  appState.stateTimer += delta;
  if (appState.speechLipSyncTimer > 0) {
    appState.speechLipSyncTimer = Math.max(0, appState.speechLipSyncTimer - delta);
  }
  if (appState.expressionTimer > 0) {
    appState.expressionTimer = Math.max(0, appState.expressionTimer - delta);
    if (appState.expressionTimer === 0) {
      appState.expressionMood = 'neutral';
    }
  }

  const floorY = appState.H - 48;
  const wallLeft = 50;
  const wallRight = appState.W - 50;

  if (appState.activeWindowTask !== null) {
    stepActiveWindowTask(delta);
    return;
  }

  if (appState.state === 'DRAGGING') {
    showParachute(false);
    clearLadder();
  }

  if (
    (appState.state === 'DANCING' ||
      appState.state === 'WAVING' ||
      appState.state === 'HEADPAT' ||
      appState.state === 'SCANNING' ||
      appState.state === 'ALERT') &&
    appState.stateTimer > 3.6
  ) {
    appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
  } else if (appState.state === 'EATING' && appState.stateTimer > 2.4) {
    if (appState.attachedWindowHwnd === null && appState.posY < floorY - 80) {
      showParachute(true);
      appState.velY = 2.0;
      appState.velX = 0;
      appState.setState('PARACHUTING');
      speak('Ăn no rồi, bung dù lượn xuống thôi!');
    } else if (appState.attachedWindowHwnd === null && appState.posY < floorY - 5) {
      appState.setState('FALLING');
    } else {
      appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    }
  } else if ((appState.state === 'BACKFLIP' || appState.state === 'SPIN') && appState.stateTimer > 1.55) {
    appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
  } else if (appState.state === 'TIRED' && (appState.energy >= 65 || appState.stateTimer > 8)) {
    appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    speak('Đã nghỉ khỏe lại rồi, tiếp tục chiến đấu thôi!');
  }

  // Cập nhật các thanh hoạt động (Năng lượng & Độ no) theo trạng thái
  if (appState.state === 'WALKING' || appState.state === 'PUSHING' || appState.state === 'PULLING') {
    appState.changeEnergy(-2.2 * delta);
    appState.changeHunger(-1.5 * delta);
  } else if (appState.state === 'JUMPING' || appState.state === 'DANCING') {
    appState.changeEnergy(-5.0 * delta);
    appState.changeHunger(-2.8 * delta);
  } else if (appState.state === 'SITTING_WINDOW' || appState.state === 'TIRED') {
    appState.changeEnergy(4.8 * delta);
    appState.changeHunger(-0.3 * delta);
  } else if (appState.state === 'IDLE') {
    appState.changeEnergy(1.6 * delta);
    appState.changeHunger(-0.4 * delta);
  }

  // Quá mệt khi đi bộ -> ngồi nghỉ và tìm đồ ăn nếu cần
  if (appState.energy <= 18 && appState.state === 'WALKING') {
    appState.setState('TIRED');
    appState.setExpression('sad', 4.0);
    speak('Phù... đi chạy nhảy nhiều mệt quá! Tớ ngồi nghỉ hoặc kiếm gì ăn chút nhé.');
    if (!appState.foodTarget) {
      triggerSpawnRandomFood(false);
    }
  }

  // Tự động rơi đồ ăn ngẫu nhiên trên màn hình khi đói hoặc định kỳ
  if (!appState.foodTarget) {
    foodTimer += delta;
    if ((appState.hunger < 45 && foodTimer > 12) || foodTimer > 55) {
      foodTimer = 0;
      triggerSpawnRandomFood(true);
    }
  }

  // Hiệu ứng hạt theo trạng thái đặc biệt
  if (appState.state === 'DANCING' && Math.random() < delta * 6) {
    const colors = [0xf472b6, 0x38bdf8, 0xfbbf24, 0x34d399];
    spawnParticles(
      appState.posX,
      appState.posY - 110,
      1,
      colors[Math.floor(Math.random() * colors.length)]
    );
  } else if (appState.state === 'SCANNING' && Math.random() < delta * 5) {
    spawnParticles(appState.posX, appState.posY - 105, 1, 0x38bdf8);
  } else if (appState.state === 'ALERT' && Math.random() < delta * 7) {
    spawnParticles(appState.posX, appState.posY - 115, 1, 0xf87171);
  } else if (appState.state === 'EATING' && Math.random() < delta * 6) {
    spawnParticles(appState.posX, appState.posY - 95, 1, 0xfbbf24);
  } else if (appState.state === 'TIRED' && Math.random() < delta * 2.5) {
    spawnParticles(appState.posX, appState.posY - 115, 1, 0x60a5fa);
  }

  // Chạm & ăn đồ ăn ngay cả khi đang nhảy / rơi / leo / đi bộ
  if (appState.foodTarget && appState.state !== 'DRAGGING' && appState.state !== 'EATING') {
    const dx = appState.foodTarget.x - appState.posX;
    const dy = appState.foodTarget.y - appState.posY;
    if (Math.hypot(dx, dy) < 48) {
      consumeFoodNow();
      return;
    }
  }

  // Tự leo trèo, bắc thang 3D, nhảy parkour & tìm tới đồ ăn xuất hiện ngẫu nhiên trên màn hình
  if (
    appState.foodTarget &&
    appState.state !== 'DRAGGING' &&
    appState.state !== 'FALLING' &&
    appState.state !== 'JUMPING' &&
    appState.state !== 'EATING' &&
    appState.state !== 'PARACHUTING'
  ) {
    const dx = appState.foodTarget.x - appState.posX;
    const dy = appState.foodTarget.y - appState.posY;

    if (appState.state === 'CLIMBING') {
      appState.changeEnergy(-2.8 * delta);
      appState.posX += Math.sign(dx) * Math.min(Math.abs(dx), 2.2);
      appState.posY += Math.sign(dy) * Math.min(Math.abs(dy), 3.6);
      if (Math.random() < delta * 6) {
        spawnParticles(appState.posX, appState.posY - 40, 1, 0x93c5fd);
      }
      return;
    }

    if (dy > 55 && appState.attachedWindowHwnd !== null) {
      appState.attachedWindowHwnd = null;
      appState.attachedLedgeOffsetY = 0;
      appState.velX = Math.max(-8, Math.min(8, Math.sign(dx) * 5));
      appState.velY = -5;
      appState.setState('FALLING');
      return;
    }

    if (dy < -55) {
      if (Math.abs(dx) > 140) {
        appState.walkDir = dx >= 0 ? 1 : -1;
        appState.setState('WALKING');
        appState.posX += appState.walkDir * 2.6;
        appState.posX = Math.max(wallLeft, Math.min(wallRight, appState.posX));
        return;
      }
      if (dy >= -160) {
        launchJumpToTarget(appState.foodTarget.x, appState.foodTarget.y);
        return;
      }
      if (Math.abs(dx) > 35) {
        appState.walkDir = dx >= 0 ? 1 : -1;
        appState.setState('WALKING');
        appState.posX += appState.walkDir * 2.6;
        appState.posX = Math.max(wallLeft, Math.min(wallRight, appState.posX));
        return;
      }
      appState.attachedWindowHwnd = null;
      appState.attachedLedgeOffsetY = 0;
      spawnLadder(appState.posX, appState.posY, appState.foodTarget.y);
      appState.setState('CLIMBING');
      speak('Không có chỗ bám, để tớ tự bắc thang trèo lên lấy đồ ăn nhé!');
      return;
    }

    appState.walkDir = dx >= 0 ? 1 : -1;
    appState.setState('WALKING');
    appState.posX += appState.walkDir * 2.6;
    appState.posX = Math.max(wallLeft, Math.min(wallRight, appState.posX));
    appState.posY += Math.sign(dy) * Math.min(Math.abs(dy), 1.8);
    return;
  }

  checkProximityWindowPush();

  if (appState.state === 'PARACHUTING') {
    const prevY = appState.posY;
    appState.posY += 2.1;
    appState.posX += Math.sin(performance.now() * 0.003) * 1.3;
    appState.posX = Math.max(wallLeft, Math.min(wallRight, appState.posX));
    if (Math.random() < delta * 4) {
      spawnParticles(appState.posX, appState.posY - 150, 1, 0xf472b6);
    }
    for (const win of appState.openWindows) {
      const withinX =
        appState.posX >= win.x + 24 && appState.posX <= win.x + win.width - 24;
      const crossedTop = prevY <= win.y + 10 && appState.posY >= win.y - 4;
      if (withinX && crossedTop) {
        showParachute(false);
        appState.posY = win.y;
        appState.attachedWindowHwnd = win.hwnd;
        appState.attachedOffsetX = appState.posX - win.x;
        appState.attachedLedgeOffsetY = 0;
        appState.attachedWinTitle = win.title;
        spawnShockwave(appState.posX, win.y, 0xf472b6);
        appState.setState('SITTING_WINDOW');
        speak(`Đã đáp dù an toàn lên "${win.title.slice(0, 22)}"!`);
        return;
      }
    }
    if (appState.posY >= floorY) {
      showParachute(false);
      appState.posY = floorY;
      spawnShockwave(appState.posX, floorY, 0xf472b6);
      appState.setState('IDLE');
      speak('Đã đáp dù xuống đất êm ru!');
    }
    return;
  }

  if (appState.state === 'FALLING' || appState.state === 'JUMPING') {
    const prevY = appState.posY;
    // Đuôi hạt lấp lánh khi bay nhanh
    if (Math.hypot(appState.velX, appState.velY) > 10 && Math.random() < 0.45) {
      spawnParticles(appState.posX, appState.posY - 70, 1, 0xa78bfa);
    }
    velUpdate: {
      appState.velY += appState.gravity;
      appState.posX += appState.velX;
      appState.posY += appState.velY;
      appState.velX *= 0.992;

      if (appState.posX < wallLeft) {
        appState.posX = wallLeft;
        appState.velX = Math.abs(appState.velX) * appState.bounceFactor;
      } else if (appState.posX > wallRight) {
        appState.posX = wallRight;
        appState.velX = -Math.abs(appState.velX) * appState.bounceFactor;
      }

      if (appState.velY > 0) {
        for (const win of appState.openWindows) {
          const withinX =
            appState.posX >= win.x + 24 && appState.posX <= win.x + win.width - 24;
          const crossedTop = prevY <= win.y + 14 && appState.posY >= win.y - 8;
          if (withinX && crossedTop) {
            appState.posY = win.y;
            appState.velX = 0;
            appState.velY = 0;
            appState.attachedWindowHwnd = win.hwnd;
            appState.attachedOffsetX = appState.posX - win.x;
            appState.attachedLedgeOffsetY = 0;
            appState.attachedWinTitle = win.title;
            appState.attachedZoneLabel = '';
            appState.squashX = 1.18;
            appState.squashY = 0.84;
            spawnShockwave(appState.posX, win.y, 0x38bdf8);
            appState.setState('SITTING_WINDOW');
            speak(`Đang ngồi nghỉ trên: ${appState.attachedWinTitle.slice(0, 26)}`);
            break velUpdate;
          }
        }
      }

      if (appState.posY >= floorY) {
        appState.posY = floorY;
        if (Math.abs(appState.velY) > 6.5 && appState.bounceFactor > 0.1) {
          appState.squashX = 1.2;
          appState.squashY = 0.82;
          spawnShockwave(appState.posX, floorY, 0x38bdf8);
          appState.velY = -appState.velY * appState.bounceFactor;
          appState.velX *= 0.72;
        } else {
          if (Math.abs(appState.velY) > 3.0) {
            appState.squashX = 1.14;
            appState.squashY = 0.88;
            spawnShockwave(appState.posX, floorY, 0x38bdf8);
          }
          appState.velY = 0;
          appState.velX = 0;
          appState.setState('IDLE');
        }
      }
    }
  } else if (appState.state === 'WALKING') {
    const speed = 1.65;
    appState.posX += appState.walkDir * speed;

    if (appState.attachedWindowHwnd !== null) {
      const targetWin = appState.openWindows.find(
        (w) => w.hwnd === appState.attachedWindowHwnd
      );
      if (targetWin) {
        const minX = targetWin.x + 28;
        const maxX = targetWin.x + targetWin.width - 28;
        if (appState.posX <= minX) {
          appState.posX = minX;
          appState.walkDir = 1;
        } else if (appState.posX >= maxX) {
          appState.posX = maxX;
          appState.walkDir = -1;
        }
        appState.attachedOffsetX = appState.posX - targetWin.x;
        appState.posY = targetWin.y + appState.attachedLedgeOffsetY;
      } else {
        appState.attachedWindowHwnd = null;
        appState.setState('FALLING');
      }
    } else {
      if (appState.posX <= wallLeft) {
        appState.posX = wallLeft;
        appState.walkDir = 1;
      } else if (appState.posX >= wallRight) {
        appState.posX = wallRight;
        appState.walkDir = -1;
      }
    }

    if (appState.stateTimer > 4.5) {
      appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    }
  } else if (
    appState.autoRoamEnabled &&
    (appState.state === 'IDLE' || appState.state === 'SITTING_WINDOW')
  ) {
    if (appState.stateTimer > appState.nextRoamDuration) {
      appState.nextRoamDuration = 6 + Math.random() * 6;
      const roll = Math.random();
      if (roll < 0.38) {
        appState.walkDir = Math.random() < 0.5 ? -1 : 1;
        appState.setState('WALKING');
      } else if (roll < 0.62 && appState.openWindows.length > 0) {
        triggerJumpToWindow();
      } else if (
        roll < 0.76 &&
        appState.windowInteractEnabled &&
        appState.openWindows.length > 0
      ) {
        // Thỉnh thoảng tự nghịch đẩy nhẹ hoặc kéo cửa sổ
        const actionRoll = Math.random();
        if (actionRoll < 0.65) {
          startPhysicalPush(Math.random() < 0.5 ? -1 : 1, undefined, 6, true);
        } else {
          startPhysicalResize(Math.random() < 0.5 ? 'shrink' : 'expand', undefined, 5, true);
        }
      } else if (roll < 0.9) {
        appState.setState('WAVING');
      } else {
        appState.stateTimer = 0;
      }
    }
  }
}

export function triggerBackflip() {
  appState.activeWindowTask = null;
  appState.velX = 0;
  appState.velY = 0;
  appState.squashX = 0.88;
  appState.squashY = 1.15;
  appState.setState('BACKFLIP');
  appState.setExpression('happy', 2.4);
  appState.changeEnergy(-4);
  appState.changeMood(6);
  spawnParticles(appState.posX, appState.posY - 80, 14, 0x76b900);
  spawnShockwave(appState.posX, appState.posY, 0x76b900);
  if (appState.builtinModelType === 'microduck' && !appState.currentVrm && !appState.currentGlbScene) {
    speak('Quạc quạc! NVIDIA MicroDuck thực hiện cú lộn nhào 360 độ!');
  } else {
    speak('Xem cú lộn nhào Backflip cực đỉnh của tớ nè!');
  }
}

export function triggerSpin() {
  appState.activeWindowTask = null;
  appState.velX = 0;
  appState.velY = 0;
  appState.setState('SPIN');
  appState.setExpression('happy', 2.4);
  appState.changeEnergy(-3);
  appState.changeMood(5);
  spawnParticles(appState.posX, appState.posY - 70, 12, 0x38bdf8);
  if (appState.builtinModelType === 'microduck' && !appState.currentVrm && !appState.currentGlbScene) {
    speak('Quạc! MicroDuck bật chế độ turbo xoay tít!');
  } else {
    speak('Ủa ôi, xoay vòng vòng chóng mặt quá đi thôi!');
  }
}

