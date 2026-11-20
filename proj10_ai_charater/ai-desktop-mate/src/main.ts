import * as THREE from 'three';
import { appState } from './core/state';
import { scene, camera, renderer, initScene, updateGroundAura } from './core/scene';
import { updateParticles } from './core/particles';
import { updateWaterPool } from './core/waterPool';
import {
  registerRhythmGooseSpeakCallback,
  updateRhythmAndGoose,
} from './core/rhythmAndGoose';
import { updateP2pArena, isP2pDuelActive } from './core/p2pArena';
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
import { registerWindowSwingSpeakCallback } from './physics/windowSwing';
import {
  initUi,
  speakMessage,
  triggerDance,
  updateTypewriter,
  updateUiPosition,
  syncHitboxToRust,
} from './frontend/ui';
import { initInput } from './frontend/input';
import { initAssistant, registerAssistantCallbacks } from './backend/assistant';

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
let simElapsedSec = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  if (document.hidden) {
    lastFrameMs = now;
    return;
  }

  const isActiveMotion =
    ACTIVE_MOTION_STATES.has(appState.state) ||
    isP2pDuelActive() ||
    appState.rhythmIntensity > 0.08;
  if (appState.ecoMode && !isActiveMotion && now - lastFrameMs < 31) {
    return;
  }

  const delta = Math.min(0.05, Math.max(0.001, (now - lastFrameMs) / 1000));
  lastFrameMs = now;
  simElapsedSec += delta;
  const elapsed = simElapsedSec;

  stepPhysicsAndRoam(delta);
  updateP2pArena(delta, elapsed);

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

  // Co giãn đàn hồi (Squash & Stretch) khi nhảy/tiếp đất & phối cảnh độ sâu Z khi bơi
  appState.squashX = THREE.MathUtils.lerp(appState.squashX, 1.0, Math.min(1, delta * 12));
  appState.squashY = THREE.MathUtils.lerp(appState.squashY, 1.0, Math.min(1, delta * 12));
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
  updateWaterPool(delta, elapsed);
  updateTypewriter(delta);
  updateUiPosition(true, delta);

  syncHitboxToRust();
  renderer.render(scene, camera);
}

animate();
