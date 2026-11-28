import * as THREE from 'three';
import { appState } from './core/state';
import { initScene, renderSceneOptimized, updateGroundAura } from './core/scene';
import { hasWideParticlesOrEffects, updateParticles } from './core/particles';
import { hasActiveActionProps3D, updateActionProps3D } from './core/props3d';
import { isWaterPoolActive, updateWaterPool } from './core/waterPool';
import {
  hasRhythmGooseVisuals,
  registerRhythmGooseSpeakCallback,
  updateRhythmAndGoose,
} from './core/rhythmAndGoose';
import { updateP2pArena, isP2pSessionActive } from './core/p2pArena';
import {
  createMicroDuckCharacter,
  createDetailedAnimeCharacter,
  animateBuiltinCharacter,
  registerAccessorySpeakCallback,
  updateAccessoryAnimation,
} from './characters/characterRig';
import {
  registerSpeakCallback,
  loadCachedVrm,
  loadVrmFromBlobUrl,
  animateVrmCharacter,
  animateGlbCharacter,
} from './characters/vrmManager';
import { registerPhysicsSpeakCallback, stepPhysicsAndRoam } from './physics/physics';
import { registerWindowSpeakCallback } from './physics/windowInteract';
import { isWindowSwingActive, registerWindowSwingSpeakCallback } from './physics/windowSwing';
import { isDesktopIconTaskActive } from './physics/desktopIconInteract';
import {
  initUi,
  isCompanionOrbSettling,
  isTypewriterActive,
  speakMessage,
  triggerDance,
  updateTypewriter,
  updateUiPosition,
  syncHitboxToRust,
} from './frontend/ui';
import { initInput } from './frontend/input';
import { initAssistant, registerAssistantCallbacks } from './backend/assistant';
import {
  applyAnimationOverlayFrame,
  beginAnimationOverlayFrame,
  initAnimationBinder,
  isAnimationOverlayActive,
  onAnimationFired,
  trackCharacterStateTransition,
} from './core/animationBinder';
import { initUiMotion } from './frontend/uiMotion';
import { sampleActiveVoiceLipSync } from './frontend/features/voiceTts';

const container = document.getElementById('canvas-container') as HTMLElement;
initScene(container);

const activeType = localStorage.getItem('mate_active_character_type') || 'microduck';
if (activeType === 'idol') {
  createDetailedAnimeCharacter();
} else if (activeType === 'custom_vrm') {
  createMicroDuckCharacter(); // Hiển thị MicroDuck trước để không bao giờ bị rỗng màn hình
  loadCachedVrm()
    .then((cached) => {
      if (cached) {
        const blobUrl = URL.createObjectURL(new Blob([cached.buffer]));
        loadVrmFromBlobUrl(blobUrl, cached.name);
      }
    })
    .catch(() => {
      createMicroDuckCharacter();
    });
} else {
  // Mặc định luôn khởi tạo NVIDIA MicroDuck
  createMicroDuckCharacter();
}

try {
  initUi();
} catch (err) {
  console.error('[INIT ERROR] initUi failed:', err);
}

try {
  initInput();
} catch (err) {
  console.error('[INIT ERROR] initInput failed:', err);
}

registerSpeakCallback(speakMessage);
registerPhysicsSpeakCallback(speakMessage);
registerWindowSpeakCallback(speakMessage);
registerWindowSwingSpeakCallback(speakMessage);
registerAccessorySpeakCallback(speakMessage);
registerRhythmGooseSpeakCallback(speakMessage);
registerAssistantCallbacks(speakMessage, triggerDance);

try {
  initAssistant();
} catch (err) {
  console.error('[INIT ERROR] initAssistant failed:', err);
}

try {
  initAnimationBinder();
  initUiMotion();
  void import('./frontend/components/animationManagerModal')
    .then(({ initAnimationManagerUi }) => initAnimationManagerUi())
    .catch((err) => console.error('[AnimManager] Lazy init error:', err));
} catch (err) {
  console.error('[INIT ERROR] initAnimationBinder failed:', err);
}

document.body.classList.toggle('eco-mode', appState.ecoMode);

const ACTIVE_MOTION_STATES = new Set([
  'DRAGGING',
  'FALLING',
  'JUMPING',
  'WALKING',
  'DANCING',
  'BACKFLIP',
  'SPIN',
  'SWIMMING',
  'SWINGING_WINDOW',
  'CLIMBING',
  'PARACHUTING',
  'FLYING_ROCKET',
  'PUSHING',
  'PULLING',
  'BUTT_PLANT',
  'WAVING',
  'HEADPAT',
  'RADAR',
  'EATING',
  'SCANNING',
  'ALERT',
]);

