import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { appState } from '../core/state';
import { scene } from '../core/scene';
import {
  clearLadder,
  showJetpack,
  showParachute,
  spawnDriftSmoke,
  spawnParticles,
  spawnShockwave,
} from '../core/particles';
import {
  playAlertBeep,
  playDuckQuackSound,
  playJumpSound,
  playLandSound,
  playWhooshSound,
} from '../core/soundFx';
import { isWaterPoolActive, triggerStopSwimming } from '../core/waterPool';
import { isP2pSessionActive } from '../core/p2pArena';

interface ArmVisual {
  group: THREE.Group;
  shoulder: THREE.Mesh;
  shaft: THREE.Mesh;
  elbow: THREE.Mesh;
  hand: THREE.Group;
}

interface WindowSwingSession {
  phase: 'approach' | 'swinging' | 'falling_tumble' | 'butt_plant';
  hwnd: number | null;
  title: string;
  barY: number;
  anchors: number[];
  anchorIdx: number;
  dir: 1 | -1;
  grabHand: 'left' | 'right';
  angle: number;
  angVel: number;
  swingTime: number;
  phaseTimer: number;
  approachStartX: number;
  approachStartY: number;
  bouncedOnce: boolean;
  retractingArms: boolean;
  retractProgress: number;
  leftHandX: number;
  leftHandY: number;
  rightHandX: number;
  rightHandY: number;
  leftArm: ArmVisual;
  rightArm: ArmVisual;
  fallbackRail: THREE.Group | null;
  dizzyStars: THREE.Group | null;
}

interface WindowPaperCrashSession {
  phase: 'dash' | 'stuck_wiggle' | 'pop_out';
  phaseTimer: number;
  startX: number;
  startY: number;
  holeX: number;
  holeY: number;
  targetHwnd: number | null;
  dir: 1 | -1;
  title: string;
  holeGroup: THREE.Group | null;
  scraps: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vr: number }>;
  velX: number;
  velY: number;
}

interface HulkRageSession {
  timer: number;
  duration: number;
  nextSmashAt: number;
  smashCount: number;
  auraGroup: THREE.Group;
  slammedThisCycle: boolean;
}

let activeSwing: WindowSwingSession | null = null;
let activePaperCrash: WindowPaperCrashSession | null = null;
let activeHulkSession: HulkRageSession | null = null;
let speakCb: ((msg: string) => void) | null = null;

export function registerWindowSwingSpeakCallback(cb: (msg: string) => void) {
  speakCb = cb;
}

function speak(msg: string) {
  if (speakCb) speakCb(msg);
}

export function isWindowSwingActive(): boolean {
  return activeSwing !== null || activePaperCrash !== null || activeHulkSession !== null;
}

async function shakeRealWindows(hwnds: number[], intensityPx = 16) {
  if (!appState.windowInteractEnabled || hwnds.length === 0) return;
  const targets = hwnds.slice(0, 2);
  const dx = Math.max(6, Math.round(intensityPx));
  const dy = Math.max(4, Math.round(intensityPx * 0.55));
  const steps: Array<[number, number]> = [
    [dx, -dy],
    [-dx * 2, dy * 2],
    [dx * 2, -dy],
    [-dx, 0],
  ];
  for (const [stepDx, stepDy] of steps) {
    await Promise.all(
      targets.map((hwnd) =>
        invoke('interact_window', { hwnd, action: 'push', dx: stepDx, dy: stepDy }).catch(
          () => {}
        )
      )
    );
    await new Promise((r) => setTimeout(r, 48));
  }
}

function disposeGroupMeshes(group: THREE.Object3D | null) {
  if (!group) return;
  scene.remove(group);
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
}

function createExtendableArm(accentHex = 0xf97316): ArmVisual {
  const group = new THREE.Group();
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.35,
    metalness: 0.25,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.55,
  });
  const handMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.32,
    metalness: 0.2,
  });

  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(5.2, 12, 10), jointMat);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.2, 1, 10), sleeveMat);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(4.4, 10, 8), jointMat);

  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(5.6, 12, 10), handMat);
  hand.add(palm);

  // 3 grabber fingers clamped onto window edge
  for (const offset of [-3.4, 0, 3.4]) {
    const finger = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.3, 8.5, 8), handMat);
    finger.position.set(offset, 5.2, 1.2);
    finger.rotation.x = 0.45;
    hand.add(finger);
  }

  group.add(shoulder, shaft, elbow, hand);
  scene.add(group);
  return { group, shoulder, shaft, elbow, hand };
}

function createDizzyStarsHalo(): THREE.Group {
  const g = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });

  const ring = new THREE.Mesh(new THREE.RingGeometry(24, 27, 28), ringMat);
  ring.rotation.x = Math.PI / 2 - 0.28;
  g.add(ring);

  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(5.4, 0), starMat);
    star.position.set(Math.cos(ang) * 26, Math.sin(ang) * 5, Math.sin(ang) * 26);
    star.name = `star_${i}`;
    g.add(star);
  }

  scene.add(g);
  return g;
}

