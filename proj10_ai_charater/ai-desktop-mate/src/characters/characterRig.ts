import * as THREE from 'three';
import { appState } from '../core/state';
import { FaceExpression } from '../core/types';

export let rigRoot: THREE.Group | null = null;
export let rigHips: THREE.Group | null = null;
export let rigTorso: THREE.Group | null = null;
export let rigHead: THREE.Group | null = null;
export let rigLeftTwinTail: THREE.Group | null = null;
export let rigRightTwinTail: THREE.Group | null = null;
export let rigLeftArm: THREE.Group | null = null;
export let rigRightArm: THREE.Group | null = null;
export let rigLeftForearm: THREE.Group | null = null;
export let rigRightForearm: THREE.Group | null = null;
export let rigLeftLeg: THREE.Group | null = null;
export let rigRightLeg: THREE.Group | null = null;
export let rigLeftShin: THREE.Group | null = null;
export let rigRightShin: THREE.Group | null = null;

let duckBeakLower: THREE.Group | null = null;
let duckAntennaLeft: THREE.Group | null = null;
let duckAntennaRight: THREE.Group | null = null;
let duckEyeGlowMat: THREE.MeshBasicMaterial | null = null;

let faceCanvas: HTMLCanvasElement | null = null;
let faceCtx: CanvasRenderingContext2D | null = null;
let faceTexture: THREE.CanvasTexture | null = null;
let currentDrawnExpression: FaceExpression | null = null;

