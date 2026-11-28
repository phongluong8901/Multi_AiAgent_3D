import { invoke } from '@tauri-apps/api/core';
import { appState, getDesktopFloorY } from '../core/state';
import {
  fireAnimationTrigger,
  getClipById,
  isAnimationOverlayActive,
  previewClip,
} from '../core/animationBinder';
import { AUTO_BEHAVIOR_CATALOG, AutoBehaviorKey, FrameZone } from '../core/types';
import { createMicroDuckCharacter } from '../characters/characterRig';
import { equipAccessory3D } from '../characters/accessories3d';
import { clearCachedVrm } from '../characters/vrmManager';
import {
  clearFoodItem,
  clearLadder,
  show3DRadar,
  showJetpack,
  showParachute,
  spawnFoodItem,
  spawnFrameHighlight,
  spawnLadder,
  spawnParticles,
  spawnScanEffect,
  spawnShockwave,
  spawnDriftSmoke,
  spawnBlackHole,
  triggerRandomSpecial3DEffect,
} from '../core/particles';
import {
  checkProximityWindowPush,
  findTargetWindow,
  startPhysicalPush,
  startPhysicalResize,
  stepActiveWindowTask,
} from './windowInteract';
import {
  playLandSound,
  playJumpSound,
  playWhooshSound,
  playSuccessChimeSound,
  playDuckQuackSound,
} from '../core/soundFx';
import {
  registerWaterPoolSpeakCallback,
  triggerStartSwimming,
  triggerStopSwimming,
  isWaterPoolActive,
} from '../core/waterPool';
import {
  isDesktopIconTaskActive,
  registerDesktopIconSpeakCallback,
  startDragDesktopIcon,
  stepDesktopIconDrag,
} from './desktopIconInteract';
import {
  clearTemporaryAccessoryTimer,
  isGooseModeActive,
  triggerGooseMischiefMode,
  triggerManualBeatDance,
  triggerTerritoryDefenseMode,
} from '../core/rhythmAndGoose';
import { isP2pSessionActive } from '../core/p2pArena';
import {
  cancelWindowSwing,
  stepWindowSwing,
  triggerHulkRageMode,
  triggerWindowPaperCrash,
  triggerWindowSwing,
} from './windowSwing';

export {
  triggerStartSwimming,
  triggerStopSwimming,
  isWaterPoolActive,
  triggerWindowSwing,
  triggerWindowPaperCrash,
  triggerHulkRageMode,
};

let uiSpeakCallback: ((msg: string) => void) | null = null;
let foodTimer = 0;
let frameZoneIdx = 0;
let ignoreWindowHwnd: number | null = null;
let ignoreWindowTimer = 0;
let lastAutoBehaviorKey: AutoBehaviorKey | null = null;
const roamClipDeck: AutoBehaviorKey[] = [];
const roamActionDeck: AutoBehaviorKey[] = [];
let ambientClipTimer = 0;

const WINDOW_UNSAFE_ROOT_CLIPS = new Set<AutoBehaviorKey>([
  'clip_front_flip',
  'clip_victory',
  'clip_celebrate_backhop',
  'clip_startled_hop',
  'clip_surprise',
  'clip_eureka_idea',
  'clip_super_saiyan_charge',
]);

function drawFromBehaviorDeck(
  deck: AutoBehaviorKey[],
  validKeys: AutoBehaviorKey[],
  excludeKey: AutoBehaviorKey | null
): AutoBehaviorKey | null {
  if (validKeys.length === 0) return null;
  const validSet = new Set(validKeys);
  const findIdx = (ignoreExclude: boolean) =>
    deck.findIndex(
      (k) => validSet.has(k) && (ignoreExclude || validKeys.length <= 1 || k !== excludeKey)
    );

  let idx = findIdx(false);
  if (idx < 0) {
    deck.length = 0;
    deck.push(...validKeys);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    idx = findIdx(false);
    if (idx < 0) idx = findIdx(true);
  }
  if (idx < 0) return validKeys[0];
  const [picked] = deck.splice(idx, 1);
  return picked;
}
let lastLandedWinHwnd: number | null = null;
let lastLandedTime = 0;

export function setIgnoreWindowCollision(hwnd: number, duration = 1.5) {
  ignoreWindowHwnd = hwnd;
  ignoreWindowTimer = duration;
}

export function registerPhysicsSpeakCallback(cb: (msg: string) => void) {
  uiSpeakCallback = cb;
  registerWaterPoolSpeakCallback(cb);
  registerDesktopIconSpeakCallback(cb);
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
  fireAnimationTrigger('event', 'food_spawn', 'enter');
  if (announce) {
    speak('Ồ! Đồ ăn vừa xuất hiện trên màn hình kìa, để tớ nhảy & leo lên lấy nhé!');
  }
}

