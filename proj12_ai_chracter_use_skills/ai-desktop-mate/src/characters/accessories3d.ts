import * as THREE from 'three';
import { appState } from '../core/state';
import { AccessoryType } from '../core/types';
import { spawnParticles } from '../core/particles';
import { rigHead } from './rigState';

export type { AccessoryType };

const ACCESSORY_LIST: AccessoryType[] = [
  'crown',
  'cyber_visor',
  'headset',
  'propeller',
  'halo',
  'sun_hat_glasses',
  'rain_umbrella',
  'winter_beanie',
  'none',
];

const ACCESSORY_LABELS: Record<AccessoryType, string> = {
  none: 'Tháo phụ kiện',
  crown: 'Vương Miện Hoàng Gia',
  cyber_visor: 'Kính Mát Cyber Neon',
  headset: 'Tai Nghe Gaming LED',
  propeller: 'Mũ Chong Chóng Tre',
  halo: 'Vòng Hào Quang Thiên Thần',
  sun_hat_glasses: 'Nón Rơm Đi Nắng & Kính Râm',
  rain_umbrella: 'Ô Dù Che Mưa 3D',
  winter_beanie: 'Mũ Len Mùa Đông Ấm Áp',
};

let accessoryGroup: THREE.Group | null = null;
let propellerBladeGroup: THREE.Group | null = null;
let haloGroup: THREE.Group | null = null;
let haloBaseY = 50;
let speakCb: ((msg: string) => void) | null = null;

export function registerAccessorySpeakCallback(cb: (msg: string) => void) {
  speakCb = cb;
}

function speak(msg: string) {
  if (speakCb) {
    speakCb(msg);
  }
}

function disposeAccessoryGroup() {
  if (!accessoryGroup) return;
  if (accessoryGroup.parent) {
    accessoryGroup.parent.remove(accessoryGroup);
  }
  accessoryGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  accessoryGroup = null;
  propellerBladeGroup = null;
  haloGroup = null;
}