export function updateFaceTexture(expression: FaceExpression) {
  if (!faceCtx || !faceCanvas || !faceTexture || currentDrawnExpression === expression) {
    return;
  }
  currentDrawnExpression = expression;

  const w = faceCanvas.width;
  const h = faceCanvas.height;
  const ctx = faceCtx;

  ctx.fillStyle = '#ffeedd';
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const eyeY = h * 0.53;
  const leftEyeX = cx - 26;
  const rightEyeX = cx + 26;

  ctx.fillStyle = 'rgba(244, 114, 182, 0.36)';
  ctx.beginPath();
  ctx.ellipse(leftEyeX - 6, eyeY + 18, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(rightEyeX + 6, eyeY + 18, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#312e81';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const browOffset =
    expression === 'surprised' ? -5 : expression === 'sad' ? 3 : 0;
  ctx.beginPath();
  ctx.moveTo(leftEyeX - 10, eyeY - 18 + browOffset);
  ctx.quadraticCurveTo(leftEyeX, eyeY - 21 + browOffset, leftEyeX + 10, eyeY - 17 + browOffset);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightEyeX - 10, eyeY - 17 + browOffset);
  ctx.quadraticCurveTo(rightEyeX, eyeY - 21 + browOffset, rightEyeX + 10, eyeY - 18 + browOffset);
  ctx.stroke();

  const drawEye = (ex: number) => {
    if (expression === 'blink') {
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(ex - 11, eyeY + 2);
      ctx.quadraticCurveTo(ex, eyeY + 6, ex + 11, eyeY + 2);
      ctx.stroke();
      return;
    }

    if (expression === 'happy') {
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(ex - 11, eyeY + 3);
      ctx.quadraticCurveTo(ex, eyeY - 9, ex + 11, eyeY + 3);
      ctx.stroke();
      return;
    }

    const rX = expression === 'surprised' ? 10 : 11;
    const rY = expression === 'surprised' ? 14 : 13;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, rX, rY, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(ex, eyeY - rY, ex, eyeY + rY);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.5, '#4f46e5');
    grad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 1, rX * 0.78, rY * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 1, rX * 0.42, rY * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 3.5, eyeY - 4, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + 3.5, eyeY + 4, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ex, eyeY + 2, rX + 1, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  };

  drawEye(leftEyeX);
  drawEye(rightEyeX);

  ctx.fillStyle = 'rgba(225, 165, 130, 0.75)';
  ctx.beginPath();
  ctx.arc(cx, eyeY + 17, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#9f1239';
  ctx.fillStyle = '#fb7185';
  ctx.lineWidth = 2.4;
  const mouthY = eyeY + 28;

  if (expression === 'happy') {
    ctx.beginPath();
    ctx.moveTo(cx - 9, mouthY - 1);
    ctx.quadraticCurveTo(cx, mouthY + 11, cx + 9, mouthY - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'surprised') {
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 3, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'talk') {
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 2, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'sad') {
    ctx.beginPath();
    ctx.moveTo(cx - 8, mouthY + 3);
    ctx.quadraticCurveTo(cx, mouthY - 6, cx + 8, mouthY + 3);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 6, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 5, cx + 6, mouthY);
    ctx.stroke();
  }

  faceTexture.needsUpdate = true;
}

export function createDetailedAnimeCharacter() {
  appState.avatarGroup.clear();
  appState.ensureHitbox();
  appState.avatarGroup.add(appState.hitBoxMesh);

  appState.currentVrm = null;
  appState.currentGlbScene = null;
  appState.currentGlbMixer = null;
  appState.builtinModelType = 'idol';

  duckBeakLower = null;
  duckAntennaLeft = null;
  duckAntennaRight = null;
  duckEyeGlowMat = null;

  rigRoot = new THREE.Group();

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x312e81,
    roughness: 0.45,
    metalness: 0.15,
  });
  const hairHighlightMat = new THREE.MeshStandardMaterial({
    color: 0x4338ca,
    roughness: 0.4,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffeedd,
    roughness: 0.65,
  });
  const uniformTopMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.5,
  });
  const navyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
  });
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    roughness: 0.4,
  });
  const accentGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });
  const sockMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.25,
  });

  faceCanvas = document.createElement('canvas');
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  faceCtx = faceCanvas.getContext('2d');
  faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  currentDrawnExpression = null;
  updateFaceTexture('neutral');

  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.6,
  });

  rigHips = new THREE.Group();
  rigHips.position.y = 62;
  rigRoot.add(rigHips);

  rigTorso = new THREE.Group();
  rigHips.add(rigTorso);

  const chestMesh = new THREE.Mesh(new THREE.CylinderGeometry(13, 11, 36, 18), uniformTopMat);
  chestMesh.position.y = 20;
  rigTorso.add(chestMesh);

  const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 16, 10, 18), navyMat);
  collarMesh.position.y = 33;
  rigTorso.add(collarMesh);

  const bowLeft = new THREE.Mesh(new THREE.ConeGeometry(5, 9, 4), ribbonMat);
  bowLeft.position.set(-4, 27, 13);
  bowLeft.rotation.z = -Math.PI / 2;
  const bowRight = new THREE.Mesh(new THREE.ConeGeometry(5, 9, 4), ribbonMat);
  bowRight.position.set(4, 27, 13);
  bowRight.rotation.z = Math.PI / 2;
  const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 10), ribbonMat);
  bowCenter.position.set(0, 27, 14);
  rigTorso.add(bowLeft, bowRight, bowCenter);

  const skirtMesh = new THREE.Mesh(new THREE.ConeGeometry(23, 24, 20, 1, false), navyMat);
  skirtMesh.position.y = 2;
  rigTorso.add(skirtMesh);

  const skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(21.5, 1.1, 8, 24), accentGlowMat);
  skirtTrim.rotation.x = Math.PI / 2;
  skirtTrim.position.y = -8;
  rigTorso.add(skirtTrim);

  rigHead = new THREE.Group();
  rigHead.position.y = 44;
  rigTorso.add(rigHead);

  const headGeo = new THREE.SphereGeometry(25, 28, 24, -Math.PI / 2, Math.PI * 2);
  const headMesh = new THREE.Mesh(headGeo, faceMat);
  headMesh.position.y = 22;
  headMesh.scale.set(1.0, 0.98, 0.94);
  rigHead.add(headMesh);

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(26.8, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairBack.position.set(0, 24, -2);
  hairBack.rotation.x = -0.3;
  rigHead.add(hairBack);

  const bangsGroup = new THREE.Group();
  bangsGroup.position.set(0, 38, 17);
  for (let i = -2; i <= 2; i++) {
    const bang = new THREE.Mesh(new THREE.ConeGeometry(5.2, 16, 6), hairHighlightMat);
    bang.position.set(i * 6.5, -4, 3 - Math.abs(i) * 1.6);
    bang.rotation.x = Math.PI + 0.25;
    bang.rotation.z = i * -0.08;
    bangsGroup.add(bang);
  }
  rigHead.add(bangsGroup);

  const leftSideLock = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.5, 26, 8), hairHighlightMat);
  leftSideLock.position.set(-20, 14, 11);
  leftSideLock.rotation.z = 0.08;
  const rightSideLock = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.5, 26, 8), hairHighlightMat);
  rightSideLock.position.set(20, 14, 11);
  rightSideLock.rotation.z = -0.08;
  rigHead.add(leftSideLock, rightSideLock);

  const createTwinTail = (side: -1 | 1): THREE.Group => {
    const tailGroup = new THREE.Group();
    tailGroup.position.set(side * 24, 32, -8);

    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(4.5, 1.6, 8, 16), accentGlowMat);
    ribbon.rotation.y = Math.PI / 2;
    tailGroup.add(ribbon);

    const upperTail = new THREE.Mesh(new THREE.ConeGeometry(7.5, 42, 12), hairMat);
    upperTail.position.set(side * 6, -20, -4);
    upperTail.rotation.z = side * 0.25;
    upperTail.rotation.x = Math.PI;
    tailGroup.add(upperTail);

    const lowerTip = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 10), hairHighlightMat);
    lowerTip.position.set(side * 11, -38, -6);
    lowerTip.rotation.z = side * 0.12;
    lowerTip.rotation.x = Math.PI;
    tailGroup.add(lowerTip);

    return tailGroup;
  };

  rigLeftTwinTail = createTwinTail(-1);
  rigRightTwinTail = createTwinTail(1);
  rigHead.add(rigLeftTwinTail, rigRightTwinTail);

  const buildArm = (side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 16, 35, 0);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.6, 18, 12), uniformTopMat);
    upperArm.position.y = -9;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -18;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 2.8, 17, 12), skinMat);
    forearm.position.y = -8.5;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 12), skinMat);
    hand.position.y = -18;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArmRig = buildArm(-1);
  const rightArmRig = buildArm(1);
  rigLeftArm = leftArmRig.shoulder;
  rigLeftForearm = leftArmRig.elbow;
  rigRightArm = rightArmRig.shoulder;
  rigRightForearm = rightArmRig.elbow;
  rigTorso.add(rigLeftArm, rigRightArm);

  const buildLeg = (side: -1 | 1): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 8.5, 0, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 4.6, 26, 12), skinMat);
    thigh.position.y = -13;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -26;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 3.6, 26, 12), sockMat);
    shin.position.y = -13;
    knee.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(9.5, 7, 15), shoeMat);
    shoe.position.set(0, -28, 3);
    knee.add(shoe);

    return { hip, knee };
  };

  const leftLegRig = buildLeg(-1);
  const rightLegRig = buildLeg(1);
  rigLeftLeg = leftLegRig.hip;
  rigLeftShin = leftLegRig.knee;
  rigRightLeg = rightLegRig.hip;
  rigRightShin = rightLegRig.knee;
  rigHips.add(rigLeftLeg, rigRightLeg);

  rigRoot.scale.setScalar(appState.modelScale);
  appState.avatarGroup.add(rigRoot);
}