function createFallbackGrabRail(startX: number, endX: number, barY: number): THREE.Group {
  const g = new THREE.Group();
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const span = Math.max(180, maxX - minX);
  const midX = (minX + maxX) * 0.5;

  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, span, 12),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      metalness: 0.65,
      roughness: 0.25,
    })
  );
  rail.rotation.z = Math.PI / 2;
  g.add(rail);

  for (const capX of [-span * 0.5, span * 0.5]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(6.8, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 })
    );
    cap.position.set(capX, 0, 0);
    g.add(cap);
  }

  g.position.set(midX, -barY, 12);
  scene.add(g);
  return g;
}

function computeShoulderScreenPos(side: -1 | 1): { x: number; y: number } {
  const s = appState.modelScale || 1.0;
  const rotZ = appState.swingTiltAngle || 0;
  const lx = side * 20 * s * Math.cos((appState.facingAngle || 0) * 0.4);
  const upY = 84 * s;
  const rx = lx * Math.cos(rotZ) - upY * Math.sin(rotZ);
  const ryUp = lx * Math.sin(rotZ) + upY * Math.cos(rotZ);
  return {
    x: appState.posX + rx,
    y: appState.posY - ryUp,
  };
}

function updateArmGeometry(
  arm: ArmVisual,
  sx: number,
  sy: number,
  hx: number,
  hy: number,
  s: number,
  clampAngle = 0
) {
  const threeSy = -sy;
  const threeHy = -hy;
  const dx = hx - sx;
  const dy = threeHy - threeSy;
  const dist = Math.max(4, Math.hypot(dx, dy));

  arm.shoulder.position.set(sx, threeSy, 16);
  arm.shoulder.scale.setScalar(s);

  arm.shaft.position.set((sx + hx) * 0.5, (threeSy + threeHy) * 0.5, 16);
  arm.shaft.scale.set(s, dist, s);
  arm.shaft.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;

  arm.elbow.position.set(sx + dx * 0.5, threeSy + dy * 0.5, 16.5);
  arm.elbow.scale.setScalar(s);

  arm.hand.position.set(hx, threeHy, 17);
  arm.hand.scale.setScalar(s);
  arm.hand.rotation.z = clampAngle;
}

function applyHulkGreenSkinTint(enable: boolean) {
  if (!appState.avatarGroup) return;
  appState.avatarGroup.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      const m = mat as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
      };
      if (enable) {
        if (!m.userData.__origHulk) {
          m.userData.__origHulk = {
            color: m.color ? m.color.getHex() : null,
            emissive: m.emissive ? m.emissive.getHex() : null,
          };
        }
        const localY = obj.position?.y ?? 0;
        if (m.color) {
          m.color.setHex(localY < 26 ? 0x7e22ce : 0x22c55e);
        }
        if (m.emissive) {
          m.emissive.setHex(localY < 26 ? 0x3b0764 : 0x14532d);
        }
      } else if (m.userData.__origHulk) {
        const orig = m.userData.__origHulk as {
          color: number | null;
          emissive: number | null;
        };
        if (m.color && orig.color !== null) {
          m.color.setHex(orig.color);
        }
        if (m.emissive && orig.emissive !== null) {
          m.emissive.setHex(orig.emissive);
        }
        delete m.userData.__origHulk;
      }
    }
  });
}

function createPaperTearHoleGroup(holeX: number, holeY: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const voidMat = new THREE.MeshBasicMaterial({
    color: 0x090d16,
    side: THREE.DoubleSide,
  });
  const holeVoid = new THREE.Mesh(new THREE.CircleGeometry(36 * s, 24), voidMat);
  g.add(holeVoid);

  const rimMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    side: THREE.DoubleSide,
  });
  const shadowRimMat = new THREE.MeshBasicMaterial({
    color: 0xcbd5e1,
    side: THREE.DoubleSide,
  });

  // 14 jagged triangular torn-paper flaps curling outward around the breach
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const flap = new THREE.Mesh(
      new THREE.ConeGeometry((9 + (i % 3) * 2.5) * s, (26 + (i % 2) * 8) * s, 3),
      i % 2 === 0 ? rimMat.clone() : shadowRimMat.clone()
    );
    const radius = 33 * s;
    flap.position.set(Math.cos(ang) * radius, Math.sin(ang) * radius, 4 * s);
    flap.rotation.z = ang - Math.PI / 2;
    flap.rotation.x = 0.55;
    g.add(flap);
  }

  // 8 radial paper crack/crease lines
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.18;
    const pts = [
      new THREE.Vector3(Math.cos(ang) * 34 * s, Math.sin(ang) * 34 * s, 2 * s),
      new THREE.Vector3(Math.cos(ang + 0.06) * 58 * s, Math.sin(ang + 0.06) * 58 * s, 2 * s),
      new THREE.Vector3(Math.cos(ang - 0.04) * 78 * s, Math.sin(ang - 0.04) * 78 * s, 2 * s),
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x475569 });
    g.add(new THREE.Line(lineGeo, lineMat));
  }

  g.position.set(holeX, -holeY, 8 * s);
  scene.add(g);
  return g;
}

