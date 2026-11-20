import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { scene } from './scene';
import { appState } from './state';
import {
  spawnParticles,
  spawnShockwave,
  triggerRandomSpecial3DEffect,
} from './particles';
import {
  playDuckQuackSound,
  playJumpSound,
  playSuccessChimeSound,
  playWhooshSound,
} from './soundFx';
import { equipAccessory3D } from '../characters/accessories3d';
import { createCloneMicroDuckMesh } from '../characters/characterRig';
import { isDesktopIconTaskActive } from '../physics/desktopIconInteract';
import { isWaterPoolActive, triggerStopSwimming } from './waterPool';
import { isP2pSessionActive } from './p2pArena';

interface FootprintItem {
  mesh: THREE.Group;
  life: number;
  maxLife: number;
}

interface GooseState {
  phase: 'chasing_cursor' | 'tugging_cursor';
  stepsDone: number;
  maxSteps: number;
  stepTimer: number;
  dirX: number;
  dirY: number;
  expectedCursorX: number;
  expectedCursorY: number;
  inFlight: boolean;
}

const footprints: FootprintItem[] = [];
let footprintSpawnTimer = 0;
let beakTetherLine: THREE.Line | null = null;

let lastKeyPressTotal = -1;
let typingKps = 0;
let continuousTypingTimer = 0;
let continuousMusicTimer = 0;
let typingReactionCooldown = 0;
let musicReactionCooldown = 0;
let manualBeatTimer = 0;
let rhythmSparkTimer = 0;

let ambientRoamHatElapsed = 0;
let temporaryHatTimer = 0;

let gooseActiveTimer = 0;
let gooseCooldown = 45;
let gooseState: GooseState | null = null;

interface TerritoryDefenseState {
  combatMode: 'sword' | 'ufo_gun';
  phase:
    | 'intruder_entering'
    | 'hero_charging'
    | 'combat_action'
    | 'intruder_fleeing'
    | 'winner_celebration';
  timer: number;
  startX: number;
  startY: number;
  intruderX: number;
  intruderY: number;
  intrudeTargetX: number;
  intrudeTargetY: number;
  floorY: number;
  fleeTargetX: number;
  actionsDone: number;
}

interface LaserBoltItem {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  isFinisher: boolean;
}

let territoryCooldown = 120;
let nextTerritoryMode: 'sword' | 'ufo' = 'sword';
let territoryState: TerritoryDefenseState | null = null;
let heroSwordGroup: THREE.Group | null = null;
let heroGunGroup: THREE.Group | null = null;
let intruderDuckGroup: THREE.Group | null = null;
const laserBolts: LaserBoltItem[] = [];
let speakCb: ((msg: string) => void) | null = null;

export function registerRhythmGooseSpeakCallback(cb: (msg: string) => void) {
  speakCb = cb;
}

function speak(msg: string) {
  if (speakCb) {
    speakCb(msg);
  }
}

export function clearTemporaryAccessoryTimer() {
  temporaryHatTimer = 0;
  ambientRoamHatElapsed = 0;
}

function ensureBeakTether() {
  if (beakTetherLine) return;
  const geo = new THREE.BufferGeometry();
  const pts = new Float32Array([0, 0, 14, 0, 0, 14]);
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.95,
  });
  beakTetherLine = new THREE.Line(geo, mat);
  beakTetherLine.visible = false;
  scene.add(beakTetherLine);
}

function updateBeakTether(charX: number, charY: number, cursorX: number, cursorY: number) {
  ensureBeakTether();
  if (!beakTetherLine) return;
  beakTetherLine.visible = true;
  const attr = beakTetherLine.geometry.getAttribute('position') as THREE.BufferAttribute;
  attr.setXYZ(0, charX, -(charY - 95 * appState.modelScale), 14);
  attr.setXYZ(1, cursorX, -cursorY, 14);
  attr.needsUpdate = true;
}

function hideBeakTether() {
  if (beakTetherLine) {
    beakTetherLine.visible = false;
  }
}

function spawnDuckFootprint(x: number, y: number, walkDir: number) {
  const fp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  const heel = new THREE.Mesh(new THREE.CircleGeometry(4.5, 10), mat.clone());
  const toeCenter = new THREE.Mesh(new THREE.ConeGeometry(4.2, 9, 4), mat.clone());
  toeCenter.position.set(walkDir * 5, 0, 0);
  toeCenter.rotation.z = -walkDir * (Math.PI / 2);

  const toeL = new THREE.Mesh(new THREE.ConeGeometry(2.8, 7, 4), mat.clone());
  toeL.position.set(walkDir * 4.5, 3.5, 0);
  toeL.rotation.z = -walkDir * (Math.PI / 2) + 0.35;

  const toeR = new THREE.Mesh(new THREE.ConeGeometry(2.8, 7, 4), mat.clone());
  toeR.position.set(walkDir * 4.5, -3.5, 0);
  toeR.rotation.z = -walkDir * (Math.PI / 2) - 0.35;

  fp.add(heel, toeCenter, toeL, toeR);
  fp.position.set(x, -y + 2, -2);
  scene.add(fp);

  footprints.push({ mesh: fp, life: 0, maxLife: 3.2 });
}

