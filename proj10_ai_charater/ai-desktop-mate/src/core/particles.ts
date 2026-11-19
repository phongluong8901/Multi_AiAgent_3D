import * as THREE from 'three';
import { scene } from './scene';
import { appState } from './state';
import { ParticleItem } from './types';
import { isP2pSessionActive } from './p2pArena';

interface ShockwaveItem {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  baseScale: number;
}

interface FrameHighlightItem {
  mesh: THREE.LineSegments;
  life: number;
  maxLife: number;
}

const particles: ParticleItem[] = [];
const shockwaves: ShockwaveItem[] = [];
const frameHighlights: FrameHighlightItem[] = [];
let foodMesh: THREE.Group | null = null;
let ladderMesh: THREE.Group | null = null;
let parachuteMesh: THREE.Group | null = null;

interface BlackHolePortal {
  group: THREE.Group;
  mode: 'suction' | 'ejection';
  life: number;
  maxLife: number;
  x: number;
  y: number;
}
const blackHolePortals: BlackHolePortal[] = [];

let radarMesh: THREE.Group | null = null;
let radarTimer = 0;

let jetpackMesh: THREE.Group | null = null;

let weatherPropGroup: THREE.Group | null = null;
let builtWeatherPropMode: string = '';

function buildCloudCluster(colorHex: number, scale = 1.0): THREE.Group {
  const cloud = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.78,
    metalness: 0.05,
    transparent: true,
    opacity: 0.94,
  });
  const puffs: Array<[number, number, number, number]> = [
    [-16, 0, 0, 12],
    [-4, 7, 2, 15],
    [10, 5, 0, 13.5],
    [22, -1, 1, 11],
    [2, -3, -2, 12],
  ];
  for (const [px, py, pz, r] of puffs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
    m.position.set(px, py, pz);
    cloud.add(m);
  }
  cloud.scale.setScalar(scale);
  return cloud;
}

function disposeWeatherProps() {
  if (!weatherPropGroup) return;
  scene.remove(weatherPropGroup);
  weatherPropGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  weatherPropGroup = null;
  builtWeatherPropMode = '';
}

function ensureWeatherProps(mode: string) {
  if (builtWeatherPropMode === mode && weatherPropGroup) return;
  disposeWeatherProps();
  builtWeatherPropMode = mode;

  const group = new THREE.Group();
  const s = 1.0;
  const skyY = 232;

  if (mode === 'rain') {
    const stormCloud = buildCloudCluster(0x475569, 1.12 * s);
    stormCloud.position.set(-14 * s, skyY, -4);
    stormCloud.userData.baseY = skyY;
    stormCloud.name = 'cloudFloat';
    group.add(stormCloud);

    const boltMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const lightning = new THREE.Group();
    lightning.name = 'lightning';
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(5 * s, 16 * s, 3 * s), boltMat);
    b1.rotation.z = -0.35;
    b1.position.set(-14 * s, skyY - 18 * s, -3);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(4 * s, 15 * s, 3 * s), boltMat);
    b2.rotation.z = 0.45;
    b2.position.set(-17 * s, skyY - 30 * s, -3);
    lightning.add(b1, b2);
    group.add(lightning);
  } else if (mode === 'hot') {
    const sunGroup = new THREE.Group();
    sunGroup.name = 'sunGroup';
    sunGroup.position.set(38 * s, skyY, -6);

    const sunMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf97316,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(15 * s, 20, 16), sunMat);
    sunGroup.add(core);

    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(18 * s, 22 * s, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      })
    );
    sunGroup.add(glowRing);

    const rays = new THREE.Group();
    rays.name = 'sunRays';
    const rayGeo = new THREE.ConeGeometry(2.6 * s, 8.5 * s, 6);
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const r = new THREE.Mesh(rayGeo, rayMat);
      r.position.set(Math.cos(ang) * 24 * s, Math.sin(ang) * 24 * s, 0);
      r.rotation.z = ang - Math.PI / 2;
      rays.add(r);
    }
    sunGroup.add(rays);
    group.add(sunGroup);
  } else if (mode === 'cold') {
    // 1. Đám mây tuyết đồng bộ chiều cao skyY
    const snowCloud = buildCloudCluster(0xe2e8f0, 1.05 * s);
    snowCloud.position.set(-14 * s, skyY, -4);
    snowCloud.userData.baseY = skyY;
    snowCloud.name = 'cloudFloat';
    group.add(snowCloud);

    // 2. Người Tuyết 3D đứng trên mặt đất bên cạnh vịt
    const snowman = new THREE.Group();
    snowman.name = 'snowman';
    snowman.position.set(-66 * s, 0, -4);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
    const coalMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const carrotMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.65 });
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

    const bodyLower = new THREE.Mesh(new THREE.SphereGeometry(16 * s, 16, 14), snowMat);
    bodyLower.position.y = 16 * s;
    const bodyHead = new THREE.Mesh(new THREE.SphereGeometry(11 * s, 16, 14), snowMat);
    bodyHead.position.y = 39 * s;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(9.5 * s, 2.6 * s, 8, 20), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 30 * s;

    const btn1 = new THREE.Mesh(new THREE.SphereGeometry(1.6 * s, 8, 8), coalMat);
    btn1.position.set(0, 20 * s, 15.6 * s);
    const btn2 = new THREE.Mesh(new THREE.SphereGeometry(1.6 * s, 8, 8), coalMat);
    btn2.position.set(0, 12 * s, 15.4 * s);

    const armL = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * s, 1.3 * s, 14 * s, 6), twigMat);
    armL.position.set(-16 * s, 24 * s, 0);
    armL.rotation.z = 0.85;
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * s, 1.3 * s, 14 * s, 6), twigMat);
    armR.position.set(16 * s, 24 * s, 0);
    armR.rotation.z = -0.85;

    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.3 * s, 9 * s, 8), carrotMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 39 * s, 12.5 * s);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(1.5 * s, 8, 8), coalMat);
    eyeL.position.set(-3.8 * s, 42 * s, 9.8 * s);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(1.5 * s, 8, 8), coalMat);
    eyeR.position.set(3.8 * s, 42 * s, 9.8 * s);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(12 * s, 12 * s, 1.8 * s, 16), coalMat);
    hatBrim.position.y = 48.5 * s;
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(8 * s, 8.5 * s, 9 * s, 16), coalMat);
    hatTop.position.y = 53.5 * s;

    snowman.add(bodyLower, bodyHead, scarf, btn1, btn2, armL, armR, nose, eyeL, eyeR, hatBrim, hatTop);
    group.add(snowman);
  } else if (mode === 'wind') {
    // Cơn lốc gió xoáy 3D cân tâm tại chiều cao skyY
    const vortex = new THREE.Group();
    vortex.name = 'windVortex';
    vortex.position.set(38 * s, skyY, -4);
    const windMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.78,
    });
    for (let i = 0; i < 6; i++) {
      const radius = (5.5 + i * 3.4) * s;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.6 * s, 8, 22), windMat);
      ring.rotation.x = Math.PI / 2 + 0.14;
      ring.position.set(Math.sin(i * 1.1) * 4 * s, (i - 2.5) * 9 * s, 0);
      vortex.add(ring);
    }
    group.add(vortex);
  } else if (mode === 'night') {
    // Mặt trăng sáng + 2 ngôi sao nhỏ đồng bộ tại skyY
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(15 * s, 18, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xeab308,
        emissiveIntensity: 0.65,
        roughness: 0.4,
      })
    );
    moon.position.set(38 * s, skyY, -6);
    group.add(moon);

    const moonHalo = new THREE.Mesh(
      new THREE.RingGeometry(18 * s, 22 * s, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.38,
      })
    );
    moonHalo.position.set(38 * s, skyY, -6);
    group.add(moonHalo);

    const stars = new THREE.Group();
    stars.name = 'nightStars';
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const starPts: Array<[number, number, number]> = [
      [14, 238, -4],
      [20, 222, -4],
    ];
    for (const [sx, sy, sz] of starPts) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(4.2 * s, 0), starMat);
      st.position.set(sx * s, sy * s, sz);
      stars.add(st);
    }
    group.add(stars);
  } else {
    // clear: 1 Mặt trời 3D dịu nhẹ đồng bộ chiều cao skyY
    const clearSun = new THREE.Group();
    clearSun.name = 'sunGroup';
    clearSun.position.set(38 * s, skyY, -6);

    const clearSunCore = new THREE.Mesh(
      new THREE.SphereGeometry(14 * s, 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      })
    );
    clearSun.add(clearSunCore);

    const clearGlow = new THREE.Mesh(
      new THREE.RingGeometry(17 * s, 21 * s, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      })
    );
    clearSun.add(clearGlow);

    const clearRays = new THREE.Group();
    clearRays.name = 'sunRays';
    const cRayGeo = new THREE.ConeGeometry(2.6 * s, 8.5 * s, 6);
    const cRayMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const r = new THREE.Mesh(cRayGeo, cRayMat);
      r.position.set(Math.cos(ang) * 23 * s, Math.sin(ang) * 23 * s, 0);
      r.rotation.z = ang - Math.PI / 2;
      clearRays.add(r);
    }
    clearSun.add(clearRays);
    group.add(clearSun);
  }

  const initScale = appState.modelScale || 1.0;
  group.scale.setScalar(initScale);
  group.position.set(appState.posX, -appState.posY, 18 * initScale);
  scene.add(group);
  weatherPropGroup = group;
}

