import * as THREE from 'three';
import { scene } from './scene';
import { appState, getDesktopFloorY } from './state';
import { spawnParticles, spawnShockwave } from './particles';
import { playWaterSplashSound, playWaterEmergeSound } from './soundFx';

interface PoolRipple {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface SwimWaypoint {
  x: number;
  y: number;
  z: number;
  depthScale: number;
  pauseDuration?: number;
  speechText?: string;
}

let poolGroup: THREE.Group | null = null;
let waterSurfaceMesh: THREE.Mesh | null = null;
let shorelineMesh: THREE.Mesh | null = null;
let submersionGroup: THREE.Group | null = null;
let buoyGroup: THREE.Group | null = null;
let contourRings: THREE.Mesh[] = [];
const ripples: PoolRipple[] = [];

let isSwimmingActive = false;
let poolCenterX = 0;
let poolCenterY = 0;
const POOL_RADIUS_X = 235;
const POOL_RADIUS_Y = 76;
const ASPECT_Y = POOL_RADIUS_Y / POOL_RADIUS_X;

let currentWaypointIdx = 0;
let waypointTimer = 0;
let rippleTimer = 0;
let swimElapsed = 0;
let fadeOutTimer = -1;
let swimSpeechTimer = 0;
let autoSwimStopTimer = 0;

let uiSpeakCallback: ((msg: string) => void) | null = null;

export function registerWaterPoolSpeakCallback(cb: (msg: string) => void) {
  uiSpeakCallback = cb;
}

function poolSpeak(msg: string) {
  if (uiSpeakCallback) {
    uiSpeakCallback(msg);
  }
}

export function isWaterPoolActive(): boolean {
  return isSwimmingActive;
}

/**
 * Tạo hồ bơi 3D 2.5D trên mặt phẳng XY vuông góc camera Orthographic,
 * đảm bảo không bị méo dẹt 1px hay che khuất nhân vật khi bơi sâu ra phía xa.
 */
export function spawnWaterPool(centerX?: number, centerY?: number) {
  if (poolGroup) {
    removeWaterPool();
  }

  const floorY = getDesktopFloorY();
  const rawX = centerX !== undefined ? centerX : appState.posX;
  const rawY = centerY !== undefined ? centerY : Math.min(floorY - POOL_RADIUS_Y - 8, appState.posY + 12);

  // Giữ toàn bộ hồ bơi và viền nổi gọn phía trên Taskbar Windows
  const minX = POOL_RADIUS_X + 36;
  const maxX = Math.max(minX, appState.W - POOL_RADIUS_X - 36);
  const minY = 180;
  const maxY = Math.max(minY, floorY - POOL_RADIUS_Y - 6);
  poolCenterX = Math.max(minX, Math.min(maxX, rawX));
  poolCenterY = Math.max(minY, Math.min(maxY, rawY));

  const root = new THREE.Group();
  root.position.set(poolCenterX, -poolCenterY, 0);
  contourRings = [];

  // 1. Bóng đổ mềm bao quanh miệng hồ (Drop Shadow Halo, z = -48)
  const shadowGeo = new THREE.CircleGeometry(POOL_RADIUS_X + 18, 48);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x020617,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.scale.set(1.0, ASPECT_Y, 1.0);
  shadowMesh.position.z = -48;
  root.add(shadowMesh);

  // 2. Viền thành bể ngoài + Neon viền xanh (Outer Deck Coping Rim, z = -44)
  const deckGeo = new THREE.RingGeometry(POOL_RADIUS_X - 2, POOL_RADIUS_X + 12, 64);
  const deckMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.scale.set(1.0, ASPECT_Y, 1.0);
  deckMesh.position.z = -44;
  root.add(deckMesh);

  const neonRimGeo = new THREE.RingGeometry(POOL_RADIUS_X + 11, POOL_RADIUS_X + 15, 64);
  const neonRimMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  const neonRimMesh = new THREE.Mesh(neonRimGeo, neonRimMat);
  neonRimMesh.scale.set(1.0, ASPECT_Y, 1.0);
  neonRimMesh.position.z = -43;
  root.add(neonRimMesh);

  // 3. Thành bể giật cấp tạo chiều sâu 3D phía sau (Top Back Wall Illusion, z = -41 & -38)
  const backWallGeo = new THREE.CircleGeometry(POOL_RADIUS_X - 1, 64);
  const backWallMat = new THREE.MeshBasicMaterial({
    color: 0x0369a1,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
  const backWallMesh = new THREE.Mesh(backWallGeo, backWallMat);
  backWallMesh.scale.set(1.0, ASPECT_Y, 1.0);
  backWallMesh.position.z = -41;
  root.add(backWallMesh);

  const innerBasinGeo = new THREE.CircleGeometry(POOL_RADIUS_X * 0.94, 64);
  const innerBasinMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });
  const innerBasinMesh = new THREE.Mesh(innerBasinGeo, innerBasinMat);
  innerBasinMesh.scale.set(1.0, ASPECT_Y, 1.0);
  innerBasinMesh.position.set(0, -8, -38);
  root.add(innerBasinMesh);

  // 4. Vùng nước sâu & 3 vòng đồng mức holographic (z = -34 .. -30)
  const deepZoneGeo = new THREE.CircleGeometry(POOL_RADIUS_X * 0.72, 48);
  const deepZoneMat = new THREE.MeshBasicMaterial({
    color: 0x0369a1,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });
  const deepZoneMesh = new THREE.Mesh(deepZoneGeo, deepZoneMat);
  deepZoneMesh.scale.set(1.0, ASPECT_Y, 1.0);
  deepZoneMesh.position.set(0, -6, -34);
  root.add(deepZoneMesh);

  [0.82, 0.64, 0.45].forEach((factor, i) => {
    const contourGeo = new THREE.RingGeometry(
      POOL_RADIUS_X * factor - 2,
      POOL_RADIUS_X * factor,
      48
    );
    const contourMat = new THREE.MeshBasicMaterial({
      color: i === 2 ? 0x7dd3fc : 0x38bdf8,
      transparent: true,
      opacity: 0.32 + i * 0.1,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(contourGeo, contourMat);
    ring.scale.set(1.0, ASPECT_Y, 1.0);
    ring.position.set(0, -4, -30 + i * 0.5);
    root.add(ring);
    contourRings.push(ring);
  });

  // 5. Bề mặt nước lấp lánh bán trong suốt (z = -22)
  const surfaceGeo = new THREE.CircleGeometry(POOL_RADIUS_X - 3, 64);
  const surfaceMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
  });
  waterSurfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
  waterSurfaceMesh.scale.set(1.0, ASPECT_Y, 1.0);
  waterSurfaceMesh.position.z = -22;
  root.add(waterSurfaceMesh);

  // 6. Viền bọt sóng mép bờ hồ (Shoreline Foam Ring, z = -18)
  const rimGeo = new THREE.RingGeometry(POOL_RADIUS_X - 7, POOL_RADIUS_X - 1, 64);
  const rimMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  shorelineMesh = new THREE.Mesh(rimGeo, rimMat);
  shorelineMesh.scale.set(1.0, ASPECT_Y, 1.0);
  shorelineMesh.position.z = -18;
  root.add(shorelineMesh);

  // 7. Vòng ngập nước ngang bụng vịt (Submersion Waterline Ring, z = +12)
  submersionGroup = new THREE.Group();
  const waistRingGeo = new THREE.RingGeometry(18, 28, 32);
  const waistRingMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });
  const waistRing = new THREE.Mesh(waistRingGeo, waistRingMat);
  waistRing.scale.set(1.0, 0.45, 1.0);

  const skirtGeo = new THREE.CircleGeometry(24, 32);
  const skirtMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
  skirtMesh.scale.set(1.0, 0.45, 1.0);
  skirtMesh.position.z = -0.5;

  submersionGroup.add(skirtMesh, waistRing);
  submersionGroup.position.set(0, 0, 12);
  root.add(submersionGroup);

  // 8. Phao bơi Cyber nghiêng 2.5D nổi góc hồ (z = +8)
  buoyGroup = new THREE.Group();
  const buoyTilt = new THREE.Group();
  buoyTilt.rotation.x = 0.85;

  const buoyTorusGeo = new THREE.TorusGeometry(14, 4.5, 12, 28);
  const buoyMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    roughness: 0.25,
    metalness: 0.1,
  });
  const buoyMesh = new THREE.Mesh(buoyTorusGeo, buoyMat);

  const stripeGeo = new THREE.CylinderGeometry(4.7, 4.7, 5, 12);
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
  stripe1.position.set(14, 0, 0);
  const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
  stripe2.position.set(-14, 0, 0);
  buoyTilt.add(buoyMesh, stripe1, stripe2);

  buoyGroup.add(buoyTilt);
  buoyGroup.position.set(-POOL_RADIUS_X * 0.68, POOL_RADIUS_Y * 0.25, 8);
  root.add(buoyGroup);

  poolGroup = root;
  scene.add(poolGroup);
  isSwimmingActive = true;
  fadeOutTimer = -1;
  swimElapsed = 0;
  currentWaypointIdx = 0;
  waypointTimer = 0;
  swimSpeechTimer = 0;

  spawnWaterSplash(poolCenterX, poolCenterY, 24);
  spawnShockwave(poolCenterX, poolCenterY, 0x38bdf8);
}

