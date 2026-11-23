import * as THREE from 'three';
import { appState } from '../../core/state';
import {
  rigRoot,
  rigHips,
  rigTorso,
  rigLeftLeg,
  rigRightLeg,
  rigLeftShin,
  rigRightShin,
  duckNodes,
  lerpRot,
} from '../rigState';

export function animateMicroDuck(elapsed: number, delta: number, lerpRate: number) {
  if (!rigRoot || !rigHips || !rigTorso) return;

  const isSpecialAir =
    appState.state === 'BACKFLIP' ||
    appState.state === 'SPIN' ||
    appState.state === 'PARACHUTING' ||
    appState.state === 'FLYING_ROCKET' ||
    appState.state === 'DRAGGING' ||
    appState.state === 'CLIMBING';

  const isExhausted = appState.energy <= 25;

  const isFastRoll =
    appState.state === 'WALKING' &&
    !isExhausted &&
    (appState.duckCrouchRoll || appState.foodTarget !== null || appState.stateTimer > 1.8);

  let targetNeckPitch = 0.14 + Math.sin(elapsed * 2.2) * 0.04;

  const weatherTorsoZ =
    appState.state === 'IDLE' || appState.state === 'SITTING_WINDOW'
      ? appState.weatherMode === 'cold'
        ? Math.sin(elapsed * 26) * 0.032
        : appState.weatherMode === 'wind'
        ? 0.07 + Math.sin(elapsed * 4.5) * 0.04
        : 0
      : 0;

  if (!isSpecialAir) {
    if (appState.state === 'SITTING_WINDOW' || appState.state === 'TIRED') {
      const isTired = appState.state === 'TIRED';
      const pant = isTired ? Math.sin(elapsed * 2.2) : 0;
      rigHips.position.y = THREE.MathUtils.lerp(
        rigHips.position.y,
        isTired ? 42.0 + pant * 1.0 : 44.5,
        lerpRate
      );
      lerpRot(rigTorso, 'x', isTired ? 0.30 + pant * 0.05 : 0.12, lerpRate);
      lerpRot(rigTorso, 'z', isTired ? 0 : weatherTorsoZ, lerpRate);
      lerpRot(rigLeftLeg, 'x', isTired ? 0.88 : 0.78, lerpRate);
      lerpRot(rigRightLeg, 'x', isTired ? 0.88 : 0.78, lerpRate);
      lerpRot(rigLeftShin, 'x', isTired ? -1.45 : -1.32, lerpRate);
      lerpRot(rigRightShin, 'x', isTired ? -1.45 : -1.32, lerpRate);
      targetNeckPitch = isTired ? 0.52 + pant * 0.06 : 0.08;
    } else if (isFastRoll) {
      rigHips.position.y = THREE.MathUtils.lerp(
        rigHips.position.y,
        53 + Math.sin(elapsed * 22) * 1.2,
        lerpRate
      );
      lerpRot(rigTorso, 'x', 0.34, lerpRate);
      lerpRot(rigTorso, 'z', Math.sin(elapsed * 9) * 0.06, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.56, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.56, lerpRate);
      lerpRot(rigLeftShin, 'x', -1.04, lerpRate);
      lerpRot(rigRightShin, 'x', -1.04, lerpRate);
      targetNeckPitch = -0.44;
    } else if (appState.state === 'WALKING') {
      const walkFreq = isExhausted ? 4.2 : 9.5;
      const stride = Math.sin(elapsed * walkFreq);
      rigHips.position.y = THREE.MathUtils.lerp(
        rigHips.position.y,
        isExhausted ? 58 + Math.abs(stride) * 1.8 : 66 + Math.abs(stride) * 3.5,
        lerpRate
      );
      lerpRot(rigTorso, 'x', isExhausted ? 0.22 : 0.06, lerpRate);
      lerpRot(rigTorso, 'z', stride * (isExhausted ? 0.07 : 0.14), lerpRate);
      lerpRot(rigLeftLeg, 'x', stride * (isExhausted ? 0.22 : 0.38), lerpRate);
      lerpRot(rigRightLeg, 'x', -stride * (isExhausted ? 0.22 : 0.38), lerpRate);
      lerpRot(rigLeftShin, 'x', -stride * (isExhausted ? 0.20 : 0.36), lerpRate);
      lerpRot(rigRightShin, 'x', stride * (isExhausted ? 0.20 : 0.36), lerpRate);
      targetNeckPitch = isExhausted
        ? 0.42 + Math.abs(stride) * 0.05
        : 0.16 + Math.abs(stride) * 0.1;
    } else if (appState.state === 'DANCING') {
      const beat = Math.sin(elapsed * 8.0);
      const beatCos = Math.cos(elapsed * 8.0);
      rigHips.position.y = THREE.MathUtils.lerp(
        rigHips.position.y,
        54 + Math.abs(beat) * 12,
        lerpRate
      );
      lerpRot(rigTorso, 'x', 0.18 - Math.abs(beat) * 0.16, lerpRate);
      lerpRot(rigTorso, 'z', beatCos * 0.15, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.38 - Math.abs(beat) * 0.32, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.38 - Math.abs(beat) * 0.32, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.7 + Math.abs(beat) * 0.58, lerpRate);
      lerpRot(rigRightShin, 'x', -0.7 + Math.abs(beat) * 0.58, lerpRate);
      targetNeckPitch = -0.18 + beat * 0.14;
    } else if (appState.state === 'PUSHING') {
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 58, lerpRate);
      lerpRot(rigTorso, 'x', 0.28, lerpRate);
      lerpRot(rigTorso, 'z', 0, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.42, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.42, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.78, lerpRate);
      lerpRot(rigRightShin, 'x', -0.78, lerpRate);
      targetNeckPitch = -0.22;
    } else if (appState.state === 'PULLING') {
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 58, lerpRate);
      lerpRot(rigTorso, 'x', -0.2, lerpRate);
      lerpRot(rigTorso, 'z', 0, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.38, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.38, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.72, lerpRate);
      lerpRot(rigRightShin, 'x', -0.72, lerpRate);
      targetNeckPitch = 0.25;
    } else if (appState.state === 'RADAR') {
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 64, lerpRate);
      lerpRot(rigTorso, 'x', 0.1, lerpRate);
      lerpRot(rigTorso, 'z', Math.sin(elapsed * 4) * 0.08, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.1, lerpRate);
      lerpRot(rigRightLeg, 'x', -0.1, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.1, lerpRate);
      lerpRot(rigRightShin, 'x', 0.1, lerpRate);
      targetNeckPitch = -0.12;
    } else if (appState.state === 'FISHING') {
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 56, lerpRate);
      lerpRot(rigTorso, 'x', -0.22, lerpRate);
      lerpRot(rigTorso, 'z', Math.sin(elapsed * 6) * 0.05, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.42, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.42, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.84, lerpRate);
      lerpRot(rigRightShin, 'x', -0.84, lerpRate);
      targetNeckPitch = 0.22;
    } else if (appState.state === 'SWIMMING') {
      const paddle = Math.sin(elapsed * 11);
      const rollWave = Math.sin(elapsed * 2.8);
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 48 + Math.sin(elapsed * 4.2) * 2.5, lerpRate);
      lerpRot(rigTorso, 'x', 0.46, lerpRate);
      lerpRot(rigTorso, 'z', rollWave * 0.08, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.68 + paddle * 0.42, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.68 - paddle * 0.42, lerpRate);
      lerpRot(rigLeftShin, 'x', -1.25 + paddle * 0.38, lerpRate);
      lerpRot(rigRightShin, 'x', -1.25 - paddle * 0.38, lerpRate);
      targetNeckPitch = -0.32;
    } else if (appState.state === 'SWINGING_WINDOW') {
      const kick = Math.sin(elapsed * 11);
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 64, lerpRate);
      lerpRot(rigTorso, 'x', -0.08, lerpRate);
      lerpRot(rigTorso, 'z', kick * 0.06, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.25 + kick * 0.34, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.25 - kick * 0.34, lerpRate);
      lerpRot(rigLeftLeg, 'z', 0, lerpRate);
      lerpRot(rigRightLeg, 'z', 0, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.38, lerpRate);
      lerpRot(rigRightShin, 'x', -0.38, lerpRate);
      targetNeckPitch = -0.22;
    } else if (appState.state === 'BUTT_PLANT') {
      const wobble = Math.sin(elapsed * 8.5);
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 26, lerpRate);
      lerpRot(rigTorso, 'x', -0.26, lerpRate);
      lerpRot(rigTorso, 'z', wobble * 0.07, lerpRate);
      lerpRot(rigLeftLeg, 'x', -1.18, lerpRate);
      lerpRot(rigRightLeg, 'x', -1.18, lerpRate);
      lerpRot(rigLeftLeg, 'z', -0.22, lerpRate);
      lerpRot(rigRightLeg, 'z', 0.22, lerpRate);
      lerpRot(rigLeftShin, 'x', 0.14, lerpRate);
      lerpRot(rigRightShin, 'x', 0.14, lerpRate);
      targetNeckPitch = 0.28 + wobble * 0.12;
    } else if (appState.state === 'SLEEP') {
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 41, lerpRate);
      lerpRot(rigTorso, 'x', 0.42, lerpRate);
      lerpRot(rigTorso, 'z', 0, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.95, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.95, lerpRate);
      lerpRot(rigLeftLeg, 'z', 0, lerpRate);
      lerpRot(rigRightLeg, 'z', 0, lerpRate);
      lerpRot(rigLeftShin, 'x', -1.55, lerpRate);
      lerpRot(rigRightShin, 'x', -1.55, lerpRate);
      targetNeckPitch = 0.58;
    } else {
      const breathe = Math.sin(elapsed * 2.4);
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 66 + breathe * 1.4, lerpRate);
      lerpRot(rigTorso, 'x', appState.isFileDragHovering ? -0.14 : 0, lerpRate);
      lerpRot(
        rigTorso,
        'z',
        appState.state === 'ALERT' ? Math.sin(elapsed * 18) * 0.08 : weatherTorsoZ,
        lerpRate
      );
      lerpRot(rigLeftLeg, 'x', 0, lerpRate);
      lerpRot(rigRightLeg, 'x', 0, lerpRate);
      lerpRot(rigLeftLeg, 'z', 0, lerpRate);
      lerpRot(rigRightLeg, 'z', 0, lerpRate);
      lerpRot(rigLeftShin, 'x', 0, lerpRate);
      lerpRot(rigRightShin, 'x', 0, lerpRate);
      if (appState.state === 'ALERT') {
        targetNeckPitch = -0.08 + Math.sin(elapsed * 16) * 0.1;
      } else if (appState.isFileDragHovering) {
        targetNeckPitch = -0.34 + Math.sin(elapsed * 8) * 0.05;
      }
    }

    if (appState.isFileDragHovering) {
      targetNeckPitch = -0.34 + Math.sin(elapsed * 8) * 0.05;
    }

    if (appState.state === 'SWIMMING' && duckNodes.feet.length === 2) {
      const paddle = Math.sin(elapsed * 11);
      duckNodes.feet[0].rotation.x = 0.38 + paddle * 0.28;
      duckNodes.feet[1].rotation.x = 0.38 - paddle * 0.28;
    } else if (duckNodes.feet.length === 2 && rigLeftLeg && rigLeftShin && rigRightLeg && rigRightShin) {
      duckNodes.feet[0].rotation.x = -(rigLeftLeg.rotation.x + rigLeftShin.rotation.x);
      duckNodes.feet[1].rotation.x = -(rigRightLeg.rotation.x + rigRightShin.rotation.x);
    }
  } else if (duckNodes.feet.length === 2) {
    duckNodes.feet[0].rotation.x = 0;
    duckNodes.feet[1].rotation.x = 0;
  }

  if (duckNodes.neck) {
    duckNodes.neck.rotation.x = THREE.MathUtils.lerp(
      duckNodes.neck.rotation.x,
      targetNeckPitch,
      Math.min(1, delta * 10)
    );
  }

  const rollerDrop = isFastRoll ? -2.6 : 0.6;
  duckNodes.footRollers.forEach((roller) => {
    roller.position.y = THREE.MathUtils.lerp(roller.position.y, rollerDrop, Math.min(1, delta * 12));
  });
  if (isFastRoll || (appState.state === 'WALKING' && Math.abs(appState.velX) > 0.5)) {
    duckNodes.wheels.forEach((wheel) => {
      wheel.rotation.x += delta * 26;
    });
  }

  if (duckNodes.beakUpper) {
    const targetUpperJaw = appState.isFileDragHovering
      ? -(0.56 + Math.sin(elapsed * 14) * 0.07)
      : appState.state === 'EATING'
      ? -(0.22 + Math.abs(Math.sin(elapsed * 14)) * 0.16)
      : 0;
    duckNodes.beakUpper.rotation.x = THREE.MathUtils.lerp(
      duckNodes.beakUpper.rotation.x,
      targetUpperJaw,
      Math.min(1, delta * 22)
    );
  }

  if (duckNodes.beakLower) {
    const isTired = appState.state === 'TIRED';
    const talking =
      appState.speechLipSyncTimer > 0 || appState.state === 'EATING' || appState.state === 'ALERT';
    const pantJaw = isTired ? 0.14 + Math.abs(Math.sin(elapsed * 2.2)) * 0.12 : 0;
    const swallowWide = appState.isFileDragHovering
      ? 1.05 + Math.sin(elapsed * 14) * 0.08
      : appState.state === 'EATING'
      ? 0.48 + Math.abs(Math.sin(elapsed * 14)) * 0.35
      : 0;
    const targetJaw =
      swallowWide > 0
        ? swallowWide
        : talking
        ? Math.abs(Math.sin(elapsed * 16)) * 0.24
        : pantJaw;
    duckNodes.beakLower.rotation.x = THREE.MathUtils.lerp(
      duckNodes.beakLower.rotation.x,
      targetJaw,
      Math.min(1, delta * 22)
    );
  }

  if (duckNodes.cameraRingMat) {
    let ringColor = 0xf59e0b; // Default warm gold
    if (appState.isFileDragHovering) {
      ringColor = Math.sin(elapsed * 14) > 0 ? 0xa855f7 : 0x22d3ee;
    } else if (appState.state === 'ALERT' || appState.expressionMood === 'surprised') {
      ringColor = 0xef4444; // Warning red
    } else if (appState.state === 'RADAR') {
      ringColor = Math.sin(elapsed * 18) > 0 ? 0x06b6d4 : 0x3b82f6;
    } else if (appState.state === 'FISHING') {
      ringColor = 0x38bdf8;
    } else if (appState.state === 'FLYING_ROCKET') {
      ringColor = 0xf97316;
    } else if (appState.state === 'SWIMMING') {
      ringColor = Math.sin(elapsed * 4.5) > 0 ? 0x06b6d4 : 0x38bdf8;
    } else if (appState.state === 'SLEEP') {
      ringColor = 0x1e293b; // Powered down slate
    } else if (appState.state === 'TIRED' || appState.energy <= 15) {
      // Nhấp nháy cảnh báo cạn kiệt pin: đỏ báo động
      ringColor = Math.sin(elapsed * 4.5) > 0 ? 0xef4444 : 0x450a0a;
    } else if (appState.energy <= 30) {
      // Năng lượng yếu: cam hổ phách
      ringColor = 0xd97706;
    } else if (appState.hunger <= 25) {
      // Đói bụng: vàng nhạt
      ringColor = 0xfbbf24;
    } else if (appState.weatherMode === 'cold') {
      ringColor = 0x7dd3fc;
    } else if (appState.weatherMode === 'wind') {
      ringColor = 0x38bdf8;
    } else if (appState.weatherMode === 'rain') {
      ringColor = 0x0284c7;
    } else if (appState.weatherMode === 'night') {
      ringColor = 0xa78bfa;
    } else if (appState.weatherMode === 'hot') {
      ringColor = 0xf97316;
    }
    duckNodes.cameraRingMat.color.setHex(ringColor);
  }
}