function createHulkAuraGroup(s: number): THREE.Group {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.58,
  });
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(48 * s, 68 * s, 28), ringMat);
  outerRing.rotation.x = Math.PI / 2 - 0.15;
  g.add(outerRing);

  const shortsBelt = new THREE.Mesh(
    new THREE.TorusGeometry(28 * s, 8 * s, 8, 22),
    new THREE.MeshStandardMaterial({
      color: 0x7e22ce,
      emissive: 0x4c1d95,
      roughness: 0.5,
    })
  );
  shortsBelt.rotation.x = Math.PI / 2;
  shortsBelt.position.y = 48 * s;
  g.add(shortsBelt);

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x16a34a,
    roughness: 0.4,
  });
  for (let i = 0; i < 8; i++) {
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry((7 + (i % 3) * 2) * s, 0), rockMat);
    const a = (i / 8) * Math.PI * 2;
    chunk.position.set(Math.cos(a) * 66 * s, (24 + (i % 4) * 22) * s, Math.sin(a) * 42 * s);
    g.add(chunk);
  }

  scene.add(g);
  return g;
}

export function cancelWindowSwing() {
  if (activeSwing) {
    disposeGroupMeshes(activeSwing.leftArm.group);
    disposeGroupMeshes(activeSwing.rightArm.group);
    disposeGroupMeshes(activeSwing.fallbackRail);
    disposeGroupMeshes(activeSwing.dizzyStars);
    activeSwing = null;
  }
  if (activePaperCrash) {
    disposeGroupMeshes(activePaperCrash.holeGroup);
    for (const sc of activePaperCrash.scraps) {
      disposeGroupMeshes(sc.mesh);
    }
    activePaperCrash = null;
  }
  if (activeHulkSession) {
    applyHulkGreenSkinTint(false);
    disposeGroupMeshes(activeHulkSession.auraGroup);
    activeHulkSession = null;
  }
  appState.swingTiltAngle = 0;
  appState.posZ = 0;
}

export function triggerWindowSwing(explicitHwnd?: number): string {
  if (isP2pSessionActive()) {
    return '[P2P] Dang trong che do P2P, tam tat hieu ung du cua so.';
  }
  cancelWindowSwing();

  if (isWaterPoolActive()) {
    triggerStopSwimming(false);
  }
  clearLadder();
  showParachute(false);
  showJetpack(false);
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  appState.attachedLedgeOffsetY = 0;
  appState.duckCrouchRoll = false;
  appState.changeEnergy(-7);

  const s = appState.modelScale || 1.0;
  const floorY = Math.max(180, (appState.H || 1080) - 48);
  const wScreen = appState.W || 1920;

  const candidates = appState.openWindows.filter(
    (w) =>
      !w.is_maximized &&
      w.y >= 80 &&
      w.y < floorY - Math.round(165 * s) &&
      w.width >= 210 &&
      w.width < wScreen - 40 &&
      !w.title.includes('Duck ai Manager')
  );

  let targetWin = explicitHwnd ? candidates.find((w) => w.hwnd === explicitHwnd) : undefined;
  if (!targetWin && appState.activeWindowHwnd) {
    targetWin = candidates.find((w) => w.hwnd === appState.activeWindowHwnd);
  }
  if (!targetWin && candidates.length > 0) {
    targetWin = candidates.reduce((best, cur) => (cur.width > best.width ? cur : best), candidates[0]);
  }

  let hwnd: number | null = null;
  let title = 'Thanh Xa Khong Trung';
  let barY: number;
  let minEdgeX: number;
  let maxEdgeX: number;

  if (targetWin) {
    hwnd = targetWin.hwnd;
    title = targetWin.title.slice(0, 24);
    barY = targetWin.y;
    minEdgeX = Math.max(70, targetWin.x + 28);
    maxEdgeX = Math.min(wScreen - 70, targetWin.x + targetWin.width - 28);
  } else {
    barY = Math.max(135, Math.min(floorY - 220, (appState.H || 1080) * 0.28));
    const spanHalf = Math.min(260, Math.max(140, wScreen * 0.22));
    const center = Math.max(spanHalf + 70, Math.min(wScreen - spanHalf - 70, appState.posX));
    minEdgeX = center - spanHalf;
    maxEdgeX = center + spanHalf;
  }

  if (maxEdgeX - minEdgeX < 140) {
    minEdgeX = Math.max(70, (minEdgeX + maxEdgeX) * 0.5 - 110);
    maxEdgeX = Math.min(wScreen - 70, minEdgeX + 220);
  }

  const distLeft = Math.abs(appState.posX - minEdgeX);
  const distRight = Math.abs(appState.posX - maxEdgeX);
  const dir: 1 | -1 = distLeft <= distRight ? 1 : -1;

  const anchorCount = 4;
  const anchors: number[] = [];
  for (let i = 0; i < anchorCount; i++) {
    const t = i / (anchorCount - 1);
    anchors.push(dir === 1 ? minEdgeX + (maxEdgeX - minEdgeX) * t : maxEdgeX - (maxEdgeX - minEdgeX) * t);
  }

  const fallbackRail = hwnd === null ? createFallbackGrabRail(minEdgeX, maxEdgeX, barY) : null;
  const leftArm = createExtendableArm(0xf97316);
  const rightArm = createExtendableArm(0xf97316);
  const lShoulder = computeShoulderScreenPos(-1);
  const rShoulder = computeShoulderScreenPos(1);

  activeSwing = {
    phase: 'approach',
    hwnd,
    title,
    barY,
    anchors,
    anchorIdx: 0,
    dir,
    grabHand: dir === 1 ? 'left' : 'right',
    angle: -0.35 * dir,
    angVel: 0,
    swingTime: 0,
    phaseTimer: 0,
    approachStartX: appState.posX,
    approachStartY: appState.posY,
    bouncedOnce: false,
    retractingArms: false,
    retractProgress: 0,
    leftHandX: lShoulder.x,
    leftHandY: lShoulder.y,
    rightHandX: rShoulder.x,
    rightHandY: rShoulder.y,
    leftArm,
    rightArm,
    fallbackRail,
    dizzyStars: null,
  };

  appState.velX = 0;
  appState.velY = 0;
  appState.walkDir = dir;
  appState.swingTiltAngle = 0;
  appState.setState('SWINGING_WINDOW');
  appState.setExpression('happy', 4.0);
  spawnParticles(appState.posX, appState.posY - 60 * s, 10, 0x38bdf8);
  playJumpSound(appState.posX);

  const msg =
    hwnd !== null
      ? `[DU CUA SO] Vit dang moc tay dai bam len cua so "${title}" de du qua ben kia!`
      : '[DU CUA SO] Chua co cua so noi, Vit phong tay dai bam thanh xa khong trung de du!';
  speak(msg);
  return msg;
}