/**
 * Hiệu ứng bọt sóng & giọt nước bắn tung tóe
 */
export function spawnWaterSplash(x: number, y: number, count = 16) {
  spawnParticles(x, y - 20, Math.floor(count * 0.6), 0x38bdf8);
  spawnParticles(x, y - 10, Math.floor(count * 0.4), 0xffffff);
}

/**
 * Tạo gợn sóng nước tròn đồng tâm loang dần trên mặt phẳng XY tại vị trí vịt bơi
 */
function spawnWaterRipple(x: number, y: number, scale = 1.0) {
  if (!poolGroup) return;

  const rippleGeo = new THREE.RingGeometry(10, 14, 28);
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
  rippleMesh.scale.set(scale, scale * ASPECT_Y, 1.0);
  rippleMesh.position.set(x - poolCenterX, -(y - poolCenterY) + 10, 6);
  poolGroup.add(rippleMesh);

  ripples.push({
    mesh: rippleMesh,
    life: 0,
    maxLife: 1.35,
  });
}

/**
 * Lộ trình bơi phối cảnh 2.5D bên trong lòng hồ oval
 */
function getSwimWaypoints(): SwimWaypoint[] {
  return [
    {
      x: poolCenterX,
      y: poolCenterY + 34,
      z: 2,
      depthScale: 1.0,
      pauseDuration: 1.2,
      speechText: 'Quạc quạc! MicroDuck nhảy ùm xuống hồ bơi giải nhiệt đây!',
    },
    {
      x: poolCenterX + 125,
      y: poolCenterY + 8,
      z: 2,
      depthScale: 0.88,
      pauseDuration: 0.9,
    },
    {
      x: poolCenterX + 110,
      y: poolCenterY - 36,
      z: 2,
      depthScale: 0.72,
      pauseDuration: 1.9,
      speechText: 'Quạc! Đang bơi sải ra mép xa hồ nước xanh ngắt mát rượi!',
    },
    {
      x: poolCenterX - 115,
      y: poolCenterY - 32,
      z: 2,
      depthScale: 0.74,
      pauseDuration: 1.5,
      speechText: 'Nước sâu trong vắt, lướt sóng quanh phao cứu sinh cực đã!',
    },
    {
      x: poolCenterX - 135,
      y: poolCenterY + 12,
      z: 2,
      depthScale: 0.9,
      pauseDuration: 1.6,
      speechText: 'Ngụp lặn một cái xem có chú cá cyber nào bơi qua không!',
    },
    {
      x: poolCenterX - 24,
      y: poolCenterY + 34,
      z: 2,
      depthScale: 0.98,
      pauseDuration: 1.4,
      speechText: 'Bơi lội tung tăng thế này vui thật đó quạc quạc!',
    },
  ];
}