interface FishingRodState {
  progress: number;
  duration: number;
  label: string;
  hooked: boolean;
  onCatch?: () => void;
}
let fishingRodMesh: THREE.Group | null = null;
let fishingState: FishingRodState | null = null;

const particleGeo = new THREE.OctahedronGeometry(4.5, 0);
const shockwaveGeo = new THREE.RingGeometry(18, 25, 28);

export function spawnParticles(x: number, y: number, count: number, colorHex: number) {
  const s = appState.modelScale || 1.0;
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.scale.setScalar(s);
    mesh.position.set(
      x + (Math.random() - 0.5) * 55 * s,
      -(y + (Math.random() - 0.5) * 40 * s),
      30 + Math.random() * 20
    );
    scene.add(mesh);

    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 2.8 * s,
      vy: (1.5 + Math.random() * 2.4) * s,
      vz: (Math.random() - 0.5) * 1.4 * s,
      life: 0,
      maxLife: 0.65 + Math.random() * 0.45,
      baseScale: s,
    });
  }
}

export function spawnDriftSmoke(x: number, y: number, dir = -1) {
  const s = appState.modelScale || 1.0;
  const smokeColor = Math.random() < 0.4 ? 0xf97316 : 0xe2e8f0;
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: smokeColor,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 16 * s,
      -(y - 4 * s + Math.random() * 8 * s),
      15 + Math.random() * 15
    );
    const bScale = (0.7 + Math.random() * 0.7) * s;
    mesh.scale.setScalar(bScale);
    scene.add(mesh);

    particles.push({
      mesh,
      vx: dir * (1.2 + Math.random() * 2.2) * s,
      vy: (0.6 + Math.random() * 1.2) * s,
      vz: (Math.random() - 0.5) * 1.5 * s,
      life: 0,
      maxLife: 0.38 + Math.random() * 0.25,
      baseScale: bScale,
    });
  }
}

export function spawnFlamePlume(x: number, y: number) {
  const s = appState.modelScale || 1.0;
  const flameColors = [0xf97316, 0xfbbf24, 0xef4444, 0x38bdf8];
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: flameColors[Math.floor(Math.random() * flameColors.length)],
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 10 * s,
      -(y + Math.random() * 6 * s),
      12 + Math.random() * 8
    );
    const bScale = (0.55 + Math.random() * 0.45) * s;
    mesh.scale.setScalar(bScale);
    scene.add(mesh);

    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 1.4 * s,
      vy: -(3.2 + Math.random() * 3.8) * s,
      vz: (Math.random() - 0.5) * 1.2 * s,
      life: 0,
      maxLife: 0.28 + Math.random() * 0.18,
      baseScale: bScale,
    });
  }
}