function dropGooseNoteToast(x: number, y: number) {
  const root = document.getElementById('app-ui') || document.body;
  const notes = [
    'Quạc! Đừng quên uống nước và chớp mắt 20 giây nhé!',
    'Con trỏ chuột đứng im lâu quá nên tớ tha đi dạo một vòng đó!',
    'MicroDuck đã ghé qua để lại dấu chân 3D trên màn hình của bạn!',
    'Nghỉ tay vươn vai một chút trước khi code tiếp nhé Chủ nhân!',
  ];
  const noteText = notes[Math.floor(Math.random() * notes.length)];

  const el = document.createElement('div');
  el.style.cssText = [
    'position: fixed',
    `left: ${Math.max(16, Math.min((appState.W || window.innerWidth) - 260, Math.round(x - 110)))}px`,
    `top: ${Math.max(16, Math.min((appState.H || window.innerHeight) - 110, Math.round(y + 18)))}px`,
    'width: 235px',
    'padding: 9px 11px',
    'border-radius: 10px',
    'background: rgba(15, 23, 42, 0.92)',
    'border: 1px solid rgba(249, 115, 22, 0.65)',
    'box-shadow: 0 10px 26px rgba(0, 0, 0, 0.5)',
    'color: #f8fafc',
    'font-size: 11.5px',
    'line-height: 1.4',
    'z-index: 9995',
    'pointer-events: none',
    'transition: opacity 0.6s ease',
  ].join(';');

  const tag = document.createElement('div');
  tag.style.cssText = 'color: #fb923c; font-size: 10px; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.4px;';
  tag.textContent = '[GOOSE NOTE]';

  const body = document.createElement('div');
  body.textContent = noteText;

  el.appendChild(tag);
  el.appendChild(body);
  root.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
  }, 5400);
  setTimeout(() => {
    el.remove();
  }, 6050);
}

export function triggerManualBeatDance() {
  if (isWaterPoolActive()) {
    triggerStopSwimming(false);
  }
  manualBeatTimer = 8.5;
  appState.rhythmIntensity = Math.max(appState.rhythmIntensity, 0.78);
  appState.setState('DANCING');
  appState.setExpression('happy', 4.5);
  appState.changeMood(6);
  spawnShockwave(appState.posX, appState.posY - 10, 0x38bdf8);
  spawnParticles(appState.posX, appState.posY - 85, 16, 0xf472b6);
  playJumpSound(appState.posX);
  speak('[BEAT DANCE] Bật chế độ nhún nhảy theo nhịp nhạc hệ thống & Visualizer 3D!');
}

export function triggerGooseMischiefMode(manual = true) {
  if (isDesktopIconTaskActive() || appState.state === 'DRAGGING') return;
  if (isWaterPoolActive()) {
    triggerStopSwimming(false);
  }
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;

  gooseActiveTimer = 14.0;
  gooseCooldown = 150.0;

  const targetX = appState.globalCursorX;
  const targetY = appState.globalCursorY;
  const pullDirX = targetX > appState.W * 0.5 ? -1 : 1;
  const pullDirY = targetY > appState.H * 0.5 ? -1 : 1;

  gooseState = {
    phase: 'chasing_cursor',
    stepsDone: 0,
    maxSteps: 10,
    stepTimer: 0,
    dirX: pullDirX * 9,
    dirY: pullDirY * 5,
    expectedCursorX: targetX,
    expectedCursorY: targetY,
    inFlight: false,
  };

  appState.velX = 0;
  appState.velY = 0;
  appState.walkDir = targetX >= appState.posX ? 1 : -1;
  appState.setState('WALKING');
  appState.setExpression('happy', 3.5);
  playDuckQuackSound(appState.posX);

  if (manual) {
    speak('[GOOSE MODE] Chế độ Vịt Tinh Nghịch đã bật! Tớ chạy đi bắt con trỏ chuột đây quạc quạc!');
  } else {
    speak('[GOOSE MODE] Thấy con trỏ chuột đứng im nãy giờ... Tớ lén chạy ra tha đi dạo nhé!');
  }
}

export function disposeThreeGroup(group: THREE.Group | null) {
  if (!group) return;
  if (group.parent) {
    group.parent.remove(group);
  }
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
}

export function buildHeroSwordMesh(): THREE.Group {
  const s = appState.modelScale || 1.0;
  const sword = new THREE.Group();
  sword.position.set(24 * s, 72 * s, 14 * s);
  sword.scale.setScalar(s);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.85,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.75,
    metalness: 0.2,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.78,
    roughness: 0.15,
    metalness: 0.85,
  });

  const pommel = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 10), goldMat);
  pommel.position.set(0, -11, 0);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 16, 10), gripMat);
  grip.position.set(0, -2, 0);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(16, 3.6, 5.5), goldMat);
  guard.position.set(0, 7, 0);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3.4, 62, 1.4), bladeMat);
  blade.position.set(0, 39, 0);
  const bladeCore = new THREE.Mesh(new THREE.BoxGeometry(1.2, 58, 1.8), goldMat);
  bladeCore.position.set(0, 39, 0);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(2.4, 10, 4), bladeMat);
  tip.rotation.y = Math.PI / 4;
  tip.position.set(0, 75, 0);

  const slashArc = new THREE.Mesh(
    new THREE.TorusGeometry(42, 2.2, 8, 24, Math.PI * 0.75),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    })
  );
  slashArc.name = 'slashArc';
  slashArc.position.set(0, 24, 2);
  slashArc.visible = false;

  sword.add(pommel, grip, guard, blade, bladeCore, tip, slashArc);
  return sword;
}