let lastFrameMs = performance.now();
let prevRafMs = lastFrameMs;
let rafIntervalMs = 16.67;
let nextRenderDueMs = lastFrameMs;
let simElapsedSec = 0;
let idleStillSec = 0;
let lastWakeCursorX = appState.globalCursorX;
let lastWakeCursorY = appState.globalCursorY;
let lastRenderedPosX = appState.posX;
let lastRenderedPosY = appState.posY;
let lastRenderedFacing = appState.facingAngle;
let rafId: number | null = null;
let idleTimerId: number | null = null;
let wasThrottledIdle = false;

function scheduleNextFrame(delayMs: number) {
  if (rafId !== null || idleTimerId !== null) return;
  if (delayMs > 0) {
    idleTimerId = window.setTimeout(() => {
      idleTimerId = null;
      rafId = requestAnimationFrame(animate);
    }, delayMs);
  } else {
    rafId = requestAnimationFrame(animate);
  }
}

function wakeRenderLoopNow() {
  idleStillSec = 0;
  wasThrottledIdle = false;
  if (idleTimerId !== null) {
    window.clearTimeout(idleTimerId);
    idleTimerId = null;
    if (rafId === null) {
      rafId = requestAnimationFrame(animate);
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) wakeRenderLoopNow();
});
window.addEventListener('pointerdown', wakeRenderLoopNow, { passive: true });
window.addEventListener('duck-wake-loop', wakeRenderLoopNow);
window.addEventListener(
  'pointermove',
  (e) => {
    if (
      Math.hypot(
        e.clientX - appState.posX,
        e.clientY - (appState.posY - 85 * appState.modelScale)
      ) < 280
    ) {
      wakeRenderLoopNow();
    }
  },
  { passive: true }
);
onAnimationFired((_b, clip) => {
  if (!clip.ambientLowFps) wakeRenderLoopNow();
});

