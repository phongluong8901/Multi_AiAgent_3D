import * as THREE from 'three';
import { scene } from './scene';
import { appState } from './state';
import { ParticleItem } from './types';

interface ShockwaveItem {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
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

const particleGeo = new THREE.OctahedronGeometry(4.5, 0);
const shockwaveGeo = new THREE.RingGeometry(18, 25, 28);

export function spawnParticles(x: number, y: number, count: number, colorHex: number) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 55,
      -(y + (Math.random() - 0.5) * 40),
      30 + Math.random() * 20
    );
    scene.add(mesh);

    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 2.8,
      vy: 1.5 + Math.random() * 2.4,
      vz: (Math.random() - 0.5) * 1.4,
      life: 0,
      maxLife: 0.65 + Math.random() * 0.45,
    });
  }
}

export function spawnShockwave(x: number, y: number, colorHex = 0x38bdf8) {
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(shockwaveGeo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, -y + 2, 0);
  scene.add(mesh);

  shockwaves.push({
    mesh,
    life: 0,
    maxLife: 0.42,
  });
}

export function spawnScanEffect(x: number, y: number) {
  spawnShockwave(x, y - 60, 0x38bdf8);
  spawnShockwave(x, y - 110, 0x818cf8);
  spawnParticles(x, y - 90, 10, 0x38bdf8);
}

export function spawnAlertEffect(x: number, y: number) {
  spawnShockwave(x, y - 80, 0xf87171);
  spawnShockwave(x, y - 130, 0xfbbf24);
  spawnParticles(x, y - 120, 14, 0xf87171);
}

export function clearLadder() {
  if (ladderMesh) {
    scene.remove(ladderMesh);
    ladderMesh = null;
  }
}

export function spawnLadder(x: number, bottomY: number, topY: number) {
  clearLadder();
  const height = Math.max(60, bottomY - topY);
  const midY = (bottomY + topY) * 0.5;
  const group = new THREE.Group();

  const railGeo = new THREE.CylinderGeometry(2.5, 2.5, height, 8);
  const railMat = new THREE.MeshToonMaterial({ color: 0x38bdf8 });
  const leftRail = new THREE.Mesh(railGeo, railMat);
  leftRail.position.x = -18;
  const rightRail = new THREE.Mesh(railGeo, railMat);
  rightRail.position.x = 18;
  group.add(leftRail, rightRail);

  const rungGeo = new THREE.CylinderGeometry(2.0, 2.0, 36, 8);
  const rungMat = new THREE.MeshToonMaterial({ color: 0xfbbf24 });
  for (let rY = -height * 0.5 + 16; rY <= height * 0.5 - 10; rY += 28) {
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

  group.position.set(appState.posX, -appState.posY, 15);
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
  group.position.set(x, -y + 18, 25);
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

export function updateParticles(delta: number) {
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
    p.mesh.scale.setScalar(1 - progress * 0.7);
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.life += delta;
    if (s.life >= s.maxLife) {
      scene.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
      shockwaves.splice(i, 1);
      continue;
    }
    const progress = s.life / s.maxLife;
    s.mesh.scale.setScalar(1 + progress * 2.4);
    (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - progress);
  }

  if (foodMesh && appState.foodTarget) {
    const now = performance.now();
    foodMesh.rotation.y += delta * 2.8;
    foodMesh.rotation.x = 0.55 + Math.sin(now * 0.005) * 0.15;
    foodMesh.position.y = -appState.foodTarget.y + 18 + Math.sin(now * 0.006) * 5;
  }

  if (parachuteMesh) {
    parachuteMesh.position.set(appState.posX, -appState.posY, 15);
    parachuteMesh.rotation.z = Math.sin(performance.now() * 0.004) * 0.14;
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
}
