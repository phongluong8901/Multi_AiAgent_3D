import * as THREE from 'three';
import { appState } from '../../core/state';
import {
  rigRoot,
  rigHips,
  rigTorso,
  rigLeftArm,
  rigRightArm,
  rigLeftLeg,
  rigRightLeg,
  rigLeftShin,
  rigRightShin,
  duckNodes,
  lerpRot,
} from '../rigState';

// Hệ thống chớp mắt sinh học cho camera MicroDuck
let nextBlinkDelay = 2.8;
let blinkTimer = 0;
let activeBlinkProgress = -1; // -1 = không chớp, 0..1 = đang chớp
let queuedSecondBlink = false;

function stepNaturalBlink(delta: number): number {
  if (appState.state === 'SLEEP') {
    activeBlinkProgress = -1;
    queuedSecondBlink = false;
    return 1;
  }

  if (activeBlinkProgress >= 0) {
    const blinkSpeed = queuedSecondBlink ? 7.8 : 6.8;
    activeBlinkProgress += delta * blinkSpeed;
    if (activeBlinkProgress >= 1) {
      if (queuedSecondBlink) {
        queuedSecondBlink = false;
        activeBlinkProgress = 0;
      } else {
        activeBlinkProgress = -1;
        nextBlinkDelay = 2.3 + Math.random() * 3.1;
        blinkTimer = 0;
      }
      return 0;
    }
    return Math.sin(activeBlinkProgress * Math.PI);
  }

  blinkTimer += delta;
  if (blinkTimer >= nextBlinkDelay) {
    activeBlinkProgress = 0;
    queuedSecondBlink = Math.random() < 0.22;
  }
  return 0;
}

