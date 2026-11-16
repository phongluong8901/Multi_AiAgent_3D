import * as THREE from 'three';
import { appState } from './core/state';
import { scene, camera, renderer, initScene, updateGroundAura } from './core/scene';
import { updateParticles } from './core/particles';
import { createDetailedAnimeCharacter, animateBuiltinCharacter } from './characters/characterRig';
import {
  registerSpeakCallback,
  loadCachedVrm,
  loadVrmFromBlobUrl,
  animateVrmCharacter,
  animateGlbCharacter,
} from './characters/vrmManager';
import { registerPhysicsSpeakCallback, stepPhysicsAndRoam } from './physics/physics';
import { registerWindowSpeakCallback } from './physics/windowInteract';
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
initUi();
initInput();

registerSpeakCallback(speakMessage);
registerPhysicsSpeakCallback(speakMessage);
registerWindowSpeakCallback(speakMessage);
registerAssistantCallbacks(speakMessage, triggerDance);
initAssistant();

createDetailedAnimeCharacter();

loadCachedVrm().then((cached) => {
  if (cached) {
    const blobUrl = URL.createObjectURL(new Blob([cached.buffer]));
    loadVrmFromBlobUrl(blobUrl, cached.name);
  }
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, clock.getDelta());
  const elapsed = clock.getElapsedTime();

  stepPhysicsAndRoam(delta);

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

  appState.avatarGroup.position.set(appState.posX, -appState.posY, 0);
  appState.avatarGroup.rotation.y = appState.facingAngle;

  // Co giãn đàn hồi (Squash & Stretch) khi nhảy/tiếp đất
  appState.squashX = THREE.MathUtils.lerp(appState.squashX, 1.0, Math.min(1, delta * 12));
  appState.squashY = THREE.MathUtils.lerp(appState.squashY, 1.0, Math.min(1, delta * 12));
  appState.avatarGroup.scale.set(appState.squashX, appState.squashY, appState.squashX);
  updateGroundAura(elapsed);

  if (appState.state === 'DRAGGING') {
    appState.avatarGroup.rotation.z = THREE.MathUtils.lerp(
      appState.avatarGroup.rotation.z,
      appState.dragSway + Math.sin(elapsed * 12) * 0.08,
      Math.min(1, delta * 14)
    );
    appState.dragSway *= 0.92;
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

  updateParticles(delta);
  updateTypewriter(delta);
  updateUiPosition();

  syncHitboxToRust();
  renderer.render(scene, camera);
}

animate();