function consumeFoodNow() {
  clearFoodItem();
  clearLadder();
  showParachute(false);
  appState.velX = 0;
  appState.velY = 0;
  appState.setState('EATING');
  appState.setExpression('happy', 3.5);
  appState.changeHunger(38);
  appState.changeEnergy(32);
  appState.changeMood(10);
  spawnParticles(appState.posX, appState.posY - 90, 14, 0xfbbf24);
  playSuccessChimeSound(appState.posX);
  fireAnimationTrigger('event', 'food_eat', 'enter');
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
  playJumpSound(appState.posX);
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
    (w) =>
      !w.is_maximized &&
      w.y > 120 &&
      w.y < appState.H - 120 &&
      w.width > 240 &&
      w.width < appState.W - 60
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

interface RocketFlightTask {
  hwnd: number | null;
  targetTitle: string;
  startX: number;
  startY: number;
  apexX: number;
  apexY: number;
  progress: number;
  duration: number;
  lastWinX: number;
  lastWinY: number;
}

let activeRocketFlight: RocketFlightTask | null = null;

export function triggerClimbWindow(explicitHwnd?: number) {
  cancelWindowSwing();
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  appState.attachedLedgeOffsetY = 0;
  appState.changeEnergy(-6);

  const candidates = appState.openWindows.filter(
    (w) =>
      !w.is_maximized &&
      w.y >= 45 &&
      w.y < appState.H - 100 &&
      w.width > 160 &&
      w.width < appState.W - 40
  );

  let targetHwnd: number | null = null;
  let targetTitle = 'không trung';
  let apexX: number;
  let apexY: number;
  let lastWinX = 0;
  let lastWinY = 0;

  if (candidates.length > 0) {
    const activeWin = candidates.find((w) => w.hwnd === appState.activeWindowHwnd);
    const targetWin = explicitHwnd
      ? candidates.find((w) => w.hwnd === explicitHwnd) || candidates[0]
      : activeWin || candidates[0];

    targetHwnd = targetWin.hwnd;
    targetTitle = targetWin.title.slice(0, 22);
    const midWinX = targetWin.x + targetWin.width * 0.5;
    apexX = Math.max(80, Math.min(appState.W - 80, midWinX + (Math.random() - 0.5) * 40));
    apexY = Math.max(60, targetWin.y - 120);
    lastWinX = targetWin.x;
    lastWinY = targetWin.y;
  } else {
    // Không có cửa sổ nổi -> Chuyển sang chế độ Rocket Bay Tuần Tra & Nhảy Dù Tự Do
    const minX = 120;
    const maxX = Math.max(minX + 80, appState.W - 120);
    if (appState.posX < appState.W * 0.5) {
      const spanStart = Math.max(minX, appState.W * 0.52);
      apexX = spanStart + Math.random() * Math.max(40, maxX - spanStart);
    } else {
      const spanEnd = Math.min(maxX, appState.W * 0.48);
      apexX = minX + Math.random() * Math.max(40, spanEnd - minX);
    }
    apexY = 95 + Math.random() * 130;
  }

  activeRocketFlight = {
    hwnd: targetHwnd,
    targetTitle,
    startX: appState.posX,
    startY: appState.posY,
    apexX,
    apexY,
    progress: 0,
    duration: 1.45,
    lastWinX,
    lastWinY,
  };

  showParachute(false);
  showJetpack(true);
  appState.setState('FLYING_ROCKET');
  appState.setExpression('happy', 3.0);
  appState.walkDir = apexX >= appState.posX ? 1 : -1;

  spawnShockwave(appState.posX, appState.posY, 0xf97316);
  spawnParticles(appState.posX, appState.posY - 20, 14, 0xf97316);
  playWhooshSound(appState.posX);
  if (targetHwnd !== null) {
    speak(`[JETPACK] Kích hoạt động cơ phản lực rocket đôi! Phun lửa bay chéo vút lên nóc "${targetTitle}"!`);
  } else {
    speak('[JETPACK] Kích hoạt phản lực bay tuần tra không trung & chuẩn bị bung dù lượn xuống!');
  }
}

export function stepPhysicsAndRoam(delta: number) {
  appState.stateTimer += delta;
  if (ignoreWindowTimer > 0) {
    ignoreWindowTimer = Math.max(0, ignoreWindowTimer - delta);
    if (ignoreWindowTimer === 0) {
      ignoreWindowHwnd = null;
    }
  }
  if (appState.speechLipSyncTimer > 0) {
    appState.speechLipSyncTimer = Math.max(0, appState.speechLipSyncTimer - delta);
  }
  if (appState.expressionTimer > 0) {
    appState.expressionTimer = Math.max(0, appState.expressionTimer - delta);
    if (appState.expressionTimer === 0) {
      appState.expressionMood = 'neutral';
    }
  }

  const ceilingY = 75;
  const floorY = getDesktopFloorY();
  const wallLeft = 50;
  const wallRight = appState.W - 50;

  if (stepDesktopIconDrag(delta)) {
    return;
  }

  if (
    isGooseModeActive() ||
    appState.isMigratedOut ||
    (isP2pSessionActive() && appState.state !== 'DRAGGING')
  ) {
    cancelWindowSwing();
    return;
  }

  if (appState.state === 'DRAGGING') {
    cancelWindowSwing();
  } else if (stepWindowSwing(delta)) {
    return;
  }

  if (appState.activeWindowTask !== null) {
    stepActiveWindowTask(delta);
    return;
  }

  if (appState.state === 'SWIMMING') {
    return;
  }

  // Chế độ Nấp Mép Màn Hình (Screen Edge Peek / Focus Mode)
  if (appState.isEdgePeekMode && appState.state !== 'DRAGGING') {
    cancelWindowSwing();
    showParachute(false);
    showJetpack(false);
    clearLadder();
    appState.attachedWindowHwnd = null;
    appState.walkDir = -1;
    const distCursor = Math.hypot(
      appState.globalCursorX - appState.posX,
      appState.globalCursorY - (appState.posY - 80 * appState.modelScale)
    );
    const targetX = distCursor < 110 ? Math.max(80, appState.W - 64) : Math.max(80, appState.W - 18);
    appState.posX += (targetX - appState.posX) * Math.min(1, delta * 9);
    appState.posY += (floorY - appState.posY) * Math.min(1, delta * 9);
    appState.velX = 0;
    appState.velY = 0;
    appState.setState('IDLE');
    return;
  }

  if (appState.state === 'DRAGGING') {
    cancelWindowSwing();
    showParachute(false);
    showJetpack(false);
    clearLadder();
    activeRocketFlight = null;
    if (isWaterPoolActive()) {
      triggerStopSwimming(false);
    }
  }

  if (
    (appState.state === 'DANCING' ||
      appState.state === 'WAVING' ||
      appState.state === 'HEADPAT' ||
      appState.state === 'SCANNING' ||
      appState.state === 'ALERT') &&
    appState.stateTimer > 3.6
  ) {
    appState.nextRoamDuration = appState.getAutoActionDelay();
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
      appState.nextRoamDuration = appState.getAutoActionDelay();
      appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    }
  } else if ((appState.state === 'BACKFLIP' || appState.state === 'SPIN') && appState.stateTimer > 1.55) {
    appState.nextRoamDuration = appState.getAutoActionDelay();
    appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
  } else if (appState.state === 'RADAR' && appState.stateTimer > 3.8) {
    appState.nextRoamDuration = appState.getAutoActionDelay();
    appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
  } else if (appState.state === 'SLEEP' && appState.stateTimer > 15.0) {
    appState.nextRoamDuration = appState.getAutoActionDelay();
    appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    fireAnimationTrigger('event', 'duck_wake', 'enter');
    speak('Oáp... MicroDuck thức dậy rồi!');
  } else if (
    appState.state === 'TIRED' &&
    ((appState.energy >= 65 && appState.stateTimer > 18) || appState.stateTimer > 32)
  ) {
    appState.nextRoamDuration = appState.getAutoActionDelay();
    appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    fireAnimationTrigger('event', 'duck_wake', 'enter');
    speak('Đã nghỉ khỏe lại rồi, tiếp tục chiến đấu thôi!');
  }

  // Cập nhật các thanh hoạt động (Năng lượng & Độ no) theo trạng thái
  if (appState.state === 'WALKING' || appState.state === 'PUSHING' || appState.state === 'PULLING') {
    appState.changeEnergy(-1.8 * delta);
    appState.changeHunger(-0.6 * delta);
  } else if (appState.state === 'JUMPING' || appState.state === 'DANCING') {
    appState.changeEnergy(-3.8 * delta);
    appState.changeHunger(-1.2 * delta);
  } else if (appState.state === 'SLEEP') {
    appState.changeEnergy(3.5 * delta);
    appState.changeHunger(-0.15 * delta);
  } else if (appState.state === 'TIRED') {
    // Hồi phục chậm rãi để người dùng quan sát kỹ hoạt động thở dốc và cạn năng lượng
    appState.changeEnergy(1.2 * delta);
    appState.changeHunger(-0.15 * delta);
  } else if (appState.state === 'SITTING_WINDOW') {
    appState.changeEnergy(0.8 * delta);
    appState.changeHunger(-0.2 * delta);
  } else if (appState.state === 'IDLE') {
    appState.changeEnergy(0.25 * delta);
    appState.changeHunger(-0.2 * delta);
  }

  // Quá mệt khi đi bộ hoặc đứng yên -> chuyển sang TIRED
  if (appState.energy <= 20 && (appState.state === 'WALKING' || appState.state === 'IDLE')) {
    appState.setState('TIRED');
    appState.setExpression('sad', 5.0);
    speak('Phù... cạn pin rồi! Tớ hết sạch năng lượng, ngồi thở một lúc đã...');
    // KHÔNG tự động thả đồ ăn ở đây để người dùng ngắm nhân vật mệt mỏi
  }

  // Tự động rơi đồ ăn ngẫu nhiên trên màn hình:
  // Tần suất chậm để người dùng có thể quan sát trạng thái đói & cạn pin
  // Chỉ tự động thả khi đói kiệt sức (< 15% sau 360s) hoặc định kỳ chậm (> 840s / 14 phút)
  if (!appState.foodTarget) {
    foodTimer += delta;
    if ((appState.hunger < 15 && foodTimer > 360) || foodTimer > 840) {
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
  } else if (appState.state === 'TIRED' && Math.random() < delta * 3.2) {
    // Hạt mồ hôi / tia điện yếu khi kiệt pin
    spawnParticles(appState.posX + (Math.random() - 0.5) * 16, appState.posY - 105, 1, 0x60a5fa);
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
  // Nếu đang TIRED cạn pin, không bật dậy chạy đi tìm đồ ăn ở xa (chỉ ăn nếu thức ăn rơi sát cạnh < 48px)
  if (
    appState.foodTarget &&
    appState.state !== 'DRAGGING' &&
    appState.state !== 'FALLING' &&
    appState.state !== 'JUMPING' &&
    appState.state !== 'EATING' &&
    appState.state !== 'PARACHUTING' &&
    appState.state !== 'TIRED'
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
      const curAttachedHwnd = appState.attachedWindowHwnd;
      const curWin = appState.openWindows.find((w) => w.hwnd === curAttachedHwnd);

      // Nếu thức ăn ở gần vị trí thẳng đứng bên dưới (dx <= 65): bắc thang trèo thẳng xuống
      if (Math.abs(dx) <= 65) {
        appState.attachedWindowHwnd = null;
        appState.attachedLedgeOffsetY = 0;
        spawnLadder(appState.posX, appState.posY, appState.foodTarget.y);
        appState.setState('CLIMBING');
        speak('Bắc thang trèo thẳng xuống lấy đồ ăn nào!');
        return;
      }

      // Nếu thức ăn ở xa theo phương ngang: đi men tới mép cửa sổ gần thức ăn rồi nhảy/bung dù
      if (curWin) {
        const targetEdgeX = dx > 0 ? curWin.x + curWin.width - 12 : curWin.x + 12;
        const distToEdge = Math.abs(appState.posX - targetEdgeX);

        if (distToEdge > 22) {
          appState.walkDir = dx > 0 ? 1 : -1;
          appState.setState('WALKING');
          appState.posX += appState.walkDir * 2.8;
          return;
        }

        // Đã tới mép cửa sổ -> rời cửa sổ và nhảy xuống
        ignoreWindowHwnd = curAttachedHwnd;
        ignoreWindowTimer = 1.8;
        appState.attachedWindowHwnd = null;
        appState.attachedLedgeOffsetY = 0;

        if (dy > 110) {
          showParachute(true);
          appState.velY = 2.4;
          appState.velX = Math.sign(dx) * 2.5;
          appState.setState('PARACHUTING');
          speak('Bung dù từ mép cửa sổ bay xuống lấy đồ ăn!');
        } else {
          appState.velY = 2.6;
          appState.velX = Math.sign(dx) * 3.8;
          appState.setState('FALLING');
          speak('Nhảy từ mép cửa sổ xuống lấy đồ ăn!');
        }
        return;
      } else {
        // Cửa sổ không còn -> rơi xuống
        ignoreWindowHwnd = curAttachedHwnd;
        ignoreWindowTimer = 1.5;
        appState.attachedWindowHwnd = null;
        appState.velY = 2.5;
        appState.velX = Math.sign(dx) * 3.5;
        appState.setState('FALLING');
        return;
      }
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

  // Xử lý động cơ phản lực Jetpack bay vút lên nóc cửa sổ hoặc tuần tra không trung rồi bung dù
  if (activeRocketFlight !== null && appState.state !== 'DRAGGING') {
    let targetLabel = activeRocketFlight.targetTitle;
    if (activeRocketFlight.hwnd !== null) {
      const curWin = appState.openWindows.find((w) => w.hwnd === activeRocketFlight!.hwnd);
      if (!curWin) {
        showJetpack(false);
        activeRocketFlight = null;
        showParachute(true);
        appState.velX = 0;
        appState.velY = 1.6;
        appState.setState('PARACHUTING');
        speak('Cửa sổ mục tiêu đã đóng, bung dù lượn xuống an toàn nhé!');
        return;
      }

      // Nếu người dùng giật hoặc di chuyển cửa sổ mạnh khi đang bay tới -> nhiễu luồng khí
      const shiftX = Math.abs(curWin.x - activeRocketFlight.lastWinX);
      const shiftY = Math.abs(curWin.y - activeRocketFlight.lastWinY);
      if (shiftX > 25 || shiftY > 25) {
        showJetpack(false);
        const lastX = activeRocketFlight.lastWinX;
        setIgnoreWindowCollision(curWin.hwnd, 1.8);
        activeRocketFlight = null;
        appState.velX = Math.sign(curWin.x - lastX) * 5.0;
        appState.velY = 2.0;
        appState.setState('FALLING');
        appState.setExpression('surprised', 3.0);
        spawnParticles(appState.posX, appState.posY - 35, 14, 0xf87171);
        speak(`Úi! Cửa sổ "${curWin.title.slice(0, 18)}" bị di chuyển đột ngột làm nhiễu luồng phản lực, mất thăng bằng rơi xuống!`);
        return;
      }
      activeRocketFlight.lastWinX = curWin.x;
      activeRocketFlight.lastWinY = curWin.y;
      targetLabel = curWin.title.slice(0, 20);
    }

    activeRocketFlight.progress += delta / activeRocketFlight.duration;
    const t = Math.min(1.0, activeRocketFlight.progress);

    // Đường bay cong chéo (Parabolic Flight Path)
    const curX = (1 - t) * activeRocketFlight.startX + t * activeRocketFlight.apexX;
    const arcHeight = Math.sin(t * Math.PI) * 35;
    const curY = (1 - t) * activeRocketFlight.startY + t * activeRocketFlight.apexY - arcHeight;

    appState.posX = curX;
    appState.posY = curY;
    appState.walkDir = activeRocketFlight.apexX >= activeRocketFlight.startX ? 1 : -1;
    appState.squashX = 0.82;
    appState.squashY = 1.25;

    if (t >= 1.0) {
      // Đạt đến đỉnh độ cao: Ngắt phản lực, bung dù lượn xuống
      const hadWindowTarget = activeRocketFlight.hwnd !== null;
      showJetpack(false);
      activeRocketFlight = null;
      showParachute(true);
      appState.setState('PARACHUTING');
      appState.velX = 0;
      appState.velY = 1.6;
      spawnShockwave(appState.posX, appState.posY, 0xf472b6);
      if (hadWindowTarget) {
        speak(`[PARACHUTE] Đạt đỉnh độ cao, ngắt phản lực, bung dù lượn êm ái xuống nóc "${targetLabel}"!`);
      } else {
        speak('[PARACHUTE] Đạt độ cao tuần tra, bung dù lượn êm ru xuống mặt đất!');
      }
    }
    return;
  }

  if (appState.state === 'PARACHUTING') {
    const prevY = appState.posY;
    appState.posY += 2.1;
    appState.posX += Math.sin(performance.now() * 0.003) * 1.3;
    appState.posX = Math.max(wallLeft, Math.min(wallRight, appState.posX));
    if (Math.random() < delta * 4) {
      spawnParticles(appState.posX, appState.posY - 150, 1, 0xf472b6);
    }
    for (const win of appState.openWindows) {
      if (
        win.is_maximized ||
        win.y < 85 ||
        (win.x <= 10 && win.width >= appState.W - 50)
      ) {
        continue;
      }
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

      if (appState.posY < ceilingY) {
        appState.posY = ceilingY;
        if (appState.velY < 0) appState.velY = 0;
      }

      if (appState.velY > 0) {
        for (const win of appState.openWindows) {
          if (win.hwnd === ignoreWindowHwnd && ignoreWindowTimer > 0) {
            continue; // Đang rời khỏi cửa sổ này để xuống lấy đồ ăn, không dính ngược lại
          }
          if (
            win.is_maximized ||
            win.y < 85 ||
            (win.x <= 10 && win.width >= appState.W - 50)
          ) {
            continue;
          }
          const withinX =
            appState.posX >= win.x + 6 && appState.posX <= win.x + win.width - 6;
          const crossedTop =
            prevY <= win.y + Math.max(16, appState.velY + 4) &&
            appState.posY >= win.y - 10;
          if (withinX && crossedTop) {
            const impactVy = Math.abs(appState.velY);
            appState.posY = win.y;
            appState.velX = 0;
            appState.velY = 0;
            appState.attachedWindowHwnd = win.hwnd;
            appState.attachedOffsetX = appState.posX - win.x;
            appState.attachedLedgeOffsetY = 0;
            appState.attachedWinTitle = win.title;
            appState.attachedZoneLabel = '';
            appState.triggerSquash(
              Math.min(1.28, 1.12 + impactVy * 0.008),
              Math.max(0.76, 0.88 - impactVy * 0.007)
            );
            spawnShockwave(appState.posX, win.y, 0x38bdf8);
            playLandSound(appState.posX);
            appState.setState('SITTING_WINDOW');
            if (impactVy > 13) {
              fireAnimationTrigger('event', 'duck_land_heavy', 'enter');
            }
            if (lastLandedWinHwnd !== win.hwnd || performance.now() - lastLandedTime > 4000) {
              speak(`Đang ngồi nghỉ trên: ${appState.attachedWinTitle.slice(0, 26)}`);
              lastLandedWinHwnd = win.hwnd;
              lastLandedTime = performance.now();
            }
            break velUpdate;
          }
        }
      }

      if (appState.posY >= floorY) {
        const impactVy = Math.abs(appState.velY);
        appState.posY = floorY;
        if (impactVy > 6.5 && appState.bounceFactor > 0.1) {
          appState.triggerSquash(
            Math.min(1.30, 1.14 + impactVy * 0.009),
            Math.max(0.74, 0.86 - impactVy * 0.008)
          );
          spawnShockwave(appState.posX, floorY, 0x38bdf8);
          playLandSound(appState.posX);
          appState.velY = -appState.velY * appState.bounceFactor;
          appState.velX *= 0.72;
        } else {
          if (impactVy > 3.0) {
            appState.triggerSquash(1.16, 0.86);
            spawnShockwave(appState.posX, floorY, 0x38bdf8);
            playLandSound(appState.posX);
          }
          appState.velY = 0;
          appState.velX = 0;
          appState.setState('IDLE');
          if (impactVy > 11.5) {
            fireAnimationTrigger('event', 'duck_land_heavy', 'enter');
          }
        }
      }
    }
  } else if (appState.state === 'WALKING') {
    const isExhausted = appState.energy <= 25;
    const isMicroDuckFast =
      appState.builtinModelType === 'microduck' &&
      !appState.currentVrm &&
      !appState.currentGlbScene &&
      !isExhausted &&
      (appState.duckCrouchRoll || appState.foodTarget !== null || appState.stateTimer > 1.8);
    const speed = isExhausted ? 0.75 : (isMicroDuckFast ? 4.3 : 1.65);
    appState.posX += appState.walkDir * speed;

    if (isMicroDuckFast && Math.random() < 0.38) {
      spawnDriftSmoke(appState.posX, appState.posY, -appState.walkDir);
    }

    if (appState.attachedWindowHwnd !== null) {
      const targetWin = appState.openWindows.find(
        (w) => w.hwnd === appState.attachedWindowHwnd
      );
      if (targetWin) {
        const leftLedge = targetWin.x;
        const rightLedge = targetWin.x + targetWin.width;

        // Đi hết thanh ngang (ra khỏi phạm vi vật lý mép cửa sổ) -> bước hụt và rơi tự do
        if (appState.posX < leftLedge - 6 || appState.posX > rightLedge + 6) {
          setIgnoreWindowCollision(targetWin.hwnd, 1.5);
          appState.attachedWindowHwnd = null;
          appState.attachedLedgeOffsetY = 0;
          appState.velX = appState.walkDir * 3.2;
          appState.velY = 1.2;
          appState.setState('FALLING');
          appState.setExpression('surprised', 2.8);
          spawnParticles(appState.posX, appState.posY - 35, 10, 0xf87171);
          speak(`Úi úi! Đi hết thanh ngang cửa sổ "${targetWin.title.slice(0, 18)}" bị hụt chân rơi xuống rồi!`);
        } else {
          const expectedY = targetWin.y + appState.attachedLedgeOffsetY;
          if (expectedY > appState.posY + 3) {
            // Cửa sổ bị kéo tụt xuống dưới -> hụt chân rơi tự do xuống cửa sổ bên dưới
            appState.attachedWindowHwnd = null;
            appState.attachedLedgeOffsetY = 0;
            appState.velY = 1.6;
            appState.setState('FALLING');
            appState.setExpression('surprised', 1.8);
          } else {
            appState.attachedOffsetX = appState.posX - targetWin.x;
            appState.posY = expectedY;
          }
        }
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
      appState.duckCrouchRoll = false;
      appState.nextRoamDuration = appState.getAutoActionDelay();
      appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    }
  } else if (
    appState.autoRoamEnabled &&
    (appState.state === 'IDLE' || appState.state === 'SITTING_WINDOW')
  ) {
    // Khi đang mở khung Chat, đang bận hoặc đang PK: không chen ngang hành động tự động
    if (
      appState.isChatOpen ||
      appState.isChatting ||
      appState.isP2pArenaOpen ||
      isP2pSessionActive() ||
      isGooseModeActive() ||
      isDesktopIconTaskActive() ||
      isWaterPoolActive() ||
      (typeof document !== 'undefined' && document.activeElement?.id === 'bubble-input')
    ) {
      return;
    }

    if (appState.energy <= 20) {
      // Khi cạn pin, ưu tiên ngồi nghỉ dưỡng sức, không nhảy nhào lộn hay leo trèo cửa sổ
      appState.setState('TIRED');
      return;
    }

    const perchedOnWindow = appState.attachedWindowHwnd !== null;
    const enabledClipKeys: AutoBehaviorKey[] = [];
    for (const item of AUTO_BEHAVIOR_CATALOG) {
      if (item.group !== 'clip3d') continue;
      if (!appState.isAutoBehaviorEnabled(item.key)) continue;
      if (perchedOnWindow && WINDOW_UNSAFE_ROOT_CLIPS.has(item.key)) continue;
      enabledClipKeys.push(item.key);
    }

    // Diễn xen kẽ 1 hoạt ảnh nhẹ trong lúc đứng/ngồi chờ giữa các chu kỳ auto-roam dài
    ambientClipTimer += delta;
    if (
      appState.nextRoamDuration >= 12 &&
      ambientClipTimer >= 8.5 &&
      appState.stateTimer < appState.nextRoamDuration - 3.0 &&
      !isAnimationOverlayActive() &&
      enabledClipKeys.length > 0
    ) {
      ambientClipTimer = 0;
      const ambientPick = drawFromBehaviorDeck(roamClipDeck, enabledClipKeys, lastAutoBehaviorKey);
      if (ambientPick) {
        lastAutoBehaviorKey = ambientPick;
        triggerAutoBehaviorNow(ambientPick, false);
        return;
      }
    }

    if (appState.stateTimer >= appState.nextRoamDuration) {
      appState.stateTimer = 0;
      ambientClipTimer = 0;
      appState.nextRoamDuration = appState.getAutoActionDelay();

      const floatingWins = appState.openWindows.filter(
        (w) =>
          !w.is_maximized &&
          w.y >= 85 &&
          w.y < appState.H - 120 &&
          w.width > 200 &&
          w.width < appState.W - 60
      );

      const actionKeys: AutoBehaviorKey[] = [];
      for (const item of AUTO_BEHAVIOR_CATALOG) {
        if (item.group === 'clip3d') continue;
        if (!appState.isAutoBehaviorEnabled(item.key)) continue;
        if (
          (item.key === 'jump_window' || item.key === 'window_swing') &&
          floatingWins.length === 0
        ) {
          continue;
        }
        if (
          item.key === 'window_push_resize' &&
          (floatingWins.length === 0 || !appState.windowInteractEnabled)
        ) {
          continue;
        }
        if (
          (item.key === 'territory_defense' || item.key === 'goose_mischief') &&
          isGooseModeActive()
        ) {
          continue;
        }
        actionKeys.push(item.key);
      }

      if (enabledClipKeys.length === 0 && actionKeys.length === 0) {
        return;
      }

      const preferClip =
        enabledClipKeys.length > 0 && (actionKeys.length === 0 || Math.random() < 0.58);
      const chosen = preferClip
        ? drawFromBehaviorDeck(roamClipDeck, enabledClipKeys, lastAutoBehaviorKey)
        : drawFromBehaviorDeck(roamActionDeck, actionKeys, lastAutoBehaviorKey);
      if (!chosen) return;
      lastAutoBehaviorKey = chosen;
      triggerAutoBehaviorNow(chosen, false);
    }
  }
}

export function triggerAutoBehaviorNow(key: AutoBehaviorKey, interactive = false) {
  const meta = AUTO_BEHAVIOR_CATALOG.find((x) => x.key === key);
  if (meta?.clipId) {
    const clip = getClipById(meta.clipId);
    previewClip(meta.clipId);
    const expr =
      meta.clipId === 'dramatic_flop' ||
        meta.clipId === 'shy_sit' ||
        meta.clipId === 'sad' ||
        meta.clipId === 'facepalm' ||
        meta.clipId === 'head_shake'
        ? 'sad'
        : meta.clipId === 'startled_hop' ||
          meta.clipId === 'dizzy_spin' ||
          meta.clipId === 'surprise' ||
          meta.clipId === 'shiver' ||
          meta.clipId === 'sneeze'
          ? 'surprised'
          : 'happy';
    appState.setExpression(expr, (clip?.defaultDuration ?? 2.6) + 0.4);
    appState.changeMood(3);
    if (interactive && clip) {
      speak(`[HOẠT ẢNH 3D] ${clip.label}: ${clip.description}`);
    }
    return;
  }

  switch (key) {
    case 'walk_roam':
      appState.walkDir = Math.random() < 0.5 ? -1 : 1;
      appState.duckCrouchRoll = false;
      appState.setState('WALKING');
      if (interactive) speak('Đi dạo thư giãn quanh màn hình chút nào!');
      break;
    case 'wheel_roll':
      void triggerDuckWheelRoll();
      break;
    case 'wave':
      appState.setState('WAVING');
      appState.setExpression('happy', 3.0);
      if (interactive) speak('Xin chào chủ nhân! Tớ vẫn luôn ở đây nè!');
      break;
    case 'dance':
      appState.activeWindowTask = null;
      appState.attachedWindowHwnd = null;
      appState.setState('DANCING');
      appState.setExpression('happy', 3.4);
      spawnParticles(appState.posX, appState.posY - 100, 10, 0xf472b6);
      appState.changeMood(4);
      if (interactive) speak('Quẩy điệu nhảy Idol 3D nào!');
      break;
    case 'backflip':
      triggerBackflip();
      break;
    case 'spin':
      triggerSpin();
      break;
    case 'radar_scan':
      void triggerDuckRadarScan();
      break;
    case 'sleep':
      void triggerDuckSleepMode();
      break;
    case 'feed_food':
      triggerSpawnRandomFood(interactive);
      break;
    case 'accessory_hat':
      clearTemporaryAccessoryTimer();
      equipAccessory3D('random', interactive);
      break;
    case 'special_fx': {
      const fx = triggerRandomSpecial3DEffect(appState.posX, appState.posY);
      if (interactive) speak(`[FX 3D] Đã bung hiệu ứng: ${fx}`);
      break;
    }
    case 'rocket_parachute':
      triggerClimbWindow();
      break;
    case 'black_hole':
      triggerBlackHoleTeleport();
      break;
    case 'jump_window':
      triggerJumpToWindow();
      break;
    case 'window_swing':
      triggerWindowSwing();
      break;
    case 'window_push_resize':
      if (Math.random() < 0.65) {
        startPhysicalPush(Math.random() < 0.5 ? -1 : 1, undefined, 6, true);
      } else {
        startPhysicalResize(Math.random() < 0.5 ? 'shrink' : 'expand', undefined, 5, true);
      }
      break;
    case 'swim_pool':
      triggerStartSwimming(interactive, 11);
      break;
    case 'territory_defense':
      triggerTerritoryDefenseMode(interactive);
      break;
    case 'goose_mischief':
      triggerGooseMischiefMode(interactive);
      break;
    case 'beat_dance':
      triggerManualBeatDance();
      break;
    case 'drag_desktop_icon':
      void startDragDesktopIcon();
      break;
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
  playWhooshSound(appState.posX);
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
  playWhooshSound(appState.posX);
  if (appState.builtinModelType === 'microduck' && !appState.currentVrm && !appState.currentGlbScene) {
    speak('Quạc! MicroDuck bật chế độ turbo xoay tít!');
  } else {
    speak('Ủa ôi, xoay vòng vòng chóng mặt quá đi thôi!');
  }
}

export async function triggerDuckWheelRoll() {
  if (
    appState.currentVrm !== null ||
    appState.currentGlbScene !== null ||
    appState.builtinModelType !== 'microduck'
  ) {
    await clearCachedVrm();
    createMicroDuckCharacter();
  }

  if (appState.state === 'WALKING' && appState.duckCrouchRoll) {
    appState.duckCrouchRoll = false;
    appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    speak('MicroDuck thu bánh xe, đứng thẳng lại rồi!');
    return;
  }

  appState.activeWindowTask = null;
  appState.duckCrouchRoll = true;
  appState.walkDir = appState.posX > appState.W * 0.5 ? -1 : 1;
  appState.setState('WALKING');
  appState.setExpression('happy', 3.0);
  appState.changeMood(5);
  spawnParticles(appState.posX, appState.posY - 12, 12, 0xf97316);
  playWhooshSound(appState.posX);
  speak('Quạc! MicroDuck gập người hạ trọng tâm, bật bánh xe lướt siêu tốc!');
}

export async function triggerDuckRadarScan() {
  if (
    appState.currentVrm !== null ||
    appState.currentGlbScene !== null ||
    appState.builtinModelType !== 'microduck'
  ) {
    await clearCachedVrm();
    createMicroDuckCharacter();
  }

  appState.activeWindowTask = null;
  appState.velX = 0;
  appState.velY = 0;
  appState.setState('RADAR');
  appState.setExpression('surprised', 3.8);
  show3DRadar(true);
  playDuckQuackSound(appState.posX);
  speak('Tít tít! MicroDuck kích hoạt đĩa Radar Parabolic 3D quét môi trường xung quanh!');

  setTimeout(() => {
    if (appState.state === 'RADAR') {
      show3DRadar(false);
      appState.nextRoamDuration = appState.getAutoActionDelay();
      appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
      speak('Đã quét xong radar! Toàn bộ vị trí cửa sổ và ứng dụng đã được ghi nhận.');
    }
  }, 3800);
}

export async function triggerDuckSleepMode() {
  if (
    appState.currentVrm !== null ||
    appState.currentGlbScene !== null ||
    appState.builtinModelType !== 'microduck'
  ) {
    await clearCachedVrm();
    createMicroDuckCharacter();
  }

  appState.activeWindowTask = null;
  appState.velX = 0;
  appState.velY = 0;
  appState.setState('SLEEP');
  appState.setExpression('neutral', 10.0);
  void invoke('cog_consolidate_sleep').catch(() => { });
  speak('Khò khò... MicroDuck gập cổ tắt đèn LED ngủ đông và tổng hợp trí nhớ dài hạn (Sleep Consolidation).');
}

export function triggerBlackHoleTeleport(targetX?: number, targetY?: number) {
  cancelWindowSwing();
  clearLadder();
  showParachute(false);
  showJetpack(false);
  activeRocketFlight = null;
  appState.activeWindowTask = null;

  const startX = appState.posX;
  const startY = appState.posY;

  let destX: number;
  let destY: number;

  if (targetX !== undefined && targetY !== undefined) {
    destX = Math.max(50, Math.min(appState.W - 50, targetX));
    destY = Math.max(75, Math.min(getDesktopFloorY(), targetY));
  } else {
    const floatingWins = appState.openWindows.filter(
      (w) =>
        !w.is_maximized &&
        w.y >= 85 &&
        w.y < appState.H - 120 &&
        w.width > 200 &&
        w.width < appState.W - 60
    );

    if (floatingWins.length > 0 && Math.random() < 0.35) {
      const win = floatingWins[Math.floor(Math.random() * floatingWins.length)];
      destX = win.x + 40 + Math.random() * Math.max(20, win.width - 80);
      destY = win.y;
    } else {
      const minX = 110;
      const maxX = Math.max(minX + 80, appState.W - 110);
      const minY = 150;
      const maxY = Math.max(minY + 60, appState.H - 55);
      const minDist = Math.min(380, appState.W * 0.32);

      destX = minX + Math.random() * (maxX - minX);
      destY = minY + Math.random() * (maxY - minY);
      for (let i = 0; i < 8; i++) {
        if (Math.hypot(destX - startX, destY - startY) >= minDist) {
          break;
        }
        destX = minX + Math.random() * (maxX - minX);
        destY = minY + Math.random() * (maxY - minY);
      }
    }
  }

  // 1. Tại vị trí xuất phát: Mở Hố đen HÚT VÀO (Suction)
  spawnBlackHole(startX, startY, 1.6, 'suction');
  speak('Hố đen không gian mở rộng! Con vịt đang bị hút xoáy vào chân trời sự kiện...');

  appState.attachedWindowHwnd = null;
  appState.attachedLedgeOffsetY = 0;
  appState.velX = 0;
  appState.velY = 0;
  appState.squashX = 0.22;
  appState.squashY = 2.0;
  appState.setState('ALERT');
  appState.setExpression('surprised', 2.0);

  // 2. Sau 420ms (sau khi bị hút vào lỗ sâu):
  setTimeout(() => {
    // 3. Tại vị trí đích: Mở Hố trắng / Cổng ĐẨY RA (Ejection)
    spawnBlackHole(destX, destY, 2.2, 'ejection');

    appState.posX = destX;
    appState.posY = destY;
    // Bị đẩy văng ra ngoài với quỹ đạo vật lý
    appState.velX = (Math.random() - 0.5) * 14;
    appState.velY = -14;
    appState.squashX = 1.45;
    appState.squashY = 0.65;
    appState.nextRoamDuration = appState.getAutoActionDelay();
    appState.setState('JUMPING');
    appState.setExpression('happy', 3.0);
    speak('Bùm! Hố trắng đẩy văng ra tọa độ ngẫu nhiên mới trên màn hình!');

    // Tự động kiểm tra gắn vào cửa sổ nếu điểm đích rơi trên nóc cửa sổ nổi
    for (const win of appState.openWindows) {
      if (
        !win.is_maximized &&
        win.y >= 85 &&
        win.width < appState.W - 60 &&
        destX >= win.x + 10 &&
        destX <= win.x + win.width - 10 &&
        Math.abs(destY - win.y) <= 35
      ) {
        appState.attachedWindowHwnd = win.hwnd;
        appState.attachedOffsetX = destX - win.x;
        appState.attachedLedgeOffsetY = 0;
        appState.attachedWinTitle = win.title;
        appState.posY = win.y;
        appState.velX = 0;
        appState.velY = 0;
        appState.nextRoamDuration = appState.getAutoActionDelay();
        appState.setState('SITTING_WINDOW');
        break;
      }
    }
  }, 420);
}