export function animateMicroDuck(elapsed: number, delta: number, lerpRate: number) {
  if (!rigRoot || !rigHips || !rigTorso) return;

  const smoothFast = Math.min(1, 1 - Math.exp(-20 * delta));
  const smoothMed = Math.min(1, 1 - Math.exp(-13 * delta));

  const isAcrobaticAir =
    appState.state === 'BACKFLIP' ||
    appState.state === 'SPIN' ||
    appState.state === 'PARACHUTING' ||
    appState.state === 'FLYING_ROCKET' ||
    appState.state === 'CLIMBING';

  const isExhausted = appState.energy <= 25;

  const isFastRoll =
    appState.state === 'WALKING' &&
    !isExhausted &&
    (appState.duckCrouchRoll || appState.foodTarget !== null || appState.stateTimer > 1.8);

  let targetNeckPitch = 0.14 + Math.sin(elapsed * 2.2) * 0.038;
  let targetTorsoYaw = 0;

  // Chuyển động cánh & đuôi mặc định
  let wingFlapL = -0.10 - Math.sin(elapsed * 2.4) * 0.035; // âm = xoè nhẹ ra ngoài bên trái
  let wingFlapR = 0.10 + Math.sin(elapsed * 2.4) * 0.035;  // dương = xoè nhẹ ra ngoài bên phải
  let wingPitchL = 0;
  let wingPitchR = 0;
  let tailWagY = Math.sin(elapsed * 2.1) * 0.07;
  let tailPitchX = Math.sin(elapsed * 2.4) * 0.04;
  let earTwitch = Math.sin(elapsed * 1.9) * 0.03;

  const weatherTorsoZ =
    appState.state === 'IDLE' || appState.state === 'SITTING_WINDOW'
      ? appState.weatherMode === 'cold'
        ? Math.sin(elapsed * 26) * 0.032
        : appState.weatherMode === 'wind'
        ? 0.07 + Math.sin(elapsed * 4.5) * 0.04
        : 0
      : 0;

  if (appState.state === 'DRAGGING') {
    // Khi bị nhấc lên: đạp chân giữa không trung & vẫy cánh hốt hoảng cực sinh động
    const kick = Math.sin(elapsed * 18);
    const flutter = Math.sin(elapsed * 26);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 65 + Math.sin(elapsed * 12) * 2, smoothMed);
    lerpRot(rigTorso, 'x', -0.08 + Math.sin(elapsed * 9) * 0.06, smoothMed);
    lerpRot(rigTorso, 'z', -appState.dragSway * 0.45, smoothMed);
    lerpRot(rigLeftLeg, 'x', 0.25 + kick * 0.52, smoothFast);
    lerpRot(rigRightLeg, 'x', 0.25 - kick * 0.52, smoothFast);
    lerpRot(rigLeftLeg, 'z', -0.08, smoothMed);
    lerpRot(rigRightLeg, 'z', 0.08, smoothMed);
    lerpRot(rigLeftShin, 'x', -0.45 - Math.max(0, kick) * 0.42, smoothFast);
    lerpRot(rigRightShin, 'x', -0.45 - Math.max(0, -kick) * 0.42, smoothFast);
    if (duckNodes.feet.length === 2) {
      duckNodes.feet[0].rotation.x = THREE.MathUtils.lerp(duckNodes.feet[0].rotation.x, 0.32 + kick * 0.24, smoothFast);
      duckNodes.feet[1].rotation.x = THREE.MathUtils.lerp(duckNodes.feet[1].rotation.x, 0.32 - kick * 0.24, smoothFast);
    }
    targetNeckPitch = -0.18 + Math.sin(elapsed * 14) * 0.08;
    wingFlapL = -0.78 - flutter * 0.38;
    wingFlapR = 0.78 + flutter * 0.38;
    tailWagY = Math.sin(elapsed * 20) * 0.32;
    earTwitch = Math.sin(elapsed * 22) * 0.12;
  } else if (appState.state === 'JUMPING' || appState.state === 'FALLING') {
    // Tư thế trên không trung theo vận tốc rơi thực tế (velY < 0: bay lên, velY > 0: rơi xuống)
    const vy = THREE.MathUtils.clamp(appState.velY, -22, 22);
    const rising = vy < 0;
    const flutter = Math.sin(elapsed * (rising ? 16 : 24));
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, rising ? 69 : 64, smoothMed);
    lerpRot(rigTorso, 'x', rising ? -0.14 : 0.16, smoothMed);
    lerpRot(rigTorso, 'z', THREE.MathUtils.clamp(appState.velX * 0.015, -0.18, 0.18), smoothMed);
    lerpRot(rigLeftLeg, 'x', rising ? 0.44 : -0.16 + Math.sin(elapsed * 15) * 0.14, smoothFast);
    lerpRot(rigRightLeg, 'x', rising ? 0.44 : -0.16 - Math.sin(elapsed * 15) * 0.14, smoothFast);
    lerpRot(rigLeftShin, 'x', rising ? -0.82 : -0.18, smoothFast);
    lerpRot(rigRightShin, 'x', rising ? -0.82 : -0.18, smoothFast);
    if (duckNodes.feet.length === 2) {
      const footAngle = rising ? 0.38 : -0.22;
      duckNodes.feet[0].rotation.x = THREE.MathUtils.lerp(duckNodes.feet[0].rotation.x, footAngle, smoothFast);
      duckNodes.feet[1].rotation.x = THREE.MathUtils.lerp(duckNodes.feet[1].rotation.x, footAngle, smoothFast);
    }
    targetNeckPitch = rising ? -0.24 : 0.18;
    wingFlapL = rising ? -0.68 - flutter * 0.16 : -0.92 - flutter * 0.32;
    wingFlapR = rising ? 0.68 + flutter * 0.16 : 0.92 + flutter * 0.32;
    tailPitchX = rising ? -0.18 : 0.22;
  } else if (!isAcrobaticAir) {
    if (appState.state === 'SITTING_WINDOW' || appState.state === 'TIRED') {
      const isTired = appState.state === 'TIRED';
      const pant = isTired ? Math.sin(elapsed * 2.4) : Math.sin(elapsed * 1.8) * 0.35;
      rigHips.position.y = THREE.MathUtils.lerp(
        rigHips.position.y,
        isTired ? 42.0 + pant * 1.0 : 44.5 + pant * 0.6,
        lerpRate
      );
      lerpRot(rigTorso, 'x', isTired ? 0.30 + pant * 0.05 : 0.10, lerpRate);
      lerpRot(rigTorso, 'z', isTired ? 0 : weatherTorsoZ, lerpRate);
      lerpRot(rigLeftLeg, 'x', isTired ? 0.88 : 0.78, lerpRate);
      lerpRot(rigRightLeg, 'x', isTired ? 0.88 : 0.78, lerpRate);
      lerpRot(rigLeftShin, 'x', isTired ? -1.45 : -1.32, lerpRate);
      lerpRot(rigRightShin, 'x', isTired ? -1.45 : -1.32, lerpRate);
      targetNeckPitch = isTired ? 0.52 + pant * 0.06 : 0.08;
      wingFlapL = isTired ? -0.04 : -0.12;
      wingFlapR = isTired ? 0.04 : 0.12;
      tailWagY = isTired ? 0 : Math.sin(elapsed * 2.6) * 0.12;
    } else if (isFastRoll) {
      rigHips.position.y = THREE.MathUtils.lerp(
        rigHips.position.y,
        53 + Math.sin(elapsed * 22) * 1.1,
        lerpRate
      );
      lerpRot(rigTorso, 'x', 0.34, lerpRate);
      lerpRot(rigTorso, 'z', Math.sin(elapsed * 9) * 0.06, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.56, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.56, lerpRate);
      lerpRot(rigLeftShin, 'x', -1.04, lerpRate);
      lerpRot(rigRightShin, 'x', -1.04, lerpRate);
      targetNeckPitch = -0.44;
      wingFlapL = -0.34;
      wingFlapR = 0.34;
      wingPitchL = 0.38;
      wingPitchR = 0.38;
      tailPitchX = -0.12;
    } else if (appState.state === 'WALKING') {
      // Chu kỳ bước đi lạch bạch chuẩn BDX Droid: nhấc chân bất đối xứng, dồn trọng tâm hông & giữ đầu cân bằng
      const walkFreq = isExhausted ? 4.4 : 9.6;
      const phase = elapsed * walkFreq;
      const stride = Math.sin(phase);
      const liftL = Math.max(0, stride);
      const liftR = Math.max(0, -stride);
      const doubleBounce = Math.abs(Math.cos(phase));

      rigHips.position.y = THREE.MathUtils.lerp(
        rigHips.position.y,
        isExhausted ? 58 + doubleBounce * 1.8 : 65.2 + doubleBounce * 3.8,
        lerpRate
      );
      lerpRot(rigTorso, 'x', isExhausted ? 0.24 : 0.08 + doubleBounce * 0.03, lerpRate);
      lerpRot(rigTorso, 'z', stride * (isExhausted ? 0.07 : 0.135), lerpRate);
      targetTorsoYaw = -stride * (isExhausted ? 0.04 : 0.085);

      const ampHip = isExhausted ? 0.24 : 0.42;
      lerpRot(rigLeftLeg, 'x', stride * ampHip + liftL * 0.14, smoothFast);
      lerpRot(rigRightLeg, 'x', -stride * ampHip + liftR * 0.14, smoothFast);
      lerpRot(rigLeftLeg, 'z', -stride * 0.04, lerpRate);
      lerpRot(rigRightLeg, 'z', -stride * 0.04, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.06 - liftL * (isExhausted ? 0.28 : 0.52), smoothFast);
      lerpRot(rigRightShin, 'x', -0.06 - liftR * (isExhausted ? 0.28 : 0.52), smoothFast);

      targetNeckPitch = isExhausted
        ? 0.42 + doubleBounce * 0.05
        : 0.14 + doubleBounce * 0.08;
      wingFlapL = -0.18 - liftL * 0.14;
      wingFlapR = 0.18 + liftR * 0.14;
      wingPitchL = -stride * 0.26;
      wingPitchR = stride * 0.26;
      tailWagY = stride * 0.28;
      tailPitchX = doubleBounce * 0.10;
    } else if (appState.state === 'DANCING') {
      const beat = Math.sin(elapsed * 8.2);
      const beatCos = Math.cos(elapsed * 8.2);
      rigHips.position.y = THREE.MathUtils.lerp(
        rigHips.position.y,
        54 + Math.abs(beat) * 12,
        lerpRate
      );
      lerpRot(rigTorso, 'x', 0.16 - Math.abs(beat) * 0.16, lerpRate);
      lerpRot(rigTorso, 'z', beatCos * 0.16, lerpRate);
      targetTorsoYaw = beat * 0.18;
      lerpRot(rigLeftLeg, 'x', 0.38 - Math.abs(beat) * 0.32, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.38 - Math.abs(beat) * 0.32, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.7 + Math.abs(beat) * 0.58, lerpRate);
      lerpRot(rigRightShin, 'x', -0.7 + Math.abs(beat) * 0.58, lerpRate);
      targetNeckPitch = -0.18 + beat * 0.14;
      wingFlapL = -0.65 - Math.abs(beat) * 0.45;
      wingFlapR = 0.65 + Math.abs(beatCos) * 0.45;
      tailWagY = beatCos * 0.38;
    } else if (appState.state === 'WAVING') {
      const wave = Math.sin(elapsed * 12);
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 65.5 + Math.abs(wave) * 2.2, lerpRate);
      lerpRot(rigTorso, 'x', -0.06, lerpRate);
      lerpRot(rigTorso, 'z', -0.09 + wave * 0.04, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.05, lerpRate);
      lerpRot(rigRightLeg, 'x', -0.05, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.08, lerpRate);
      lerpRot(rigRightShin, 'x', -0.08, lerpRate);
      targetNeckPitch = -0.10 + Math.abs(wave) * 0.06;
      wingFlapL = -0.22;
      wingFlapR = 1.15 + wave * 0.32;
      wingPitchR = -0.25 + wave * 0.18;
      tailWagY = wave * 0.28;
    } else if (appState.state === 'HEADPAT') {
      const purr = Math.sin(elapsed * 9.5);
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 60.5 + purr * 1.4, lerpRate);
      lerpRot(rigTorso, 'x', 0.06, lerpRate);
      lerpRot(rigTorso, 'z', purr * 0.07, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.22, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.22, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.42, lerpRate);
      lerpRot(rigRightShin, 'x', -0.42, lerpRate);
      targetNeckPitch = 0.04;
      wingFlapL = -0.42 - Math.abs(purr) * 0.25;
      wingFlapR = 0.42 + Math.abs(purr) * 0.25;
      tailWagY = Math.sin(elapsed * 18) * 0.42;
      earTwitch = purr * 0.14;
    } else if (appState.state === 'PUSHING') {
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 58, lerpRate);
      lerpRot(rigTorso, 'x', 0.28, lerpRate);
      lerpRot(rigTorso, 'z', 0, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.42, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.42, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.78, lerpRate);
      lerpRot(rigRightShin, 'x', -0.78, lerpRate);
      targetNeckPitch = -0.22;
      wingFlapL = -0.35;
      wingFlapR = 0.35;
      wingPitchL = -0.5;
      wingPitchR = -0.5;
    } else if (appState.state === 'PULLING') {
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 58, lerpRate);
      lerpRot(rigTorso, 'x', -0.2, lerpRate);
      lerpRot(rigTorso, 'z', 0, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.38, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.38, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.72, lerpRate);
      lerpRot(rigRightShin, 'x', -0.72, lerpRate);
      targetNeckPitch = 0.25;
      wingFlapL = -0.28;
      wingFlapR = 0.28;
    } else if (appState.state === 'RADAR') {
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 64, lerpRate);
      lerpRot(rigTorso, 'x', 0.1, lerpRate);
      lerpRot(rigTorso, 'z', Math.sin(elapsed * 4) * 0.08, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.1, lerpRate);
      lerpRot(rigRightLeg, 'x', -0.1, lerpRate);
      lerpRot(rigLeftShin, 'x', -0.1, lerpRate);
      lerpRot(rigRightShin, 'x', 0.1, lerpRate);
      targetNeckPitch = -0.12;
      earTwitch = Math.sin(elapsed * 12) * 0.18;
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
      wingFlapL = -0.45 - Math.sin(elapsed * 5.5) * 0.15;
      wingFlapR = 0.45 + Math.sin(elapsed * 5.5) * 0.15;
      tailWagY = paddle * 0.22;
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
      wingFlapL = -0.52 - Math.abs(kick) * 0.2;
      wingFlapR = 0.52 + Math.abs(kick) * 0.2;
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
      wingFlapL = -0.55;
      wingFlapR = 0.55;
    } else if (appState.state === 'SLEEP') {
      const deepSleep = Math.sin(elapsed * 1.4);
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 41 + deepSleep * 0.6, lerpRate);
      lerpRot(rigTorso, 'x', 0.42 + deepSleep * 0.03, lerpRate);
      lerpRot(rigTorso, 'z', 0, lerpRate);
      lerpRot(rigLeftLeg, 'x', 0.95, lerpRate);
      lerpRot(rigRightLeg, 'x', 0.95, lerpRate);
      lerpRot(rigLeftLeg, 'z', 0, lerpRate);
      lerpRot(rigRightLeg, 'z', 0, lerpRate);
      lerpRot(rigLeftShin, 'x', -1.55, lerpRate);
      lerpRot(rigRightShin, 'x', -1.55, lerpRate);
      targetNeckPitch = 0.58 + deepSleep * 0.04;
      wingFlapL = -0.04;
      wingFlapR = 0.04;
      tailWagY = 0;
      tailPitchX = -0.08;
    } else {
      // IDLE / ALERT / EATING / SCANNING: nhịp thở đa hài tự nhiên + dồn trọng tâm rất khẽ
      const breathe = Math.sin(elapsed * 2.3) + Math.sin(elapsed * 1.15) * 0.35;
      const idleSway = Math.sin(elapsed * 0.95) * 0.024;
      rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 66 + breathe * 1.25, lerpRate);
      lerpRot(rigTorso, 'x', appState.isFileDragHovering ? -0.16 : breathe * 0.018, lerpRate);
      lerpRot(
        rigTorso,
        'z',
        appState.state === 'ALERT'
          ? Math.sin(elapsed * 18) * 0.08
          : weatherTorsoZ !== 0
          ? weatherTorsoZ
          : idleSway,
        lerpRate
      );
      lerpRot(rigLeftLeg, 'x', breathe * 0.025, lerpRate);
      lerpRot(rigRightLeg, 'x', breathe * 0.025, lerpRate);
      lerpRot(rigLeftLeg, 'z', 0, lerpRate);
      lerpRot(rigRightLeg, 'z', 0, lerpRate);
      lerpRot(rigLeftShin, 'x', -breathe * 0.05, lerpRate);
      lerpRot(rigRightShin, 'x', -breathe * 0.05, lerpRate);
      if (appState.state === 'ALERT') {
        targetNeckPitch = -0.08 + Math.sin(elapsed * 16) * 0.1;
        wingFlapL = -0.75 - Math.abs(Math.sin(elapsed * 20)) * 0.3;
        wingFlapR = 0.75 + Math.abs(Math.sin(elapsed * 20)) * 0.3;
      } else if (appState.state === 'EATING') {
        const chew = Math.abs(Math.sin(elapsed * 13));
        targetNeckPitch = 0.22 + chew * 0.12;
        wingFlapL = -0.32 - chew * 0.18;
        wingFlapR = 0.32 + chew * 0.18;
        tailWagY = Math.sin(elapsed * 15) * 0.32;
      } else if (appState.isFileDragHovering) {
        targetNeckPitch = -0.34 + Math.sin(elapsed * 8) * 0.05;
        wingFlapL = -0.58 - Math.sin(elapsed * 10) * 0.15;
        wingFlapR = 0.58 + Math.sin(elapsed * 10) * 0.15;
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
      const walkToePitchL =
        appState.state === 'WALKING' && !isFastRoll
          ? Math.max(0, Math.sin(elapsed * (isExhausted ? 4.4 : 9.6))) * 0.18
          : 0;
      const walkToePitchR =
        appState.state === 'WALKING' && !isFastRoll
          ? Math.max(0, -Math.sin(elapsed * (isExhausted ? 4.4 : 9.6))) * 0.18
          : 0;
      duckNodes.feet[0].rotation.x = -(rigLeftLeg.rotation.x + rigLeftShin.rotation.x) + walkToePitchL;
      duckNodes.feet[1].rotation.x = -(rigRightLeg.rotation.x + rigRightShin.rotation.x) + walkToePitchR;
    }
  } else if (duckNodes.feet.length === 2) {
    duckNodes.feet[0].rotation.x = THREE.MathUtils.lerp(duckNodes.feet[0].rotation.x, 0.25, smoothMed);
    duckNodes.feet[1].rotation.x = THREE.MathUtils.lerp(duckNodes.feet[1].rotation.x, 0.25, smoothMed);
    wingFlapL = -0.85;
    wingFlapR = 0.85;
  }

  // Cộng hưởng lắc đầu, vỗ nhẹ cánh & vẫy đuôi theo nhịp Bass nhạc hệ thống thực tế (WASAPI Beat Sync)
  if (
    appState.isSystemMusicPlaying &&
    appState.audioVisualizer3dEnabled &&
    (appState.state === 'IDLE' ||
      appState.state === 'SITTING_WINDOW' ||
      appState.state === 'DANCING' ||
      appState.state === 'WALKING')
  ) {
    const bpmRad = (Math.max(72, appState.systemAudioBpm || 120) / 60) * Math.PI * 2;
    const beatAmp = Math.min(1, appState.systemAudioPeak * 1.25 + appState.audioBeatPulse * 0.45);
    const nodWave = Math.sin(elapsed * bpmRad);
    targetNeckPitch += nodWave * 0.14 * beatAmp + appState.audioBeatPulse * 0.1;
    targetTorsoYaw += Math.sin(elapsed * bpmRad * 0.5) * 0.1 * beatAmp;
    wingFlapL -= (0.08 + Math.abs(nodWave) * 0.18 + appState.audioBeatPulse * 0.14) * beatAmp;
    wingFlapR += (0.08 + Math.abs(nodWave) * 0.18 + appState.audioBeatPulse * 0.14) * beatAmp;
    tailWagY += Math.cos(elapsed * bpmRad * 0.5) * 0.24 * beatAmp;
    earTwitch += nodWave * 0.08 * beatAmp;
  }

  lerpRot(rigTorso, 'y', targetTorsoYaw, smoothMed);

  // Điều khiển cánh Cyber hai bên thân
  if (rigLeftArm) {
    lerpRot(rigLeftArm, 'z', wingFlapL, smoothFast);
    lerpRot(rigLeftArm, 'x', wingPitchL, smoothMed);
  }
  if (rigRightArm) {
    lerpRot(rigRightArm, 'z', wingFlapR, smoothFast);
    lerpRot(rigRightArm, 'x', wingPitchR, smoothMed);
  }

  // Điều khiển đuôi & tai biểu cảm
  if (duckNodes.tail) {
    lerpRot(duckNodes.tail, 'y', tailWagY, smoothFast);
    lerpRot(duckNodes.tail, 'x', tailPitchX, smoothMed);
  }
  if (duckNodes.earLeft && duckNodes.earRight) {
    const happyPerk = appState.expressionMood === 'happy' || appState.state === 'HEADPAT' ? 0.14 : 0;
    const sadDroop = appState.expressionMood === 'sad' || appState.state === 'TIRED' ? -0.18 : 0;
    lerpRot(duckNodes.earLeft, 'z', -(happyPerk + sadDroop + earTwitch), smoothMed);
    lerpRot(duckNodes.earRight, 'z', happyPerk + sadDroop - earTwitch, smoothMed);
  }

  if (duckNodes.neck) {
    duckNodes.neck.rotation.x = THREE.MathUtils.lerp(
      duckNodes.neck.rotation.x,
      targetNeckPitch,
      Math.min(1, 1 - Math.exp(-11 * delta))
    );
  }

  const rollerDrop = isFastRoll ? -2.6 : 0.6;
  duckNodes.footRollers.forEach((roller) => {
    roller.position.y = THREE.MathUtils.lerp(roller.position.y, rollerDrop, smoothMed);
  });
  if (isFastRoll || (appState.state === 'WALKING' && Math.abs(appState.velX) > 0.5)) {
    duckNodes.wheels.forEach((wheel) => {
      wheel.rotation.x += delta * 26;
    });
  }

  // Nhịp mấp máy mỏ đa tần tự nhiên theo biên độ sóng âm thực hoặc fallback
  const lipSyllable = appState.isRealAudioLipSync
    ? THREE.MathUtils.clamp(
        appState.speechAudioLevel * (0.88 + 0.22 * appState.speechFormantSharpness),
        0,
        1
      )
    : appState.speechLipSyncTimer > 0
    ? Math.max(0, Math.sin(elapsed * 16.5) * 0.65 + Math.sin(elapsed * 26.0) * 0.35)
    : 0;

  if (duckNodes.beakUpper) {
    const targetUpperJaw = appState.isFileDragHovering
      ? -(0.56 + Math.sin(elapsed * 14) * 0.07)
      : appState.state === 'EATING'
      ? -(0.22 + Math.abs(Math.sin(elapsed * 14)) * 0.16)
      : appState.speechLipSyncTimer > 0 || appState.isRealAudioLipSync
      ? -lipSyllable * (appState.isRealAudioLipSync ? 0.16 : 0.11)
      : appState.expressionMood === 'happy'
      ? -0.05
      : 0;
    duckNodes.beakUpper.rotation.x = THREE.MathUtils.lerp(
      duckNodes.beakUpper.rotation.x,
      targetUpperJaw,
      smoothFast
    );
  }

  if (duckNodes.beakLower) {
    const isTired = appState.state === 'TIRED';
    const pantJaw = isTired ? 0.14 + Math.abs(Math.sin(elapsed * 2.2)) * 0.12 : 0;
    const swallowWide = appState.isFileDragHovering
      ? 1.05 + Math.sin(elapsed * 14) * 0.08
      : appState.state === 'EATING'
      ? 0.48 + Math.abs(Math.sin(elapsed * 14)) * 0.35
      : 0;
    const targetJaw =
      swallowWide > 0
        ? swallowWide
        : appState.speechLipSyncTimer > 0 || appState.isRealAudioLipSync
        ? (lipSyllable > 0.02 ? 0.03 : 0) + lipSyllable * (appState.isRealAudioLipSync ? 0.38 : 0.28)
        : appState.state === 'ALERT' || appState.expressionMood === 'surprised'
        ? 0.30
        : appState.expressionMood === 'happy'
        ? 0.12
        : pantJaw;
    duckNodes.beakLower.rotation.x = THREE.MathUtils.lerp(
      duckNodes.beakLower.rotation.x,
      targetJaw,
      smoothFast
    );
  }

  // Diễn hoạt mí mắt cơ học (chớp mắt tự nhiên + biểu cảm vui/buồn/ngạc nhiên/ngủ)
  const blinkWeight = stepNaturalBlink(delta);
  if (duckNodes.eyelidUpper && duckNodes.eyelidLower) {
    let openUpper = -1.42;
    let openLower = 1.42;

    if (appState.state === 'SLEEP') {
      openUpper = 0;
      openLower = 0;
    } else if (appState.state === 'TIRED' || appState.expressionMood === 'sad') {
      openUpper = -0.40;
      openLower = 1.25;
    } else if (
      appState.state === 'HEADPAT' ||
      appState.state === 'WAVING' ||
      appState.state === 'EATING' ||
      appState.expressionMood === 'happy'
    ) {
      // Cười híp mắt thân thiện: mí dưới nâng nhẹ lên tạo vòng cung vui vẻ
      openUpper = -1.05;
      openLower = 0.32;
    } else if (
      appState.state === 'ALERT' ||
      appState.state === 'DRAGGING' ||
      appState.expressionMood === 'surprised'
    ) {
      openUpper = -1.52;
      openLower = 1.52;
    }

    const targetUpper = THREE.MathUtils.lerp(openUpper, 0, blinkWeight);
    const targetLower = THREE.MathUtils.lerp(openLower, 0, blinkWeight);
    const lidSpeed = blinkWeight > 0.05 ? Math.min(1, 1 - Math.exp(-38 * delta)) : smoothFast;
    duckNodes.eyelidUpper.rotation.x = THREE.MathUtils.lerp(
      duckNodes.eyelidUpper.rotation.x,
      targetUpper,
      lidSpeed
    );
    duckNodes.eyelidLower.rotation.x = THREE.MathUtils.lerp(
      duckNodes.eyelidLower.rotation.x,
      targetLower,
      lidSpeed
    );
  }

  if (duckNodes.camGlint) {
    const excited =
      appState.expressionMood === 'happy' ||
      appState.expressionMood === 'surprised' ||
      appState.state === 'HEADPAT';
    const glintScale =
      appState.state === 'SLEEP'
        ? 0.01
        : excited
        ? 1.22 + Math.sin(elapsed * 14) * 0.14
        : 1.0;
    duckNodes.camGlint.scale.setScalar(glintScale);
  }

  if (duckNodes.cameraRingMat) {
    let ringColor = 0xf59e0b; // Default warm gold
    if (appState.isFileDragHovering) {
      ringColor = Math.sin(elapsed * 14) > 0 ? 0xa855f7 : 0x22d3ee;
    } else if (appState.isSystemMusicPlaying && appState.audioVisualizer3dEnabled) {
      if (appState.audioBeatPulse > 0.42) {
        ringColor = 0xf472b6;
      } else {
        const beatPalette = [0x22d3ee, 0xa855f7, 0x34d399, 0xfacc15];
        ringColor = beatPalette[Math.floor(elapsed * 3.5) % beatPalette.length];
      }
    } else if (appState.state === 'ALERT' || appState.expressionMood === 'surprised') {
      ringColor = 0xef4444; // Warning red
    } else if (appState.expressionMood === 'happy' || appState.state === 'HEADPAT') {
      ringColor = 0x34d399; // Emerald joy
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
      ringColor = Math.sin(elapsed * 4.5) > 0 ? 0xef4444 : 0x450a0a;
    } else if (appState.energy <= 30) {
      ringColor = 0xd97706;
    } else if (appState.hunger <= 25) {
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