/**
 * Bắt đầu tính năng Đi Bơi
 */
export function triggerStartSwimming(announce = true, autoStopAfterSec?: number) {
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  appState.attachedLedgeOffsetY = 0;
  autoSwimStopTimer = autoStopAfterSec && autoStopAfterSec > 0 ? autoStopAfterSec : 0;

  spawnWaterPool(appState.posX, appState.posY);

  appState.setState('SWIMMING');
  appState.setExpression('happy', 4.0);
  appState.changeMood(10);
  appState.changeEnergy(-3);
  playWaterSplashSound(appState.posX);

  if (announce) {
    poolSpeak('Quạc quạc! MicroDuck bật hồ bơi 3D, nhảy xuống nước bơi giải nhiệt và lướt sóng nhé!');
  }
}

/**
 * Kết thúc chế độ bơi, vịt nhảy lên bờ rũ lông
 */
export function triggerStopSwimming(announce = true) {
  autoSwimStopTimer = 0;
  if (!isSwimmingActive) return;

  isSwimmingActive = false;
  fadeOutTimer = 0.8;
  if (submersionGroup) {
    submersionGroup.visible = false;
  }

  appState.posX = poolCenterX;
  appState.posY = poolCenterY + 25;
  appState.posZ = 0;
  appState.swimDepthScale = 1.0;
  appState.velY = -4.5;
  appState.velX = 0;
  appState.nextRoamDuration = appState.getAutoActionDelay();
  appState.setState('IDLE');
  appState.setExpression('happy', 3.0);

  const btnActSwim = document.getElementById('btn-act-swim') as HTMLButtonElement | null;
  if (btnActSwim) {
    btnActSwim.textContent = 'Hồ Bơi 3D & Đi Bơi Ra Xa';
    btnActSwim.style.background = 'rgba(14, 165, 233, 0.22)';
    btnActSwim.style.borderColor = 'rgba(56, 189, 248, 0.45)';
    btnActSwim.style.color = '#bae6fd';
  }

  spawnWaterSplash(appState.posX, appState.posY, 26);
  spawnShockwave(appState.posX, appState.posY, 0x38bdf8);
  playWaterEmergeSound(appState.posX);

  if (announce) {
    poolSpeak('MicroDuck bơi đã đời rồi! Lên bờ rũ lông tí tách cho khô ráo quạc quạc!');
  }
}

