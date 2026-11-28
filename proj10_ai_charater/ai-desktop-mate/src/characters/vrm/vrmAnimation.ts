import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { appState } from '../../core/state';

export function animateVrmCharacter(vrm: VRM, elapsed: number, delta: number) {
  const humanoid = vrm.humanoid;
  if (!humanoid) {
    vrm.update(delta);
    return;
  }

  const hips = humanoid.getNormalizedBoneNode('hips');
  const spine = humanoid.getNormalizedBoneNode('spine');
  const chest = humanoid.getNormalizedBoneNode('chest');
  const neck = humanoid.getNormalizedBoneNode('neck');
  const head = humanoid.getNormalizedBoneNode('head');

  const lUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
  const rUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
  const lLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
  const rLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');

  const lUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
  const rUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
  const lLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
  const rLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');

  const lerpRate = Math.min(1, delta * 12);
  const lerpAngle = (bone: THREE.Object3D | null, ax: 'x' | 'y' | 'z', target: number) => {
    if (bone) {
      bone.rotation[ax] = THREE.MathUtils.lerp(bone.rotation[ax], target, lerpRate);
    }
  };

  let lookYaw = 0;
  let lookPitch = 0;
  if (appState.state === 'SCANNING') {
    lookYaw = Math.sin(elapsed * 6) * 0.45;
    lookPitch = -0.05;
  } else if (
    appState.lookAtEnabled &&
    appState.state !== 'DRAGGING' &&
    appState.state !== 'DANCING' &&
    appState.state !== 'PUSHING' &&
    appState.state !== 'PULLING'
  ) {
    const dx = appState.globalCursorX - appState.posX;
    const dy = appState.globalCursorY - (appState.posY - 125 * appState.modelScale);
    lookYaw = THREE.MathUtils.clamp(dx / 380, -0.45, 0.45);
    lookPitch = THREE.MathUtils.clamp(dy / 380, -0.3, 0.3);
  }

  if (appState.state === 'PUSHING') {
    const step = Math.sin(elapsed * 9.0);
    lerpAngle(hips, 'x', 0.14);
    lerpAngle(spine, 'x', 0.22);
    lerpAngle(chest, 'x', 0.12);
    lerpAngle(lUpperArm, 'z', -1.25);
    lerpAngle(rUpperArm, 'z', 1.25);
    lerpAngle(lUpperArm, 'x', -1.35 + step * 0.08);
    lerpAngle(rUpperArm, 'x', -1.35 - step * 0.08);
    lerpAngle(lLowerArm, 'x', -0.25);
    lerpAngle(rLowerArm, 'x', -0.25);
    lerpAngle(lUpperLeg, 'x', -0.35 + step * 0.35);
    lerpAngle(rUpperLeg, 'x', 0.4 - step * 0.35);
    lerpAngle(lLowerLeg, 'x', 0.25);
    lerpAngle(rLowerLeg, 'x', 0.25);
  } else if (appState.state === 'PULLING') {
    const tug = Math.sin(elapsed * 7.5);
    lerpAngle(hips, 'x', -0.12);
    lerpAngle(spine, 'x', -0.18 + tug * 0.05);
    lerpAngle(chest, 'x', -0.08);
    lerpAngle(lUpperArm, 'z', -1.22);
    lerpAngle(rUpperArm, 'z', 1.22);
    lerpAngle(lUpperArm, 'x', -1.05 - tug * 0.12);
    lerpAngle(rUpperArm, 'x', -1.05 - tug * 0.12);
    lerpAngle(lLowerArm, 'x', -0.45);
    lerpAngle(rLowerArm, 'x', -0.45);
    lerpAngle(lUpperLeg, 'x', -0.4);
    lerpAngle(rUpperLeg, 'x', 0.3);
    lerpAngle(lLowerLeg, 'x', 0.35);
    lerpAngle(rLowerLeg, 'x', 0.22);
  } else if (appState.state === 'SITTING_WINDOW') {
    lerpAngle(hips, 'x', 0.08);
    lerpAngle(spine, 'x', -0.05);
    lerpAngle(chest, 'x', 0.05);
    lerpAngle(lUpperLeg, 'x', -1.35);
    lerpAngle(rUpperLeg, 'x', -1.35);
    lerpAngle(lLowerLeg, 'x', 1.35 + Math.sin(elapsed * 3.5) * 0.18);
    lerpAngle(rLowerLeg, 'x', 1.35 + Math.cos(elapsed * 3.5) * 0.18);

    lerpAngle(lUpperArm, 'z', -1.18);
    lerpAngle(rUpperArm, 'z', 1.18);
    lerpAngle(lUpperArm, 'x', -0.3);
    lerpAngle(rUpperArm, 'x', -0.3);
    lerpAngle(lLowerArm, 'x', -0.45);
    lerpAngle(rLowerArm, 'x', -0.45);
  } else if (appState.state === 'WALKING') {
    const stride = Math.sin(elapsed * 9.5);
    lerpAngle(hips, 'y', stride * 0.08);
    lerpAngle(spine, 'x', 0.08);
    lerpAngle(lUpperLeg, 'x', stride * 0.55);
    lerpAngle(rUpperLeg, 'x', -stride * 0.55);
    lerpAngle(lLowerLeg, 'x', Math.max(0, -stride * 0.65));
    lerpAngle(rLowerLeg, 'x', Math.max(0, stride * 0.65));

    lerpAngle(lUpperArm, 'z', -1.16);
    lerpAngle(rUpperArm, 'z', 1.16);
    lerpAngle(lUpperArm, 'x', -stride * 0.48);
    lerpAngle(rUpperArm, 'x', stride * 0.48);
    lerpAngle(lLowerArm, 'x', -0.35);
    lerpAngle(rLowerArm, 'x', -0.35);
  } else if (appState.state === 'FALLING' || appState.state === 'JUMPING') {
    lerpAngle(lUpperArm, 'z', -0.35 + Math.sin(elapsed * 14) * 0.25);
    lerpAngle(rUpperArm, 'z', 0.35 - Math.sin(elapsed * 14) * 0.25);
    lerpAngle(lUpperArm, 'x', -0.4);
    lerpAngle(rUpperArm, 'x', -0.4);
    lerpAngle(lLowerArm, 'x', -0.5);
    lerpAngle(rLowerArm, 'x', -0.5);

    lerpAngle(lUpperLeg, 'x', Math.sin(elapsed * 11) * 0.35 - 0.15);
    lerpAngle(rUpperLeg, 'x', -Math.sin(elapsed * 11) * 0.35 - 0.15);
    lerpAngle(lLowerLeg, 'x', 0.45);
    lerpAngle(rLowerLeg, 'x', 0.45);
  } else if (appState.state === 'DRAGGING') {
    lerpAngle(lUpperArm, 'z', -0.45 + Math.sin(elapsed * 14) * 0.2);
    lerpAngle(rUpperArm, 'z', 0.45 - Math.sin(elapsed * 14) * 0.2);
    lerpAngle(lUpperLeg, 'x', Math.sin(elapsed * 12) * 0.35);
    lerpAngle(rUpperLeg, 'x', -Math.sin(elapsed * 12) * 0.35);
    lerpAngle(lLowerLeg, 'x', 0.35);
    lerpAngle(rLowerLeg, 'x', 0.35);
  } else if (appState.state === 'DANCING') {
    const beat = Math.sin(elapsed * 8.0);
    const beatCos = Math.cos(elapsed * 8.0);
    lerpAngle(hips, 'y', beat * 0.22);
    lerpAngle(hips, 'z', beatCos * 0.08);
    lerpAngle(spine, 'z', -beatCos * 0.1);
    lerpAngle(lUpperArm, 'z', -0.55 + beat * 0.45);
    lerpAngle(rUpperArm, 'z', 0.55 + beat * 0.45);
    lerpAngle(lLowerArm, 'x', -0.8 + beatCos * 0.35);
    lerpAngle(rLowerArm, 'x', -0.8 - beatCos * 0.35);
    lerpAngle(lUpperLeg, 'x', Math.max(0, beat) * 0.35);
    lerpAngle(rUpperLeg, 'x', Math.max(0, -beat) * 0.35);
    lerpAngle(lLowerLeg, 'x', Math.max(0, -beat) * 0.4);
    lerpAngle(rLowerLeg, 'x', Math.max(0, beat) * 0.4);
  } else if (appState.state === 'WAVING') {
    lerpAngle(lUpperArm, 'z', -1.2);
    lerpAngle(lUpperArm, 'x', 0);
    lerpAngle(rUpperArm, 'z', 0.35);
    lerpAngle(rUpperArm, 'x', -0.35);
    lerpAngle(rLowerArm, 'z', Math.sin(elapsed * 10) * 0.45 + 0.4);
    lerpAngle(lUpperLeg, 'x', 0);
    lerpAngle(rUpperLeg, 'x', 0);
    lerpAngle(lLowerLeg, 'x', 0);
    lerpAngle(rLowerLeg, 'x', 0);
  } else if (appState.state === 'HEADPAT') {
    lerpAngle(spine, 'x', 0.08);
    lerpAngle(lUpperArm, 'z', -1.1);
    lerpAngle(rUpperArm, 'z', 1.1);
    lerpAngle(lLowerArm, 'x', -0.6);
    lerpAngle(rLowerArm, 'x', -0.6);
    lerpAngle(head, 'z', Math.sin(elapsed * 7) * 0.14);
  } else if (appState.state === 'SCANNING') {
    lerpAngle(hips, 'x', 0);
    lerpAngle(spine, 'x', 0.04);
    lerpAngle(lUpperArm, 'z', -1.15);
    lerpAngle(rUpperArm, 'z', 0.55);
    lerpAngle(rUpperArm, 'x', -1.15);
    lerpAngle(rLowerArm, 'x', -1.05);
    lerpAngle(lUpperLeg, 'x', 0);
    lerpAngle(rUpperLeg, 'x', 0);
  } else if (appState.state === 'ALERT') {
    const jump = Math.abs(Math.sin(elapsed * 16));
    lerpAngle(hips, 'z', Math.sin(elapsed * 18) * 0.08);
    lerpAngle(lUpperArm, 'z', -0.25 + Math.sin(elapsed * 18) * 0.3);
    lerpAngle(rUpperArm, 'z', 0.25 - Math.sin(elapsed * 18) * 0.3);
    lerpAngle(lLowerArm, 'x', -0.35);
    lerpAngle(rLowerArm, 'x', -0.35);
    lerpAngle(lUpperLeg, 'x', jump * 0.2);
    lerpAngle(rUpperLeg, 'x', -jump * 0.2);
  } else if (appState.state === 'EATING') {
    lerpAngle(spine, 'x', 0.08);
    lerpAngle(lUpperArm, 'z', -1.0);
    lerpAngle(rUpperArm, 'z', 1.0);
    lerpAngle(lUpperArm, 'x', -1.05);
    lerpAngle(rUpperArm, 'x', -1.05);
    lerpAngle(lLowerArm, 'x', -1.05);
    lerpAngle(rLowerArm, 'x', -1.05);
    lerpAngle(head, 'x', Math.sin(elapsed * 12) * 0.12);
  } else if (appState.state === 'TIRED') {
    const pant = Math.sin(elapsed * 4.5);
    lerpAngle(hips, 'x', 0.12);
    lerpAngle(spine, 'x', 0.25 + pant * 0.03);
    lerpAngle(lUpperArm, 'z', -1.15);
    lerpAngle(rUpperArm, 'z', 1.15);
    lerpAngle(lUpperArm, 'x', 0.15);
    lerpAngle(rUpperArm, 'x', 0.15);
    lerpAngle(lUpperLeg, 'x', -1.2);
    lerpAngle(rUpperLeg, 'x', -1.2);
    lerpAngle(lLowerLeg, 'x', 1.25);
    lerpAngle(rLowerLeg, 'x', 1.25);
  } else if (appState.state === 'CLIMBING') {
    const climb = Math.sin(elapsed * 11.0);
    lerpAngle(hips, 'z', climb * 0.08);
    lerpAngle(spine, 'x', -0.12);
    lerpAngle(lUpperArm, 'z', -0.45);
    lerpAngle(rUpperArm, 'z', 0.45);
    lerpAngle(lUpperArm, 'x', -1.8 + climb * 0.55);
    lerpAngle(rUpperArm, 'x', -1.8 - climb * 0.55);
    lerpAngle(lLowerArm, 'x', -0.45);
    lerpAngle(rLowerArm, 'x', -0.45);
    lerpAngle(lUpperLeg, 'x', -0.55 - climb * 0.45);
    lerpAngle(rUpperLeg, 'x', -0.55 + climb * 0.45);
    lerpAngle(lLowerLeg, 'x', 0.65);
    lerpAngle(rLowerLeg, 'x', 0.65);
  } else if (appState.state === 'PARACHUTING') {
    const sway = Math.sin(elapsed * 3.5);
    lerpAngle(hips, 'z', sway * 0.1);
    lerpAngle(spine, 'x', 0.05);
    lerpAngle(lUpperArm, 'z', -0.35);
    lerpAngle(rUpperArm, 'z', 0.35);
    lerpAngle(lUpperArm, 'x', -2.4);
    lerpAngle(rUpperArm, 'x', -2.4);
    lerpAngle(lLowerArm, 'x', -0.2);
    lerpAngle(rLowerArm, 'x', -0.2);
    lerpAngle(lUpperLeg, 'x', sway * 0.25);
    lerpAngle(rUpperLeg, 'x', -sway * 0.25);
    lerpAngle(lLowerLeg, 'x', 0.35);
    lerpAngle(rLowerLeg, 'x', 0.35);
  } else if (appState.state === 'BACKFLIP') {
    const progress = Math.min(1, appState.stateTimer / 0.85);
    if (hips) hips.rotation.x = -progress * Math.PI * 2;
    lerpAngle(spine, 'x', 0.35);
    lerpAngle(lUpperArm, 'z', -0.4);
    lerpAngle(rUpperArm, 'z', 0.4);
    lerpAngle(lUpperArm, 'x', -1.8);
    lerpAngle(rUpperArm, 'x', -1.8);
    lerpAngle(lUpperLeg, 'x', -0.9);
    lerpAngle(rUpperLeg, 'x', -0.9);
    lerpAngle(lLowerLeg, 'x', 1.4);
    lerpAngle(rLowerLeg, 'x', 1.4);
  } else if (appState.state === 'SPIN') {
    if (hips) hips.rotation.y = (appState.stateTimer * Math.PI * 5) % (Math.PI * 2);
    lerpAngle(lUpperArm, 'z', -0.2);
    lerpAngle(rUpperArm, 'z', 0.2);
    lerpAngle(lUpperArm, 'x', 0);
    lerpAngle(rUpperArm, 'x', 0);
    lerpAngle(lUpperLeg, 'x', 0.2);
    lerpAngle(rUpperLeg, 'x', -0.2);
  } else if (appState.state === 'SWINGING_WINDOW') {
    const kick = Math.sin(elapsed * 11);
    lerpAngle(hips, 'x', 0);
    lerpAngle(spine, 'x', -0.06);
    lerpAngle(lUpperArm, 'z', -0.25);
    lerpAngle(rUpperArm, 'z', 0.25);
    lerpAngle(lUpperArm, 'x', -2.6);
    lerpAngle(rUpperArm, 'x', -2.6);
    lerpAngle(lLowerArm, 'x', -0.2);
    lerpAngle(rLowerArm, 'x', -0.2);
    lerpAngle(lUpperLeg, 'x', kick * 0.35);
    lerpAngle(rUpperLeg, 'x', -kick * 0.35);
    lerpAngle(lLowerLeg, 'x', 0.35);
    lerpAngle(rLowerLeg, 'x', 0.35);
  } else if (appState.state === 'BUTT_PLANT') {
    lerpAngle(hips, 'x', 0.14);
    lerpAngle(spine, 'x', -0.24);
    lerpAngle(lUpperArm, 'z', -0.75);
    lerpAngle(rUpperArm, 'z', 0.75);
    lerpAngle(lUpperArm, 'x', 0.45);
    lerpAngle(rUpperArm, 'x', 0.45);
    lerpAngle(lUpperLeg, 'x', -1.28);
    lerpAngle(rUpperLeg, 'x', -1.28);
    lerpAngle(lLowerLeg, 'x', 0.1);
    lerpAngle(rLowerLeg, 'x', 0.1);
  } else {
    const breathe = Math.sin(elapsed * 2.4);
    if (hips && Math.abs(hips.rotation.x) > Math.PI) hips.rotation.x %= Math.PI * 2;
    lerpAngle(hips, 'x', 0);
    lerpAngle(hips, 'y', 0);
    lerpAngle(hips, 'z', 0);
    lerpAngle(spine, 'x', breathe * 0.03);
    lerpAngle(chest, 'x', breathe * 0.03);
    lerpAngle(lUpperArm, 'z', -1.18 - breathe * 0.03);
    lerpAngle(rUpperArm, 'z', 1.18 + breathe * 0.03);
    lerpAngle(lUpperArm, 'x', 0.04);
    lerpAngle(rUpperArm, 'x', 0.04);
    lerpAngle(lLowerArm, 'x', -0.2);
    lerpAngle(rLowerArm, 'x', -0.2);
    lerpAngle(rLowerArm, 'z', 0);
    lerpAngle(lUpperLeg, 'x', 0);
    lerpAngle(rUpperLeg, 'x', 0);
    lerpAngle(lLowerLeg, 'x', 0);
    lerpAngle(rLowerLeg, 'x', 0);
  }

  const beatGroove =
    appState.isSystemMusicPlaying &&
    appState.audioVisualizer3dEnabled &&
    (appState.state === 'IDLE' || appState.state === 'SITTING_WINDOW' || appState.state === 'DANCING')
      ? Math.sin(elapsed * ((Math.max(72, appState.systemAudioBpm || 120) / 60) * Math.PI * 2)) *
          Math.min(1, appState.systemAudioPeak * 1.2 + appState.audioBeatPulse * 0.4)
      : 0;

  if (appState.state !== 'HEADPAT') {
    lerpAngle(head, 'z', beatGroove * 0.08);
  }
  lerpAngle(neck, 'y', lookYaw * 0.45);
  lerpAngle(head, 'y', lookYaw * 0.55);
  lerpAngle(head, 'x', lookPitch * 0.7 + beatGroove * 0.11);

  const exp = vrm.expressionManager;
  if (exp) {
    const blinkCycle = Math.sin(elapsed * 1.7);
    const isBlinking = blinkCycle > 0.96;
    exp.setValue('blink', isBlinking ? 1.0 : 0.0);

    const isHappy =
      appState.expressionMood === 'happy' ||
      appState.state === 'HEADPAT' ||
      appState.state === 'DANCING' ||
      appState.state === 'WAVING' ||
      appState.state === 'EATING' ||
      appState.state === 'PARACHUTING' ||
      appState.state === 'BACKFLIP' ||
      appState.state === 'SPIN' ||
      appState.state === 'SWINGING_WINDOW';
    const isSurprised =
      appState.expressionMood === 'surprised' ||
      appState.state === 'DRAGGING' ||
      appState.state === 'FALLING' ||
      appState.state === 'PUSHING' ||
      appState.state === 'PULLING' ||
      appState.state === 'ALERT';
    const isSad =
      (appState.expressionMood === 'sad' ||
        appState.state === 'TIRED' ||
        appState.state === 'BUTT_PLANT') &&
      !isHappy &&
      !isSurprised;
    const isRelaxed = appState.state === 'SITTING_WINDOW';

    exp.setValue('happy', isHappy ? 0.9 : 0.0);
    exp.setValue('surprised', isSurprised ? 0.75 : 0.0);
    exp.setValue('sad', isSad ? 0.8 : 0.0);
    exp.setValue('relaxed', isRelaxed && !isHappy && !isSad ? 0.55 : 0.0);

    if (appState.isRealAudioLipSync) {
      const lvl = appState.speechAudioLevel;
      const sharp = appState.speechFormantSharpness;
      exp.setValue('aa', Math.min(1, lvl * (1 - sharp * 0.35)));
      exp.setValue('ih', Math.min(0.85, lvl * sharp * 0.78));
    } else if (appState.speechLipSyncTimer > 0) {
      const talkOsc = Math.abs(Math.sin(elapsed * 16));
      exp.setValue('aa', talkOsc * 0.7);
      exp.setValue('ih', (1 - talkOsc) * 0.35);
    } else {
      exp.setValue('aa', 0);
      exp.setValue('ih', 0);
    }
  }

  vrm.update(delta);
}