export function triggerWindowPaperCrash(explicitHwnd?: number): string {
  if (isP2pSessionActive()) {
    return '[P2P] Dang trong che do P2P, tam tat hieu ung dam thung cua so.';
  }
  cancelWindowSwing();
  if (isWaterPoolActive()) {
    triggerStopSwimming(false);
  }
  clearLadder();
  showParachute(false);
  showJetpack(false);
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;

  const s = appState.modelScale || 1.0;
  const floorY = Math.max(220, (appState.H || 1080) - 48);
  const wScreen = appState.W || 1920;

  const candidates = appState.openWindows.filter(
    (w) => !w.is_maximized && w.width >= 220 && w.height >= 140 && !w.title.includes('Duck ai Manager')
  );
  let targetWin = explicitHwnd ? candidates.find((w) => w.hwnd === explicitHwnd) : undefined;
  if (!targetWin && appState.activeWindowHwnd) {
    targetWin = candidates.find((w) => w.hwnd === appState.activeWindowHwnd);
  }
  if (!targetWin && candidates.length > 0) {
    targetWin = candidates.reduce((best, cur) => (cur.width > best.width ? cur : best), candidates[0]);
  }

  const holeX = targetWin
    ? Math.max(110, Math.min(wScreen - 110, targetWin.x + targetWin.width * 0.5))
    : Math.max(160, Math.min(wScreen - 160, wScreen * 0.5));
  const holeY = targetWin
    ? Math.max(120, Math.min(floorY - 120, targetWin.y + targetWin.height * 0.42))
    : Math.max(140, floorY - 260 * s);
  const title = targetWin ? targetWin.title.slice(0, 24) : 'Trang Giay Man Hinh';
  const dir: 1 | -1 = holeX >= appState.posX ? 1 : -1;

  activePaperCrash = {
    phase: 'dash',
    phaseTimer: 0,
    startX: appState.posX,
    startY: appState.posY,
    holeX,
    holeY,
    targetHwnd: targetWin?.hwnd ?? null,
    dir,
    title,
    holeGroup: null,
    scraps: [],
    velX: 0,
    velY: 0,
  };

  appState.walkDir = dir;
  appState.velX = 0;
  appState.velY = 0;
  appState.setState('SWINGING_WINDOW');
  appState.setExpression('surprised', 3.5);
  playWhooshSound(appState.posX);

  const msg = `[THUNG CUA SO] Vit lao toi dam xuyen thung "${title}" nhu rach trang giay!`;
  speak(msg);
  return msg;
}