/**
 * Hủy hoàn toàn hồ bơi và dọn dẹp bộ nhớ Three.js
 */
export function removeWaterPool() {
  if (!poolGroup) return;

  ripples.forEach((r) => {
    poolGroup?.remove(r.mesh);
    r.mesh.geometry.dispose();
    (r.mesh.material as THREE.Material).dispose();
  });
  ripples.length = 0;
  contourRings = [];

  scene.remove(poolGroup);
  poolGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });

  poolGroup = null;
  waterSurfaceMesh = null;
  shorelineMesh = null;
  submersionGroup = null;
  buoyGroup = null;
  isSwimmingActive = false;
  fadeOutTimer = -1;

  appState.posZ = 0;
  appState.swimDepthScale = 1.0;
}

/**
 * Vòng lặp cập nhật vật lý nước, gợn sóng, và chuyển động bơi trong hồ 2.5D
 */
export function updateWaterPool(delta: number, _elapsed: number) {
  if (!poolGroup) return;

  swimElapsed += delta;

  // 1. Hoạt ảnh mờ dần khi dừng bơi & đồng bộ scale theo kích thước vịt
  const ms = appState.modelScale || 1.0;
  if (fadeOutTimer > 0) {
    fadeOutTimer -= delta;
    const alpha = Math.max(0, fadeOutTimer / 0.8);
    poolGroup.scale.setScalar(ms * (0.75 + alpha * 0.25));
    poolGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const mat = obj.material as THREE.Material;
        mat.transparent = true;
        mat.opacity = Math.min(mat.opacity, alpha * 0.85);
      }
    });

    if (fadeOutTimer <= 0) {
      removeWaterPool();
      return;
    }
  } else {
    poolGroup.scale.setScalar(ms);
  }

  // 2. Chuyển động nhấp nhô & gợn sóng đồng mức
  if (waterSurfaceMesh) {
    const pulse = 1 + Math.sin(swimElapsed * 2.4) * 0.015;
    waterSurfaceMesh.scale.set(pulse, pulse * ASPECT_Y, 1.0);
  }
  if (shorelineMesh) {
    (shorelineMesh.material as THREE.MeshBasicMaterial).opacity =
      0.68 + Math.sin(swimElapsed * 3.5) * 0.2;
  }
  contourRings.forEach((ring, i) => {
    const pulse = 1 + Math.sin(swimElapsed * 2.0 + i * 1.1) * 0.025;
    ring.scale.set(pulse, pulse * ASPECT_Y, 1.0);
  });
  if (buoyGroup) {
    buoyGroup.position.y = POOL_RADIUS_Y * 0.25 + Math.sin(swimElapsed * 3.0) * 3.2;
    buoyGroup.rotation.z = Math.sin(swimElapsed * 1.8) * 0.14;
  }

  // 3. Cập nhật các vòng sóng tỏa ra (Ripples) trên mặt phẳng XY
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.life += delta;
    if (r.life >= r.maxLife) {
      poolGroup.remove(r.mesh);
      r.mesh.geometry.dispose();
      (r.mesh.material as THREE.Material).dispose();
      ripples.splice(i, 1);
      continue;
    }

    const progress = r.life / r.maxLife;
    const expansion = 1.0 + progress * 2.4;
    r.mesh.scale.set(expansion, expansion * ASPECT_Y, 1.0);
    (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.78;
  }

  // 4. Điều phối lộ trình bơi tích cực
  if (isSwimmingActive && appState.state === 'SWIMMING') {
    if (autoSwimStopTimer > 0) {
      autoSwimStopTimer -= delta;
      if (autoSwimStopTimer <= 0) {
        triggerStopSwimming(false);
        return;
      }
    }
    const waypoints = getSwimWaypoints();
    const targetWp = waypoints[currentWaypointIdx];

    rippleTimer += delta;
    if (rippleTimer > 0.24) {
      rippleTimer = 0;
      spawnWaterRipple(appState.posX, appState.posY, targetWp.depthScale);
      if (Math.random() < 0.35) {
        spawnWaterSplash(appState.posX, appState.posY, 2);
      }
    }

    const moveRate = Math.min(1, delta * 2.2);
    appState.posX = THREE.MathUtils.lerp(appState.posX, targetWp.x, moveRate);

    const bobbing = Math.sin(swimElapsed * 4.2) * 3.0;
    appState.posY = THREE.MathUtils.lerp(appState.posY, targetWp.y + bobbing, moveRate);

    // Giữ posZ = 2 để vịt luôn nổi phía trước lớp nước hồ, tạo chiều sâu bằng swimDepthScale
    appState.posZ = 2;
    appState.swimDepthScale = THREE.MathUtils.lerp(
      appState.swimDepthScale || 1.0,
      targetWp.depthScale,
      moveRate
    );

    if (submersionGroup) {
      submersionGroup.visible = true;
      submersionGroup.position.set(
        appState.posX - poolCenterX,
        -(appState.posY - poolCenterY) + 12 * appState.swimDepthScale,
        12
      );
      const wScale = appState.swimDepthScale * appState.modelScale;
      submersionGroup.scale.setScalar(wScale);
    }

    const dx = targetWp.x - appState.posX;
    const dy = targetWp.y - appState.posY;
    const targetAngle = Math.atan2(dx, -dy) * 0.45;
    appState.facingAngle = THREE.MathUtils.lerp(
      appState.facingAngle,
      targetAngle,
      Math.min(1, delta * 6)
    );

    const distToTarget = Math.hypot(dx, dy);
    if (distToTarget < 25) {
      waypointTimer += delta;
      if (waypointTimer >= (targetWp.pauseDuration || 1.0)) {
        waypointTimer = 0;
        currentWaypointIdx = (currentWaypointIdx + 1) % waypoints.length;

        const nextWp = waypoints[currentWaypointIdx];
        if (nextWp.speechText) {
          poolSpeak(nextWp.speechText);
        }
      }
    }

    appState.changeEnergy(-0.6 * delta);
    appState.changeHunger(-0.3 * delta);
    appState.changeMood(1.2 * delta);

    swimSpeechTimer += delta;
    if (swimSpeechTimer > 22) {
      swimSpeechTimer = 0;
      const quotes = [
        'Vẫy chân chèo nước tí tách, năng lượng vui vẻ tăng vọt!',
        'Hồ nước 3D trong mát quá, bơi sải một vòng thật sảng khoái!',
        'MicroDuck rẽ sóng nước êm ru, thư giãn tuyệt đối!',
      ];
      poolSpeak(quotes[Math.floor(Math.random() * quotes.length)]);
    }
  }
}