export function buildHeroGunMesh(): THREE.Group {
  const s = appState.modelScale || 1.0;
  const gun = new THREE.Group();
  gun.position.set(24 * s, 74 * s, 16 * s);
  gun.scale.setScalar(s);

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.65,
    metalness: 0.3,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.78,
  });
  const plasmaMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.85,
    roughness: 0.15,
  });
  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

  const grip = new THREE.Mesh(new THREE.BoxGeometry(5, 14, 6), gripMat);
  grip.position.set(0, -6, -3);
  grip.rotation.x = 0.25;

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 26), bodyMat);
  receiver.position.set(0, 3, 6);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 22, 12), plasmaMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 4, 20);

  const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.9, 8, 16), muzzleMat);
  muzzleRing.position.set(0, 4, 31);

  gun.add(grip, receiver, barrel, muzzleRing);
  return gun;
}

function buildIntruderDuckMesh(withUfo: boolean): THREE.Group {
  const s = appState.modelScale || 1.0;
  const heroBody = (appState.duckBodyColor || '').toLowerCase();
  const palettes: Array<[string, string]> = [
    ['#312e81', '#f43f5e'],
    ['#1e293b', '#a855f7'],
    ['#064e3b', '#facc15'],
    ['#7f1d1d', '#38bdf8'],
  ];
  const candidates = palettes.filter(([b]) => b.toLowerCase() !== heroBody);
  const [bodyHex, accentHex] = candidates[Math.floor(Math.random() * candidates.length)] || palettes[0];

  const intruderRoot = new THREE.Group();
  const cloneDuck = createCloneMicroDuckMesh(bodyHex, accentHex);

  if (!withUfo) {
    intruderRoot.add(cloneDuck);
    return intruderRoot;
  }

  cloneDuck.position.y = 2 * s;
  intruderRoot.add(cloneDuck);

  const ufoDisk = new THREE.Group();
  ufoDisk.name = 'ufoDisk';
  ufoDisk.scale.setScalar(s);

  const saucerMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.25,
    metalness: 0.85,
  });
  const neonRimMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6,
    emissive: 0x6d28d9,
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });

  const saucerDisc = new THREE.Mesh(new THREE.CylinderGeometry(36, 44, 7, 24), saucerMat);
  saucerDisc.position.y = -2;
  const neonRim = new THREE.Mesh(new THREE.TorusGeometry(40, 2.5, 10, 28), neonRimMat);
  neonRim.rotation.x = Math.PI / 2;
  neonRim.position.y = -2;
  const bottomDome = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 10), domeMat);
  bottomDome.position.y = -8;

  ufoDisk.add(saucerDisc, neonRim, bottomDome);
  intruderRoot.add(ufoDisk);

  return intruderRoot;
}

export function showWinnerVictoryBanner(x: number, y: number) {
  const existing = document.getElementById('territory-winner-banner');
  if (existing) existing.remove();

  const root = document.getElementById('app-ui') || document.body;
  const s = appState.modelScale || 1.0;
  const el = document.createElement('div');
  el.id = 'territory-winner-banner';
  el.style.cssText = [
    'position: fixed',
    `left: ${Math.max(16, Math.min((appState.W || window.innerWidth) - 130, Math.round(x - 52)))}px`,
    `top: ${Math.max(18, Math.min((appState.H || window.innerHeight) - 70, Math.round(y - 210 * s)))}px`,
    'padding: 6px 16px',
    'border-radius: 999px',
    'background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(120, 53, 15, 0.92))',
    'border: 1.5px solid rgba(250, 204, 21, 0.9)',
    'box-shadow: 0 8px 22px rgba(245, 158, 11, 0.4)',
    'color: #fef08a',
    'font-size: 13px',
    'font-weight: 900',
    'letter-spacing: 1.2px',
    'z-index: 9998',
    'pointer-events: none',
    'transition: opacity 0.45s ease, transform 0.45s ease',
  ].join(';');
  el.textContent = 'WINNER';

  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
  }, 1450);
  setTimeout(() => {
    el.remove();
  }, 2000);
}

function clearAllLaserBolts() {
  for (let i = laserBolts.length - 1; i >= 0; i--) {
    const b = laserBolts[i];
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    (b.mesh.material as THREE.Material).dispose();
    laserBolts.splice(i, 1);
  }
}

function disposeTerritoryDefense() {
  disposeThreeGroup(heroSwordGroup);
  heroSwordGroup = null;
  disposeThreeGroup(heroGunGroup);
  heroGunGroup = null;
  disposeThreeGroup(intruderDuckGroup);
  intruderDuckGroup = null;
  clearAllLaserBolts();
  territoryState = null;
}