export function triggerHulkRageMode(): string {
  if (isP2pSessionActive()) {
    return '[P2P] Dang trong che do P2P, tam tat che do Hoa HULK.';
  }
  cancelWindowSwing();
  if (isWaterPoolActive()) {
    triggerStopSwimming(false);
  }
  clearLadder();
  showParachute(false);
  showJetpack(false);
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;

  const s = appState.modelScale || 1.0;
  const floorY = Math.max(220, (appState.H || 1080) - 48);
  if (appState.posY > floorY) appState.posY = floorY;

  applyHulkGreenSkinTint(true);
  const auraGroup = createHulkAuraGroup(s);
  activeHulkSession = {
    timer: 0,
    duration: 7.2,
    nextSmashAt: 0.35,
    smashCount: 0,
    auraGroup,
    slammedThisCycle: false,
  };

  appState.setState('JUMPING');
  appState.setExpression('surprised', 7.2);
  spawnShockwave(appState.posX, appState.posY, 0x22c55e);
  spawnParticles(appState.posX, appState.posY - 50 * s, 26, 0x4ade80);
  playAlertBeep();

  const msg = '[HULK RAGE] Hoa HULK xanh gian du khong lo! HULK SMASH!!';
  speak(msg);
  return msg;
}

function stepWindowPaperCrash(delta: number): boolean {
  const pc = activePaperCrash;
  if (!pc) return false;
  const s = appState.modelScale || 1.0;
  const floorY = Math.max(200, (appState.H || 1080) - 48);
  const wScreen = appState.W || 1920;

  for (const sc of pc.scraps) {
    sc.vy += 420 * delta;
    sc.mesh.position.x += sc.vx * delta;
    sc.mesh.position.y -= sc.vy * delta;
    sc.mesh.rotation.z += sc.vr * delta;
    sc.mesh.rotation.x += sc.vr * 0.7 * delta;
  }

  pc.phaseTimer += delta;

  if (pc.phase === 'dash') {
    const t = Math.min(1, pc.phaseTimer / 0.44);
    const ease = t * t;
    appState.posX = THREE.MathUtils.lerp(pc.startX, pc.holeX, ease);
    appState.posY = THREE.MathUtils.lerp(pc.startY, pc.holeY + 26 * s, ease) - Math.sin(t * Math.PI) * 38 * s;
    appState.swingTiltAngle = pc.dir * 1.28;
    appState.squashX = 1.32;
    appState.squashY = 0.76;
    if (Math.random() < 0.65) {
      spawnParticles(appState.posX, appState.posY - 40 * s, 1, 0xf8fafc);
    }

    if (t >= 1) {
      pc.holeGroup = createPaperTearHoleGroup(pc.holeX, pc.holeY, s);
      const scrapMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide });
      for (let i = 0; i < 18; i++) {
        const scrap = new THREE.Mesh(
          new THREE.PlaneGeometry((10 + Math.random() * 10) * s, (7 + Math.random() * 8) * s),
          scrapMat.clone()
        );
        scrap.position.set(pc.holeX, -pc.holeY, 12 * s);
        scene.add(scrap);
        const ang = Math.random() * Math.PI * 2;
        const spd = 95 + Math.random() * 210;
        pc.scraps.push({
          mesh: scrap,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 90,
          vr: (Math.random() - 0.5) * 14,
        });
      }
      spawnShockwave(pc.holeX, pc.holeY, 0xffffff);
      spawnParticles(pc.holeX, pc.holeY, 22, 0xe2e8f0);
      playLandSound(pc.holeX);
      playDuckQuackSound(pc.holeX);
      if (pc.targetHwnd) {
        void shakeRealWindows([pc.targetHwnd], 18);
      }
      pc.phase = 'stuck_wiggle';
      pc.phaseTimer = 0;
    }
    return true;
  }

  if (pc.phase === 'stuck_wiggle') {
    appState.posX = pc.holeX;
    appState.posY = pc.holeY + 28 * s;
    appState.posZ = -14 * s;
    appState.swingTiltAngle = Math.sin(pc.phaseTimer * 26) * 0.42;
    appState.squashX = 1.22 + Math.sin(pc.phaseTimer * 18) * 0.14;
    appState.squashY = 0.78;
    appState.setExpression('sad', 0.5);

    if (pc.phaseTimer >= 2.05) {
      pc.phase = 'pop_out';
      pc.phaseTimer = 0;
      pc.velX = -pc.dir * 3.8;
      pc.velY = -7.5;
      appState.posZ = 0;
      playJumpSound(pc.holeX);
      spawnShockwave(pc.holeX, pc.holeY, 0x38bdf8);
    }
    return true;
  }

  // Phase: pop_out
  const dtF = delta * 60;
  pc.velY += appState.gravity * dtF;
  appState.posX = Math.max(55, Math.min(wScreen - 55, appState.posX + pc.velX * dtF));
  appState.posY += pc.velY * dtF;
  appState.swingTiltAngle = pc.phaseTimer * 9.5 * -pc.dir;
  if (pc.holeGroup) {
    const shrink = Math.max(0.02, 1 - pc.phaseTimer / 0.85);
    pc.holeGroup.scale.setScalar(shrink);
  }
  if (appState.posY >= floorY || pc.phaseTimer >= 1.2) {
    appState.posY = floorY;
    spawnShockwave(appState.posX, floorY, 0x38bdf8);
    spawnParticles(appState.posX, floorY - 16 * s, 12, 0xf8fafc);
    playLandSound(appState.posX);
    cancelWindowSwing();
    appState.setState('IDLE');
    return false;
  }
  return true;
}