export function spawnShockwave(x: number, y: number, colorHex = 0x38bdf8) {
  const s = appState.modelScale || 1.0;
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(shockwaveGeo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.setScalar(s);
  mesh.position.set(x, -y + 2 * s, 0);
  scene.add(mesh);

  shockwaves.push({
    mesh,
    life: 0,
    maxLife: 0.42,
    baseScale: s,
  });
}

export function spawnScanEffect(x: number, y: number) {
  const s = appState.modelScale || 1.0;
  spawnShockwave(x, y - 60 * s, 0x38bdf8);
  spawnShockwave(x, y - 110 * s, 0x818cf8);
  spawnParticles(x, y - 90 * s, 10, 0x38bdf8);
}

export function spawnAlertEffect(x: number, y: number) {
  const s = appState.modelScale || 1.0;
  spawnShockwave(x, y - 80 * s, 0xf87171);
  spawnShockwave(x, y - 130 * s, 0xfbbf24);
  spawnParticles(x, y - 120 * s, 14, 0xf87171);
}

export function clearLadder() {
  if (ladderMesh) {
    scene.remove(ladderMesh);
    ladderMesh = null;
  }
}

export function spawnLadder(x: number, y1: number, y2: number) {
  clearLadder();
  const s = appState.modelScale || 1.0;
  const topY = Math.min(y1, y2);
  const bottomY = Math.max(y1, y2);
  const height = Math.max(70 * s, bottomY - topY);
  const midY = (bottomY + topY) * 0.5;
  const group = new THREE.Group();

  const railGeo = new THREE.CylinderGeometry(2.5 * s, 2.5 * s, height, 8);
  const railMat = new THREE.MeshToonMaterial({ color: 0x38bdf8 });
  const leftRail = new THREE.Mesh(railGeo, railMat);
  leftRail.position.x = -18 * s;
  const rightRail = new THREE.Mesh(railGeo, railMat);
  rightRail.position.x = 18 * s;
  group.add(leftRail, rightRail);

  const rungGeo = new THREE.CylinderGeometry(2.0 * s, 2.0 * s, 36 * s, 8);
  const rungMat = new THREE.MeshToonMaterial({ color: 0xfbbf24 });
  const stepGap = 28 * s;
  for (let rY = -height * 0.5 + 16 * s; rY <= height * 0.5 - 10 * s; rY += stepGap) {
    const rung = new THREE.Mesh(rungGeo, rungMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.y = rY;
    group.add(rung);
  }

  group.position.set(x, -midY, 12);
  scene.add(group);
  ladderMesh = group;
  spawnShockwave(x, bottomY, 0x38bdf8);
}

export function clearBlackHole() {
  for (const portal of blackHolePortals) {
    scene.remove(portal.group);
  }
  blackHolePortals.length = 0;
}

export function spawnBlackHole(
  x: number,
  y: number,
  duration = 2.4,
  mode: 'suction' | 'ejection' = 'suction'
) {
  const group = new THREE.Group();

  if (mode === 'suction') {
    // 1. Tâm lỗ đen hút vào (Singularity void)
    const coreGeo = new THREE.SphereGeometry(24, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x030308 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Đĩa bồi tụ xoáy tím
    const ring1Geo = new THREE.RingGeometry(25, 52, 42);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const ring1Mesh = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1Mesh.rotation.x = 1.25;
    ring1Mesh.name = 'ring1';
    group.add(ring1Mesh);

    // Vành quang tử hấp dẫn lam điện
    const ring2Geo = new THREE.RingGeometry(36, 68, 42);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2Mesh.rotation.x = -0.85;
    ring2Mesh.rotation.y = 0.45;
    ring2Mesh.name = 'ring2';
    group.add(ring2Mesh);

    // Vòng mờ biên ngoài
    const ring3Geo = new THREE.RingGeometry(20, 85, 36);
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const ring3Mesh = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3Mesh.name = 'ring3';
    group.add(ring3Mesh);

    const suScale = appState.modelScale || 1.0;
    spawnShockwave(x, y - 55 * suScale, 0x8b5cf6);
    spawnParticles(x, y - 55 * suScale, 24, 0xa855f7);
  } else {
    // 2. Cổng đẩy ra / Hố trắng (Ejection White Portal)
    const coreGeo = new THREE.SphereGeometry(26, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Đĩa hào quang bùng nổ Cyan
    const ring1Geo = new THREE.RingGeometry(28, 58, 42);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const ring1Mesh = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1Mesh.rotation.x = 1.1;
    ring1Mesh.name = 'ring1';
    group.add(ring1Mesh);

    // Vòng phóng năng lượng hồng tươi
    const ring2Geo = new THREE.RingGeometry(38, 76, 42);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2Mesh.rotation.x = -0.9;
    ring2Mesh.rotation.y = -0.4;
    ring2Mesh.name = 'ring2';
    group.add(ring2Mesh);

    // Vòng xung kích ngoài cùng
    const ring3Geo = new THREE.RingGeometry(22, 92, 36);
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ring3Mesh = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3Mesh.name = 'ring3';
    group.add(ring3Mesh);

    const sc = appState.modelScale || 1.0;
    spawnShockwave(x, y - 55 * sc, 0x06b6d4);
    spawnShockwave(x, y - 55 * sc, 0xf43f5e);
    spawnParticles(x, y - 55 * sc, 32, 0x38bdf8);
  }

  const bhScale = appState.modelScale || 1.0;
  group.position.set(x, -y + 55 * bhScale, 35 * bhScale);
  group.scale.set(0.01, 0.01, 0.01);
  scene.add(group);

  blackHolePortals.push({
    group,
    mode,
    life: 0,
    maxLife: duration,
    x,
    y,
  });
}

export function showJetpack(visible: boolean) {
  if (!visible) {
    if (jetpackMesh) {
      scene.remove(jetpackMesh);
      jetpackMesh = null;
    }
    return;
  }
  if (jetpackMesh) return;

  const group = new THREE.Group();

  const podGeo = new THREE.CylinderGeometry(5.0, 5.8, 30, 10);
  const podMat = new THREE.MeshToonMaterial({ color: 0x475569 });
  const leftPod = new THREE.Mesh(podGeo, podMat);
  leftPod.position.set(-18, 0, -8);

  const leftCap = new THREE.Mesh(
    new THREE.SphereGeometry(5.0, 10, 8),
    new THREE.MeshToonMaterial({ color: 0xf97316 })
  );
  leftCap.position.set(-18, 15, -8);

  const leftNozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 5.2, 8, 10),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  leftNozzle.position.set(-18, -18, -8);

  const rightPod = new THREE.Mesh(podGeo, podMat);
  rightPod.position.set(18, 0, -8);

  const rightCap = new THREE.Mesh(
    new THREE.SphereGeometry(5.0, 10, 8),
    new THREE.MeshToonMaterial({ color: 0xf97316 })
  );
  rightCap.position.set(18, 15, -8);

  const rightNozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 5.2, 8, 10),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  rightNozzle.position.set(18, -18, -8);

  const barGeo = new THREE.BoxGeometry(36, 6, 4);
  const barMat = new THREE.MeshToonMaterial({ color: 0x1e293b });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(0, 2, -7);

  const jpScale = appState.modelScale || 1.0;
  group.add(leftPod, leftCap, leftNozzle, rightPod, rightCap, rightNozzle, bar);
  group.position.set(appState.posX, -appState.posY + 30 * jpScale, 12 * jpScale);
  group.scale.setScalar(jpScale);
  scene.add(group);
  jetpackMesh = group;
}

export function show3DRadar(visible: boolean) {
  if (!visible) {
    if (radarMesh) {
      scene.remove(radarMesh);
      radarMesh = null;
    }
    radarTimer = 0;
    return;
  }
  if (radarMesh) {
    radarTimer = 3.8;
    return;
  }

  const group = new THREE.Group();

  // 1. Radar mast
  const mastGeo = new THREE.CylinderGeometry(1.8, 1.8, 28, 8);
  const mastMat = new THREE.MeshToonMaterial({ color: 0x334155 });
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, 50, 5);
  group.add(mast);

  // 2. Parabolic dish (xoay 360 độ)
  const dishGroup = new THREE.Group();
  dishGroup.name = 'dishGroup';
  dishGroup.position.set(0, 68, 5);

  const dishGeo = new THREE.SphereGeometry(22, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
  const dishMat = new THREE.MeshToonMaterial({
    color: 0x1e293b,
    side: THREE.DoubleSide,
  });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.rotation.x = Math.PI * 0.55;
  dishGroup.add(dish);

  const dishRim = new THREE.Mesh(
    new THREE.TorusGeometry(20, 1.4, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  dishRim.position.set(0, 0, -4);
  dishGroup.add(dishRim);

  const horn = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 16, 8),
    new THREE.MeshToonMaterial({ color: 0x94a3b8 })
  );
  horn.rotation.x = Math.PI / 2;
  horn.position.set(0, 0, -10);
  dishGroup.add(horn);

  const hornTip = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  hornTip.position.set(0, 0, -18);
  dishGroup.add(hornTip);

  group.add(dishGroup);

  // 3. Màn hình Hologram Radar quét không gian (HUD)
  const hudGroup = new THREE.Group();
  hudGroup.name = 'hudGroup';
  hudGroup.position.set(0, 95, 14);

  const ringRadii = [28, 52, 78];
  for (const r of ringRadii) {
    const rGeo = new THREE.RingGeometry(r - 0.9, r + 0.9, 36);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    hudGroup.add(rMesh);
  }

  const crossPts = new Float32Array([
    -80, 0, 0, 80, 0, 0,
    0, -80, 0, 0, 80, 0,
  ]);
  const crossGeo = new THREE.BufferGeometry();
  crossGeo.setAttribute('position', new THREE.BufferAttribute(crossPts, 3));
  const crossMat = new THREE.LineBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.5,
  });
  hudGroup.add(new THREE.LineSegments(crossGeo, crossMat));

  // Vùng quét hình quạt xoay tròn (Radar Sweep Beam)
  const sweepGeo = new THREE.CircleGeometry(78, 32, 0, Math.PI * 0.42);
  const sweepMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
  });
  const sweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
  sweepMesh.name = 'sweepSector';
  hudGroup.add(sweepMesh);

  // Các điểm phát hiện mục tiêu (Target pings)
  const blipPositions = [
    { x: 32, y: 22, color: 0xef4444 },
    { x: -45, y: 35, color: 0x38bdf8 },
    { x: -25, y: -48, color: 0xfbbf24 },
    { x: 50, y: -30, color: 0x22c55e },
  ];
  const blipsGroup = new THREE.Group();
  blipsGroup.name = 'blipsGroup';
  for (const bp of blipPositions) {
    const blipMesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: bp.color })
    );
    blipMesh.position.set(bp.x, bp.y, 2);
    blipsGroup.add(blipMesh);
  }
  hudGroup.add(blipsGroup);

  const rdScale = appState.modelScale || 1.0;
  group.add(hudGroup);
  group.position.set(appState.posX, -appState.posY, 25 * rdScale);
  group.scale.setScalar(rdScale);
  scene.add(group);
  radarMesh = group;
  radarTimer = 3.8;

  spawnShockwave(appState.posX, appState.posY - 90 * rdScale, 0x22c55e);
  spawnParticles(appState.posX, appState.posY - 90 * rdScale, 15, 0x22c55e);
}