export function animateGlbCharacter(glbRoot: THREE.Group, elapsed: number, delta: number) {
  if (appState.currentGlbMixer) {
    appState.currentGlbMixer.update(delta);
  }

  const baseScale = appState.vrmBaseScale * appState.modelScale;
  const baseY = appState.vrmFloorOffset * appState.modelScale;

  glbRoot.rotation.set(0, 0, 0);
  glbRoot.scale.setScalar(baseScale);
  glbRoot.position.y = baseY;

  if (appState.state === 'BACKFLIP') {
    const progress = Math.min(1, appState.stateTimer / 0.85);
    glbRoot.rotation.x = -progress * Math.PI * 2;
    glbRoot.position.y = baseY + Math.sin(progress * Math.PI) * 55;
  } else if (appState.state === 'SPIN') {
    glbRoot.rotation.y = (appState.stateTimer * Math.PI * 5) % (Math.PI * 2);
    glbRoot.position.y = baseY + Math.abs(Math.sin(elapsed * 8)) * 12;
  } else if (appState.state === 'WALKING') {
    glbRoot.rotation.z = Math.sin(elapsed * 9.5) * 0.08;
    glbRoot.position.y = baseY + Math.abs(Math.sin(elapsed * 9.5)) * 8;
  } else if (appState.state === 'DANCING') {
    glbRoot.rotation.z = Math.sin(elapsed * 8) * 0.14;
    glbRoot.rotation.y = Math.cos(elapsed * 4) * 0.25;
    glbRoot.position.y = baseY + Math.abs(Math.sin(elapsed * 8)) * 16;
  } else if (appState.state === 'JUMPING' || appState.state === 'FALLING') {
    glbRoot.scale.set(baseScale * 0.94, baseScale * 1.08, baseScale * 0.94);
  } else if (appState.state === 'HEADPAT') {
    const squish = Math.abs(Math.sin(elapsed * 8)) * 0.08;
    glbRoot.scale.set(baseScale * (1 + squish), baseScale * (1 - squish), baseScale * (1 + squish));
  } else if (appState.state === 'TIRED') {
    glbRoot.rotation.x = 0.22;
    glbRoot.scale.set(baseScale * 1.04, baseScale * 0.92, baseScale * 1.04);
  } else if (appState.state === 'EATING') {
    glbRoot.rotation.x = Math.sin(elapsed * 14) * 0.14;
  } else if (appState.state === 'ALERT') {
    glbRoot.position.y = baseY + Math.abs(Math.sin(elapsed * 16)) * 14;
    glbRoot.rotation.z = Math.sin(elapsed * 18) * 0.12;
  } else {
    const breathe = Math.sin(elapsed * 2.5) * 0.02;
    glbRoot.scale.set(baseScale * (1 - breathe * 0.5), baseScale * (1 + breathe), baseScale * (1 - breathe * 0.5));
  }
}

