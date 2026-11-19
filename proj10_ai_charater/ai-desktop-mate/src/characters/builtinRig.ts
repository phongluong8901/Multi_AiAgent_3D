import * as THREE from 'three';
import { appState } from '../core/state';
import {
  rigRoot,
  rigHips,
  rigTorso,
  rigHead,
  lerpRot,
} from './rigState';
import { createDetailedAnimeCharacter } from './animeIdol/animeModel';
import { animateAnimeIdol } from './animeIdol/animeAnimation';
import { createMicroDuckCharacter } from './microduck/microduckModel';
import { animateMicroDuck } from './microduck/microduckAnimation';

/** Chuyển đổi qua lại giữa Anime Idol và NVIDIA MicroDuck */
export function switchBuiltinCharacterType(type: 'idol' | 'microduck') {
  if (type === 'microduck') {
    createMicroDuckCharacter();
  } else {
    createDetailedAnimeCharacter();
  }
}

export function animateBuiltinCharacter(elapsed: number, delta: number) {
  if (!rigRoot || !rigHips || !rigTorso || !rigHead) return;

  const lerpRate = Math.min(1, delta * 12);

  // 1. Tính toán hướng nhìn (Look-At)
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
    const dy = appState.globalCursorY - (appState.posY - 115 * appState.modelScale);
    lookYaw = THREE.MathUtils.clamp(dx / 340, -0.45, 0.45);
    lookPitch = THREE.MathUtils.clamp(dy / 340, -0.28, 0.28);
  }

  // 2. Chạy diễn hoạt khung xương cơ bản theo nhân vật
  animateAnimeIdol(elapsed, delta, lerpRate);

  if (appState.state !== 'BACKFLIP' && appState.state !== 'SPIN') {
    rigRoot.rotation.x = 0;
    rigRoot.rotation.y = 0;
  }

  // 3. Nếu là MicroDuck, áp dụng chuyển động servo & kinematics đặc thù
  if (appState.builtinModelType === 'microduck') {
    animateMicroDuck(elapsed, delta, lerpRate);
  }

  // 4. Áp dụng góc nhìn và hướng đầu
  if (appState.state === 'RADAR') {
    lookYaw = Math.sin(elapsed * 5.5) * 0.72;
    lookPitch = Math.cos(elapsed * 3.2) * 0.28;
  } else if (appState.state === 'SLEEP') {
    lookYaw = 0;
    lookPitch = 0.45;
  }

  if (appState.state !== 'HEADPAT') {
    lerpRot(rigHead, 'z', 0, lerpRate);
  }
  lerpRot(rigHead, 'y', lookYaw, lerpRate);
  if (appState.state !== 'EATING' && appState.state !== 'TIRED') {
    lerpRot(rigHead, 'x', lookPitch, lerpRate);
  }
}