function buildAccessoryMeshes(type: AccessoryType) {
  disposeAccessoryGroup();
  if (type === 'none') return;

  let parentNode: THREE.Object3D | null = null;
  let topPos = new THREE.Vector3(0, 39, -3);
  let eyePos = new THREE.Vector3(0, 18.5, 9.5);
  let earOffsetX = 31;
  let earY = 20;
  let earZ = -4;
  let overallScale = 1.0;

  if (appState.currentVrm) {
    const headBone = appState.currentVrm.humanoid?.getNormalizedBoneNode('head');
    if (!headBone) return;
    parentNode = headBone;
    overallScale = 0.0055;
    topPos = new THREE.Vector3(0, 42, 0);
    eyePos = new THREE.Vector3(0, 18, 22);
    earOffsetX = 24;
    earY = 20;
    earZ = 0;
  } else if (rigHead) {
    parentNode = rigHead;
    if (appState.builtinModelType === 'microduck') {
      topPos = new THREE.Vector3(0, 39, -3);
      eyePos = new THREE.Vector3(0, 18.5, 9.5);
      earOffsetX = 31;
      earY = 20;
      earZ = -4;
      overallScale = 1.0;
    } else {
      topPos = new THREE.Vector3(0, 47, 0);
      eyePos = new THREE.Vector3(0, 23, 24);
      earOffsetX = 25;
      earY = 23;
      earZ = 0;
      overallScale = 0.9;
    }
  }

  if (!parentNode) return;

  const group = new THREE.Group();
  group.scale.setScalar(overallScale);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.25,
    roughness: 0.22,
    metalness: 0.78,
  });

  if (type === 'crown') {
    const crown = new THREE.Group();
    crown.position.copy(topPos);
    crown.position.y += 2;

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 14, 7, 24, 1, false),
      goldMat
    );
    band.position.y = 3.5;
    crown.add(band);

    const gemMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const spikeGeo = new THREE.ConeGeometry(3.2, 10, 8);
    const gemGeo = new THREE.SphereGeometry(1.9, 10, 10);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sx = Math.cos(a) * 14.2;
      const sz = Math.sin(a) * 14.2;
      const spike = new THREE.Mesh(spikeGeo, goldMat);
      spike.position.set(sx, 11.2, sz);
      crown.add(spike);

      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.set(Math.cos(a) * 16.0, 4.2, Math.sin(a) * 16.0);
      crown.add(gem);
    }

    group.add(crown);
  } else if (type === 'cyber_visor') {
    const visor = new THREE.Group();
    visor.position.copy(eyePos);

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.7,
      roughness: 0.1,
      metalness: 0.6,
      transparent: true,
      opacity: 0.86,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.7,
    });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });

    const shield = new THREE.Mesh(new THREE.BoxGeometry(44, 10, 3.6), lensMat);
    visor.add(shield);

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(46, 2.4, 4.2), frameMat);
    topBar.position.y = 5.4;
    visor.add(topBar);

    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(45, 1.4, 4.5), accentMat);
    neonStrip.position.y = 5.4;
    visor.add(neonStrip);

    [-22.5, 22.5].forEach((sx) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 18), frameMat);
      arm.position.set(sx, 2, -8);
      visor.add(arm);
    });

    group.add(visor);
  } else if (type === 'headset') {
    const headset = new THREE.Group();

    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.55,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7,
      metalness: 0.15,
    });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const archRadius = Math.max(24, earOffsetX + 1);
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(archRadius, 2.8, 10, 28, Math.PI),
      bandMat
    );
    arch.position.set(0, earY + 1, earZ);
    headset.add(arch);

    [-1, 1].forEach((side) => {
      const cup = new THREE.Group();
      cup.position.set(side * earOffsetX, earY, earZ);

      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 10, 6, 18),
        bandMat
      );
      shell.rotation.z = Math.PI / 2;
      cup.add(shell);

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(9.2, 9.2, 2.5, 18),
        cushionMat
      );
      pad.rotation.z = Math.PI / 2;
      pad.position.x = -side * 2.5;
      cup.add(pad);

      const ledRing = new THREE.Mesh(
        new THREE.TorusGeometry(7.2, 1.2, 8, 20),
        ledMat
      );
      ledRing.rotation.y = Math.PI / 2;
      ledRing.position.x = side * 3.1;
      cup.add(ledRing);

      headset.add(cup);
    });

    const micArm = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 16, 8), bandMat);
    micArm.position.set(-earOffsetX + 2, earY - 6, earZ + 8);
    micArm.rotation.x = Math.PI * 0.35;
    micArm.rotation.z = -0.35;
    headset.add(micArm);

    const micTip = new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 10), ledMat);
    micTip.position.set(-earOffsetX + 6, earY - 9, earZ + 15);
    headset.add(micTip);

    group.add(headset);
  } else if (type === 'propeller') {
    const hat = new THREE.Group();
    hat.position.copy(topPos);

    const capMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.45,
      metalness: 0.15,
    });
    const brimMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.45,
      metalness: 0.15,
    });

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(17, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      capMat
    );
    hat.add(dome);

    const buttonPin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 7, 10),
      goldMat
    );
    buttonPin.position.y = 18.5;
    hat.add(buttonPin);

    const blades = new THREE.Group();
    blades.position.y = 21.8;
    const bladeGeo = new THREE.BoxGeometry(28, 1.2, 4.2);
    const blade1 = new THREE.Mesh(bladeGeo, brimMat);
    const blade2 = new THREE.Mesh(bladeGeo, goldMat);
    blade2.rotation.y = Math.PI / 2;
    blades.add(blade1, blade2);

    propellerBladeGroup = blades;
    hat.add(blades);
    group.add(hat);
  } else if (type === 'halo') {
    const halo = new THREE.Group();
    haloBaseY = topPos.y + 14;
    halo.position.set(topPos.x, haloBaseY, topPos.z);

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.92,
    });
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
    });

    const ring = new THREE.Mesh(new THREE.TorusGeometry(18, 2.1, 12, 32), haloMat);
    ring.rotation.x = Math.PI / 2;
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(15.5, 1.0, 8, 28), innerMat);
    glowRing.rotation.x = Math.PI / 2;
    halo.add(ring, glowRing);

    haloGroup = halo;
    group.add(halo);
  } else if (type === 'sun_hat_glasses') {
    // 1. Nón rơm rộng vành đi nắng + đai ruy-băng đỏ
    const hatGroup = new THREE.Group();
    hatGroup.position.copy(topPos);
    const strawMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      roughness: 0.65,
      metalness: 0.05,
    });
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.4,
    });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(34, 36, 2.2, 28), strawMat);
    const crownDome = new THREE.Mesh(new THREE.CylinderGeometry(15, 19, 13, 24), strawMat);
    crownDome.position.y = 7;
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(18.6, 19.2, 3.6, 24), ribbonMat);
    ribbon.position.y = 2.6;
    hatGroup.add(brim, crownDome, ribbon);
    group.add(hatGroup);

    // 2. Kính râm đen thời trang
    const glasses = new THREE.Group();
    glasses.position.copy(eyePos);
    const darkLensMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.12,
      metalness: 0.8,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.25,
      metalness: 0.7,
    });
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.7,
    });
    const leftLens = new THREE.Mesh(new THREE.BoxGeometry(19, 10, 3.2), darkLensMat);
    leftLens.position.x = -12;
    const rightLens = new THREE.Mesh(new THREE.BoxGeometry(19, 10, 3.2), darkLensMat);
    rightLens.position.x = 12;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(46, 2.2, 3.4), rimMat);
    bridge.position.y = 4.2;
    glasses.add(leftLens, rightLens, bridge);
    [-22.5, 22.5].forEach((sx) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 18), armMat);
      arm.position.set(sx, 2, -8);
      glasses.add(arm);
    });
    group.add(glasses);
  } else if (type === 'rain_umbrella') {
    // Ô/Dù che mưa 3D vòm xanh dương - viền vàng trên đầu vịt
    const umb = new THREE.Group();
    umb.position.set(topPos.x + 8, topPos.y + 28, topPos.z);
    umb.rotation.z = -0.14;
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
    });
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.75,
      roughness: 0.25,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(38, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
      canopyMat
    );
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(37.5, 1.5, 8, 28), trimMat);
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 4.5;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(2.5, 8, 10), trimMat);
    tip.position.y = 40;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 48, 10), shaftMat);
    shaft.position.y = 14;
    const hookHandle = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 1.4, 8, 16, Math.PI),
      trimMat
    );
    hookHandle.position.set(-4.2, -10, 0);
    hookHandle.rotation.z = Math.PI;
    umb.add(dome, rimRing, tip, shaft, hookHandle);
    group.add(umb);
  } else if (type === 'winter_beanie') {
    // Mũ len mùa đông đỏ + viền trắng + quả bông đỉnh
    const beanie = new THREE.Group();
    beanie.position.copy(topPos);
    const knitRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.85,
    });
    const woolWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.9,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(19, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      knitRedMat
    );
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(19.2, 4.2, 10, 24), woolWhiteMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = 1.5;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(5.5, 14, 12), woolWhiteMat);
    pom.position.y = 22.5;
    beanie.add(dome, cuff, pom);
    group.add(beanie);
  }

  parentNode.add(group);
  accessoryGroup = group;
}