/** Tạo mô hình 3D NVIDIA MicroDuck (phong cách BDX Droid) với cánh, mỏ và chân robot khớp ngược */
export function createMicroDuckCharacter() {
  appState.avatarGroup.clear();
  appState.ensureHitbox();
  appState.avatarGroup.add(appState.hitBoxMesh);

  appState.currentVrm = null;
  appState.currentGlbScene = null;
  appState.currentGlbMixer = null;
  appState.builtinModelType = 'microduck';

  faceCanvas = null;
  faceCtx = null;
  faceTexture = null;
  currentDrawnExpression = null;
  rigLeftTwinTail = null;
  rigRightTwinTail = null;

  rigRoot = new THREE.Group();

  const yellowShellMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.36,
    metalness: 0.22,
  });
  const darkChassisMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.55,
  });
  const metalJointMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.32,
    metalness: 0.75,
  });
  const orangeBillMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.42,
    metalness: 0.12,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.15,
    metalness: 0.75,
  });
  duckEyeGlowMat = new THREE.MeshBasicMaterial({
    color: 0x76b900,
  });
  const nvCoreMat = new THREE.MeshBasicMaterial({
    color: 0x76b900,
  });

  // Hông & khớp nối cơ khí
  rigHips = new THREE.Group();
  rigHips.position.y = 62;
  rigRoot.add(rigHips);

  const pelvisBlock = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 24), darkChassisMat);
  rigHips.add(pelvisBlock);

  const tailFin = new THREE.Mesh(new THREE.ConeGeometry(8, 16, 4), yellowShellMat);
  tailFin.position.set(0, 6, -15);
  tailFin.rotation.x = -Math.PI / 3;
  tailFin.rotation.y = Math.PI / 4;
  rigHips.add(tailFin);

  // Thân bầu dục BDX Droid
  rigTorso = new THREE.Group();
  rigTorso.position.y = 8;
  rigHips.add(rigTorso);

  const bodyShell = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 18), yellowShellMat);
  bodyShell.position.y = 18;
  bodyShell.scale.set(1.08, 0.94, 0.9);
  rigTorso.add(bodyShell);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(24, 20, 6), darkChassisMat);
  chestPlate.position.set(0, 18, 16);
  rigTorso.add(chestPlate);

  const nvCoreRing = new THREE.Mesh(new THREE.TorusGeometry(6, 1.4, 8, 20), nvCoreMat);
  nvCoreRing.position.set(0, 18, 19.5);
  rigTorso.add(nvCoreRing);

  const nvCoreDot = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 1.5, 16), nvCoreMat);
  nvCoreDot.rotation.x = Math.PI / 2;
  nvCoreDot.position.set(0, 18, 19.5);
  rigTorso.add(nvCoreDot);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(22, 20, 10), darkChassisMat);
  backpack.position.set(0, 19, -15);
  rigTorso.add(backpack);

  const backpackAccent = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 2), nvCoreMat);
  backpackAccent.position.set(0, 23, -20.2);
  rigTorso.add(backpackAccent);

  // Đầu MicroDuck với visor đen, mắt camera LED NVIDIA và mỏ vịt cử động
  rigHead = new THREE.Group();
  rigHead.position.y = 35;
  rigTorso.add(rigHead);

  const headDome = new THREE.Mesh(new THREE.SphereGeometry(23, 24, 18), yellowShellMat);
  headDome.position.y = 20;
  headDome.scale.set(1.16, 0.92, 1.04);
  rigHead.add(headDome);

  const visorStrip = new THREE.Mesh(new THREE.BoxGeometry(36, 13, 8), visorMat);
  visorStrip.position.set(0, 22, 19);
  rigHead.add(visorStrip);

  [-10, 10].forEach((eyeX) => {
    const lensHousing = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 4, 16), metalJointMat);
    lensHousing.rotation.x = Math.PI / 2;
    lensHousing.position.set(eyeX, 22, 22.5);
    rigHead!.add(lensHousing);

    const lensGlow = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.5, 16), duckEyeGlowMat!);
    lensGlow.rotation.x = Math.PI / 2;
    lensGlow.position.set(eyeX, 22, 24.2);
    rigHead!.add(lensGlow);
  });

  // Mỏ vịt trên
  const upperBillGroup = new THREE.Group();
  upperBillGroup.position.set(0, 13, 20);
  const upperBillBase = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 16), orangeBillMat);
  upperBillBase.position.z = 7;
  const upperBillTip = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 5, 16), orangeBillMat);
  upperBillTip.scale.set(1, 1, 0.55);
  upperBillTip.position.z = 14;
  upperBillGroup.add(upperBillBase, upperBillTip);
  rigHead.add(upperBillGroup);

  // Mỏ vịt dưới (khớp xoay khi nói / ăn / kêu quạc)
  duckBeakLower = new THREE.Group();
  duckBeakLower.position.set(0, 9, 17);
  const lowerBillBase = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 14), orangeBillMat);
  lowerBillBase.position.z = 7;
  const lowerBillTip = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 4, 16), orangeBillMat);
  lowerBillTip.scale.set(1, 1, 0.55);
  lowerBillTip.position.z = 13;
  duckBeakLower.add(lowerBillBase, lowerBillTip);
  rigHead.add(duckBeakLower);

  // Mào cảm biến + 2 ăng-ten trên đỉnh đầu
  const headCrest = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 14), darkChassisMat);
  headCrest.position.set(0, 42, -1);
  rigHead.add(headCrest);

  const buildAntenna = (side: -1 | 1): THREE.Group => {
    const antGroup = new THREE.Group();
    antGroup.position.set(side * 12, 39, -5);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 14, 8), darkChassisMat);
    stalk.position.y = 7;
    stalk.rotation.z = side * -0.18;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 10), nvCoreMat);
    tip.position.set(side * 2.2, 14.5, 0);
    antGroup.add(stalk, tip);
    return antGroup;
  };
  duckAntennaLeft = buildAntenna(-1);
  duckAntennaRight = buildAntenna(1);
  rigHead.add(duckAntennaLeft, duckAntennaRight);

  // Cánh cơ khí hai bên thân
  const buildWing = (side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 24, 24, 0);

    const servo = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 6, 12), darkChassisMat);
    servo.rotation.z = Math.PI / 2;
    shoulder.add(servo);

    const upperWing = new THREE.Mesh(new THREE.BoxGeometry(5, 18, 14), yellowShellMat);
    upperWing.position.set(side * 2, -10, 0);
    shoulder.add(upperWing);

    const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 12, 6), nvCoreMat);
    wingStripe.position.set(side * 4.5, -10, 0);
    shoulder.add(wingStripe);

    const elbow = new THREE.Group();
    elbow.position.set(side * 2, -18, 0);
    shoulder.add(elbow);

    const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 14, 11), darkChassisMat);
    lowerWing.position.y = -7;
    elbow.add(lowerWing);

    return { shoulder, elbow };
  };

  const leftWing = buildWing(-1);
  const rightWing = buildWing(1);
  rigLeftArm = leftWing.shoulder;
  rigLeftForearm = leftWing.elbow;
  rigRightArm = rightWing.shoulder;
  rigRightForearm = rightWing.elbow;
  rigTorso.add(rigLeftArm, rigRightArm);

  // Chân robot khớp ngược kiểu BDX Droid với bàn chân vịt cam
  const buildDroidLeg = (side: -1 | 1): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 11, -2, 0);

    const hipJoint = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 7, 12), metalJointMat);
    hipJoint.rotation.z = Math.PI / 2;
    hip.add(hipJoint);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(8.5, 22, 11), darkChassisMat);
    thigh.position.set(0, -11, 2);
    thigh.rotation.x = -0.18;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -22, 4);
    hip.add(knee);

    const kneeCap = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 9, 12), yellowShellMat);
    kneeCap.rotation.z = Math.PI / 2;
    knee.add(kneeCap);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.6, 26, 12), metalJointMat);
    shin.position.set(0, -13, -3);
    shin.rotation.x = 0.2;
    knee.add(shin);

    const ankleCollar = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 5, 12), darkChassisMat);
    ankleCollar.position.set(0, -27, -4);
    knee.add(ankleCollar);

    // Bàn chân vịt 3 ngón màu cam
    const footPad = new THREE.Mesh(new THREE.BoxGeometry(15, 5, 19), orangeBillMat);
    footPad.position.set(0, -32.5, 2);
    knee.add(footPad);

    return { hip, knee };
  };

  const leftLeg = buildDroidLeg(-1);
  const rightLeg = buildDroidLeg(1);
  rigLeftLeg = leftLeg.hip;
  rigLeftShin = leftLeg.knee;
  rigRightLeg = rightLeg.hip;
  rigRightShin = rightLeg.knee;
  rigHips.add(rigLeftLeg, rigRightLeg);

  rigRoot.scale.setScalar(appState.modelScale);
  appState.avatarGroup.add(rigRoot);
}

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
  const lerpRot = (obj: THREE.Object3D | null, ax: 'x' | 'y' | 'z', target: number) => {
    if (obj) {
      obj.rotation[ax] = THREE.MathUtils.lerp(obj.rotation[ax], target, lerpRate);
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
    const dy = appState.globalCursorY - (appState.posY - 115 * appState.modelScale);
    lookYaw = THREE.MathUtils.clamp(dx / 340, -0.45, 0.45);
    lookPitch = THREE.MathUtils.clamp(dy / 340, -0.28, 0.28);
  }

  const tailSwingY = THREE.MathUtils.clamp(-appState.velX * 0.03, -0.45, 0.45);
  const tailLift = THREE.MathUtils.clamp(appState.velY * 0.025, -0.35, 0.45);
  if (rigLeftTwinTail && rigRightTwinTail) {
    lerpRot(rigLeftTwinTail, 'z', tailSwingY + Math.sin(elapsed * 3.1) * 0.06);
    lerpRot(rigRightTwinTail, 'z', tailSwingY - Math.sin(elapsed * 3.1) * 0.06);
    lerpRot(rigLeftTwinTail, 'x', tailLift);
    lerpRot(rigRightTwinTail, 'x', tailLift);
  }

  if (appState.state === 'PUSHING') {
    // Tư thế nghiêng người về trước, hai tay duỗi thẳng đẩy vào cạnh cửa sổ
    const step = Math.sin(elapsed * 9.0);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 58 + Math.abs(step) * 2.5, lerpRate);
    lerpRot(rigTorso, 'x', 0.32);
    lerpRot(rigTorso, 'z', 0);
    lerpRot(rigLeftArm, 'z', -0.06);
    lerpRot(rigRightArm, 'z', 0.06);
    lerpRot(rigLeftArm, 'x', -1.42 + step * 0.08);
    lerpRot(rigRightArm, 'x', -1.42 - step * 0.08);
    lerpRot(rigLeftForearm, 'x', -0.22);
    lerpRot(rigRightForearm, 'x', -0.22);
    lerpRot(rigLeftLeg, 'x', -0.38 + step * 0.35);
    lerpRot(rigRightLeg, 'x', 0.42 - step * 0.35);
    lerpRot(rigLeftShin, 'x', 0.28);
    lerpRot(rigRightShin, 'x', 0.28);
  } else if (appState.state === 'PULLING') {
    // Tư thế ngả người ra sau, hai tay bám chặt mép cửa sổ kéo về
    const tug = Math.sin(elapsed * 7.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 57, lerpRate);
    lerpRot(rigTorso, 'x', -0.28 + tug * 0.06);
    lerpRot(rigTorso, 'z', 0);
    lerpRot(rigLeftArm, 'z', -0.08);
    lerpRot(rigRightArm, 'z', 0.08);
    lerpRot(rigLeftArm, 'x', -1.05 - tug * 0.12);
    lerpRot(rigRightArm, 'x', -1.05 - tug * 0.12);
    lerpRot(rigLeftForearm, 'x', -0.45);
    lerpRot(rigRightForearm, 'x', -0.45);
    lerpRot(rigLeftLeg, 'x', -0.45);
    lerpRot(rigRightLeg, 'x', 0.32);
    lerpRot(rigLeftShin, 'x', 0.35);
    lerpRot(rigRightShin, 'x', 0.22);
  } else if (appState.state === 'SITTING_WINDOW') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 44, lerpRate);
    lerpRot(rigTorso, 'x', 0);
    lerpRot(rigLeftLeg, 'x', -Math.PI / 2);
    lerpRot(rigRightLeg, 'x', -Math.PI / 2);
    lerpRot(rigLeftShin, 'x', Math.PI / 2 + Math.sin(elapsed * 3.5) * 0.22);
    lerpRot(rigRightShin, 'x', Math.PI / 2 + Math.cos(elapsed * 3.5) * 0.22);
    lerpRot(rigLeftArm, 'z', -0.2);
    lerpRot(rigRightArm, 'z', 0.2);
    lerpRot(rigLeftArm, 'x', -0.35);
    lerpRot(rigRightArm, 'x', -0.35);
    lerpRot(rigLeftForearm, 'x', -0.4);
    lerpRot(rigRightForearm, 'x', -0.4);
  } else if (appState.state === 'WALKING') {
    const stride = Math.sin(elapsed * 9.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + Math.abs(stride) * 4, lerpRate);
    lerpRot(rigTorso, 'x', 0.06);
    lerpRot(rigLeftLeg, 'x', stride * 0.55);
    lerpRot(rigRightLeg, 'x', -stride * 0.55);
    lerpRot(rigLeftShin, 'x', Math.max(0, -stride * 0.6));
    lerpRot(rigRightShin, 'x', Math.max(0, stride * 0.6));
    lerpRot(rigLeftArm, 'z', -0.18);
    lerpRot(rigRightArm, 'z', 0.18);
    lerpRot(rigLeftArm, 'x', -stride * 0.45);
    lerpRot(rigRightArm, 'x', stride * 0.45);
    lerpRot(rigLeftForearm, 'x', -0.3);
    lerpRot(rigRightForearm, 'x', -0.3);
  } else if (appState.state === 'FALLING' || appState.state === 'JUMPING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0);
    lerpRot(rigLeftArm, 'z', -2.35 + Math.sin(elapsed * 14) * 0.25);
    lerpRot(rigRightArm, 'z', 2.35 - Math.sin(elapsed * 14) * 0.25);
    lerpRot(rigLeftLeg, 'x', Math.sin(elapsed * 12) * 0.4);
    lerpRot(rigRightLeg, 'x', -Math.sin(elapsed * 12) * 0.4);
    lerpRot(rigLeftShin, 'x', 0.45);
    lerpRot(rigRightShin, 'x', 0.45);
  } else if (appState.state === 'DRAGGING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0);
    lerpRot(rigLeftArm, 'z', -1.8 + Math.sin(elapsed * 15) * 0.3);
    lerpRot(rigRightArm, 'z', 1.8 - Math.sin(elapsed * 15) * 0.3);
    lerpRot(rigLeftLeg, 'x', Math.sin(elapsed * 14) * 0.35);
    lerpRot(rigRightLeg, 'x', -Math.sin(elapsed * 14) * 0.35);
  } else if (appState.state === 'DANCING') {
    const beat = Math.sin(elapsed * 8.0);
    const beatCos = Math.cos(elapsed * 8.0);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + Math.abs(beat) * 7, lerpRate);
    lerpRot(rigTorso, 'x', 0);
    lerpRot(rigTorso, 'z', beatCos * 0.12);
    lerpRot(rigLeftArm, 'z', -1.8 + beat * 0.55);
    lerpRot(rigRightArm, 'z', 1.8 + beat * 0.55);
    lerpRot(rigLeftForearm, 'x', -0.7 + beatCos * 0.3);
    lerpRot(rigRightForearm, 'x', -0.7 - beatCos * 0.3);
    lerpRot(rigLeftLeg, 'x', Math.max(0, beat) * 0.4);
    lerpRot(rigRightLeg, 'x', Math.max(0, -beat) * 0.4);
  } else if (appState.state === 'WAVING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0);
    lerpRot(rigLeftArm, 'z', -0.2);
    lerpRot(rigRightArm, 'z', 2.4 + Math.sin(elapsed * 11) * 0.35);
    lerpRot(rigRightForearm, 'z', Math.sin(elapsed * 11) * 0.3);
    lerpRot(rigLeftLeg, 'x', 0);
    lerpRot(rigRightLeg, 'x', 0);
  } else if (appState.state === 'HEADPAT') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 60, lerpRate);
    lerpRot(rigTorso, 'x', 0);
    lerpRot(rigHead, 'z', Math.sin(elapsed * 7) * 0.15);
    lerpRot(rigLeftArm, 'z', -0.35);
    lerpRot(rigRightArm, 'z', 0.35);
    lerpRot(rigLeftForearm, 'x', -0.8);
    lerpRot(rigRightForearm, 'x', -0.8);
  } else if (appState.state === 'SCANNING') {
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + Math.sin(elapsed * 5) * 2, lerpRate);
    lerpRot(rigTorso, 'x', 0.04);
    lerpRot(rigTorso, 'z', 0);
    lerpRot(rigLeftArm, 'z', -0.22);
    lerpRot(rigLeftArm, 'x', -0.2);
    lerpRot(rigLeftForearm, 'x', -0.45);
    lerpRot(rigRightArm, 'z', 0.35);
    lerpRot(rigRightArm, 'x', -1.4);
    lerpRot(rigRightForearm, 'x', -1.1);
    lerpRot(rigLeftLeg, 'x', 0);
    lerpRot(rigRightLeg, 'x', 0);
    lerpRot(rigLeftShin, 'x', 0);
    lerpRot(rigRightShin, 'x', 0);
  } else if (appState.state === 'ALERT') {
    const jump = Math.abs(Math.sin(elapsed * 16));
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + jump * 6, lerpRate);
    lerpRot(rigTorso, 'x', -0.05);
    lerpRot(rigTorso, 'z', Math.sin(elapsed * 18) * 0.08);
    lerpRot(rigLeftArm, 'z', -2.5 + Math.sin(elapsed * 18) * 0.35);
    lerpRot(rigRightArm, 'z', 2.5 - Math.sin(elapsed * 18) * 0.35);
    lerpRot(rigLeftArm, 'x', 0);
    lerpRot(rigRightArm, 'x', 0);
    lerpRot(rigLeftForearm, 'x', -0.35);
    lerpRot(rigRightForearm, 'x', -0.35);
    lerpRot(rigLeftLeg, 'x', jump * 0.2);
    lerpRot(rigRightLeg, 'x', -jump * 0.2);
  } else if (appState.state === 'EATING') {
    const chew = Math.abs(Math.sin(elapsed * 10));
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 60 + chew * 3.5, lerpRate);
    lerpRot(rigTorso, 'x', 0.08);
    lerpRot(rigTorso, 'z', 0);
    lerpRot(rigLeftArm, 'z', -0.15);
    lerpRot(rigRightArm, 'z', 0.15);
    lerpRot(rigLeftArm, 'x', -1.1);
    lerpRot(rigRightArm, 'x', -1.1);
    lerpRot(rigLeftForearm, 'x', -1.15);
    lerpRot(rigRightForearm, 'x', -1.15);
    lerpRot(rigHead, 'x', Math.sin(elapsed * 12) * 0.12);
    lerpRot(rigLeftLeg, 'x', 0);
    lerpRot(rigRightLeg, 'x', 0);
  } else if (appState.state === 'TIRED') {
    const pant = Math.sin(elapsed * 4.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 48 + pant * 1.5, lerpRate);
    lerpRot(rigTorso, 'x', 0.28 + pant * 0.03);
    lerpRot(rigTorso, 'z', 0);
    lerpRot(rigHead, 'x', 0.22);
    lerpRot(rigLeftArm, 'z', -0.12);
    lerpRot(rigRightArm, 'z', 0.12);
    lerpRot(rigLeftArm, 'x', 0.15);
    lerpRot(rigRightArm, 'x', 0.15);
    lerpRot(rigLeftForearm, 'x', -0.1);
    lerpRot(rigRightForearm, 'x', -0.1);
    lerpRot(rigLeftLeg, 'x', -1.15);
    lerpRot(rigRightLeg, 'x', -1.15);
    lerpRot(rigLeftShin, 'x', 1.2);
    lerpRot(rigRightShin, 'x', 1.2);
  } else if (appState.state === 'CLIMBING') {
    const climb = Math.sin(elapsed * 11.0);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + Math.abs(climb) * 3, lerpRate);
    lerpRot(rigTorso, 'x', -0.14);
    lerpRot(rigTorso, 'z', climb * 0.08);
    lerpRot(rigLeftArm, 'z', -0.25);
    lerpRot(rigRightArm, 'z', 0.25);
    lerpRot(rigLeftArm, 'x', -2.1 + climb * 0.55);
    lerpRot(rigRightArm, 'x', -2.1 - climb * 0.55);
    lerpRot(rigLeftForearm, 'x', -0.45);
    lerpRot(rigRightForearm, 'x', -0.45);
    lerpRot(rigLeftLeg, 'x', -0.55 - climb * 0.45);
    lerpRot(rigRightLeg, 'x', -0.55 + climb * 0.45);
    lerpRot(rigLeftShin, 'x', 0.65);
    lerpRot(rigRightShin, 'x', 0.65);
  } else if (appState.state === 'PARACHUTING') {
    const sway = Math.sin(elapsed * 3.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62, lerpRate);
    lerpRot(rigTorso, 'x', 0.06);
    lerpRot(rigTorso, 'z', sway * 0.1);
    lerpRot(rigLeftArm, 'z', -2.65);
    lerpRot(rigRightArm, 'z', 2.65);
    lerpRot(rigLeftArm, 'x', -0.2);
    lerpRot(rigRightArm, 'x', -0.2);
    lerpRot(rigLeftForearm, 'x', -0.25);
    lerpRot(rigRightForearm, 'x', -0.25);
    lerpRot(rigLeftLeg, 'x', sway * 0.25);
    lerpRot(rigRightLeg, 'x', -sway * 0.25);
    lerpRot(rigLeftShin, 'x', 0.35);
    lerpRot(rigRightShin, 'x', 0.35);
  } else if (appState.state === 'BACKFLIP') {
    const progress = Math.min(1, appState.stateTimer / 0.85);
    rigRoot.rotation.x = -progress * Math.PI * 2;
    rigRoot.rotation.y = 0;
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 64, lerpRate);
    lerpRot(rigTorso, 'x', 0.35);
    lerpRot(rigLeftArm, 'z', -0.4);
    lerpRot(rigRightArm, 'z', 0.4);
    lerpRot(rigLeftArm, 'x', -1.8);
    lerpRot(rigRightArm, 'x', -1.8);
    lerpRot(rigLeftLeg, 'x', -0.95);
    lerpRot(rigRightLeg, 'x', -0.95);
    lerpRot(rigLeftShin, 'x', 1.45);
    lerpRot(rigRightShin, 'x', 1.45);
  } else if (appState.state === 'SPIN') {
    rigRoot.rotation.x = 0;
    rigRoot.rotation.y = (appState.stateTimer * Math.PI * 5) % (Math.PI * 2);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 64 + Math.abs(Math.sin(elapsed * 10)) * 5, lerpRate);
    lerpRot(rigTorso, 'x', 0);
    lerpRot(rigTorso, 'z', 0);
    lerpRot(rigLeftArm, 'z', -1.4);
    lerpRot(rigRightArm, 'z', 1.4);
    lerpRot(rigLeftArm, 'x', 0);
    lerpRot(rigRightArm, 'x', 0);
    lerpRot(rigLeftLeg, 'x', 0.2);
    lerpRot(rigRightLeg, 'x', -0.2);
  } else {
    const breathe = Math.sin(elapsed * 2.5);
    rigHips.position.y = THREE.MathUtils.lerp(rigHips.position.y, 62 + breathe * 2.2, lerpRate);
    lerpRot(rigTorso, 'x', 0);
    lerpRot(rigTorso, 'z', 0);
    lerpRot(rigLeftArm, 'z', -0.18 - breathe * 0.03);
    lerpRot(rigRightArm, 'z', 0.18 + breathe * 0.03);
    lerpRot(rigLeftArm, 'x', breathe * 0.06);
    lerpRot(rigRightArm, 'x', -breathe * 0.06);
    lerpRot(rigLeftForearm, 'x', -0.2);
    lerpRot(rigRightForearm, 'x', -0.2);
    lerpRot(rigRightForearm, 'z', 0);
    lerpRot(rigLeftLeg, 'x', 0);
    lerpRot(rigRightLeg, 'x', 0);
    lerpRot(rigLeftShin, 'x', 0);
    lerpRot(rigRightShin, 'x', 0);
  }

  if (appState.state !== 'BACKFLIP' && appState.state !== 'SPIN') {
    rigRoot.rotation.x = 0;
    rigRoot.rotation.y = 0;
  }

  // Hiệu ứng waddle dễ thương khi MicroDuck đi bộ + cử động mỏ & ăng-ten
  if (appState.builtinModelType === 'microduck') {
    if (appState.state === 'WALKING') {
      lerpRot(rigTorso, 'z', Math.sin(elapsed * 9.5) * 0.14);
    }
    if (duckBeakLower) {
      const talking = appState.speechLipSyncTimer > 0 || appState.state === 'EATING' || appState.state === 'ALERT';
      const targetJaw = talking ? Math.abs(Math.sin(elapsed * 16)) * 0.42 : 0.02;
      duckBeakLower.rotation.x = THREE.MathUtils.lerp(duckBeakLower.rotation.x, targetJaw, Math.min(1, delta * 18));
    }
    if (duckAntennaLeft && duckAntennaRight) {
      const wiggle = Math.sin(elapsed * 5.2) * 0.12 + (appState.state === 'ALERT' ? Math.sin(elapsed * 22) * 0.25 : 0);
      duckAntennaLeft.rotation.x = wiggle;
      duckAntennaRight.rotation.x = -wiggle;
    }
    if (duckEyeGlowMat) {
      const isBlink = Math.sin(elapsed * 1.7) > 0.96;
      const colorHex =
        appState.state === 'ALERT' || appState.expressionMood === 'surprised'
          ? 0xf59e0b
          : appState.state === 'TIRED'
            ? 0x64748b
            : 0x76b900;
      duckEyeGlowMat.color.setHex(isBlink ? 0x090d16 : colorHex);
    }
  }

  if (appState.state !== 'HEADPAT') {
    lerpRot(rigHead, 'z', 0);
  }
  lerpRot(rigHead, 'y', lookYaw);
  if (appState.state !== 'EATING' && appState.state !== 'TIRED') {
    lerpRot(rigHead, 'x', lookPitch);
  }

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
    appState.state === 'SPIN'
  ) {
    expr = 'happy';
  } else if (
    appState.expressionMood === 'surprised' ||
    appState.state === 'DRAGGING' ||
    appState.state === 'FALLING' ||
    appState.state === 'ALERT'
  ) {
    expr = 'surprised';
  } else if (appState.expressionMood === 'sad' || appState.state === 'TIRED') {
    expr = 'sad';
  } else if (appState.speechLipSyncTimer > 0 && Math.sin(elapsed * 18) > 0) {
    expr = 'talk';
  }
  updateFaceTexture(expr);
}