export function showFishingRod(
  visible: boolean,
  label = 'Ứng dụng',
  onCatch?: () => void
) {
  if (!visible) {
    if (fishingRodMesh) {
      scene.remove(fishingRodMesh);
      fishingRodMesh = null;
    }
    fishingState = null;
    return;
  }
  if (fishingRodMesh) {
    scene.remove(fishingRodMesh);
    fishingRodMesh = null;
  }

  const group = new THREE.Group();

  // 1. Cần câu (Fishing Pole)
  const poleGeo = new THREE.CylinderGeometry(1.4, 2.8, 105, 8);
  const poleMat = new THREE.MeshToonMaterial({ color: 0x1e293b });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(28, 55, 12);
  pole.rotation.z = -0.58;
  pole.rotation.x = 0.15;
  group.add(pole);

  // Vành khoen vàng dẫn dây
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  for (const py of [25, 55, 85]) {
    const gRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.7, 6, 12), ringMat);
    gRing.position.set(28 + (py - 55) * -0.58, 55 + (py - 55), 12);
    group.add(gRing);
  }

  // Cuộn cước máy câu
  const reelGeo = new THREE.CylinderGeometry(5.2, 5.2, 7, 12);
  const reelMat = new THREE.MeshToonMaterial({ color: 0xf59e0b });
  const reel = new THREE.Mesh(reelGeo, reelMat);
  reel.name = 'reel';
  reel.position.set(16, 32, 16);
  reel.rotation.x = Math.PI / 2;
  group.add(reel);

  // Tay quay máy câu
  const crank = new THREE.Mesh(
    new THREE.BoxGeometry(2, 9, 2),
    new THREE.MeshBasicMaterial({ color: 0x94a3b8 })
  );
  crank.position.set(16, 35, 20);
  crank.name = 'crank';
  group.add(crank);

  // 2. Dây câu
  const lineGeo = new THREE.BufferGeometry();
  const linePts = new Float32Array([58, 98, 14, 58, -70, 14]);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
  const lineMesh = new THREE.Line(lineGeo, lineMat);
  lineMesh.name = 'fishingLine';
  group.add(lineMesh);

  // 3. Phao câu
  const bobber = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  bobber.name = 'bobber';
  bobber.position.set(58, -70, 14);
  group.add(bobber);

  // 4. Khối hộp ứng dụng 3D Hologram được câu lên
  const appBox = new THREE.Group();
  appBox.name = 'appBox';
  const boxGeo = new THREE.BoxGeometry(24, 24, 12);
  const boxMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.82,
  });
  const boxMesh = new THREE.Mesh(boxGeo, boxMat);
  appBox.add(boxMesh);

  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
  const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
  appBox.add(edgeMesh);

  const badgeRing = new THREE.Mesh(
    new THREE.RingGeometry(14, 18, 20),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
  );
  badgeRing.position.z = 7;
  appBox.add(badgeRing);

  appBox.position.set(58, -75, 14);
  group.add(appBox);

  const frScale = appState.modelScale || 1.0;
  group.position.set(appState.posX, -appState.posY, 20 * frScale);
  group.scale.setScalar(frScale);
  scene.add(group);
  fishingRodMesh = group;

  fishingState = {
    progress: 0,
    duration: 1.6,
    label,
    hooked: false,
    onCatch,
  };

  spawnShockwave(appState.posX + 58 * (appState.modelScale || 1.0), appState.posY + 70 * (appState.modelScale || 1.0), 0x38bdf8);
}

