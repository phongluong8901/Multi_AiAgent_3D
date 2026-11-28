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

  const lerpRate = Math.min(1, 1 - Math.exp(-14 * delta));

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

  // 2. Hồi tiếp mượt góc xoay tổng khi thoát nhào lộn / xoay tròn (tránh giật cục 1 frame)
  if (appState.state !== 'BACKFLIP' && appState.state !== 'SPIN') {
    lerpRot(rigRoot, 'x', 0, Math.min(1, 1 - Math.exp(-16 * delta)));
    lerpRot(rigRoot, 'y', 0, Math.min(1, 1 - Math.exp(-16 * delta)));
    lerpRot(rigRoot, 'z', 0, Math.min(1, 1 - Math.exp(-16 * delta)));
  }

  // 3. Chạy diễn hoạt chuyên biệt cho từng nhân vật (không chồng chéo xương Idol lên MicroDuck)
  if (appState.builtinModelType === 'microduck') {
    if (appState.state === 'BACKFLIP') {
      const spinAngle = -elapsed * 11.5;
      rigRoot.rotation.x = spinAngle;
    } else if (appState.state === 'SPIN') {
      rigRoot.rotation.y = elapsed * 14.0;
    }
    animateMicroDuck(elapsed, delta, lerpRate);
  } else {
    animateAnimeIdol(elapsed, delta, lerpRate);
  }

  // 4. Áp dụng góc nhìn và hướng đầu
  if (appState.state === 'RADAR') {
    lookYaw = Math.sin(elapsed * 5.5) * 0.72;
    lookPitch = Math.cos(elapsed * 3.2) * 0.28;
  } else if (appState.state === 'SLEEP') {
    lookYaw = 0;
    lookPitch = 0.45;
  } else if (appState.state === 'DRAGGING' && appState.builtinModelType === 'microduck') {
    lookYaw = Math.sin(elapsed * 7.5) * 0.22;
    lookPitch = -0.14;
  }

  if (appState.state !== 'HEADPAT') {
    const idleTiltZ =
      appState.builtinModelType === 'microduck' && appState.state === 'IDLE'
        ? Math.sin(elapsed * 1.35) * 0.035
        : 0;
    lerpRot(rigHead, 'z', idleTiltZ, lerpRate);
  } else if (appState.builtinModelType === 'microduck') {
    lerpRot(rigHead, 'z', Math.sin(elapsed * 7.2) * 0.16, lerpRate);
  }
  lerpRot(rigHead, 'y', lookYaw, lerpRate);
  if (appState.state !== 'EATING' && appState.state !== 'TIRED') {
    lerpRot(rigHead, 'x', lookPitch, lerpRate);
  }
}