function spawnLaserBolt(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  isFinisher: boolean
) {
  const s = appState.modelScale || 1.0;
  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed = 940;
  const vx = (dx / dist) * speed;
  const vy = (dy / dist) * speed;

  const boltGeo = new THREE.CylinderGeometry(1.8 * s, 1.8 * s, 22 * s, 8);
  const boltMat = new THREE.MeshBasicMaterial({
    color: isFinisher ? 0xfacc15 : 0x22d3ee,
  });
  const mesh = new THREE.Mesh(boltGeo, boltMat);
  mesh.position.set(startX, -startY, 18);
  mesh.rotation.z = Math.atan2(-vy, vx) - Math.PI / 2;
  scene.add(mesh);

  laserBolts.push({
    mesh,
    x: startX,
    y: startY,
    vx,
    vy,
    targetX,
    targetY,
    isFinisher,
  });
}

export function triggerTerritoryDefenseMode(_manual = true, forcedType?: 'sword' | 'ufo') {
  if (isDesktopIconTaskActive() || appState.state === 'DRAGGING') return;
  if (isWaterPoolActive()) {
    triggerStopSwimming(false);
  }
  if (gooseState) {
    hideBeakTether();
    gooseState = null;
  }
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  disposeTerritoryDefense();

  territoryCooldown = 190.0;

  const chosenMode = forcedType ?? nextTerritoryMode;
  nextTerritoryMode = chosenMode === 'sword' ? 'ufo' : 'sword';
  const isUfo = chosenMode === 'ufo';

  const w = appState.W || window.innerWidth || 1920;
  const s = appState.modelScale || 1.0;
  const floorY = Math.max(180, (appState.H || window.innerHeight || 1080) - 48);
  const skyHoverY = Math.max(140, floorY - 185 * s);
  const fromRight = Math.random() < 0.5;

  const startX = fromRight ? w + 65 : -65;
  const startY = isUfo ? skyHoverY : floorY;
  let targetX = fromRight
    ? Math.max(180, Math.min(w - 160, w * 0.72))
    : Math.max(160, Math.min(w - 180, w * 0.28));
  const targetY = isUfo ? skyHoverY : floorY;
  const fleeX = fromRight ? w + 100 : -100;

  const minSep = isUfo ? 220 : 150;
  if (Math.abs(targetX - appState.posX) < minSep) {
    targetX =
      appState.posX > w * 0.5
        ? Math.max(160, appState.posX - (isUfo ? 260 : 230))
        : Math.min(w - 160, appState.posX + (isUfo ? 260 : 230));
  }

  if (isUfo) {
    heroGunGroup = buildHeroGunMesh();
    appState.avatarGroup.add(heroGunGroup);
  } else {
    heroSwordGroup = buildHeroSwordMesh();
    appState.avatarGroup.add(heroSwordGroup);
  }

  intruderDuckGroup = buildIntruderDuckMesh(isUfo);
  intruderDuckGroup.position.set(startX, -startY, 12);
  scene.add(intruderDuckGroup);

  territoryState = {
    combatMode: isUfo ? 'ufo_gun' : 'sword',
    phase: 'intruder_entering',
    timer: 0,
    startX,
    startY,
    intruderX: startX,
    intruderY: startY,
    intrudeTargetX: targetX,
    intrudeTargetY: targetY,
    floorY,
    fleeTargetX: fleeX,
    actionsDone: 0,
  };

  appState.velX = 0;
  appState.velY = 0;
  appState.walkDir = targetX >= appState.posX ? 1 : -1;
  appState.setState('ALERT');
  appState.setExpression('surprised', 2.2);
  playDuckQuackSound(appState.posX);
  spawnShockwave(appState.posX, appState.posY - 40, 0xef4444);
  speak(
    isUfo
      ? '[BÁO ĐỘNG ĐĨA BAY!] Vịt lạ cưỡi UFO bay vào lãnh thổ! Rút Súng Laser bắn hạ ngay!'
      : '[BÁO ĐỘNG LÃNH THỔ!] Phát hiện vịt lạ xâm nhập màn hình! Rút Kiếm Cyber ra đuổi ngay!'
  );
}