export function showParachute(visible: boolean) {
  if (!visible) {
    if (parachuteMesh) {
      scene.remove(parachuteMesh);
      parachuteMesh = null;
    }
    return;
  }
  if (parachuteMesh) return;

  const group = new THREE.Group();
  const canopyGeo = new THREE.SphereGeometry(52, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const canopyMat = new THREE.MeshToonMaterial({ color: 0xf472b6, side: THREE.DoubleSide });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 175, 0);
  group.add(canopy);

  const ringGeo = new THREE.TorusGeometry(50, 2.2, 8, 24);
  const ringMat = new THREE.MeshToonMaterial({ color: 0xfbbf24 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 172, 0);
  group.add(ring);

  const cordPts = new Float32Array([
    -44, 172, 0, -16, 115, 0,
    44, 172, 0, 16, 115, 0,
    -22, 172, 20, -14, 115, 0,
    22, 172, -20, 14, 115, 0,
  ]);
  const cordGeo = new THREE.BufferGeometry();
  cordGeo.setAttribute('position', new THREE.BufferAttribute(cordPts, 3));
  const cordMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0 });
  const cords = new THREE.LineSegments(cordGeo, cordMat);
  group.add(cords);

  const paraScale = appState.modelScale || 1.0;
  group.position.set(appState.posX, -appState.posY, 15 * paraScale);
  group.scale.setScalar(paraScale);
  scene.add(group);
  parachuteMesh = group;
}

export function clearFoodItem() {
  if (foodMesh) {
    scene.remove(foodMesh);
    foodMesh = null;
  }
  appState.foodTarget = null;
  clearLadder();
}

export function spawnFoodItem(x: number, y: number) {
  clearFoodItem();
  const group = new THREE.Group();

  const donutGeo = new THREE.TorusGeometry(14, 6.5, 12, 24);
  const donutMat = new THREE.MeshToonMaterial({ color: 0xfbbf24 });
  const donut = new THREE.Mesh(donutGeo, donutMat);

  const icingGeo = new THREE.TorusGeometry(14, 5.2, 10, 24);
  const icingMat = new THREE.MeshToonMaterial({ color: 0xf472b6 });
  const icing = new THREE.Mesh(icingGeo, icingMat);
  icing.position.z = 2.2;

  const auraGeo = new THREE.RingGeometry(18, 22, 24);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = -16;

  group.add(donut);
  group.add(icing);
  group.add(aura);
  const foodScale = appState.modelScale || 1.0;
  group.position.set(x, -y + 18 * foodScale, 25 * foodScale);
  group.scale.setScalar(foodScale);
  scene.add(group);

  foodMesh = group;
  appState.foodTarget = { x, y };
  spawnShockwave(x, y, 0xfbbf24);
}

export function spawnFrameHighlight(x: number, y: number, w: number, h: number) {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(Math.max(20, w), Math.max(20, h), 8));
  const mat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.95,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.position.set(x + w * 0.5, -(y + h * 0.5), 20);
  scene.add(mesh);

  frameHighlights.push({
    mesh,
    life: 0,
    maxLife: 1.8,
  });
  spawnParticles(x + w * 0.5, y + h * 0.5, 8, 0x38bdf8);
}

const SPECIAL_EFFECT_TYPES = [
  'meteor_shower',
  'aurora_ring',
  'cyber_fireworks',
  'starlight_fountain',
  'matrix_pulse',
] as const;