function stepHulkRage(delta: number): boolean {
  const hk = activeHulkSession;
  if (!hk) return false;
  const s = appState.modelScale || 1.0;
  const floorY = Math.max(200, (appState.H || 1080) - 48);

  hk.timer += delta;
  appState.setExpression('surprised', 0.4);
  appState.squashX = 2.08 + Math.sin(hk.timer * 13) * 0.12;
  appState.squashY = 1.78 + Math.cos(hk.timer * 13) * 0.08;

  // Periodic HULK SMASH jump and slam every 1.45s
  if (hk.timer >= hk.nextSmashAt) {
    const localT = hk.timer - hk.nextSmashAt;
    if (localT < 0.48) {
      const arc = Math.sin((localT / 0.48) * Math.PI);
      appState.posY = floorY - arc * 86 * s;
      appState.swingTiltAngle = Math.sin(localT * 20) * 0.18;
    } else {
      appState.posY = floorY;
      appState.swingTiltAngle = 0;
      hk.nextSmashAt = hk.timer + 1.05;
      hk.smashCount++;
      spawnShockwave(appState.posX, floorY, 0x22c55e);
      spawnParticles(appState.posX, floorY - 24 * s, 24, 0x4ade80);
      spawnDriftSmoke(appState.posX - 24 * s, floorY, -1);
      spawnDriftSmoke(appState.posX + 24 * s, floorY, 1);
      playLandSound(appState.posX);
      playDuckQuackSound(appState.posX);
      const shakeTargets = appState.openWindows
        .filter((w) => !w.is_maximized && !w.title.includes('Duck ai Manager'))
        .slice(0, 2)
        .map((w) => w.hwnd);
      if (shakeTargets.length > 0) {
        void shakeRealWindows(shakeTargets, 22);
      }
    }
  } else {
    appState.posY = floorY;
    appState.swingTiltAngle = Math.sin(hk.timer * 16) * 0.07;
    if (Math.random() < delta * 9) {
      spawnParticles(appState.posX + (Math.random() - 0.5) * 60 * s, floorY - 60 * s, 1, 0x22c55e);
    }
  }

  hk.auraGroup.position.set(appState.posX, -appState.posY, 10 * s);
  hk.auraGroup.rotation.y += delta * 4.5;

  if (hk.timer >= hk.duration) {
    cancelWindowSwing();
    appState.squashX = 1.0;
    appState.squashY = 1.0;
    appState.setState('IDLE');
    appState.setExpression('neutral', 1.0);
    spawnParticles(appState.posX, floorY - 40 * s, 12, 0x22c55e);
    speak('[HULK] Ha nhiet roi, quay lai dang goc nhe!');
    return false;
  }
  return true;
}