function animate() {
  rafId = null;
  const now = performance.now();
  const rawDt = now - prevRafMs;
  prevRafMs = now;
  if (!wasThrottledIdle && rawDt >= 3 && rawDt <= 22) {
    rafIntervalMs = rafIntervalMs * 0.9 + rawDt * 0.1;
  }

  if (document.hidden) {
    lastFrameMs = now;
    nextRenderDueMs = now;
    idleStillSec = 0;
    wasThrottledIdle = true;
    scheduleNextFrame(250);
    return;
  }

  const cursorMoved =
    Math.abs(appState.globalCursorX - lastWakeCursorX) > 2 ||
    Math.abs(appState.globalCursorY - lastWakeCursorY) > 2;
  if (cursorMoved) {
    lastWakeCursorX = appState.globalCursorX;
    lastWakeCursorY = appState.globalCursorY;
  }
  const cursorDistToDuck = Math.hypot(
    appState.globalCursorX - appState.posX,
    appState.globalCursorY - (appState.posY - 85 * appState.modelScale)
  );
  const cursorWake = cursorMoved && cursorDistToDuck < 280;

  const needsFullScreen =
    isWaterPoolActive() ||
    isWindowSwingActive() ||
    hasRhythmGooseVisuals() ||
    isP2pSessionActive() ||
    isDesktopIconTaskActive() ||
    hasWideParticlesOrEffects() ||
    appState.activeWindowTask !== null ||
    appState.state === 'FLYING_ROCKET' ||
    appState.state === 'PARACHUTING' ||
    appState.state === 'CLIMBING' ||
    appState.state === 'SWIMMING' ||
    appState.state === 'SWINGING_WINDOW';

  const isSettling =
    Math.abs(appState.posX - lastRenderedPosX) > 0.25 ||
    Math.abs(appState.posY - lastRenderedPosY) > 0.25 ||
    Math.abs(appState.facingAngle - lastRenderedFacing) > 0.008 ||
    Math.abs(appState.squashX - 1.0) > 0.004 ||
    Math.abs(appState.squashY - 1.0) > 0.004 ||
    Math.abs(appState.squashVelX) > 0.02 ||
    Math.abs(appState.squashVelY) > 0.02 ||
    isCompanionOrbSettling();

  const isActiveMotion =
    ACTIVE_MOTION_STATES.has(appState.state) ||
    needsFullScreen ||
    appState.rhythmIntensity > 0.12 ||
    hasActiveActionProps3D() ||
    cursorWake ||
    isSettling ||
    appState.isFileDragHovering ||
    appState.expressionTimer > 0 ||
    appState.speechLipSyncTimer > 0 ||
    appState.isRealAudioLipSync ||
    appState.isSystemMusicPlaying ||
    isAnimationOverlayActive() ||
    isTypewriterActive();

  if (isActiveMotion) {
    idleStillSec = 0;
  } else {
    idleStillSec = Math.min(10, idleStillSec + Math.min(0.05, Math.max(0.001, rawDt / 1000)));
  }

  const shouldThrottleIdle = !isActiveMotion && (appState.ecoMode || idleStillSec >= 3.0);
  if (shouldThrottleIdle) {
    if (now - lastFrameMs < 24) {
      wasThrottledIdle = true;
      scheduleNextFrame(24);
      return;
    }
  } else if (rafIntervalMs < 12.8) {
    if (now < nextRenderDueMs - 1.5) {
      wasThrottledIdle = false;
      scheduleNextFrame(0);
      return;
    }
    nextRenderDueMs = Math.max(now, nextRenderDueMs + 1000 / 60);
  }

  const delta = Math.min(0.05, Math.max(0.001, (now - lastFrameMs) / 1000));
  lastFrameMs = now;
  simElapsedSec += delta;
  const elapsed = simElapsedSec;

  beginAnimationOverlayFrame();
  stepPhysicsAndRoam(delta);
  updateP2pArena(delta, elapsed);
  trackCharacterStateTransition();

  let targetFacing = 0;
  if (appState.state === 'PUSHING' || appState.state === 'PULLING') {
    targetFacing = appState.walkDir * 1.15;
  } else if (appState.state === 'WALKING') {
    targetFacing = appState.walkDir * 0.65;
  } else if (appState.lookAtEnabled && appState.state !== 'DRAGGING') {
    targetFacing = THREE.MathUtils.clamp((appState.globalCursorX - appState.posX) / 900, -0.25, 0.25);
  }

  appState.facingAngle = THREE.MathUtils.lerp(
    appState.facingAngle,
    targetFacing,
    Math.min(1, delta * 9)
  );

  appState.avatarGroup.position.set(appState.posX, -appState.posY, appState.posZ || 0);
  appState.avatarGroup.rotation.y = appState.facingAngle;

  // Lò xo đàn hồi (Spring Squash & Stretch) cho các cú bật nhảy, chọc vui & tiếp đất
  const springDt = Math.min(0.025, delta);
  const kSpring = 210;
  const cDamp = 17.5;
  appState.squashVelX += ((1.0 - appState.squashX) * kSpring - appState.squashVelX * cDamp) * springDt;
  appState.squashVelY += ((1.0 - appState.squashY) * kSpring - appState.squashVelY * cDamp) * springDt;
  appState.squashX = THREE.MathUtils.clamp(appState.squashX + appState.squashVelX * springDt, 0.68, 1.38);
  appState.squashY = THREE.MathUtils.clamp(appState.squashY + appState.squashVelY * springDt, 0.68, 1.38);
  if (Math.abs(appState.squashX - 1.0) < 0.0015 && Math.abs(appState.squashVelX) < 0.015) {
    appState.squashX = 1.0;
    appState.squashVelX = 0;
  }
  if (Math.abs(appState.squashY - 1.0) < 0.0015 && Math.abs(appState.squashVelY) < 0.015) {
    appState.squashY = 1.0;
    appState.squashVelY = 0;
  }
  const depthScale = appState.swimDepthScale || 1.0;
  appState.avatarGroup.scale.set(
    appState.squashX * depthScale,
    appState.squashY * depthScale,
    appState.squashX * depthScale
  );
  updateGroundAura(elapsed, delta);

  if (appState.state === 'DRAGGING') {
    appState.avatarGroup.rotation.z = THREE.MathUtils.lerp(
      appState.avatarGroup.rotation.z,
      appState.dragSway + Math.sin(elapsed * 12) * 0.08,
      Math.min(1, delta * 14)
    );
    appState.dragSway *= Math.pow(0.92, delta * 60);
  } else if (
    appState.state === 'SWINGING_WINDOW' ||
    appState.state === 'BUTT_PLANT' ||
    Math.abs(appState.swingTiltAngle) > 0.002
  ) {
    appState.avatarGroup.rotation.z = THREE.MathUtils.lerp(
      appState.avatarGroup.rotation.z,
      appState.swingTiltAngle,
      Math.min(1, delta * 15)
    );
  } else {
    appState.avatarGroup.rotation.z = THREE.MathUtils.lerp(
      appState.avatarGroup.rotation.z,
      0,
      Math.min(1, delta * 10)
    );
  }

  sampleActiveVoiceLipSync(delta);

  if (appState.currentVrm) {
    animateVrmCharacter(appState.currentVrm, elapsed, delta);
  } else if (appState.currentGlbScene) {
    animateGlbCharacter(appState.currentGlbScene, elapsed, delta);
  } else {
    animateBuiltinCharacter(elapsed, delta);
  }

  updateAccessoryAnimation(elapsed, delta);
  updateRhythmAndGoose(delta, elapsed);
  updateParticles(delta);
  updateActionProps3D(delta, elapsed);
  updateWaterPool(delta, elapsed);
  updateTypewriter(delta);
  updateUiPosition(true, delta);
  applyAnimationOverlayFrame(delta);

  syncHitboxToRust();
  lastRenderedPosX = appState.posX;
  lastRenderedPosY = appState.posY;
  lastRenderedFacing = appState.facingAngle;
  renderSceneOptimized(needsFullScreen, delta);
  wasThrottledIdle = shouldThrottleIdle;
  scheduleNextFrame(shouldThrottleIdle ? 24 : 0);
}

scheduleNextFrame(0);