export function triggerRandomSpecial3DEffect(
  x: number,
  y: number,
  forcedType?: string
): string {
  const s = appState.modelScale || 1.0;
  const chosen =
    forcedType && SPECIAL_EFFECT_TYPES.includes(forcedType as (typeof SPECIAL_EFFECT_TYPES)[number])
      ? forcedType
      : SPECIAL_EFFECT_TYPES[Math.floor(Math.random() * SPECIAL_EFFECT_TYPES.length)];

  const addParticle = (
    px: number,
    py: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    scale: number,
    maxLife: number
  ) => {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.96,
    });
    const mesh = new THREE.Mesh(particleGeo, mat);
    const scaled = scale * s;
    mesh.scale.setScalar(scaled);
    mesh.position.set(px, -py, (28 + Math.random() * 14) * s);
    scene.add(mesh);
    particles.push({
      mesh,
      vx: vx * s,
      vy: vy * s,
      vz: vz * s,
      life: 0,
      maxLife,
      baseScale: scaled,
    });
  };

  if (chosen === 'meteor_shower') {
    const colors = [0xfacc15, 0x38bdf8, 0xc084fc, 0xfb7185];
    for (let i = 0; i < 26; i++) {
      const rx = x + (-140 + Math.random() * 280) * s;
      const ry = y - (220 + Math.random() * 90) * s;
      const col = colors[i % colors.length];
      addParticle(rx, ry, 2.4 + Math.random() * 2.2, -(5.5 + Math.random() * 3.5), 0.3, col, 0.85, 0.72);
    }
    spawnShockwave(x, y - 55 * s, 0xfacc15);
  } else if (chosen === 'aurora_ring') {
    spawnShockwave(x, y - 40 * s, 0x34d399);
    spawnShockwave(x, y - 75 * s, 0x38bdf8);
    spawnShockwave(x, y - 110 * s, 0xa855f7);
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const col = i % 2 === 0 ? 0x34d399 : 0xa855f7;
      addParticle(
        x + Math.cos(ang) * 45 * s,
        y - 60 * s + Math.sin(ang) * 20 * s,
        Math.cos(ang) * 1.4,
        1.4 + Math.random() * 1.5,
        Math.sin(ang) * 1.1,
        col,
        0.9,
        0.95
      );
    }
  } else if (chosen === 'cyber_fireworks') {
    const fwColors = [0xf43f5e, 0xfbbf24, 0x22d3ee, 0x4ade80];
    for (let burst = 0; burst < 2; burst++) {
      const bx = x + (burst === 0 ? -50 : 50) * s;
      const by = y - (125 + burst * 28) * s;
      const col = fwColors[Math.floor(Math.random() * fwColors.length)];
      spawnShockwave(bx, by, col);
      for (let i = 0; i < 16; i++) {
        const theta = (i / 16) * Math.PI * 2;
        const speed = 2.6 + Math.random() * 1.8;
        addParticle(
          bx,
          by,
          Math.cos(theta) * speed,
          Math.sin(theta) * speed,
          (Math.random() - 0.5) * 1.8,
          fwColors[(i + burst) % fwColors.length],
          0.85,
          0.78
        );
      }
    }
  } else if (chosen === 'starlight_fountain') {
    spawnShockwave(x, y - 10 * s, 0xfbbf24);
    for (let i = 0; i < 28; i++) {
      const spreadX = (Math.random() - 0.5) * 3.6;
      const upY = 3.8 + Math.random() * 3.2;
      const col = i % 3 === 0 ? 0xfef08a : i % 3 === 1 ? 0x38bdf8 : 0x34d399;
      addParticle(x, y - 20 * s, spreadX, upY, (Math.random() - 0.5) * 1.4, col, 0.8, 0.88);
    }
  } else {
    // matrix_pulse
    spawnShockwave(x, y - 35 * s, 0x22c55e);
    spawnShockwave(x, y - 85 * s, 0x06b6d4);
    for (let i = 0; i < 24; i++) {
      const colX = x + (-95 + (i % 8) * 26) * s;
      const col = i % 2 === 0 ? 0x22c55e : 0x06b6d4;
      addParticle(colX, y - (30 + (i % 3) * 35) * s, 0, 2.2 + Math.random() * 1.8, 0, col, 0.72, 0.9);
    }
  }

  return chosen;
}

