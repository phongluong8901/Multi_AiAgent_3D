import * as THREE from 'three';
import { appState } from '../../core/state';
import { FaceExpression } from '../../core/types';
import {
  rigRoot,
  rigHips,
  rigTorso,
  rigHead,
  rigLeftTwinTail,
  rigRightTwinTail,
  rigLeftArm,
  rigRightArm,
  rigLeftForearm,
  rigRightForearm,
  rigLeftLeg,
  rigRightLeg,
  rigLeftShin,
  rigRightShin,
  lerpRot,
} from '../rigState';
import { updateFaceTexture } from './animeFace';

export function animateAnimeIdol(elapsed: number, _delta: number, lerpRate: number) {
  if (!rigRoot || !rigHips || !rigTorso || !rigHead) return;

  const tailSwingY = THREE.MathUtils.clamp(-appState.velX * 0.03, -0.45, 0.45);
  const tailLift = THREE.MathUtils.clamp(appState.velY * 0.025, -0.35, 0.45);
  if (rigLeftTwinTail && rigRightTwinTail) {
    lerpRot(rigLeftTwinTail, 'z', tailSwingY + Math.sin(elapsed * 3.1) * 0.06, lerpRate);
    lerpRot(rigRightTwinTail, 'z', tailSwingY - Math.sin(elapsed * 3.1) * 0.06, lerpRate);
    lerpRot(rigLeftTwinTail, 'x', tailLift, lerpRate);
    lerpRot(rigRightTwinTail, 'x', tailLift, lerpRate);
  }

  if (appState.state === 'PUSHING') {
    const step = Math.sin(elapsed * 9.0);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 58 + Math.abs(step) * 2.5, lerpRate);
    lerpRot(rigTorso, 'x', 0.32, lerpRate);
    lerpRot(rigTorso, 'z', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.06, lerpRate);
    lerpRot(rigRightArm, 'z', 0.06, lerpRate);
    lerpRot(rigLeftArm, 'x', -1.42 + step * 0.08, lerpRate);
    lerpRot(rigRightArm, 'x', -1.42 - step * 0.08, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.22, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.22, lerpRate);
    lerpRot(rigLeftLeg, 'x', -0.38 + step * 0.35, lerpRate);
    lerpRot(rigRightLeg, 'x', 0.42 - step * 0.35, lerpRate);
    lerpRot(rigLeftShin, 'x', 0.28, lerpRate);
    lerpRot(rigRightShin, 'x', 0.28, lerpRate);
  } else if (appState.state === 'PULLING') {
    const tug = Math.sin(elapsed * 7.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 57, lerpRate);
    lerpRot(rigTorso, 'x', -0.28 + tug * 0.06, lerpRate);
    lerpRot(rigTorso, 'z', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.08, lerpRate);
    lerpRot(rigRightArm, 'z', 0.08, lerpRate);
    lerpRot(rigLeftArm, 'x', -1.05 - tug * 0.12, lerpRate);
    lerpRot(rigRightArm, 'x', -1.05 - tug * 0.12, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.45, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.45, lerpRate);
    lerpRot(rigLeftLeg, 'x', -0.45, lerpRate);
    lerpRot(rigRightLeg, 'x', 0.32, lerpRate);
    lerpRot(rigLeftShin, 'x', 0.35, lerpRate);
    lerpRot(rigRightShin, 'x', 0.22, lerpRate);
  } else if (appState.state === 'SITTING_WINDOW') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 44, lerpRate);
    lerpRot(rigTorso, 'x', 0, lerpRate);
    lerpRot(rigLeftLeg, 'x', -Math.PI / 2, lerpRate);
    lerpRot(rigRightLeg, 'x', -Math.PI / 2, lerpRate);
    lerpRot(rigLeftShin, 'x', Math.PI / 2 + Math.sin(elapsed * 3.5) * 0.22, lerpRate);
    lerpRot(rigRightShin, 'x', Math.PI / 2 + Math.cos(elapsed * 3.5) * 0.22, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.2, lerpRate);
    lerpRot(rigRightArm, 'z', 0.2, lerpRate);
    lerpRot(rigLeftArm, 'x', -0.35, lerpRate);
    lerpRot(rigRightArm, 'x', -0.35, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.4, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.4, lerpRate);
  } else if (appState.state === 'WALKING') {
    const isExhausted = appState.energy <= 25;
    const walkFreq = isExhausted ? 4.5 : 9.5;
    const stride = Math.sin(elapsed * walkFreq);
    rigHips.position.y = THREE.MathUtils.lerp(
      rigHips.position.y,
      isExhausted ? 56 + Math.abs(stride) * 2 : 62 + Math.abs(stride) * 4,
      lerpRate
    );
    lerpRot(rigTorso, 'x', isExhausted ? 0.20 : 0.06, lerpRate);
    lerpRot(rigLeftLeg, 'x', stride * (isExhausted ? 0.32 : 0.55), lerpRate);
    lerpRot(rigRightLeg, 'x', -stride * (isExhausted ? 0.32 : 0.55), lerpRate);
    lerpRot(rigLeftShin, 'x', Math.max(0, -stride * (isExhausted ? 0.35 : 0.6)), lerpRate);
    lerpRot(rigRightShin, 'x', Math.max(0, stride * (isExhausted ? 0.35 : 0.6)), lerpRate);
    lerpRot(rigLeftArm, 'z', -0.18, lerpRate);
    lerpRot(rigRightArm, 'z', 0.18, lerpRate);
    lerpRot(rigLeftArm, 'x', -stride * (isExhausted ? 0.22 : 0.45), lerpRate);
    lerpRot(rigRightArm, 'x', stride * (isExhausted ? 0.22 : 0.45), lerpRate);
    lerpRot(rigLeftForearm, 'x', isExhausted ? -0.15 : -0.3, lerpRate);
    lerpRot(rigRightForearm, 'x', isExhausted ? -0.15 : -0.3, lerpRate);
  } else if (appState.state === 'FALLING' || appState.state === 'JUMPING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -2.35 + Math.sin(elapsed * 14) * 0.25, lerpRate);
    lerpRot(rigRightArm, 'z', 2.35 - Math.sin(elapsed * 14) * 0.25, lerpRate);
    lerpRot(rigLeftLeg, 'x', Math.sin(elapsed * 12) * 0.4, lerpRate);
    lerpRot(rigRightLeg, 'x', -Math.sin(elapsed * 12) * 0.4, lerpRate);
    lerpRot(rigLeftShin, 'x', 0.45, lerpRate);
    lerpRot(rigRightShin, 'x', 0.45, lerpRate);
  } else if (appState.state === 'DRAGGING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -1.8 + Math.sin(elapsed * 15) * 0.3, lerpRate);
    lerpRot(rigRightArm, 'z', 1.8 - Math.sin(elapsed * 15) * 0.3, lerpRate);
    lerpRot(rigLeftLeg, 'x', Math.sin(elapsed * 14) * 0.35, lerpRate);
    lerpRot(rigRightLeg, 'x', -Math.sin(elapsed * 14) * 0.35, lerpRate);
  } else if (appState.state === 'DANCING') {
    const beat = Math.sin(elapsed * 8.0);
    const beatCos = Math.cos(elapsed * 8.0);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + Math.abs(beat) * 7, lerpRate);
    lerpRot(rigTorso, 'x', 0, lerpRate);
    lerpRot(rigTorso, 'z', beatCos * 0.12, lerpRate);
    lerpRot(rigLeftArm, 'z', -1.8 + beat * 0.55, lerpRate);
    lerpRot(rigRightArm, 'z', 1.8 + beat * 0.55, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.7 + beatCos * 0.3, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.7 - beatCos * 0.3, lerpRate);
    lerpRot(rigLeftLeg, 'x', Math.max(0, beat) * 0.4, lerpRate);
    lerpRot(rigRightLeg, 'x', Math.max(0, -beat) * 0.4, lerpRate);
  } else if (appState.state === 'WAVING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.2, lerpRate);
    lerpRot(rigRightArm, 'z', 2.4 + Math.sin(elapsed * 11) * 0.35, lerpRate);
    lerpRot(rigRightForearm, 'z', Math.sin(elapsed * 11) * 0.3, lerpRate);
    lerpRot(rigLeftLeg, 'x', 0, lerpRate);
    lerpRot(rigRightLeg, 'x', 0, lerpRate);
  } else if (appState.state === 'HEADPAT') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 60, lerpRate);
    lerpRot(rigTorso, 'x', 0, lerpRate);
    lerpRot(rigHead, 'z', Math.sin(elapsed * 7) * 0.15, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.35, lerpRate);
    lerpRot(rigRightArm, 'z', 0.35, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.8, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.8, lerpRate);
  } else if (appState.state === 'SCANNING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + Math.sin(elapsed * 5) * 2, lerpRate);
    lerpRot(rigTorso, 'x', 0.04, lerpRate);
    lerpRot(rigTorso, 'z', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.22, lerpRate);
    lerpRot(rigLeftArm, 'x', -0.2, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.45, lerpRate);
    lerpRot(rigRightArm, 'z', 0.35, lerpRate);
    lerpRot(rigRightArm, 'x', -1.4, lerpRate);
    lerpRot(rigRightForearm, 'x', -1.1, lerpRate);
    lerpRot(rigLeftLeg, 'x', 0, lerpRate);
    lerpRot(rigRightLeg, 'x', 0, lerpRate);
    lerpRot(rigLeftShin, 'x', 0, lerpRate);
    lerpRot(rigRightShin, 'x', 0, lerpRate);
  } else if (appState.state === 'ALERT') {
    const jump = Math.abs(Math.sin(elapsed * 16));
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + jump * 6, lerpRate);
    lerpRot(rigTorso, 'x', -0.05, lerpRate);
    lerpRot(rigTorso, 'z', Math.sin(elapsed * 18) * 0.08, lerpRate);
    lerpRot(rigLeftArm, 'z', -2.5 + Math.sin(elapsed * 18) * 0.35, lerpRate);
    lerpRot(rigRightArm, 'z', 2.5 - Math.sin(elapsed * 18) * 0.35, lerpRate);
    lerpRot(rigLeftArm, 'x', 0, lerpRate);
    lerpRot(rigRightArm, 'x', 0, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.35, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.35, lerpRate);
    lerpRot(rigLeftLeg, 'x', jump * 0.2, lerpRate);
    lerpRot(rigRightLeg, 'x', -jump * 0.2, lerpRate);
  } else if (appState.state === 'EATING') {
    const chew = Math.abs(Math.sin(elapsed * 10));
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 60 + chew * 3.5, lerpRate);
    lerpRot(rigTorso, 'x', 0.08, lerpRate);
    lerpRot(rigTorso, 'z', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.15, lerpRate);
    lerpRot(rigRightArm, 'z', 0.15, lerpRate);
    lerpRot(rigLeftArm, 'x', -1.1, lerpRate);
    lerpRot(rigRightArm, 'x', -1.1, lerpRate);
    lerpRot(rigLeftForearm, 'x', -1.15, lerpRate);
    lerpRot(rigRightForearm, 'x', -1.15, lerpRate);
    lerpRot(rigHead, 'x', Math.sin(elapsed * 12) * 0.12, lerpRate);
    lerpRot(rigLeftLeg, 'x', 0, lerpRate);
    lerpRot(rigRightLeg, 'x', 0, lerpRate);
  } else if (appState.state === 'TIRED') {
    const pant = Math.sin(elapsed * 4.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 48 + pant * 1.5, lerpRate);
    lerpRot(rigTorso, 'x', 0.28 + pant * 0.03, lerpRate);
    lerpRot(rigTorso, 'z', 0, lerpRate);
    lerpRot(rigHead, 'x', 0.22, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.12, lerpRate);
    lerpRot(rigRightArm, 'z', 0.12, lerpRate);
    lerpRot(rigLeftArm, 'x', 0.15, lerpRate);
    lerpRot(rigRightArm, 'x', 0.15, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.1, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.1, lerpRate);
    lerpRot(rigLeftLeg, 'x', -1.15, lerpRate);
    lerpRot(rigRightLeg, 'x', -1.15, lerpRate);
    lerpRot(rigLeftShin, 'x', 1.2, lerpRate);
    lerpRot(rigRightShin, 'x', 1.2, lerpRate);
  } else if (appState.state === 'FLYING_ROCKET') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0.35, lerpRate);
    lerpRot(rigLeftArm, 'x', 0.8, lerpRate);
    lerpRot(rigRightArm, 'x', 0.8, lerpRate);
    lerpRot(rigLeftLeg, 'x', -0.5, lerpRate);
    lerpRot(rigRightLeg, 'x', -0.5, lerpRate);
  } else if (appState.state === 'SWIMMING') {
    const kick = Math.sin(elapsed * 10);
    const stroke = Math.sin(elapsed * 4.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 48 + Math.sin(elapsed * 4) * 3, lerpRate);
    lerpRot(rigTorso, 'x', 0.45, lerpRate);
    lerpRot(rigTorso, 'z', Math.sin(elapsed * 2) * 0.08, lerpRate);
    lerpRot(rigLeftArm, 'x', stroke * 0.6 - 0.4, lerpRate);
    lerpRot(rigRightArm, 'x', -stroke * 0.6 - 0.4, lerpRate);
    lerpRot(rigLeftArm, 'z', 0.5, lerpRate);
    lerpRot(rigRightArm, 'z', -0.5, lerpRate);
    lerpRot(rigLeftLeg, 'x', kick * 0.35 - 0.3, lerpRate);
    lerpRot(rigRightLeg, 'x', -kick * 0.35 - 0.3, lerpRate);
  } else if (appState.state === 'FISHING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 58, lerpRate);
    lerpRot(rigTorso, 'x', -0.2, lerpRate);
    lerpRot(rigRightArm, 'x', -1.4, lerpRate);
    lerpRot(rigRightArm, 'z', 0.3, lerpRate);
  } else if (appState.state === 'CLIMBING') {
    const climb = Math.sin(elapsed * 11.0);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + Math.abs(climb) * 3, lerpRate);
    lerpRot(rigTorso, 'x', -0.14, lerpRate);
    lerpRot(rigTorso, 'z', climb * 0.08, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.25, lerpRate);
    lerpRot(rigRightArm, 'z', 0.25, lerpRate);
    lerpRot(rigLeftArm, 'x', -2.1 + climb * 0.55, lerpRate);
    lerpRot(rigRightArm, 'x', -2.1 - climb * 0.55, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.45, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.45, lerpRate);
    lerpRot(rigLeftLeg, 'x', -0.55 - climb * 0.45, lerpRate);
    lerpRot(rigRightLeg, 'x', -0.55 + climb * 0.45, lerpRate);
    lerpRot(rigLeftShin, 'x', 0.65, lerpRate);
    lerpRot(rigRightShin, 'x', 0.65, lerpRate);
  } else if (appState.state === 'PARACHUTING') {
    const sway = Math.sin(elapsed * 3.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0.06, lerpRate);
    lerpRot(rigTorso, 'z', sway * 0.1, lerpRate);
    lerpRot(rigLeftArm, 'z', -2.65, lerpRate);
    lerpRot(rigRightArm, 'z', 2.65, lerpRate);
    lerpRot(rigLeftArm, 'x', -0.2, lerpRate);
    lerpRot(rigRightArm, 'x', -0.2, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.25, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.25, lerpRate);
    lerpRot(rigLeftLeg, 'x', sway * 0.25, lerpRate);
    lerpRot(rigRightLeg, 'x', -sway * 0.25, lerpRate);
    lerpRot(rigLeftShin, 'x', 0.35, lerpRate);
    lerpRot(rigRightShin, 'x', 0.35, lerpRate);
  } else if (appState.state === 'BACKFLIP') {
    const progress = Math.min(1, appState.stateTimer / 0.85);
    rigRoot.rotation.x = -progress * Math.PI * 2;
    rigRoot.rotation.y = 0;
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 64, lerpRate);
    lerpRot(rigTorso, 'x', 0.35, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.4, lerpRate);
    lerpRot(rigRightArm, 'z', 0.4, lerpRate);
    lerpRot(rigLeftArm, 'x', -1.8, lerpRate);
    lerpRot(rigRightArm, 'x', -1.8, lerpRate);
    lerpRot(rigLeftLeg, 'x', -0.95, lerpRate);
    lerpRot(rigRightLeg, 'x', -0.95, lerpRate);
    lerpRot(rigLeftShin, 'x', 1.45, lerpRate);
    lerpRot(rigRightShin, 'x', 1.45, lerpRate);
  } else if (appState.state === 'SPIN') {
    rigRoot.rotation.x = 0;
    rigRoot.rotation.y = (appState.stateTimer * Math.PI * 5) % (Math.PI * 2);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 64 + Math.abs(Math.sin(elapsed * 10)) * 5, lerpRate);
    lerpRot(rigTorso, 'x', 0, lerpRate);
    lerpRot(rigTorso, 'z', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -1.4, lerpRate);
    lerpRot(rigRightArm, 'z', 1.4, lerpRate);
    lerpRot(rigLeftArm, 'x', 0, lerpRate);
    lerpRot(rigRightArm, 'x', 0, lerpRate);
    lerpRot(rigLeftLeg, 'x', 0.2, lerpRate);
    lerpRot(rigRightLeg, 'x', -0.2, lerpRate);
  } else if (appState.state === 'SWINGING_WINDOW') {
    const kick = Math.sin(elapsed * 11);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', -0.08, lerpRate);
    lerpRot(rigTorso, 'z', kick * 0.05, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.2, lerpRate);
    lerpRot(rigRightArm, 'z', 0.2, lerpRate);
    lerpRot(rigLeftArm, 'x', -2.8, lerpRate);
    lerpRot(rigRightArm, 'x', -2.8, lerpRate);
    lerpRot(rigLeftLeg, 'x', kick * 0.35, lerpRate);
    lerpRot(rigRightLeg, 'x', -kick * 0.35, lerpRate);
    lerpRot(rigLeftLeg, 'z', 0, lerpRate);
    lerpRot(rigRightLeg, 'z', 0, lerpRate);
    lerpRot(rigLeftShin, 'x', 0.35, lerpRate);
    lerpRot(rigRightShin, 'x', 0.35, lerpRate);
  } else if (appState.state === 'BUTT_PLANT') {
    const wobble = Math.sin(elapsed * 8.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 26, lerpRate);
    lerpRot(rigTorso, 'x', -0.26, lerpRate);
    lerpRot(rigTorso, 'z', wobble * 0.08, lerpRate);
    lerpRot(rigHead, 'x', 0.24, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.75, lerpRate);
    lerpRot(rigRightArm, 'z', 0.75, lerpRate);
    lerpRot(rigLeftArm, 'x', 0.45, lerpRate);
    lerpRot(rigRightArm, 'x', 0.45, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.2, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.2, lerpRate);
    lerpRot(rigLeftLeg, 'x', -1.32, lerpRate);
    lerpRot(rigRightLeg, 'x', -1.32, lerpRate);
    lerpRot(rigLeftLeg, 'z', -0.18, lerpRate);
    lerpRot(rigRightLeg, 'z', 0.18, lerpRate);
    lerpRot(rigLeftShin, 'x', 0.08, lerpRate);
    lerpRot(rigRightShin, 'x', 0.08, lerpRate);
  } else {
    const breathe = Math.sin(elapsed * 2.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + breathe * 2.2, lerpRate);
    lerpRot(rigTorso, 'x', 0, lerpRate);
    lerpRot(rigTorso, 'z', 0, lerpRate);
    lerpRot(rigLeftArm, 'z', -0.18 - breathe * 0.03, lerpRate);
    lerpRot(rigRightArm, 'z', 0.18 + breathe * 0.03, lerpRate);
    lerpRot(rigLeftArm, 'x', breathe * 0.06, lerpRate);
    const beatWave =
      appState.isSystemMusicPlaying && appState.audioVisualizer3dEnabled
        ? Math.sin(elapsed * ((Math.max(72, appState.systemAudioBpm || 120) / 60) * Math.PI * 2)) *
          Math.min(1, appState.systemAudioPeak * 1.2 + appState.audioBeatPulse * 0.4)
        : 0;
    lerpRot(rigRightArm, 'x', -breathe * 0.06 + beatWave * 0.12, lerpRate);
    lerpRot(rigLeftForearm, 'x', -0.2 - Math.abs(beatWave) * 0.18, lerpRate);
    lerpRot(rigRightForearm, 'x', -0.2 - Math.abs(beatWave) * 0.18, lerpRate);
    lerpRot(rigRightForearm, 'z', 0, lerpRate);
    lerpRot(rigLeftLeg, 'x', 0, lerpRate);
    lerpRot(rigRightLeg, 'x', 0, lerpRate);
    lerpRot(rigLeftLeg, 'z', 0, lerpRate);
    lerpRot(rigRightLeg, 'z', 0, lerpRate);
    lerpRot(rigLeftShin, 'x', 0, lerpRate);
    lerpRot(rigRightShin, 'x', 0, lerpRate);
  }

  // Cập nhật biểu cảm mặt 2D cho Anime Idol
  const isBlinking = Math.sin(elapsed * 1.7) > 0.96;
  let expr: FaceExpression = 'neutral';
  if (isBlinking) {
    expr = 'blink';
  } else if (
    appState.expressionMood === 'happy' ||
    appState.state === 'HEADPAT' ||
    appState.state === 'DANCING' ||
    appState.state === 'WAVING' ||
    appState.state === 'EATING' ||
    appState.state === 'PARACHUTING' ||
    appState.state === 'BACKFLIP' ||
    appState.state === 'SPIN' ||
    appState.state === 'SWINGING_WINDOW'
  ) {
    expr = 'happy';
  } else if (
    appState.expressionMood === 'surprised' ||
    appState.state === 'DRAGGING' ||
    appState.state === 'FALLING' ||
    appState.state === 'ALERT'
  ) {
    expr = 'surprised';
  } else if (appState.expressionMood === 'sad' || appState.state === 'TIRED' || appState.state === 'BUTT_PLANT') {
    expr = 'sad';
  } else if (
    appState.isRealAudioLipSync
      ? appState.speechAudioLevel > 0.08
      : appState.speechLipSyncTimer > 0 && Math.sin(elapsed * 18) > 0
  ) {
    expr = 'talk';
  }
  updateFaceTexture(expr);
}