function stepTerritoryDefense(delta: number, elapsed: number): boolean {
  if (!territoryState) return false;
  if (appState.state === 'DRAGGING') {
    disposeTerritoryDefense();
    return false;
  }

  const st = territoryState;
  const s = appState.modelScale || 1.0;
  const isUfo = st.combatMode === 'ufo_gun';
  st.timer += delta;

  // Cập nhật các tia đạn Laser bay vào UFO
  for (let i = laserBolts.length - 1; i >= 0; i--) {
    const b = laserBolts[i];
    b.x += b.vx * delta;
    b.y += b.vy * delta;
    b.mesh.position.set(b.x, -b.y, 18);

    const hitTargetY = st.intruderY - 20 * s;
    const distToUfo = Math.hypot(b.x - st.intruderX, b.y - hitTargetY);
    if (distToUfo <= 38 * s || b.x < -120 || b.x > (appState.W || 1920) + 120 || b.y < -120) {
      const impactDir = st.intruderX >= appState.posX ? 1 : -1;
      spawnParticles(b.x, b.y, b.isFinisher ? 18 : 11, b.isFinisher ? 0xfacc15 : 0x38bdf8);
      spawnShockwave(st.intruderX, hitTargetY, b.isFinisher ? 0xf97316 : 0x22d3ee);
      st.intruderX += impactDir * (b.isFinisher ? 52 : 28);
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
      laserBolts.splice(i, 1);
    }
  }

  if (intruderDuckGroup) {
    const hoverBob = isUfo ? Math.sin(elapsed * 5.2) * 8 * s : 0;
    intruderDuckGroup.position.set(st.intruderX, -(st.intruderY + hoverBob), 12);
    const legL = intruderDuckGroup.getObjectByName('legL');
    const legR = intruderDuckGroup.getObjectByName('legR');
    if (!isUfo && (st.phase === 'intruder_entering' || st.phase === 'intruder_fleeing')) {
      const stride = Math.sin(elapsed * (st.phase === 'intruder_fleeing' ? 24 : 15)) * 0.58;
      if (legL) legL.rotation.x = stride;
      if (legR) legR.rotation.x = -stride;
    } else {
      if (legL) legL.rotation.x = 0;
      if (legR) legR.rotation.x = 0;
    }
    if (isUfo) {
      const ufoDisk = intruderDuckGroup.getObjectByName('ufoDisk');
      if (ufoDisk) ufoDisk.rotation.y += delta * 5.5;
    }
  }

  if (st.phase === 'intruder_entering') {
    const p = Math.min(1, st.timer / 1.3);
    st.intruderX = st.startX + (st.intrudeTargetX - st.startX) * p;
    st.intruderY = st.startY + (st.intrudeTargetY - st.startY) * p;
    if (intruderDuckGroup) {
      intruderDuckGroup.rotation.y = st.intrudeTargetX >= st.startX ? 0.55 : -0.55;
    }
    appState.posY += (st.floorY - appState.posY) * Math.min(1, delta * 8);
    appState.walkDir = st.intruderX >= appState.posX ? 1 : -1;
    appState.setState('ALERT');
    if (heroSwordGroup) {
      heroSwordGroup.rotation.z = -0.35 + Math.sin(elapsed * 8) * 0.12;
    }
    if (heroGunGroup) {
      heroGunGroup.rotation.x = -0.55;
    }
    if (st.timer >= 1.3) {
      st.phase = 'hero_charging';
      st.timer = 0;
      playWhooshSound(appState.posX);
    }
    return true;
  }

  if (st.phase === 'hero_charging') {
    const dx = st.intruderX - appState.posX;
    const dist = Math.abs(dx);
    const stopDist = isUfo ? 240 : 76;
    appState.walkDir = dx >= 0 ? 1 : -1;
    appState.setState('WALKING');
    if (dist > stopDist) {
      appState.posX += Math.sign(dx) * Math.min(dist - stopDist, 460 * delta);
    }
    appState.posY += (st.floorY - appState.posY) * Math.min(1, delta * 10);
    if (intruderDuckGroup) {
      intruderDuckGroup.rotation.y = appState.posX >= st.intruderX ? 0.55 : -0.55;
    }
    if (heroSwordGroup) {
      heroSwordGroup.rotation.z = -0.6 + Math.sin(elapsed * 18) * 0.16;
    }
    if (heroGunGroup) {
      heroGunGroup.rotation.x = -0.68;
    }
    if (dist <= stopDist + 6 || st.timer >= 2.0) {
      st.phase = 'combat_action';
      st.timer = 0;
      st.actionsDone = 0;
    }
    return true;
  }

  if (st.phase === 'combat_action') {
    const dir = st.intruderX >= appState.posX ? 1 : -1;
    appState.walkDir = dir;
    appState.setState('PUSHING');

    const actionMarks = [0.15, 0.62, 1.08];
    if (!isUfo) {
      if (heroSwordGroup) {
        heroSwordGroup.rotation.z = 0.7 + Math.sin(st.timer * 18) * 1.1;
        const arc = heroSwordGroup.getObjectByName('slashArc');
        if (arc) {
          arc.visible = true;
          arc.rotation.z += delta * 22;
        }
      }

      if (st.actionsDone < actionMarks.length && st.timer >= actionMarks[st.actionsDone]) {
        st.actionsDone++;
        const isFinisher = st.actionsDone === 3;
        const hitX = (appState.posX + st.intruderX) * 0.5;
        const hitY = st.floorY - 72 * s;
        playWhooshSound(appState.posX);
        spawnParticles(hitX, hitY, isFinisher ? 18 : 11, isFinisher ? 0xfacc15 : 0x38bdf8);
        spawnShockwave(st.intruderX, st.floorY - 64 * s, isFinisher ? 0xf97316 : 0x22d3ee);
        st.intruderX += dir * (isFinisher ? 68 : 36);
        appState.squashX = 1.18;
        appState.squashY = 0.86;
      }

      if (st.timer >= 1.08) {
        const jumpP = Math.min(1, (st.timer - 1.08) / 0.42);
        appState.posY = st.floorY - Math.sin(jumpP * Math.PI) * 44;
      } else {
        appState.posY = st.floorY;
      }
    } else {
      // Bắn 3 phát súng Laser lên đĩa bay UFO
      appState.posY = st.floorY;
      const recoil = Math.max(0, Math.sin(st.timer * 14)) * 0.14;
      if (heroGunGroup) {
        heroGunGroup.rotation.x = -0.78 - recoil;
      }

      if (st.actionsDone < actionMarks.length && st.timer >= actionMarks[st.actionsDone]) {
        st.actionsDone++;
        const isFinisher = st.actionsDone === 3;
        const muzzleX = appState.posX + dir * 24 * s;
        const muzzleY = appState.posY - 82 * s;
        playWhooshSound(appState.posX);
        spawnParticles(muzzleX, muzzleY, 6, isFinisher ? 0xfacc15 : 0x22d3ee);
        spawnLaserBolt(muzzleX, muzzleY, st.intruderX, st.intruderY - 18 * s, isFinisher);
        appState.squashX = 0.9;
        appState.squashY = 1.12;
      }
    }

    if (st.timer >= 1.55) {
      appState.posY = st.floorY;
      if (heroSwordGroup) {
        const arc = heroSwordGroup.getObjectByName('slashArc');
        if (arc) arc.visible = false;
      }
      st.phase = 'intruder_fleeing';
      st.timer = 0;
      playDuckQuackSound(st.intruderX);
      speak(
        isUfo
          ? 'Bắn trúng 3 phát Laser! Đĩa bay xì khói đang tháo chạy khỏi bầu trời!'
          : 'Quạc quạc! Vịt xâm phạm trúng 3 nhát kiếm đang hoảng hốt bỏ chạy rồi!'
      );
    }
    return true;
  }

  if (st.phase === 'intruder_fleeing') {
    const fleeDir = st.fleeTargetX >= st.intruderX ? 1 : -1;
    st.intruderX += fleeDir * (isUfo ? 580 : 540) * delta;
    if (isUfo) {
      st.intruderY = Math.max(40, st.intruderY - 75 * delta);
    }
    if (intruderDuckGroup) {
      intruderDuckGroup.rotation.y += delta * 14;
    }
    if (!isUfo && st.timer < 0.7) {
      appState.walkDir = fleeDir;
      appState.posX += fleeDir * 170 * delta;
      appState.setState('WALKING');
    } else {
      appState.setState('WAVING');
    }
    if (heroSwordGroup) {
      heroSwordGroup.rotation.z = -0.35 + Math.sin(elapsed * 20) * 0.35;
    }
    if (heroGunGroup) {
      heroGunGroup.rotation.x = -0.45 + Math.sin(elapsed * 12) * 0.1;
    }

    if (st.timer >= 1.5) {
      disposeThreeGroup(intruderDuckGroup);
      intruderDuckGroup = null;
      clearAllLaserBolts();
      st.phase = 'winner_celebration';
      st.timer = 0;

      triggerRandomSpecial3DEffect(appState.posX, appState.posY, 'cyber_fireworks');
      showWinnerVictoryBanner(appState.posX, appState.posY);
      playSuccessChimeSound(appState.posX);
      appState.changeMood(8);
      appState.setExpression('happy', 3.5);
      appState.setState('DANCING');
      speak('WINNER! Đã đánh đuổi vịt xâm phạm bảo vệ lãnh thổ thành công!');
    }
    return true;
  }

  // phase === 'winner_celebration'
  appState.setState('DANCING');
  if (heroSwordGroup) {
    heroSwordGroup.rotation.z = Math.sin(elapsed * 10) * 0.25;
  }
  if (heroGunGroup) {
    heroGunGroup.rotation.x = -0.6 + Math.sin(elapsed * 10) * 0.2;
  }
  if (Math.random() < delta * 6) {
    spawnParticles(appState.posX, appState.posY - 135 * s, 2, 0xfacc15);
  }
  if (st.timer >= 2.2) {
    disposeTerritoryDefense();
    appState.nextRoamDuration = appState.getAutoActionDelay();
    appState.setState('IDLE');
  }
  return true;
}