export function updateParticles(delta: number) {
  const s = appState.modelScale || 1.0;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += delta;
    if (p.life >= p.maxLife) {
      scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
      particles.splice(i, 1);
      continue;
    }
    const progress = p.life / p.maxLife;
    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    p.mesh.rotation.y += delta * 6;
    p.mesh.rotation.x += delta * 4;
    p.mesh.scale.setScalar((p.baseScale ?? 1.0) * (1 - progress * 0.7));
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life += delta;
    if (sw.life >= sw.maxLife) {
      scene.remove(sw.mesh);
      (sw.mesh.material as THREE.Material).dispose();
      shockwaves.splice(i, 1);
      continue;
    }
    const progress = sw.life / sw.maxLife;
    sw.mesh.scale.setScalar((sw.baseScale ?? 1.0) * (1 + progress * 2.4));
    (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - progress);
  }

  if (foodMesh && appState.foodTarget) {
    const now = performance.now();
    foodMesh.scale.setScalar(s);
    foodMesh.rotation.y += delta * 2.8;
    foodMesh.rotation.x = 0.55 + Math.sin(now * 0.005) * 0.15;
    foodMesh.position.y = -appState.foodTarget.y + 18 * s + Math.sin(now * 0.006) * 5 * s;
  }

  if (parachuteMesh) {
    parachuteMesh.scale.setScalar(s);
    parachuteMesh.position.set(appState.posX, -appState.posY, 15 * s);
    parachuteMesh.rotation.z = Math.sin(performance.now() * 0.004) * 0.14;
  }

  // Cập nhật các cổng Hố Đen / Hố Trắng
  for (let i = blackHolePortals.length - 1; i >= 0; i--) {
    const portal = blackHolePortals[i];
    portal.life += delta;
    if (portal.life >= portal.maxLife) {
      if (portal.mode === 'suction') {
        spawnShockwave(portal.x, portal.y - 55 * s, 0x8b5cf6);
      } else {
        spawnShockwave(portal.x, portal.y - 55 * s, 0x06b6d4);
      }
      scene.remove(portal.group);
      blackHolePortals.splice(i, 1);
      continue;
    }

    const p = portal.life / portal.maxLife;
    let targetScale = 1.45 * s;
    if (p < 0.2) {
      targetScale = (p / 0.2) * 1.45 * s;
    } else if (p > 0.8) {
      targetScale = Math.max(0.01, ((1.0 - p) / 0.2) * 1.45 * s);
    }
    portal.group.scale.setScalar(targetScale);

    const r1 = portal.group.getObjectByName('ring1');
    const r2 = portal.group.getObjectByName('ring2');
    const r3 = portal.group.getObjectByName('ring3');

    if (portal.mode === 'suction') {
      if (r1) r1.rotation.z += delta * 8.5;
      if (r2) r2.rotation.z -= delta * 6.0;
      if (r3) r3.rotation.z += delta * 3.5;

      // Hút các hạt không gian từ bán kính rộng (90..150px * scale) vào tâm lỗ đen
      if (Math.random() < delta * 18) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (90 + Math.random() * 60) * s;
        const px = portal.x + Math.cos(angle) * dist;
        const py = portal.y - 55 * s + Math.sin(angle) * dist;
        spawnParticles(px, py, 1, Math.random() < 0.5 ? 0x8b5cf6 : 0xa855f7);
      }
    } else {
      // Hố trắng / Cổng đẩy ra: xoay gia tốc và bắn năng lượng ra ngoài
      if (r1) r1.rotation.z -= delta * 10.5;
      if (r2) r2.rotation.z += delta * 7.5;
      if (r3) r3.rotation.z -= delta * 4.5;

      // Bắn tia sáng ra ngoài
      if (Math.random() < delta * 20) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (20 + Math.random() * 25) * s;
        const px = portal.x + Math.cos(angle) * dist;
        const py = portal.y - 55 * s + Math.sin(angle) * dist;
        spawnParticles(px, py, 2, Math.random() < 0.5 ? 0x06b6d4 : 0xf43f5e);
      }
    }
  }

  // Cập nhật Radar 3D
  if (radarMesh) {
    radarMesh.scale.setScalar(s);
    radarMesh.position.set(appState.posX, -appState.posY, 25 * s);
    const dish = radarMesh.getObjectByName('dishGroup');
    if (dish) {
      dish.rotation.y += delta * 4.5;
      dish.rotation.x = Math.sin(performance.now() * 0.003) * 0.15;
    }
    const sweep = radarMesh.getObjectByName('sweepSector');
    if (sweep) {
      sweep.rotation.z -= delta * 5.2;
    }
    const blips = radarMesh.getObjectByName('blipsGroup');
    if (blips) {
      const pulseScale = 1.0 + Math.sin(performance.now() * 0.008) * 0.25;
      blips.scale.setScalar(pulseScale);
    }
    radarTimer -= delta;
    if (radarTimer <= 0) {
      show3DRadar(false);
    }
  }

  // Cập nhật Jetpack phản lực
  if (jetpackMesh) {
    jetpackMesh.scale.setScalar(s);
    jetpackMesh.position.set(appState.posX, -appState.posY + 30 * s, 12 * s);
    // Phun lửa từ 2 ống phụt rocket bên trái và phải
    spawnFlamePlume(appState.posX - 18 * s, appState.posY - 12 * s);
    spawnFlamePlume(appState.posX + 18 * s, appState.posY - 12 * s);
    if (Math.random() < delta * 8) {
      spawnDriftSmoke(appState.posX, appState.posY - 10 * s, 0);
    }
  }

  // Cập nhật Cần câu cá & Hologram App
  if (fishingRodMesh && fishingState) {
    fishingRodMesh.scale.setScalar(s);
    fishingRodMesh.position.set(appState.posX, -appState.posY, 20 * s);
    fishingState.progress += delta;
    const p = Math.min(1.0, fishingState.progress / fishingState.duration);

    const crank = fishingRodMesh.getObjectByName('crank');
    const reel = fishingRodMesh.getObjectByName('reel');
    const bobber = fishingRodMesh.getObjectByName('bobber');
    const appBox = fishingRodMesh.getObjectByName('appBox');
    const fishingLine = fishingRodMesh.getObjectByName('fishingLine') as THREE.Line | undefined;

    // Giai đoạn:
    // 0 -> 0.25: Quăng mồi xuống dưới
    // 0.25 -> 0.8: Giật cần, quay cước kéo hộp app lên
    // 0.8 -> 1.0: Đã câu được app giơ lên ăn mừng
    let hookY = -70;
    if (p < 0.25) {
      const castP = p / 0.25;
      hookY = -20 + castP * -50;
      if (appBox) appBox.visible = false;
    } else if (p < 0.8) {
      const reelP = (p - 0.25) / 0.55;
      hookY = -70 + reelP * 115; // từ -70 lên +45
      if (crank) crank.rotation.x += delta * 24;
      if (reel) reel.rotation.z += delta * 20;
      if (appBox) {
        appBox.visible = true;
        appBox.position.y = hookY - 10;
        appBox.rotation.y += delta * 6;
      }
      if (Math.random() < delta * 12) {
        spawnParticles(appState.posX + 58 * s, appState.posY - hookY * s, 1, 0x38bdf8);
      }
    } else {
      hookY = 45;
      if (appBox) {
        appBox.visible = true;
        appBox.position.y = 45;
        appBox.rotation.y += delta * 4;
      }
      if (!fishingState.hooked) {
        fishingState.hooked = true;
        spawnShockwave(appState.posX + 58 * s, appState.posY - 45 * s, 0x38bdf8);
        spawnParticles(appState.posX + 58 * s, appState.posY - 45 * s, 14, 0xfacc15);
        fishingState.onCatch?.();
      }
    }

    if (bobber) bobber.position.y = hookY;

    if (fishingLine) {
      const posAttr = fishingLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, 58, 98, 14);
      posAttr.setXYZ(1, 58, hookY, 14);
      posAttr.needsUpdate = true;
    }

    if (p >= 1.0) {
      showFishingRod(false);
    }
  }

  for (let i = frameHighlights.length - 1; i >= 0; i--) {
    const f = frameHighlights[i];
    f.life += delta;
    if (f.life >= f.maxLife) {
      scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      (f.mesh.material as THREE.Material).dispose();
      frameHighlights.splice(i, 1);
      continue;
    }
    const progress = f.life / f.maxLife;
    (f.mesh.material as THREE.LineBasicMaterial).opacity = 0.95 * (1 - progress);
  }

  // Vật thể thời tiết 3D trực quan cạnh vịt (1 mây, 1 mặt trời, 1 gió xoáy hoặc người tuyết đồng bộ)
  if (appState.state !== 'SWIMMING' && !appState.isEdgePeekMode && !isP2pSessionActive()) {
    ensureWeatherProps(appState.weatherMode);
    if (weatherPropGroup) {
      weatherPropGroup.scale.setScalar(s);
      weatherPropGroup.position.set(appState.posX, -appState.posY, 18 * s);
      const tNow = performance.now() * 0.001;
      const cloud = weatherPropGroup.getObjectByName('cloudFloat');
      if (cloud) {
        cloud.position.y = (cloud.userData.baseY ?? 232) + Math.sin(tNow * 2.2) * 3.5;
      }
      const sunRays = weatherPropGroup.getObjectByName('sunRays');
      if (sunRays) {
        sunRays.rotation.z += delta * 1.4;
      }
      const lightning = weatherPropGroup.getObjectByName('lightning');
      if (lightning) {
        lightning.visible = Math.sin(tNow * 13) > 0.72;
      }
      const snowman = weatherPropGroup.getObjectByName('snowman');
      if (snowman) {
        snowman.rotation.z = Math.sin(tNow * 2.4) * 0.05;
      }
      const vortex = weatherPropGroup.getObjectByName('windVortex');
      if (vortex) {
        vortex.rotation.y += delta * 8.5;
        vortex.children.forEach((ring, idx) => {
          ring.position.x = Math.sin(tNow * 6 + idx * 0.9) * 5;
        });
      }
      const stars = weatherPropGroup.getObjectByName('nightStars');
      if (stars) {
        stars.children.forEach((st, idx) => {
          st.rotation.y += delta * (1.8 + idx * 0.5);
          st.scale.setScalar(0.85 + Math.sin(tNow * 4 + idx) * 0.25);
        });
      }
    }
  } else {
    disposeWeatherProps();
  }

  // Hiệu ứng hạt thời tiết 3D Live Weather Aura đồng bộ với chiều cao chuẩn skyY
  if (appState.weatherMode !== 'clear' && appState.state !== 'SWIMMING' && !isP2pSessionActive()) {
    const mode = appState.weatherMode;
    const skyY = 232 * s;
    const prob = mode === 'rain' ? delta * 18 : mode === 'wind' ? delta * 14 : delta * 7;
    if (Math.random() < prob) {
      let colorHex = 0x38bdf8;
      let vx = (Math.random() - 0.5) * 0.6;
      let vy = -6.5;
      let px = appState.posX + (Math.random() - 0.5) * 120 * s;
      let py = appState.posY - skyY;
      let maxLife = 0.75;
      let scale = 0.75;

      if (mode === 'rain') {
        colorHex = Math.random() < 0.6 ? 0x38bdf8 : 0x7dd3fc;
        vx = -0.6;
        vy = -9.5;
        px = appState.posX - 14 * s + (Math.random() - 0.5) * 58 * s;
        py = appState.posY - (skyY - 8 * s);
        maxLife = 0.62;
        scale = 0.6;
      } else if (mode === 'hot') {
        colorHex = Math.random() < 0.5 ? 0xf97316 : 0xfacc15;
        vx = (Math.random() - 0.5) * 1.1;
        vy = (Math.random() - 0.5) * 1.2;
        px = appState.posX + 38 * s + (Math.random() - 0.5) * 48 * s;
        py = appState.posY - (skyY + (Math.random() - 0.5) * 20 * s);
        maxLife = 0.75;
        scale = 0.65;
      } else if (mode === 'cold') {
        colorHex = 0xe0f2fe;
        vx = Math.sin(performance.now() * 0.004 + px) * 0.9;
        vy = -1.8 - Math.random() * 0.9;
        px = appState.posX - 14 * s + (Math.random() - 0.5) * 64 * s;
        py = appState.posY - (skyY - 8 * s);
        maxLife = 1.55;
        scale = 0.85;
      } else if (mode === 'wind') {
        colorHex = Math.random() < 0.5 ? 0xbae6fd : 0x86efac;
        vx = 4.5 + Math.random() * 3.0;
        vy = Math.sin(performance.now() * 0.01 + px) * 1.8;
        px = appState.posX - 45 * s;
        py = appState.posY - (skyY + (Math.random() - 0.5) * 32 * s);
        maxLife = 0.72;
        scale = 0.7;
      } else if (mode === 'night') {
        colorHex = Math.random() < 0.5 ? 0xa78bfa : 0x34d399;
        vx = (Math.random() - 0.5) * 1.0;
        vy = (Math.random() - 0.5) * 0.8 + 0.4;
        px = appState.posX + (Math.random() - 0.5) * 95 * s;
        py = appState.posY - (skyY + (Math.random() - 0.5) * 24 * s);
        maxLife = 1.15;
        scale = 0.65;
      }

      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.88,
      });
      const mesh = new THREE.Mesh(particleGeo, mat);
      const scaledParticle = scale * s;
      mesh.scale.setScalar(scaledParticle);
      mesh.position.set(px, -py, 22);
      scene.add(mesh);
      particles.push({
        mesh,
        vx: vx * s,
        vy: vy * s,
        vz: (Math.random() - 0.5) * 0.6 * s,
        life: 0,
        maxLife,
        baseScale: scaledParticle,
      });
    }
  }
}