export function equipAccessory3D(
  type: AccessoryType | 'random' | 'cycle',
  announce = true
): AccessoryType {
  let target: AccessoryType = 'none';

  if (type === 'cycle') {
    const idx = ACCESSORY_LIST.indexOf(appState.activeAccessory);
    target = ACCESSORY_LIST[(idx + 1) % ACCESSORY_LIST.length];
  } else if (type === 'random') {
    const choices = ACCESSORY_LIST.filter((t) => t !== 'none' && t !== appState.activeAccessory);
    target = choices[Math.floor(Math.random() * choices.length)] || 'crown';
  } else {
    target = ACCESSORY_LIST.includes(type) ? type : 'none';
  }

  appState.activeAccessory = target;
  buildAccessoryMeshes(target);

  if (appState.posX > 0 && appState.posY > 0) {
    spawnParticles(appState.posX, appState.posY - 120 * appState.modelScale, 12, 0xfacc15);
  }

  if (announce) {
    if (target === 'none') {
      speak('[3D HAT] Đã tháo phụ kiện trên đầu, trả lại vẻ tự nhiên gọn gàng!');
    } else {
      speak(`[3D HAT] Đã trang bị phụ kiện mới: ${ACCESSORY_LABELS[target]}!`);
    }
  }

  return target;
}

export function reattachActiveAccessory() {
  if (appState.activeAccessory !== 'none') {
    buildAccessoryMeshes(appState.activeAccessory);
  } else {
    disposeAccessoryGroup();
  }
}

export function updateAccessoryAnimation(elapsed: number, delta: number) {
  if (!accessoryGroup) return;

  if (propellerBladeGroup) {
    propellerBladeGroup.rotation.y += delta * (14 + appState.rhythmIntensity * 14);
  }
  if (haloGroup) {
    haloGroup.position.y = haloBaseY + Math.sin(elapsed * 4.0) * 2.2;
    haloGroup.rotation.z = Math.sin(elapsed * 1.8) * 0.08;
  }
}