export function stepWindowSwing(delta: number): boolean {
  if (appState.state === 'DRAGGING' || isP2pSessionActive()) {
    if (isWindowSwingActive()) cancelWindowSwing();
    return false;
  }
  if (activePaperCrash) return stepWindowPaperCrash(delta);
  if (activeHulkSession) return stepHulkRage(delta);
  if (!activeSwing) return false;

  const sw = activeSwing;
  const s = appState.modelScale || 1.0;
  const floorY = Math.max(180, (appState.H || 1080) - 48);
  const wScreen = appState.W || 1920;
  const hangDist = 118 * s;

  // Keep barY synced if host window moved while swinging
  if (sw.hwnd !== null && (sw.phase === 'approach' || sw.phase === 'swinging')) {
    const liveWin = appState.openWindows.find((w) => w.hwnd === sw.hwnd);
    if (liveWin) {
      sw.barY = liveWin.y;
    }
  }

  sw.phaseTimer += delta;

  if (sw.phase === 'approach') {
    const dur = 0.52;
    const p = Math.min(1, sw.phaseTimer / dur);
    const ease = 1 - Math.pow(1 - p, 3);
    const startPivotX = sw.anchors[0];
    const hangX = startPivotX + Math.sin(sw.angle) * hangDist;
    const hangY = Math.min(floorY, sw.barY + Math.cos(sw.angle) * hangDist + 76 * s);

    appState.posX = THREE.MathUtils.lerp(sw.approachStartX, hangX, ease);
    appState.posY = THREE.MathUtils.lerp(sw.approachStartY, hangY, ease);
    appState.swingTiltAngle = THREE.MathUtils.lerp(0, sw.angle * 0.78, ease);

    const ls = computeShoulderScreenPos(-1);
    const rs = computeShoulderScreenPos(1);
    sw.leftHandX = THREE.MathUtils.lerp(ls.x, startPivotX - 10 * s, ease);
    sw.leftHandY = THREE.MathUtils.lerp(ls.y, sw.barY, ease);
    sw.rightHandX = THREE.MathUtils.lerp(rs.x, startPivotX + 10 * s, ease);
    sw.rightHandY = THREE.MathUtils.lerp(rs.y, sw.barY, ease);
    updateArmGeometry(sw.leftArm, ls.x, ls.y, sw.leftHandX, sw.leftHandY, s, 0);
    updateArmGeometry(sw.rightArm, rs.x, rs.y, sw.rightHandX, sw.rightHandY, s, 0);

    if (p >= 1) {
      sw.phase = 'swinging';
      sw.phaseTimer = 0;
      sw.angVel = sw.dir * 3.1;
      spawnParticles(startPivotX, sw.barY, 10, 0xf97316);
      playWhooshSound(startPivotX);
    }
    return true;
  }

  if (sw.phase === 'swinging') {
    sw.swingTime += delta;
    const pivotX = sw.anchors[sw.anchorIdx];
    const hasNext = sw.anchorIdx < sw.anchors.length - 1;
    const nextPivotX = hasNext ? sw.anchors[sw.anchorIdx + 1] : pivotX + sw.dir * 85 * s;

    // Pendulum gravity + forward pumping torque toward destination edge
    const gravTerm = -(980 / Math.max(60, hangDist)) * Math.sin(sw.angle);
    const pumpTorque = sw.dir * 3.8;
    sw.angVel += (gravTerm + pumpTorque) * delta;
    sw.angVel *= Math.pow(0.92, delta);
    sw.angle += sw.angVel * delta;

    appState.posX = Math.max(55, Math.min(wScreen - 55, pivotX + Math.sin(sw.angle) * hangDist));
    appState.posY = Math.min(floorY, sw.barY + Math.cos(sw.angle) * hangDist + 76 * s);
    appState.walkDir = sw.dir;
    appState.swingTiltAngle = THREE.MathUtils.clamp(sw.angle * 0.82, -0.78, 0.78);

    const ls = computeShoulderScreenPos(-1);
    const rs = computeShoulderScreenPos(1);

    // Reaching progress for free hand ahead
    const reachT = THREE.MathUtils.clamp((sw.angle * sw.dir + 0.35) / 0.82, 0.12, 1.0);
    if (sw.grabHand === 'left') {
      sw.leftHandX = pivotX;
      sw.leftHandY = sw.barY;
      sw.rightHandX = THREE.MathUtils.lerp(rs.x + sw.dir * 12 * s, nextPivotX, reachT);
      sw.rightHandY = THREE.MathUtils.lerp(rs.y - 25 * s, sw.barY, reachT) - Math.sin(reachT * Math.PI) * 18 * s;
    } else {
      sw.rightHandX = pivotX;
      sw.rightHandY = sw.barY;
      sw.leftHandX = THREE.MathUtils.lerp(ls.x + sw.dir * 12 * s, nextPivotX, reachT);
      sw.leftHandY = THREE.MathUtils.lerp(ls.y - 25 * s, sw.barY, reachT) - Math.sin(reachT * Math.PI) * 18 * s;
    }

    updateArmGeometry(sw.leftArm, ls.x, ls.y, sw.leftHandX, sw.leftHandY, s, 0);
    updateArmGeometry(sw.rightArm, rs.x, rs.y, sw.rightHandX, sw.rightHandY, s, 0);

    // Transfer grip at forward peak or slip on last anchor
    if (sw.angle * sw.dir >= 0.44 || sw.phaseTimer > 1.35) {
      if (hasNext) {
        sw.anchorIdx++;
        const newPivotX = sw.anchors[sw.anchorIdx];
        const shoulderMidY = Math.max(40, appState.posY - 76 * s - sw.barY);
        sw.angle = THREE.MathUtils.clamp(
          Math.atan2(appState.posX - newPivotX, shoulderMidY),
          -0.68,
          0.68
        );
        sw.angVel = sw.dir * 2.85;
        sw.grabHand = sw.grabHand === 'left' ? 'right' : 'left';
        sw.phaseTimer = 0;
        spawnParticles(newPivotX, sw.barY, 10, 0x38bdf8);
        playWhooshSound(newPivotX);
      } else {
        // Slip off far edge of window!
        sw.phase = 'falling_tumble';
        sw.phaseTimer = 0;
        sw.retractingArms = true;
        sw.retractProgress = 0;
        appState.velX = sw.dir * Math.min(8.5, Math.max(4.5, Math.abs(sw.angVel) * 2.2));
        appState.velY = -5.2;
        appState.setState('FALLING');
        appState.setExpression('surprised', 2.8);
        spawnParticles(pivotX, sw.barY, 14, 0xf87171);
        spawnShockwave(pivotX, sw.barY, 0xf97316);
        playAlertBeep(appState.posX);
        speak('Á á... tuột tay khỏi cửa sổ rồi!!');
      }
    }
    return true;
  }

  if (sw.phase === 'falling_tumble') {
    if (sw.retractingArms) {
      sw.retractProgress = Math.min(1, sw.retractProgress + delta * 4.5);
      const ls = computeShoulderScreenPos(-1);
      const rs = computeShoulderScreenPos(1);
      const lx = THREE.MathUtils.lerp(sw.leftHandX, ls.x, sw.retractProgress);
      const ly = THREE.MathUtils.lerp(sw.leftHandY, ls.y, sw.retractProgress);
      const rx = THREE.MathUtils.lerp(sw.rightHandX, rs.x, sw.retractProgress);
      const ry = THREE.MathUtils.lerp(sw.rightHandY, rs.y, sw.retractProgress);
      updateArmGeometry(sw.leftArm, ls.x, ls.y, lx, ly, s, 0);
      updateArmGeometry(sw.rightArm, rs.x, rs.y, rx, ry, s, 0);
      if (sw.retractProgress >= 1) {
        sw.retractingArms = false;
        disposeGroupMeshes(sw.leftArm.group);
        disposeGroupMeshes(sw.rightArm.group);
      }
    }

    const dtF = delta * 60;
    appState.velY += (appState.gravity || 0.68) * dtF;
    appState.posX += appState.velX * dtF;
    appState.posY += appState.velY * dtF;

    if (appState.posX < 55) {
      appState.posX = 55;
      appState.velX = Math.abs(appState.velX) * 0.5;
    } else if (appState.posX > wScreen - 55) {
      appState.posX = wScreen - 55;
      appState.velX = -Math.abs(appState.velX) * 0.5;
    }

    if (!sw.bouncedOnce) {
      appState.swingTiltAngle = Math.sin(sw.phaseTimer * 12) * 0.65;
    } else {
      appState.swingTiltAngle = THREE.MathUtils.lerp(appState.swingTiltAngle, -sw.dir * 0.25, Math.min(1, delta * 10));
    }

    if (appState.posY >= floorY) {
      appState.posY = floorY;
      if (!sw.bouncedOnce && Math.abs(appState.velY) > 4.5) {
        sw.bouncedOnce = true;
        appState.velY = -Math.min(10.0, Math.max(6.0, Math.abs(appState.velY) * 0.35));
        appState.velX *= 0.45;
        appState.squashX = 1.56;
        appState.squashY = 0.50;
        spawnDriftSmoke(appState.posX - 18 * s, floorY, -1);
        spawnDriftSmoke(appState.posX + 18 * s, floorY, 1);
        spawnShockwave(appState.posX, floorY, 0xf97316);
        spawnParticles(appState.posX, floorY - 22 * s, 16, 0xfacc15);
        playLandSound(appState.posX);
        playDuckQuackSound(appState.posX);
      } else {
        appState.velY = 0;
        appState.squashX = 1.48;
        appState.squashY = 0.56;
        sw.phase = 'butt_plant';
        sw.phaseTimer = 0;
        appState.setState('BUTT_PLANT');
        appState.setExpression('sad', 2.4);
        sw.dizzyStars = createDizzyStarsHalo();
        spawnShockwave(appState.posX, floorY, 0xfacc15);
        spawnDriftSmoke(appState.posX, floorY, -sw.dir);
        playLandSound(appState.posX);
        speak('Ui da! Ngồi dập mông đau quá trời luôn quạc quạc!');
      }
    }
    return true;
  }

  // Phase 4: Seated butt-plant wobble + spinning dizzy stars overhead
  appState.posY = floorY;
  appState.velX *= Math.pow(0.06, delta);
  appState.posX = Math.max(55, Math.min(wScreen - 55, appState.posX + appState.velX * delta * 60));

  const recoverT = Math.min(1, sw.phaseTimer / 2.25);
  appState.swingTiltAngle = Math.sin(sw.phaseTimer * 10) * 0.14 * (1 - recoverT);

  if (sw.dizzyStars) {
    sw.dizzyStars.position.set(appState.posX, -(floorY - 148 * s), 20 * s);
    sw.dizzyStars.scale.setScalar(s);
    sw.dizzyStars.rotation.y += delta * 5.2;
  }

  if (sw.phaseTimer >= 2.25) {
    disposeGroupMeshes(sw.leftArm.group);
    disposeGroupMeshes(sw.rightArm.group);
    disposeGroupMeshes(sw.fallbackRail);
    disposeGroupMeshes(sw.dizzyStars);
    activeSwing = null;

    appState.swingTiltAngle = 0;
    appState.velX = 0;
    appState.velY = -7.2;
    appState.squashX = 0.85;
    appState.squashY = 1.22;
    appState.nextRoamDuration = appState.getAutoActionDelay();
    appState.setState('JUMPING');
    playJumpSound(appState.posX);
    spawnParticles(appState.posX, floorY - 16 * s, 8, 0x38bdf8);
    return false;
  }

  return true;
}