export function isGooseModeActive(): boolean {
  return gooseState !== null || territoryState !== null;
}

export function hasRhythmGooseVisuals(): boolean {
  return (
    gooseState !== null ||
    territoryState !== null ||
    footprints.length > 0 ||
    laserBolts.length > 0 ||
    intruderDuckGroup !== null
  );
}

export function updateRhythmAndGoose(delta: number, elapsed: number) {
  if (isP2pSessionActive()) {
    appState.rhythmIntensity = 0;
    return;
  }
  // 1. Tính tốc độ gõ phím thực tế theo từng frame
  if (lastKeyPressTotal < 0) {
    lastKeyPressTotal = appState.keyPressTotal;
  } else if (appState.keyPressTotal > lastKeyPressTotal) {
    const pressedDelta = Math.min(10, appState.keyPressTotal - lastKeyPressTotal);
    lastKeyPressTotal = appState.keyPressTotal;
    typingKps = Math.min(14, typingKps + pressedDelta * 1.4);
  }
  typingKps = Math.max(0, typingKps - delta * 4.5);

  if (manualBeatTimer > 0) manualBeatTimer = Math.max(0, manualBeatTimer - delta);
  if (typingReactionCooldown > 0) typingReactionCooldown = Math.max(0, typingReactionCooldown - delta);
  if (musicReactionCooldown > 0) musicReactionCooldown = Math.max(0, musicReactionCooldown - delta);
  if (gooseCooldown > 0) gooseCooldown = Math.max(0, gooseCooldown - delta);
  if (territoryCooldown > 0) territoryCooldown = Math.max(0, territoryCooldown - delta);

  const audioBoost = appState.systemAudioPeak * 1.35;
  const typingBoost = Math.min(1.0, typingKps / 7.0);
  const manualBoost = manualBeatTimer > 0 ? 0.78 : 0;
  appState.rhythmIntensity = Math.min(1.0, Math.max(audioBoost, typingBoost, manualBoost));

  // 2. Nhún nhảy & bắn hạt theo nhịp nhạc / gõ phím
  if (
    appState.rhythmIntensity > 0.12 &&
    (appState.state === 'IDLE' || appState.state === 'SITTING_WINDOW' || appState.state === 'WALKING')
  ) {
    appState.squashY = 1.0 + Math.sin(elapsed * 14) * 0.08 * appState.rhythmIntensity;
    appState.squashX = 1.0 - Math.sin(elapsed * 14) * 0.05 * appState.rhythmIntensity;

    rhythmSparkTimer += delta;
    if (rhythmSparkTimer >= 0.35) {
      rhythmSparkTimer = 0;
      const colors = [0x38bdf8, 0xf472b6, 0x34d399, 0xfacc15];
      spawnParticles(
        appState.posX + (Math.random() - 0.5) * 28,
        appState.posY - 95 * appState.modelScale,
        2,
        colors[Math.floor(Math.random() * colors.length)]
      );
    }
  }

  const canRunAmbient =
    !appState.isChatOpen &&
    !appState.isChatting &&
    !appState.isP2pArenaOpen &&
    !isP2pSessionActive();
  const canAutoBeat =
    canRunAmbient && appState.autoRoamEnabled && appState.isAutoBehaviorEnabled('beat_dance');

  // Phát hiện gõ phím liên tục -> cổ vũ & thỉnh thoảng đội phụ kiện 3D
  if (canAutoBeat && typingKps >= 3.0) {
    continuousTypingTimer += delta;
    if (continuousTypingTimer > 4.5 && typingReactionCooldown <= 0) {
      typingReactionCooldown = 75.0;
      continuousTypingTimer = 0;
      appState.setExpression('happy', 3.5);
      appState.changeMood(4);
      spawnParticles(appState.posX, appState.posY - 100, 10, 0x34d399);
      if (appState.isAutoBehaviorEnabled('accessory_hat') && Math.random() < 0.35) {
        equipAccessory3D('random', false);
        temporaryHatTimer = 45.0;
      }
      speak('[NHỊP GÕ PHÍM] Tốc độ gõ phím cực đỉnh! MicroDuck nhịp tay cổ vũ bạn đây!');
    }
  } else {
    continuousTypingTimer = Math.max(0, continuousTypingTimer - delta * 2);
  }

  // Phát hiện nhạc hệ thống liên tục -> tự động Dance theo điệu nhạc
  if (canAutoBeat && appState.systemAudioPeak > 0.08) {
    continuousMusicTimer += delta;
    if (
      continuousMusicTimer > 6.0 &&
      musicReactionCooldown <= 0 &&
      !isDesktopIconTaskActive() &&
      appState.state === 'IDLE'
    ) {
      musicReactionCooldown = 85.0;
      continuousMusicTimer = 0;
      appState.setState('DANCING');
      appState.setExpression('happy', 4.0);
      appState.changeMood(5);
      spawnShockwave(appState.posX, appState.posY - 10, 0xf472b6);
      if (appState.isAutoBehaviorEnabled('accessory_hat') && Math.random() < 0.35) {
        equipAccessory3D('random', false);
        temporaryHatTimer = 45.0;
      }
      speak('[BEAT DANCE] Phát hiện nhạc hệ thống sôi động! Quẩy theo điệu Bass thôi!');
    }
  } else {
    continuousMusicTimer = Math.max(0, continuousMusicTimer - delta * 2);
  }

  // 3. Tự động đội phụ kiện 3D ngẫu nhiên theo thời gian nếu đang IDLE
  if (
    canRunAmbient &&
    appState.autoRoamEnabled &&
    appState.isAutoBehaviorEnabled('accessory_hat') &&
    !isDesktopIconTaskActive() &&
    appState.state !== 'SWIMMING'
  ) {
    if (temporaryHatTimer > 0) {
      temporaryHatTimer -= delta;
      if (temporaryHatTimer <= 0 && appState.activeAccessory !== 'none') {
        equipAccessory3D('none', false);
      }
    } else if (appState.activeAccessory === 'none') {
      ambientRoamHatElapsed += delta;
      if (ambientRoamHatElapsed >= 220.0) {
        ambientRoamHatElapsed = 0;
        equipAccessory3D('random', false);
        temporaryHatTimer = 45.0;
      }
    }
  }

  // 4. Tự động kích hoạt Desktop Goose Mode khi chuột đứng im >= 48 giây
  if (
    canRunAmbient &&
    appState.autoRoamEnabled &&
    appState.isAutoBehaviorEnabled('goose_mischief') &&
    !gooseState &&
    gooseCooldown <= 0 &&
    appState.cursorIdleMs >= 48000 &&
    !isDesktopIconTaskActive() &&
    appState.state !== 'DRAGGING' &&
    appState.state !== 'SWIMMING' &&
    appState.state !== 'SLEEP'
  ) {
    triggerGooseMischiefMode(false);
  }

  // 4b. Thỉnh thoảng có vịt lạ lẻn vào lãnh thổ để bảo vệ màn hình
  if (
    canRunAmbient &&
    appState.autoRoamEnabled &&
    appState.randomFeatureEnabled &&
    appState.isAutoBehaviorEnabled('territory_defense') &&
    !territoryState &&
    !gooseState &&
    territoryCooldown <= 0 &&
    !isDesktopIconTaskActive() &&
    appState.state === 'IDLE'
  ) {
    triggerTerritoryDefenseMode(false);
  }

  // 5. Cập nhật dấu chân 3D mờ dần trên màn hình
  for (let i = footprints.length - 1; i >= 0; i--) {
    const f = footprints[i];
    f.life += delta;
    if (f.life >= f.maxLife) {
      scene.remove(f.mesh);
      f.mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      footprints.splice(i, 1);
      continue;
    }
    const alpha = Math.max(0, (1 - f.life / f.maxLife) * 0.85);
    f.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        (obj.material as THREE.MeshBasicMaterial).opacity = alpha;
      }
    });
  }

  if (gooseActiveTimer > 0) {
    gooseActiveTimer = Math.max(0, gooseActiveTimer - delta);
    if (appState.state === 'WALKING' || appState.state === 'PULLING' || gooseState !== null) {
      footprintSpawnTimer += delta;
      if (footprintSpawnTimer >= 0.24) {
        footprintSpawnTimer = 0;
        spawnDuckFootprint(appState.posX, appState.posY, appState.walkDir);
      }
    }
  }

  // 6. Điều phối Bảo vệ Lãnh thổ (Đấu kiếm đuổi vịt xâm phạm) hoặc Desktop Goose Mode
  if (stepTerritoryDefense(delta, elapsed)) return;
  if (!gooseState) return;
  const g = gooseState;

  if (appState.state === 'DRAGGING') {
    hideBeakTether();
    gooseState = null;
    return;
  }

  if (g.phase === 'chasing_cursor') {
    const tx = appState.globalCursorX;
    const ty = Math.min(appState.H - 48, Math.max(85, appState.globalCursorY + 36));
    const dx = tx - appState.posX;
    const dy = ty - appState.posY;
    const dist = Math.hypot(dx, dy);

    if (dist <= 28) {
      g.phase = 'tugging_cursor';
      g.stepTimer = 0.08;
      g.expectedCursorX = appState.globalCursorX;
      g.expectedCursorY = appState.globalCursorY;
      appState.setState('PULLING');
      playDuckQuackSound(appState.posX);
      updateBeakTether(appState.posX, appState.posY, appState.globalCursorX, appState.globalCursorY);
      speak('[GOOSE MODE] Bắt được con trỏ chuột rồi! Quạc quạc, lôi đi dạo nhé!');
      return;
    }

    const move = Math.min(1, (390 * delta) / Math.max(1, dist));
    appState.posX += dx * move;
    appState.posY += dy * move;
    appState.walkDir = dx >= 0 ? 1 : -1;
    appState.setState('WALKING');
    return;
  }

  // phase === 'tugging_cursor'
  // Nếu người dùng tự giật chuột ra xa quá 55px -> thả chuột ngay để không cản trở thao tác
  const userDistFromExpected = Math.hypot(
    appState.globalCursorX - g.expectedCursorX,
    appState.globalCursorY - g.expectedCursorY
  );
  if (userDistFromExpected > 55) {
    hideBeakTether();
    gooseState = null;
    appState.setState('FALLING');
    speak('[GOOSE MODE] Ái! Chủ nhân giật lại chuột rồi, tớ thả ra ngay đây quạc!');
    return;
  }

  updateBeakTether(appState.posX, appState.posY, appState.globalCursorX, appState.globalCursorY);

  g.stepTimer += delta;
  if (g.stepTimer >= 0.11 && !g.inFlight) {
    g.stepTimer = 0;
    if (g.stepsDone >= g.maxSteps) {
      hideBeakTether();
      const noteX = appState.globalCursorX;
      const noteY = appState.globalCursorY;
      gooseState = null;
      appState.nextRoamDuration = appState.getAutoActionDelay();
      appState.setState('FALLING');
      playSuccessChimeSound(appState.posX);
      spawnParticles(noteX, noteY, 12, 0xf97316);
      dropGooseNoteToast(noteX, noteY);
      return;
    }

    g.stepsDone++;
    g.inFlight = true;
    const dpr = window.devicePixelRatio || 1;
    const physDx = Math.round(g.dirX * dpr);
    const physDy = Math.round(g.dirY * dpr);
    g.expectedCursorX += g.dirX;
    g.expectedCursorY += g.dirY;
    appState.posX = Math.max(36, Math.min(appState.W - 36, appState.posX + g.dirX));
    appState.posY = Math.max(85, Math.min(appState.H - 48, appState.posY + g.dirY));
    appState.walkDir = g.dirX >= 0 ? -1 : 1;

    void invoke('nudge_cursor_pos', { dx: physDx, dy: physDy })
      .catch(() => {})
      .finally(() => {
        if (gooseState) gooseState.inFlight = false;
      });
  }
}

