import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { appState, getDesktopFloorY } from './state';
import { WinRect } from './types';
import { scene } from './scene';
import { fireAnimationTrigger } from './animationBinder';
import {
  showJetpack,
  spawnBlackHole,
  spawnDriftSmoke,
  spawnParticles,
  spawnShockwave,
  triggerRandomSpecial3DEffect,
} from './particles';
import { createCloneMicroDuckMesh } from '../characters/characterRig';
import {
  buildHeroGunMesh,
  buildHeroSwordMesh,
  disposeThreeGroup,
  showWinnerVictoryBanner,
} from './rhythmAndGoose';
import {
  playAlertBeep,
  playDuckQuackSound,
  playSuccessChimeSound,
  playWhooshSound,
} from './soundFx';

export interface P2pStatus {
  local_ip: string;
  listen_port: number;
  local_name: string;
  room_code: string;
  phase:
  | 'disconnected'
  | 'hosting'
  | 'waiting_consent'
  | 'incoming_consent'
  | 'connected'
  | 'pk_duel'
  | 'winner_control'
  | 'victim_controlled';
  peer_name: string;
  peer_addr: string;
  peer_body_color: string;
  peer_accent_color: string;
  pending_peer_name: string;
  pending_peer_addr: string;
  winner_remaining_sec: number;
  victim_remaining_sec: number;
  is_sim_mode: boolean;
  is_web_peer?: boolean;
  is_room_host?: boolean;
  mobile_url?: string;
  lan_ips?: string[];
  host_windows_json?: string;
}

export interface P2pRemoteFrameSnapshot {
  has_frame: boolean;
  frame_b64: string;
  width: number;
  height: number;
  seq: number;
  cursor_x: number;
  cursor_y: number;
  remaining_sec: number;
  is_sim_mode: boolean;
}

export interface P2pWirePacket {
  kind: string;
  room_code?: string;
  peer_name?: string;
  body_color?: string;
  accent_color?: string;
  x_ratio?: number;
  y_ratio?: number;
  vx?: number;
  vy?: number;
  walk_dir?: number;
  char_state?: string;
  weapon?: string;
  hp?: number;
  peer_hp?: number;
  max_hp?: number;
  skill?: string;
  damage?: number;
  winner_is_sender?: boolean;
  cmd_type?: string;
  x_norm?: number;
  y_norm?: number;
  button?: string;
  vk?: number;
  wheel_delta?: number;
  text?: string;
  duration_sec?: number;
  reason?: string;
  aim_x?: number;
  aim_y?: number;
  is_hidden?: boolean;
  is_shielding?: boolean;
  is_jetpack?: boolean;
  is_sliding?: boolean;
  windows_json?: string;
  energy?: number;
  peer_energy?: number;
  foods_json?: string;
  food_id?: number;
  frame_b64?: string;
  frame_w?: number;
  frame_h?: number;
  frame_seq?: number;
}

export interface HostWindowPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  hwnd?: number;
}

export interface P2pEventPayload {
  event_type: string;
  packet: P2pWirePacket | null;
  status: P2pStatus;
  message: string | null;
}

export interface LanPeerInfo {
  name: string;
  addr: string;
  port: number;
}

interface P2pBolt {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetSide: 'peer' | 'hero';
  color: number;
  damage: number;
  resolved: boolean;
  life: number;
}

interface PendingThunder {
  targetSide: 'peer' | 'hero';
  lockedX: number;
  floorY: number;
  timer: number;
  damage: number;
  color: number;
  marker: THREE.Mesh;
}

type SpeakFn = (msg: string) => void;
type SuggestFn = (
  onAccept: () => void,
  onDismiss: () => void,
  acceptLabel?: string,
  dismissLabel?: string
) => void;
type SyncUiFn = () => void;

let speakCb: SpeakFn | null = null;
let suggestCb: SuggestFn | null = null;
let syncUiCb: SyncUiFn | null = null;
let setP2pModalOpenCb: ((open: boolean) => void) | null = null;

export function registerP2pCallbacks(
  speakFn: SpeakFn,
  suggestFn: SuggestFn,
  syncUiFn: SyncUiFn,
  setModalOpenFn: (open: boolean) => void
) {
  speakCb = speakFn;
  suggestCb = suggestFn;
  syncUiCb = syncUiFn;
  setP2pModalOpenCb = setModalOpenFn;
}

function speak(msg: string) {
  if (speakCb) speakCb(msg);
}

let currentStatus: P2pStatus = {
  local_ip: '127.0.0.1',
  listen_port: 39282,
  local_name: 'DuckPlayer',
  room_code: '------',
  phase: 'hosting',
  peer_name: '',
  peer_addr: '',
  peer_body_color: '#312e81',
  peer_accent_color: '#f43f5e',
  pending_peer_name: '',
  pending_peer_addr: '',
  winner_remaining_sec: 0,
  victim_remaining_sec: 0,
  is_sim_mode: false,
};

let crossScreenAutoMigrate = true;
let myHp = 100;
let peerHp = 100;
const MAX_HP = 100;
let myEnergy = 100;
let peerEnergy = 100;
const MAX_ENERGY = 100;
const SHOOT_ENERGY_COST = 14;
const SLIDE_ENERGY_COST = 20;
const ROCKET_IGNITE_COST = 8;
const ROCKET_MIN_IGNITE = 10;
const ROCKET_DRAIN_PER_SEC = 28;
const PASSIVE_ENERGY_REGEN = 4.5;
const FOOD_ENERGY_RESTORE = 40;

interface PkFoodItem {
  id: number;
  xRatio: number;
  yRatio: number;
  kind: 'burger' | 'battery' | 'snack';
  mesh: THREE.Group;
  bobPhase: number;
}
const pkFoods: PkFoodItem[] = [];
let nextPkFoodId = 1;
let pkFoodSpawnTimer = 2.2;
let myShieldTimer = 0;
let peerShieldTimer = 0;
let skillCooldowns: Record<string, number> = {
  sword: 0,
  laser: 0,
  thunder: 0,
  shield: 0,
};

let peerPresentOnMyScreen = false;
let peerX = 600;
let peerY = 600;
let peerWalkDir = -1;
let peerAnimState = 'IDLE';
let peerWeapon: 'none' | 'sword' | 'gun' = 'none';
let heroWeapon: 'none' | 'sword' | 'gun' = 'none';
let peerAttackAnimTimer = 0;
let heroAttackAnimTimer = 0;
let peerHiddenInWindow = false;
let peerBulletShielding = false;
let peerJetpackActive = false;
let peerSlidingActive = false;

let peerDuckGroup: THREE.Group | null = null;
let peerSwordGroup: THREE.Group | null = null;
let peerGunGroup: THREE.Group | null = null;
let heroPvpSwordGroup: THREE.Group | null = null;
let heroPvpGunGroup: THREE.Group | null = null;
let heroShieldDomeMesh: THREE.Group | null = null;
let peerShieldDomeMesh: THREE.Group | null = null;
const pvpBolts: P2pBolt[] = [];
const pendingThunders: PendingThunder[] = [];

let heroMoveInput = 0;
let heroVelY = 0;
let heroSlideVelX = 0;
let heroSlideTimer = 0;
let heroJetpackActive = false;
let heroBulletShieldActive = false;
let heroBulletShieldEnergy = 2.4;
let heroBulletShieldCooldown = 0;
let heroDropThroughTimer = 0;
let heroHiddenTimer = 0;
let heroHiddenWinIdx = 0;

let peerJumpOffset = 0;
let peerJumpVel = 0;
let myDodgeTimer = 0;
let peerDodgeTimer = 0;
let myDashCooldown = 0;

let remoteHostPlatforms: HostWindowPlatform[] = [];
let lastSentWindowsJson = '';
let lastRenderedHostMapKey = '';
let lastMapForceBroadcastAt = 0;
let lastWindowFetchAt = 0;
let hostMapSyncAccum = 0;
let jetpackFxAccum = 0;
let slideFxAccum = 0;

let simAiTimer = 0;
let simReturnTimer = 0;
let stateSyncAccum = 0;
let edgeMigrationCooldown = 0;
let statusCountdownTimer = 0;
let liveMouseStreamEnabled = false;
let lastMouseStreamSent = 0;
let initialized = false;
let p2pIdleOverlaysCleaned = false;

let remoteViewerOpen = false;
let remoteViewerExpanded = false;
let remoteFramePollTimer: number | null = null;
let remoteFramePollBusy = false;
let lastRenderedFrameSeq = -1;
let lastRemoteFrameAt = 0;

function hydrateRemotePlatformsFromJson(rawJson?: string): boolean {
  if (!rawJson || rawJson === '[]') return false;
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      remoteHostPlatforms = parsed;
      return true;
    }
  } catch { }
  return false;
}

export function getP2pStatusSnapshot(): P2pStatus {
  return currentStatus;
}

export function getP2pCombatVitals() {
  return {
    myHp,
    peerHp,
    maxHp: MAX_HP,
    myEnergy,
    peerEnergy,
    maxEnergy: MAX_ENERGY,
    peerPresentOnMyScreen,
    crossScreenAutoMigrate,
    liveMouseStreamEnabled,
    bulletShieldActive: heroBulletShieldActive,
    bulletShieldEnergy: heroBulletShieldEnergy,
    bulletShieldCooldown: heroBulletShieldCooldown,
    jetpackActive: heroJetpackActive,
    hiddenInWindow: heroHiddenTimer > 0,
    slidingActive: heroSlideTimer > 0,
    skillCooldowns: { ...skillCooldowns },
  };
}

export function setCrossScreenAutoMigrate(enabled: boolean) {
  crossScreenAutoMigrate = enabled;
}

export function setLiveMouseStreamEnabled(enabled: boolean) {
  liveMouseStreamEnabled = enabled;
}

export function isP2pDuelActive(): boolean {
  return currentStatus.phase === 'pk_duel';
}

export function isP2pSessionActive(): boolean {
  return (
    currentStatus.phase === 'connected' ||
    currentStatus.phase === 'pk_duel' ||
    currentStatus.phase === 'winner_control' ||
    currentStatus.phase === 'victim_controlled'
  );
}

export function isP2pCombatControlsActive(): boolean {
  return currentStatus.phase === 'connected' || currentStatus.phase === 'pk_duel';
}

export function getActiveP2pPlatforms(): HostWindowPlatform[] {
  const wScreen = appState.W || window.innerWidth || 1920;
  const hScreen = appState.H || window.innerHeight || 1080;
  const floorY = getDesktopFloorY(hScreen);

  if (currentStatus.is_room_host !== false) {
    const filtered = appState.openWindows.filter(
      (w) =>
        w.width >= 120 &&
        w.height >= 60 &&
        !w.title.includes('Duck ai Manager') &&
        !w.title.includes('AI Desktop Mate') &&
        !w.title.includes('Program Manager')
    );

    const platforms: HostWindowPlatform[] = [];
    let maxIdx = 0;
    for (const w of filtered.slice(0, 8)) {
      const isFullWidthOrMax = Boolean(w.is_maximized) || w.width >= wScreen - 30;
      if (!isFullWidthOrMax) {
        const y = Math.max(135, Math.min(floorY - 75, w.y));
        const x = Math.max(16, Math.min(wScreen - 160, w.x));
        const width = Math.max(140, Math.min(wScreen - 32, w.width));
        const height = Math.max(80, Math.min(floorY - y, w.height));
        platforms.push({
          x,
          y,
          w: width,
          h: height,
          title: w.title,
          hwnd: w.hwnd,
        });
      } else {
        const sw = Math.round(wScreen * 0.34);
        const sh = Math.round(hScreen * 0.30);
        const sx = Math.round(wScreen * (0.07 + (maxIdx % 2) * 0.50));
        const sy = Math.max(140, Math.min(floorY - 85, Math.round(hScreen * (0.34 + (maxIdx % 3) * 0.16))));
        maxIdx += 1;
        platforms.push({
          x: sx,
          y: sy,
          w: sw,
          h: sh,
          title: w.title,
          hwnd: w.hwnd,
        });
      }
    }

    if (platforms.length === 0) {
      platforms.push(
        {
          x: Math.round(wScreen * 0.08),
          y: Math.round(hScreen * 0.56),
          w: Math.round(wScreen * 0.32),
          h: Math.round(hScreen * 0.28),
          title: '[ARENA MAP] Thap Cua So Trai',
        },
        {
          x: Math.round(wScreen * 0.60),
          y: Math.round(hScreen * 0.44),
          w: Math.round(wScreen * 0.32),
          h: Math.round(hScreen * 0.34),
          title: '[ARENA MAP] Thap Cua So Phai',
        }
      );
    }

    return platforms;
  }

  if (remoteHostPlatforms.length === 0 && currentStatus.host_windows_json) {
    hydrateRemotePlatformsFromJson(currentStatus.host_windows_json);
  }

  return remoteHostPlatforms.map((p) => ({
    x: p.x * wScreen,
    y: p.y * hScreen,
    w: p.w * wScreen,
    h: p.h * hScreen,
    title: p.title,
  }));
}

function createShieldDomeGroup(hexColor: number): THREE.Group {
  const g = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(68, 20, 16),
    new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.24,
      wireframe: true,
    })
  );
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(66, 20, 16),
    new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
    })
  );
  g.add(sphere);
  g.add(shell);
  return g;
}

function disposeShieldDomes() {
  if (heroShieldDomeMesh) {
    disposeThreeGroup(heroShieldDomeMesh);
    heroShieldDomeMesh = null;
  }
  if (peerShieldDomeMesh) {
    disposeThreeGroup(peerShieldDomeMesh);
    peerShieldDomeMesh = null;
  }
}

function buildPkFoodMesh(kind: 'burger' | 'battery' | 'snack'): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(18, 24, 24),
    new THREE.MeshBasicMaterial({
      color: kind === 'battery' ? 0x22d3ee : 0xfde047,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -13;
  g.add(ring);

  if (kind === 'battery') {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 20, 14),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0284c7,
        emissiveIntensity: 0.7,
        roughness: 0.25,
      })
    );
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.6 })
    );
    cap.position.y = 11.5;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(9.5, 9.5, 5, 14),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    g.add(body, cap, band);
  } else if (kind === 'burger') {
    const bunBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(12, 11, 5, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 })
    );
    bunBottom.position.y = -4;
    const patty = new THREE.Mesh(
      new THREE.CylinderGeometry(12.5, 12.5, 4.5, 16),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.7 })
    );
    const cheese = new THREE.Mesh(
      new THREE.BoxGeometry(20, 2, 20),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    cheese.position.y = 2.6;
    const bunTop = new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.35 })
    );
    bunTop.position.y = 3.5;
    g.add(bunBottom, patty, cheese, bunTop);
  } else {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(19, 13, 15),
      new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        emissive: 0xe11d48,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      })
    );
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(20, 4, 16),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.4 })
    );
    lid.position.y = 7.5;
    g.add(box, lid);
  }

  return g;
}

function clearPkFoods() {
  for (const f of pkFoods) {
    disposeThreeGroup(f.mesh);
  }
  pkFoods.length = 0;
}

function serializePkFoods() {
  return pkFoods.map((f) => ({
    id: f.id,
    x: Number(f.xRatio.toFixed(4)),
    y: Number(f.yRatio.toFixed(4)),
    kind: f.kind,
  }));
}

async function broadcastPkFoods() {
  if (currentStatus.is_sim_mode || currentStatus.phase !== 'pk_duel') return;
  await invoke('p2p_send_packet', {
    packet: {
      kind: 'pk_foods_sync',
      foods_json: JSON.stringify(serializePkFoods()),
    },
  }).catch(() => { });
}

function spawnOnePkFood() {
  const wScreen = Math.max(400, appState.W || window.innerWidth || 1920);
  const hScreen = Math.max(300, appState.H || window.innerHeight || 1080);
  const floorY = getDesktopFloorY(hScreen);
  const s = appState.modelScale || 1.0;
  const platforms = getActiveP2pPlatforms();

  let fx: number;
  let fy: number;
  if (platforms.length > 0 && Math.random() < 0.5) {
    const win = platforms[Math.floor(Math.random() * platforms.length)];
    fx = Math.max(60, Math.min(wScreen - 60, win.x + (0.2 + Math.random() * 0.6) * win.w));
    fy = win.y - 6;
  } else {
    fx = wScreen * (0.14 + Math.random() * 0.72);
    fy = floorY - 6;
  }

  const kinds: Array<'burger' | 'battery' | 'snack'> = ['burger', 'battery', 'snack'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const mesh = buildPkFoodMesh(kind);
  mesh.scale.setScalar(s);
  mesh.position.set(fx, -(fy - 18 * s), 20 * s);
  scene.add(mesh);

  pkFoods.push({
    id: nextPkFoodId++,
    xRatio: fx / wScreen,
    yRatio: fy / hScreen,
    kind,
    mesh,
    bobPhase: Math.random() * Math.PI * 2,
  });

  spawnShockwave(fx, fy - 14 * s, 0xfde047);
  spawnFloatingCombatText(fx, fy - 62 * s, 'DO AN +40 EN!', '#fde047');
  void broadcastPkFoods();
}

function syncPkFoodsFromHostJson(rawJson: string) {
  try {
    const list = JSON.parse(rawJson);
    if (!Array.isArray(list)) return;
    const validIds = new Set<number>(
      list.map((it) => Number(it.id)).filter((id) => Number.isFinite(id))
    );
    for (let i = pkFoods.length - 1; i >= 0; i--) {
      if (!validIds.has(pkFoods[i].id)) {
        disposeThreeGroup(pkFoods[i].mesh);
        pkFoods.splice(i, 1);
      }
    }
    const wScreen = Math.max(400, appState.W || window.innerWidth || 1920);
    const hScreen = Math.max(300, appState.H || window.innerHeight || 1080);
    const s = appState.modelScale || 1.0;
    for (const item of list) {
      const fid = Number(item.id);
      if (!Number.isFinite(fid) || pkFoods.some((f) => f.id === fid)) continue;
      const kind: 'burger' | 'battery' | 'snack' =
        item.kind === 'battery' || item.kind === 'snack' ? item.kind : 'burger';
      const xr = Math.max(0.05, Math.min(0.95, Number(item.x) || 0.5));
      const yr = Math.max(0.12, Math.min(0.95, Number(item.y) || 0.9));
      const mesh = buildPkFoodMesh(kind);
      mesh.scale.setScalar(s);
      mesh.position.set(xr * wScreen, -(yr * hScreen - 18 * s), 20 * s);
      scene.add(mesh);
      pkFoods.push({
        id: fid,
        xRatio: xr,
        yRatio: yr,
        kind,
        mesh,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  } catch { }
}

function removePkFoodById(foodId: number, rewardPeer = false) {
  const idx = pkFoods.findIndex((f) => f.id === foodId);
  if (idx < 0) return;
  const item = pkFoods[idx];
  const wScreen = appState.W || window.innerWidth || 1920;
  const hScreen = appState.H || window.innerHeight || 1080;
  const fx = item.xRatio * wScreen;
  const fy = item.yRatio * hScreen;
  const s = appState.modelScale || 1.0;

  spawnParticles(fx, fy - 18 * s, 12, 0xfde047);
  spawnShockwave(fx, fy - 12 * s, 0x34d399);
  disposeThreeGroup(item.mesh);
  pkFoods.splice(idx, 1);

  if (rewardPeer) {
    peerEnergy = Math.min(MAX_ENERGY, peerEnergy + FOOD_ENERGY_RESTORE);
    spawnFloatingCombatText(peerX, peerY - 145 * s, '+40 EN', '#fde047');
  }
}

function escapeHtmlSimple(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function isUltraViewOpen(): boolean {
  return remoteViewerOpen && currentStatus.phase === 'winner_control';
}

export function applyRemoteFrameToUi(
  b64: string,
  width: number,
  height: number,
  seq: number,
  cx?: number,
  cy?: number,
  simMode?: boolean
) {
  if (!b64) return;
  if (seq > 0 && seq === lastRenderedFrameSeq) return;
  lastRenderedFrameSeq = seq;
  lastRemoteFrameAt = performance.now();

  const src = `data:image/bmp;base64,${b64}`;
  const uvImg = document.getElementById('p2p-uv-screen-img') as HTMLImageElement | null;
  const uvPlaceholder = document.getElementById('p2p-uv-placeholder');
  const uvFps = document.getElementById('p2p-uv-fps-badge');
  const uvCursor = document.getElementById('p2p-uv-cursor');
  const tpImg = document.getElementById('p2p-touchpad-live-img') as HTMLImageElement | null;

  if (uvImg) {
    uvImg.src = src;
    uvImg.style.display = 'block';
  }
  if (uvPlaceholder) {
    uvPlaceholder.style.display = 'none';
  }
  if (tpImg) {
    tpImg.src = src;
    tpImg.style.display = 'block';
  }
  if (uvFps) {
    const modeTag = simMode ? 'SIM LIVE' : 'REMOTE LIVE';
    uvFps.textContent = `[${modeTag} ${width}x${height} #${seq}]`;
  }
  if (uvCursor && typeof cx === 'number' && typeof cy === 'number') {
    uvCursor.style.left = `${Math.round(Math.max(0, Math.min(1, cx)) * 100)}%`;
    uvCursor.style.top = `${Math.round(Math.max(0, Math.min(1, cy)) * 100)}%`;
  }
}

export function stopRemoteFramePolling() {
  if (remoteFramePollTimer !== null) {
    window.clearTimeout(remoteFramePollTimer);
    remoteFramePollTimer = null;
  }
  remoteFramePollBusy = false;
}

async function stepRemoteFramePoll() {
  if (currentStatus.phase !== 'winner_control') {
    stopRemoteFramePolling();
    return;
  }
  const now = performance.now();
  const recentlyPushedViaEvent = !currentStatus.is_sim_mode && now - lastRemoteFrameAt < 130;
  if (!remoteFramePollBusy && !recentlyPushedViaEvent) {
    remoteFramePollBusy = true;
    try {
      const snap = await invoke<P2pRemoteFrameSnapshot>('p2p_poll_remote_frame', {
        maxWidth: remoteViewerExpanded ? 760 : 620,
      });
      if (snap.has_frame && snap.frame_b64) {
        applyRemoteFrameToUi(
          snap.frame_b64,
          snap.width,
          snap.height,
          snap.seq,
          snap.cursor_x,
          snap.cursor_y,
          snap.is_sim_mode
        );
      }
      if (snap.remaining_sec !== currentStatus.winner_remaining_sec) {
        currentStatus.winner_remaining_sec = snap.remaining_sec;
        updateUltraViewHeaderUi();
        syncUiCb?.();
      }
    } catch { }
    remoteFramePollBusy = false;
  }
  if (currentStatus.phase === 'winner_control') {
    remoteFramePollTimer = window.setTimeout(() => void stepRemoteFramePoll(), 150);
  }
}

export function startRemoteFramePolling() {
  stopRemoteFramePolling();
  if (currentStatus.phase !== 'winner_control') return;
  void stepRemoteFramePoll();
}

function updateUltraViewHeaderUi() {
  const modal = document.getElementById('p2p-ultraview-modal');
  const cd = document.getElementById('p2p-uv-countdown');
  const peer = document.getElementById('p2p-uv-peer-name');
  const simWrap = document.getElementById('p2p-uv-sim-exec-wrap');
  const active = remoteViewerOpen && currentStatus.phase === 'winner_control';
  if (modal) {
    modal.style.display = active ? 'flex' : 'none';
    modal.classList.toggle('is-expanded', remoteViewerExpanded);
  }
  if (cd) {
    cd.textContent = `${currentStatus.winner_remaining_sec || 0}s`;
  }
  if (peer) {
    const tag = currentStatus.is_sim_mode
      ? `${currentStatus.peer_name || 'May B'} [SIM]`
      : currentStatus.is_web_peer
        ? `${currentStatus.peer_name || 'Mobile'} [WEB]`
        : currentStatus.peer_name || 'May Thua';
    peer.textContent = tag;
  }
  if (simWrap) {
    simWrap.style.display = currentStatus.is_sim_mode ? 'inline-flex' : 'none';
  }
}

export function openUltraViewModal(forceOpen?: boolean) {
  if (currentStatus.phase !== 'winner_control') {
    remoteViewerOpen = false;
    stopRemoteFramePolling();
    updateUltraViewHeaderUi();
    syncUiCb?.();
    return;
  }
  remoteViewerOpen = forceOpen !== undefined ? forceOpen : !remoteViewerOpen;
  updateUltraViewHeaderUi();
  if (remoteViewerOpen) {
    startRemoteFramePolling();
    const vp = document.getElementById('p2p-uv-viewport');
    setTimeout(() => vp?.focus(), 60);
  }
  syncUiCb?.();
}

export function toggleUltraViewExpand() {
  remoteViewerExpanded = !remoteViewerExpanded;
  const btn = document.getElementById('btn-p2p-uv-size');
  if (btn) {
    btn.textContent = remoteViewerExpanded ? 'Thu Nho Khung' : 'Phong To';
  }
  updateUltraViewHeaderUi();
  syncUiCb?.();
}

function hideHostMapAndControllerOverlays() {
  lastRenderedHostMapKey = '';
  const hostMap = document.getElementById('p2p-host-map-overlay');
  if (hostMap) {
    hostMap.style.display = 'none';
    hostMap.innerHTML = '';
  }
  const crosshair = document.getElementById('p2p-aim-crosshair');
  if (crosshair) crosshair.style.display = 'none';
  const ctrl = document.getElementById('p2p-pk-controller');
  if (ctrl) ctrl.style.display = 'none';
  remoteViewerOpen = false;
  stopRemoteFramePolling();
  updateUltraViewHeaderUi();
}

function updateP2pCombatOverlaysVisibility() {
  const ctrl = document.getElementById('p2p-pk-controller');
  const active = isP2pCombatControlsActive() && !appState.isMigratedOut;
  if (ctrl) {
    if (!active) {
      if (ctrl.style.display !== 'none') {
        ctrl.style.display = 'none';
      }
    } else {
      ctrl.style.display = 'flex';
      const shieldBtn = document.getElementById('btn-p2p-ctrl-shield');
      if (shieldBtn) {
        shieldBtn.classList.toggle('is-active', heroBulletShieldActive);
      }
      const bhBtn = document.getElementById('btn-p2p-ctrl-bh');
      if (bhBtn) {
        bhBtn.classList.toggle('is-active', heroHiddenTimer > 0);
      }
      const rocketBtn = document.getElementById('btn-p2p-ctrl-rocket');
      if (rocketBtn) {
        rocketBtn.classList.toggle('is-active', heroJetpackActive);
      }
      const enTextEl = document.getElementById('p2p-ctrl-en-text');
      const enFillEl = document.getElementById('p2p-ctrl-en-fill');
      const peerStatEl = document.getElementById('p2p-ctrl-peer-stat');
      const roundedEn = Math.round(myEnergy);
      if (enTextEl) enTextEl.textContent = `EN ${roundedEn}/${MAX_ENERGY}`;
      if (enFillEl) {
        enFillEl.style.width = `${Math.max(0, Math.min(100, (myEnergy / MAX_ENERGY) * 100))}%`;
        enFillEl.classList.toggle('low', roundedEn < 20);
      }
      if (peerStatEl) {
        peerStatEl.textContent = `Doi thu: ${peerHp} HP | ${Math.round(peerEnergy)} EN`;
      }
    }
  }

  const crosshair = document.getElementById('p2p-aim-crosshair');
  if (crosshair) {
    if (currentStatus.phase === 'pk_duel' && !appState.isMigratedOut) {
      const cx = Math.round(appState.globalCursorX || (appState.W || 1920) * 0.5);
      const cy = Math.round(appState.globalCursorY || (appState.H || 1080) * 0.5);
      crosshair.style.display = 'block';
      crosshair.style.left = `${cx}px`;
      crosshair.style.top = `${cy}px`;
    } else if (crosshair.style.display !== 'none') {
      crosshair.style.display = 'none';
    }
  }

  const hostMap = document.getElementById('p2p-host-map-overlay');
  if (hostMap) {
    const platforms = isP2pCombatControlsActive() ? getActiveP2pPlatforms() : [];
    const showSharedMap = isP2pCombatControlsActive() && platforms.length > 0;
    if (!showSharedMap) {
      if (hostMap.style.display !== 'none') {
        hostMap.style.display = 'none';
      }
      lastRenderedHostMapKey = '';
    } else {
      const wScreen = appState.W || window.innerWidth || 1920;
      const hScreen = appState.H || window.innerHeight || 1080;
      const isGuest = currentStatus.is_room_host === false;
      const nextKey = `${isGuest ? 'G' : 'H'}:${wScreen}x${hScreen}:${platforms
        .map((p) => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.w)},${Math.round(p.h)},${p.title}`)
        .join('|')}`;
      hostMap.style.display = 'block';
      if (nextKey !== lastRenderedHostMapKey) {
        lastRenderedHostMapKey = nextKey;
        const hostNameSafe = escapeHtmlSimple(currentStatus.peer_name || 'Chu Phong');
        const bannerText = isGuest
          ? `[MAP DONG BO CHUNG: ${platforms.length} CUA SO VAT LY — CHU PHONG: ${hostNameSafe}] (Space: Nhay len noc | B: Ho den an nap)`
          : `[MAP PHONG CHUNG DANG CHIA SE CHO KHACH: ${platforms.length} CUA SO VAT LY] (Space: Nhay len noc | B: Ho den an nap)`;
        const boxesHtml = platforms
          .map((win, idx) => {
            const left = Math.round(win.x);
            const top = Math.round(win.y);
            const width = Math.max(88, Math.round(win.w));
            const height = Math.max(46, Math.round(win.h));
            const safeTitle = escapeHtmlSimple((win.title || `Window ${idx + 1}`).slice(0, 34));
            if (isGuest) {
              return `<div class="p2p-host-win-box" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;"><div class="p2p-host-win-ledge"></div><div class="p2p-host-win-header"><span class="p2p-host-win-title">[MAP CHU PHONG] ${safeTitle}</span><span class="p2p-host-win-tag">SAN VAT LY | B: HO DEN</span></div></div>`;
            }
            return `<div class="p2p-host-win-box is-host-ledge" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;"><div class="p2p-host-win-ledge"></div><span class="p2p-host-win-title">[DONG BO MAP] ${safeTitle}</span></div>`;
          })
          .join('');
        hostMap.innerHTML = `<div class="p2p-shared-map-banner${isGuest ? '' : ' is-host'}">${bannerText}</div>${boxesHtml}`;
      }
    }
  }
}

function revealFromBlackHoleIfHidden(spawnPortal = true) {
  if (heroHiddenTimer <= 0) return;
  heroHiddenTimer = 0;
  appState.avatarGroup.visible = !appState.isMigratedOut;
  const s = appState.modelScale || 1.0;
  if (spawnPortal) {
    spawnBlackHole(appState.posX, appState.posY - 50 * s, 1.1, 'ejection');
    spawnParticles(appState.posX, appState.posY - 50 * s, 12, 0x38bdf8);
    playWhooshSound(appState.posX);
    spawnFloatingCombatText(appState.posX, appState.posY - 140 * s, 'XUAT HIEN!', '#38bdf8');
  }
  if (!currentStatus.is_sim_mode) {
    const w = Math.max(1, appState.W || 1920);
    const h = Math.max(1, appState.H || 1080);
    void invoke('p2p_send_packet', {
      packet: {
        kind: 'blackhole_hide',
        is_hidden: false,
        x_ratio: appState.posX / w,
        y_ratio: appState.posY / h,
      },
    }).catch(() => { });
  }
}

export function triggerP2pBlackHoleHide() {
  if (!isP2pCombatControlsActive() || appState.isMigratedOut) return;
  const s = appState.modelScale || 1.0;
  if (heroHiddenTimer > 0) {
    revealFromBlackHoleIfHidden(true);
    updateP2pCombatOverlaysVisibility();
    return;
  }

  const platforms = getActiveP2pPlatforms();
  if (platforms.length === 0) {
    spawnFloatingCombatText(appState.posX, appState.posY - 140 * s, 'CHUA CO CUA SO!', '#c084fc');
    speak('[HO DEN P2P] Phong chu chua mo cua so thuong nao de chui vao an!');
    return;
  }

  heroHiddenWinIdx = (heroHiddenWinIdx + 1) % platforms.length;
  const targetWin = platforms[heroHiddenWinIdx];
  const wScreen = appState.W || window.innerWidth || 1920;
  const floorY = getDesktopFloorY(appState.H || window.innerHeight || 1080);

  spawnBlackHole(appState.posX, appState.posY - 60 * s, 1.3, 'suction');
  playWhooshSound(appState.posX);

  appState.posX = Math.max(58, Math.min(wScreen - 58, targetWin.x + targetWin.w * 0.5));
  appState.posY = Math.max(115, Math.min(floorY, targetWin.y + Math.min(68, targetWin.h * 0.35)));
  heroVelY = 0;
  heroSlideVelX = 0;
  heroSlideTimer = 0;
  appState.duckCrouchRoll = false;
  heroJetpackActive = false;
  showJetpack(false);
  heroBulletShieldActive = false;
  heroHiddenTimer = 4.0;
  appState.avatarGroup.visible = false;

  spawnBlackHole(appState.posX, appState.posY - 40 * s, 1.3, 'suction');
  spawnFloatingCombatText(appState.posX, appState.posY - 100 * s, 'AN CUA SO!', '#c084fc');

  if (!currentStatus.is_sim_mode) {
    void invoke('p2p_send_packet', {
      packet: {
        kind: 'blackhole_hide',
        is_hidden: true,
        x_ratio: appState.posX / Math.max(1, wScreen),
        y_ratio: appState.posY / Math.max(1, appState.H || 1080),
      },
    }).catch(() => { });
  }
  updateP2pCombatOverlaysVisibility();
}

export function setP2pBulletShield(active: boolean) {
  if (!isP2pCombatControlsActive() || appState.isMigratedOut) {
    heroBulletShieldActive = false;
    return;
  }
  const s = appState.modelScale || 1.0;
  if (active) {
    if (heroBulletShieldCooldown > 0 || heroBulletShieldEnergy <= 0.1) {
      if (!heroBulletShieldActive) {
        spawnFloatingCombatText(appState.posX, appState.posY - 140 * s, 'HOI KHIEN...', '#94a3b8');
      }
      heroBulletShieldActive = false;
      return;
    }
    revealFromBlackHoleIfHidden(true);
    if (!heroBulletShieldActive) {
      heroBulletShieldActive = true;
      spawnShockwave(appState.posX, appState.posY - 60 * s, 0x22d3ee);
      spawnFloatingCombatText(appState.posX, appState.posY - 145 * s, 'KHIEN CHAN DAN!', '#22d3ee');
    }
  } else {
    heroBulletShieldActive = false;
  }
  updateP2pCombatOverlaysVisibility();
}

function clearPvpBolts() {
  for (let i = pvpBolts.length - 1; i >= 0; i--) {
    const b = pvpBolts[i];
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    (b.mesh.material as THREE.Material).dispose();
    pvpBolts.splice(i, 1);
  }
  for (let i = pendingThunders.length - 1; i >= 0; i--) {
    const th = pendingThunders[i];
    scene.remove(th.marker);
    th.marker.geometry.dispose();
    (th.marker.material as THREE.Material).dispose();
    pendingThunders.splice(i, 1);
  }
}

export function spawnFloatingCombatText(x: number, y: number, text: string, color = '#fde047') {
  const root = document.getElementById('app-ui') || document.body;
  const el = document.createElement('div');
  el.style.cssText = [
    'position: fixed',
    `left: ${Math.max(12, Math.min((appState.W || 1920) - 130, Math.round(x - 44)))}px`,
    `top: ${Math.max(12, Math.min((appState.H || 1080) - 60, Math.round(y)))}px`,
    'padding: 2px 8px',
    'border-radius: 6px',
    'background: rgba(15, 23, 42, 0.86)',
    `border: 1px solid ${color}`,
    `color: ${color}`,
    'font-size: 11.5px',
    'font-weight: 800',
    'letter-spacing: 0.4px',
    'pointer-events: none',
    'z-index: 9997',
    'transition: transform 0.55s ease, opacity 0.55s ease',
  ].join(';');
  el.textContent = text;
  root.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(-26px) scale(1.06)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 620);
}

function isHeroStandingOnPlatformOrFloor(floorY: number): boolean {
  if (appState.posY >= floorY - 5) return true;
  if (heroDropThroughTimer > 0 || heroVelY < -20) return false;
  const platforms = getActiveP2pPlatforms();
  for (const win of platforms) {
    if (
      appState.posX >= win.x + 10 &&
      appState.posX <= win.x + win.w - 10 &&
      Math.abs(appState.posY - win.y) <= 10
    ) {
      return true;
    }
  }
  return false;
}

export function triggerP2pMove(
  action:
    | 'left'
    | 'right'
    | 'stop'
    | 'step_left'
    | 'step_right'
    | 'jump'
    | 'dash'
    | 'rocket_up'
    | 'rocket_stop'
    | 'slide_left'
    | 'slide_right'
    | 'drop_down'
) {
  if (!isP2pCombatControlsActive() || appState.isMigratedOut) return;
  const w = appState.W || window.innerWidth || 1920;
  const floorY = getDesktopFloorY(appState.H || window.innerHeight || 1080);
  const s = appState.modelScale || 1.0;

  if (action === 'left' || action === 'right') {
    const dir = action === 'left' ? -1 : 1;
    heroMoveInput = dir;
    appState.walkDir = dir;
    if (heroHiddenTimer > 0) {
      const platforms = getActiveP2pPlatforms();
      if (platforms.length > 1) {
        heroHiddenWinIdx = (heroHiddenWinIdx + (dir > 0 ? 1 : platforms.length - 1)) % platforms.length;
        const win = platforms[heroHiddenWinIdx];
        appState.posX = Math.max(58, Math.min(w - 58, win.x + win.w * 0.5));
        appState.posY = Math.max(115, Math.min(floorY, win.y + Math.min(68, win.h * 0.35)));
        spawnParticles(appState.posX, appState.posY - 40, 8, 0xc084fc);
      }
    } else if (!isP2pDuelActive()) {
      appState.setState('WALKING');
    }
    return;
  }
  if (action === 'stop') {
    heroMoveInput = 0;
    return;
  }
  if (action === 'step_left' || action === 'step_right') {
    revealFromBlackHoleIfHidden(true);
    const dir = action === 'step_left' ? -1 : 1;
    appState.walkDir = dir;
    appState.posX = Math.max(52, Math.min(w - 52, appState.posX + dir * 64));
    appState.squashX = 1.08;
    appState.squashY = 0.94;
    if (!isP2pDuelActive()) {
      appState.setState('WALKING');
    }
    spawnParticles(appState.posX, appState.posY - 10, 4, 0x38bdf8);
    return;
  }
  if (action === 'drop_down') {
    if (heroHiddenTimer > 0) {
      revealFromBlackHoleIfHidden(true);
    }
    if (appState.posY < floorY - 12) {
      heroDropThroughTimer = 0.28;
      heroVelY = Math.max(heroVelY, 160);
      spawnParticles(appState.posX, appState.posY - 6, 5, 0x94a3b8);
    }
    return;
  }
  if (action === 'rocket_up') {
    if (currentStatus.phase === 'pk_duel') {
      if (!heroJetpackActive && myEnergy < ROCKET_MIN_IGNITE) {
        playAlertBeep(appState.posX);
        spawnFloatingCombatText(appState.posX, appState.posY - 145 * s, 'HET NANG LUONG TEN LUA!', '#fbbf24');
        return;
      }
      if (!heroJetpackActive) {
        myEnergy = Math.max(0, myEnergy - ROCKET_IGNITE_COST);
      }
    }
    revealFromBlackHoleIfHidden(true);
    heroJetpackActive = true;
    showJetpack(true);
    if (heroVelY > -240) {
      heroVelY = -340 * Math.max(0.85, s);
    }
    appState.setState('JUMPING');
    updateP2pCombatOverlaysVisibility();
    return;
  }
  if (action === 'rocket_stop') {
    heroJetpackActive = false;
    showJetpack(false);
    updateP2pCombatOverlaysVisibility();
    return;
  }
  if (action === 'jump') {
    revealFromBlackHoleIfHidden(true);
    if (isHeroStandingOnPlatformOrFloor(floorY)) {
      heroVelY = -630 * Math.max(0.88, s);
      appState.squashX = 0.85;
      appState.squashY = 1.22;
      appState.setState('JUMPING');
      spawnParticles(appState.posX, appState.posY - 10, 8, 0x38bdf8);
      playWhooshSound(appState.posX);
    }
    return;
  }
  if (action === 'dash' || action === 'slide_left' || action === 'slide_right') {
    if (myDashCooldown > 0) return;
    if (currentStatus.phase === 'pk_duel') {
      if (myEnergy < SLIDE_ENERGY_COST) {
        playAlertBeep(appState.posX);
        spawnFloatingCombatText(
          appState.posX,
          appState.posY - 145 * s,
          `CAN ${SLIDE_ENERGY_COST} NANG LUONG!`,
          '#fbbf24'
        );
        return;
      }
      myEnergy = Math.max(0, myEnergy - SLIDE_ENERGY_COST);
    }
    revealFromBlackHoleIfHidden(true);
    myDashCooldown = 0.9;
    myDodgeTimer = 0.55;
    heroSlideTimer = 0.42;
    const dir =
      action === 'slide_left'
        ? -1
        : action === 'slide_right'
          ? 1
          : heroMoveInput !== 0
            ? heroMoveInput
            : appState.walkDir || 1;
    appState.walkDir = dir;
    heroSlideVelX = dir * 740 * Math.max(0.85, s);
    appState.duckCrouchRoll = true;
    appState.squashX = 1.26;
    appState.squashY = 0.78;
    spawnDriftSmoke(appState.posX, appState.posY - 6, -dir);
    spawnParticles(appState.posX, appState.posY - 55 * s, 14, 0x22d3ee);
    spawnShockwave(appState.posX, appState.posY - 30 * s, 0x22d3ee);
    playWhooshSound(appState.posX);
    spawnFloatingCombatText(appState.posX, appState.posY - 155 * s, 'TRUOT NE!', '#22d3ee');
  }
}

function setHeroWeapon(w: 'none' | 'sword' | 'gun') {
  if (heroWeapon === w) return;
  heroWeapon = w;
  disposeThreeGroup(heroPvpSwordGroup);
  heroPvpSwordGroup = null;
  disposeThreeGroup(heroPvpGunGroup);
  heroPvpGunGroup = null;
  if (w === 'sword') {
    heroPvpSwordGroup = buildHeroSwordMesh();
    appState.avatarGroup.add(heroPvpSwordGroup);
  } else if (w === 'gun') {
    heroPvpGunGroup = buildHeroGunMesh();
    appState.avatarGroup.add(heroPvpGunGroup);
  }
}

function setPeerWeapon(w: 'none' | 'sword' | 'gun') {
  if (peerWeapon === w && peerDuckGroup) return;
  peerWeapon = w;
  disposeThreeGroup(peerSwordGroup);
  peerSwordGroup = null;
  disposeThreeGroup(peerGunGroup);
  peerGunGroup = null;
  if (!peerDuckGroup) return;
  if (w === 'sword') {
    peerSwordGroup = buildHeroSwordMesh();
    peerDuckGroup.add(peerSwordGroup);
  } else if (w === 'gun') {
    peerGunGroup = buildHeroGunMesh();
    peerDuckGroup.add(peerGunGroup);
  }
}

function ensurePeerDuckMesh() {
  if (peerDuckGroup) return;
  const bodyHex = currentStatus.peer_body_color || '#312e81';
  const accentHex = currentStatus.peer_accent_color || '#f43f5e';
  peerDuckGroup = createCloneMicroDuckMesh(bodyHex, accentHex);
  peerDuckGroup.position.set(peerX, -peerY, 10);
  scene.add(peerDuckGroup);
  if (peerWeapon !== 'none') {
    const w = peerWeapon;
    peerWeapon = 'none';
    setPeerWeapon(w);
  }
}

function removePeerDuckMesh() {
  disposeThreeGroup(peerSwordGroup);
  peerSwordGroup = null;
  disposeThreeGroup(peerGunGroup);
  peerGunGroup = null;
  if (peerShieldDomeMesh) {
    disposeThreeGroup(peerShieldDomeMesh);
    peerShieldDomeMesh = null;
  }
  disposeThreeGroup(peerDuckGroup);
  peerDuckGroup = null;
  peerPresentOnMyScreen = false;
  peerHiddenInWindow = false;
  peerBulletShielding = false;
  peerJetpackActive = false;
  peerSlidingActive = false;
  peerWeapon = 'none';
  hideP2pFloatingHud();
}

function spawnPvpLaser(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  targetSide: 'peer' | 'hero',
  color: number,
  damage: number
) {
  const s = appState.modelScale || 1.0;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed = 820;
  const vx = (dx / dist) * speed;
  const vy = (dy / dist) * speed;

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3 * s, 2.3 * s, 28 * s, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.set(fromX, -fromY, 18);
  mesh.rotation.z = Math.atan2(-vy, vx) - Math.PI / 2;
  scene.add(mesh);

  pvpBolts.push({
    mesh,
    x: fromX,
    y: fromY,
    vx,
    vy,
    targetSide,
    color,
    damage,
    resolved: false,
    life: 0,
  });
}

function spawnThunderStrike(
  targetSide: 'peer' | 'hero',
  lockedX: number,
  floorY: number,
  color: number,
  damage: number
) {
  const s = appState.modelScale || 1.0;
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(18 * s, 32 * s, 24),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
  );
  marker.rotation.x = Math.PI / 2;
  marker.position.set(lockedX, -(floorY - 6), 14);
  scene.add(marker);

  pendingThunders.push({
    targetSide,
    lockedX,
    floorY,
    timer: 0.52,
    damage,
    color,
    marker,
  });
  spawnFloatingCombatText(lockedX, floorY - 155 * s, 'CANH BAO SET!', color === 0xfacc15 ? '#fde047' : '#fda4af');
}

function hideP2pFloatingHud() {
  const el = document.getElementById('p2p-floating-hud');
  if (el) el.style.display = 'none';
}

function updateP2pFloatingHud() {
  const el = document.getElementById('p2p-floating-hud');
  if (!el) return;

  const shouldShow =
    currentStatus.phase === 'pk_duel' || (peerPresentOnMyScreen && currentStatus.phase === 'connected');
  if (!shouldShow) {
    if (el.style.display !== 'none') {
      el.style.display = 'none';
    }
    return;
  }

  el.style.display = 'block';
  const myTag = document.getElementById('p2p-hud-my-tag');
  const myBar = document.getElementById('p2p-hud-my-hp');
  const myEnBar = document.getElementById('p2p-hud-my-en');
  const peerTag = document.getElementById('p2p-hud-peer-tag');
  const peerBar = document.getElementById('p2p-hud-peer-hp');
  const peerEnBar = document.getElementById('p2p-hud-peer-en');

  const s = appState.modelScale || 1.0;
  if (myTag && myBar) {
    if (appState.isMigratedOut) {
      myTag.style.display = 'none';
    } else {
      myTag.style.display = 'flex';
      myTag.style.left = `${Math.max(8, Math.min(appState.W - 140, Math.round(appState.posX - 64)))}px`;
      myTag.style.top = `${Math.max(8, Math.round(appState.posY - 204 * s))}px`;
      const nameEl = myTag.querySelector('.p2p-float-name');
      if (nameEl) nameEl.textContent = `${currentStatus.local_name} (${myHp} HP)`;
      myBar.style.width = `${Math.max(0, Math.min(100, (myHp / MAX_HP) * 100))}%`;
      if (myEnBar) myEnBar.style.width = `${Math.max(0, Math.min(100, (myEnergy / MAX_ENERGY) * 100))}%`;
    }
  }

  if (peerTag && peerBar) {
    if (!peerPresentOnMyScreen) {
      peerTag.style.display = 'none';
    } else {
      peerTag.style.display = 'flex';
      peerTag.style.left = `${Math.max(8, Math.min(appState.W - 140, Math.round(peerX - 64)))}px`;
      peerTag.style.top = `${Math.max(8, Math.round(peerY - 204 * s))}px`;
      const nameEl = peerTag.querySelector('.p2p-float-name');
      if (nameEl) {
        nameEl.textContent = `${currentStatus.peer_name || 'Peer B'} (${peerHp} HP)`;
      }
      peerBar.style.width = `${Math.max(0, Math.min(100, (peerHp / MAX_HP) * 100))}%`;
      if (peerEnBar) peerEnBar.style.width = `${Math.max(0, Math.min(100, (peerEnergy / MAX_ENERGY) * 100))}%`;
    }
  }
}

function updateReturnAndVictimBanners() {
  const returnPill = document.getElementById('p2p-return-pill');
  if (returnPill) {
    returnPill.style.display = appState.isMigratedOut ? 'flex' : 'none';
  }

  const victimBanner = document.getElementById('p2p-victim-banner');
  const victimCountdown = document.getElementById('p2p-victim-countdown');
  if (victimBanner && victimCountdown) {
    const active =
      currentStatus.phase === 'victim_controlled' && currentStatus.victim_remaining_sec > 0;
    victimBanner.style.display = active ? 'flex' : 'none';
    victimCountdown.textContent = `${currentStatus.victim_remaining_sec}s`;
  }

  if (currentStatus.phase !== 'winner_control') {
    if (remoteViewerOpen || remoteFramePollTimer !== null) {
      remoteViewerOpen = false;
      stopRemoteFramePolling();
    }
  }
  updateUltraViewHeaderUi();
}

export async function refreshP2pStatus(): Promise<P2pStatus> {
  try {
    currentStatus = await invoke<P2pStatus>('p2p_get_status');
  } catch { }
  if (currentStatus.is_room_host === false && currentStatus.host_windows_json) {
    hydrateRemotePlatformsFromJson(currentStatus.host_windows_json);
  }
  updateReturnAndVictimBanners();
  syncUiCb?.();
  return currentStatus;
}

export async function initP2pArena() {
  if (initialized) return;
  initialized = true;

  await refreshP2pStatus();

  await listen<P2pEventPayload>('desktop-mate://p2p-event', (event) => {
    const ev = event.payload;
    currentStatus = ev.status;
    if (currentStatus.is_room_host === false && currentStatus.host_windows_json) {
      hydrateRemotePlatformsFromJson(currentStatus.host_windows_json);
    }

    if (ev.event_type === 'incoming_handshake') {
      playAlertBeep(appState.posX);
      appState.setState('ALERT');
      appState.setExpression('surprised', 4.0);
      const fromName = currentStatus.pending_peer_name || 'Đối thủ';
      const fromAddr = currentStatus.pending_peer_addr || '';
      speak(
        `[HANDSHAKE P2P] ${fromName} (${fromAddr}) muốn kết nối vào phòng đấu PK & điều khiển chéo! Bấm "Đồng ý Kết Nối" để bắt tay nhé.`
      );
      if (suggestCb) {
        suggestCb(
          () => {
            void respondP2pHandshake(true);
          },
          () => {
            void respondP2pHandshake(false);
          },
          'Đồng ý Kết Nối',
          'Từ chối'
        );
      }
      setP2pModalOpenCb?.(true);
    } else if (ev.event_type === 'handshake_accepted') {
      playSuccessChimeSound(appState.posX);
      appState.setExpression('happy', 3.5);
      spawnParticles(appState.posX, appState.posY - 100, 14, 0x34d399);
      if (currentStatus.is_room_host !== false) {
        lastSentWindowsJson = '';
        void sendHostWindowMapNow(true);
      } else {
        hydrateRemotePlatformsFromJson(currentStatus.host_windows_json);
        void invoke('p2p_send_packet', { packet: { kind: 'map_request' } }).catch(() => { });
      }
      speak(
        ev.message ||
        `[P2P HANDSHAKE] Da ket noi an toan voi ${currentStatus.peer_name}! Map cua so vat ly da duoc dong bo de 2 ben nhay & PK!`
      );
    } else if (ev.event_type === 'map_request') {
      if (currentStatus.is_room_host !== false) {
        lastSentWindowsJson = '';
        void sendHostWindowMapNow(true);
      }
    } else if (ev.event_type === 'handshake_rejected') {
      playAlertBeep(appState.posX);
      speak(`[P2P] ${ev.message || 'Yêu cầu kết nối đã bị từ chối.'}`);
    } else if (ev.event_type === 'peer_migrated_in' && ev.packet) {
      const p = ev.packet;
      const w = appState.W || window.innerWidth || 1920;
      const h = appState.H || window.innerHeight || 1080;
      peerPresentOnMyScreen = true;
      peerHiddenInWindow = false;
      peerX = Math.max(40, Math.min(w - 40, (p.x_ratio ?? 0.08) * w));
      peerY = Math.max(115, Math.min(getDesktopFloorY(h), (p.y_ratio ?? 0.9) * h));
      peerWalkDir = p.walk_dir ?? 1;
      peerAnimState = 'WALKING';
      ensurePeerDuckMesh();
      playDuckQuackSound(peerX);
      spawnShockwave(peerX, peerY - 30, 0x38bdf8);
      spawnParticles(peerX, peerY - 80, 16, 0x38bdf8);
      speak(
        `[CROSS-PC] Vịt của ${currentStatus.peer_name || 'Đối thủ'} vừa nhảy từ máy bên kia sang màn hình bạn!`
      );
    } else if (ev.event_type === 'peer_migrated_return') {
      if (peerDuckGroup) {
        spawnParticles(peerX, peerY - 70, 14, 0xa855f7);
        spawnShockwave(peerX, peerY - 30, 0xa855f7);
      }
      removePeerDuckMesh();
      speak(`[CROSS-PC] Vịt của đối thủ đã quay trở về máy của họ.`);
    } else if (ev.event_type === 'host_map_sync' && ev.packet) {
      if (currentStatus.is_room_host === false && typeof ev.packet.windows_json === 'string') {
        if (hydrateRemotePlatformsFromJson(ev.packet.windows_json)) {
          updateP2pCombatOverlaysVisibility();
        }
      }
    } else if (ev.event_type === 'remote_frame' && ev.packet) {
      const fp = ev.packet;
      if (typeof fp.frame_b64 === 'string' && fp.frame_b64) {
        applyRemoteFrameToUi(
          fp.frame_b64,
          fp.frame_w || 560,
          fp.frame_h || 315,
          fp.frame_seq || 0,
          fp.x_ratio,
          fp.y_ratio,
          currentStatus.is_sim_mode
        );
      }
    } else if (ev.event_type === 'peer_blackhole_hide' && ev.packet) {
      const p = ev.packet;
      const w = appState.W || window.innerWidth || 1920;
      const h = appState.H || window.innerHeight || 1080;
      const hidden = Boolean(p.is_hidden);
      peerHiddenInWindow = hidden;
      if (typeof p.x_ratio === 'number') peerX = Math.max(40, Math.min(w - 40, p.x_ratio * w));
      if (typeof p.y_ratio === 'number') peerY = Math.max(115, Math.min(getDesktopFloorY(h), p.y_ratio * h));
      spawnBlackHole(peerX, peerY - 50, 1.2, hidden ? 'suction' : 'ejection');
      spawnFloatingCombatText(
        peerX,
        peerY - 125,
        hidden ? 'DOI THU AN CUA SO!' : 'DOI THU XUAT HIEN!',
        '#c084fc'
      );
    } else if (ev.event_type === 'pk_foods_sync' && ev.packet) {
      if (currentStatus.is_room_host === false && typeof ev.packet.foods_json === 'string') {
        syncPkFoodsFromHostJson(ev.packet.foods_json);
      }
    } else if (ev.event_type === 'pk_food_pickup' && ev.packet) {
      if (typeof ev.packet.food_id === 'number') {
        removePkFoodById(ev.packet.food_id, true);
        if (currentStatus.is_room_host !== false) {
          void broadcastPkFoods();
        }
      }
    } else if (ev.event_type === 'peer_state_sync' && ev.packet) {
      const p = ev.packet;
      const w = appState.W || window.innerWidth || 1920;
      const h = appState.H || window.innerHeight || 1080;
      if (!peerPresentOnMyScreen && currentStatus.phase === 'pk_duel') {
        peerPresentOnMyScreen = true;
        ensurePeerDuckMesh();
      }
      if (typeof p.energy === 'number') {
        peerEnergy = Math.max(0, Math.min(MAX_ENERGY, p.energy));
      }
      if (typeof p.windows_json === 'string' && currentStatus.is_room_host === false) {
        hydrateRemotePlatformsFromJson(p.windows_json);
      }
      if (peerPresentOnMyScreen) {
        if (typeof p.x_ratio === 'number') {
          peerX = Math.max(40, Math.min(w - 40, p.x_ratio * w));
        }
        if (typeof p.y_ratio === 'number') {
          peerY = Math.max(115, Math.min(getDesktopFloorY(h), p.y_ratio * h));
        }
        if (typeof p.walk_dir === 'number') peerWalkDir = p.walk_dir;
        if (p.char_state) {
          peerAnimState = p.char_state;
          if (p.char_state === 'DASH') {
            peerDodgeTimer = Math.max(peerDodgeTimer, 0.52);
          }
        }
        if (typeof p.is_hidden === 'boolean') peerHiddenInWindow = p.is_hidden;
        if (typeof p.is_shielding === 'boolean') peerBulletShielding = p.is_shielding;
        if (typeof p.is_jetpack === 'boolean') peerJetpackActive = p.is_jetpack;
        if (typeof p.is_sliding === 'boolean') {
          peerSlidingActive = p.is_sliding;
          if (p.is_sliding) peerDodgeTimer = Math.max(peerDodgeTimer, 0.45);
        }
        if (p.weapon === 'sword' || p.weapon === 'gun' || p.weapon === 'none') {
          setPeerWeapon(p.weapon);
        }
      }
    } else if (ev.event_type === 'pk_started') {
      if (ev.packet?.windows_json && currentStatus.is_room_host === false) {
        hydrateRemotePlatformsFromJson(ev.packet.windows_json);
      }
      setupLocalPkArena(false);
    } else if (ev.event_type === 'pk_attack' && ev.packet) {
      handleIncomingPkAttack(ev.packet);
    } else if (ev.event_type === 'pk_finished' && ev.packet) {
      const winnerIsSender = Boolean(ev.packet.winner_is_sender);
      finalizePkOutcome(!winnerIsSender, false);
    } else if (ev.event_type === 'remote_executed') {
      const ctype = ev.packet?.cmd_type || '';
      const isQuietInput =
        ctype === 'mouse_move' ||
        ctype === 'mouse_down' ||
        ctype === 'mouse_up' ||
        ctype === 'mouse_click' ||
        ctype === 'mouse_dblclick' ||
        ctype === 'mouse_wheel' ||
        ctype === 'key_down' ||
        ctype === 'key_up' ||
        ctype === 'key_press' ||
        ctype === 'hotkey';
      if (!isQuietInput) {
        playAlertBeep(appState.posX);
        if (ev.message) {
          speak(`[REMOTE CONTROL] Đối thủ vừa thực thi: ${ev.message}`);
        }
      }
    } else if (ev.event_type === 'peer_disconnected') {
      cleanupAfterDisconnect();
      speak(`[P2P] ${ev.message || 'Đã ngắt kết nối P2P.'}`);
    }

    updateReturnAndVictimBanners();
    updateP2pCombatOverlaysVisibility();
    syncUiCb?.();
  });
}

async function sendHostWindowMapNow(force = false) {
  if (currentStatus.is_room_host === false || !isP2pCombatControlsActive()) return;
  const now = performance.now();
  if (appState.openWindows.length === 0 && now - lastWindowFetchAt > 1200) {
    lastWindowFetchAt = now;
    try {
      const wins = await invoke<WinRect[]>('get_open_windows');
      if (Array.isArray(wins) && wins.length > 0) {
        appState.openWindows = wins;
      }
    } catch { }
  }

  const wScreen = Math.max(1, appState.W || window.innerWidth || 1920);
  const hScreen = Math.max(1, appState.H || window.innerHeight || 1080);
  const platforms = getActiveP2pPlatforms().map((win) => ({
    x: Number((win.x / wScreen).toFixed(4)),
    y: Number((win.y / hScreen).toFixed(4)),
    w: Number((win.w / wScreen).toFixed(4)),
    h: Number((win.h / hScreen).toFixed(4)),
    title: (win.title || 'Window').slice(0, 32),
  }));
  const jsonStr = JSON.stringify(platforms);
  const periodicDue = now - lastMapForceBroadcastAt >= 2000;
  if (!force && !periodicDue && jsonStr === lastSentWindowsJson) return;
  lastSentWindowsJson = jsonStr;
  lastMapForceBroadcastAt = now;
  await invoke('p2p_send_packet', {
    packet: {
      kind: 'map_windows',
      windows_json: jsonStr,
    },
  }).catch(() => { });
}

function cleanupAfterDisconnect() {
  if (appState.isMigratedOut) {
    appState.isMigratedOut = false;
  }
  appState.avatarGroup.visible = true;
  heroMoveInput = 0;
  heroVelY = 0;
  heroSlideVelX = 0;
  heroSlideTimer = 0;
  heroJetpackActive = false;
  showJetpack(false);
  heroBulletShieldActive = false;
  heroBulletShieldEnergy = 2.4;
  heroBulletShieldCooldown = 0;
  heroDropThroughTimer = 0;
  heroHiddenTimer = 0;
  appState.duckCrouchRoll = false;
  remoteHostPlatforms = [];
  lastSentWindowsJson = '';
  lastMapForceBroadcastAt = 0;
  lastRenderedFrameSeq = -1;
  lastRemoteFrameAt = 0;
  remoteViewerOpen = false;
  stopRemoteFramePolling();
  myEnergy = MAX_ENERGY;
  peerEnergy = MAX_ENERGY;
  clearPkFoods();
  setHeroWeapon('none');
  removePeerDuckMesh();
  disposeShieldDomes();
  clearPvpBolts();
  updateReturnAndVictimBanners();
  hideHostMapAndControllerOverlays();
}

export async function requestP2pHandshake(targetAddr: string, roomCode: string): Promise<void> {
  try {
    currentStatus = await invoke<P2pStatus>('p2p_request_handshake', {
      targetAddr,
      roomCode,
      localName: currentStatus.local_name || 'DuckPlayer',
      bodyColor: appState.duckBodyColor || '#f4f4f6',
      accentColor: appState.duckAccentColor || '#f97316',
    });
    speak(
      `[HANDSHAKE] Đã gửi yêu cầu bắt tay tới ${targetAddr}. Đang chờ đối thủ bấm Đồng ý...`
    );
  } catch (err) {
    speak(`[P2P LỖI] ${String(err)}`);
  }
  syncUiCb?.();
}

export async function respondP2pHandshake(accept: boolean): Promise<void> {
  try {
    currentStatus = await invoke<P2pStatus>('p2p_respond_handshake', {
      accept,
      localName: currentStatus.local_name || 'DuckPlayer',
      bodyColor: appState.duckBodyColor || '#f4f4f6',
      accentColor: appState.duckAccentColor || '#f97316',
    });
    if (accept && currentStatus.is_room_host !== false) {
      lastSentWindowsJson = '';
      await sendHostWindowMapNow(true);
    }
  } catch (err) {
    speak(`[P2P LỖI] ${String(err)}`);
  }
  syncUiCb?.();
}

export async function startSimPeerTest(): Promise<void> {
  try {
    currentStatus = await invoke<P2pStatus>('p2p_start_sim_peer');
  } catch (err) {
    speak(`[P2P LỖI] ${String(err)}`);
  }
  syncUiCb?.();
}

export async function disconnectP2pRoom(): Promise<void> {
  try {
    currentStatus = await invoke<P2pStatus>('p2p_disconnect');
  } catch { }
  cleanupAfterDisconnect();
  syncUiCb?.();
}

export async function emergencyReleaseP2pControl(): Promise<void> {
  try {
    currentStatus = await invoke<P2pStatus>('p2p_emergency_release');
  } catch { }
  updateReturnAndVictimBanners();
  syncUiCb?.();
}

export async function migrateDuckOutToPeer(exitEdge?: 'left' | 'right'): Promise<void> {
  if (
    currentStatus.phase !== 'connected' &&
    currentStatus.phase !== 'winner_control' &&
    currentStatus.phase !== 'victim_controlled'
  ) {
    speak('[CROSS-PC] Hãy kết nối P2P Handshake trước khi cho vịt nhảy sang máy kia!');
    return;
  }
  if (appState.isMigratedOut) return;

  const w = appState.W || window.innerWidth || 1920;
  const h = appState.H || window.innerHeight || 1080;
  const goingRight = exitEdge ? exitEdge === 'right' : appState.posX >= w * 0.5;
  const enterXRatio = goingRight ? 0.06 : 0.94;
  const enterWalkDir = goingRight ? 1 : -1;

  spawnParticles(appState.posX, appState.posY - 80, 18, 0x38bdf8);
  spawnShockwave(appState.posX, appState.posY - 25, 0x38bdf8);
  playWhooshSound(appState.posX);

  appState.isMigratedOut = true;
  appState.avatarGroup.visible = false;
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  edgeMigrationCooldown = 3.0;

  if (currentStatus.is_sim_mode) {
    simReturnTimer = 3.2;
    speak(
      `[SIM CROSS-PC] Vịt của bạn đã nhảy sang màn hình Máy B! Bấm "Gọi Vịt Về" hoặc chờ 3 giây để Máy B sang thăm lại.`
    );
  } else {
    await invoke('p2p_send_packet', {
      packet: {
        kind: 'migrate_enter',
        x_ratio: enterXRatio,
        y_ratio: Math.max(0.2, Math.min(0.95, appState.posY / Math.max(1, h))),
        walk_dir: enterWalkDir,
        peer_name: currentStatus.local_name,
        body_color: appState.duckBodyColor,
        accent_color: appState.duckAccentColor,
      },
    }).catch(() => { });
    speak(`[CROSS-PC] Vịt đã nhảy xuyên mép sang màn hình ${currentStatus.peer_name}!`);
  }

  updateReturnAndVictimBanners();
  syncUiCb?.();
}

export async function recallDuckFromPeer(): Promise<void> {
  if (!appState.isMigratedOut) return;
  const w = appState.W || window.innerWidth || 1920;
  const floorY = getDesktopFloorY(appState.H || window.innerHeight || 1080);

  appState.isMigratedOut = false;
  appState.avatarGroup.visible = true;
  appState.posX = Math.max(120, Math.min(w - 120, appState.posX));
  appState.posY = floorY;
  appState.velX = 0;
  appState.velY = 0;
  appState.setState('WAVING');
  edgeMigrationCooldown = 3.0;

  spawnParticles(appState.posX, appState.posY - 80, 16, 0x34d399);
  spawnShockwave(appState.posX, appState.posY - 25, 0x34d399);
  playDuckQuackSound(appState.posX);

  if (!currentStatus.is_sim_mode) {
    await invoke('p2p_send_packet', {
      packet: { kind: 'migrate_return' },
    }).catch(() => { });
  }
  speak('[CROSS-PC] Quạc! Vịt đã nhảy trở về màn hình của bạn rồi!');
  updateReturnAndVictimBanners();
  syncUiCb?.();
}

function setupLocalPkArena(sendStartPacket: boolean) {
  if (appState.isMigratedOut) {
    appState.isMigratedOut = false;
  }
  appState.avatarGroup.visible = true;

  const w = appState.W || window.innerWidth || 1920;
  const floorY = getDesktopFloorY(appState.H || window.innerHeight || 1080);

  myHp = MAX_HP;
  peerHp = MAX_HP;
  myEnergy = MAX_ENERGY;
  peerEnergy = MAX_ENERGY;
  clearPkFoods();
  pkFoodSpawnTimer = 2.0;
  myShieldTimer = 0;
  peerShieldTimer = 0;
  heroMoveInput = 0;
  heroVelY = 0;
  heroSlideVelX = 0;
  heroSlideTimer = 0;
  heroJetpackActive = false;
  showJetpack(false);
  heroBulletShieldActive = false;
  heroBulletShieldEnergy = 2.4;
  heroBulletShieldCooldown = 0;
  heroDropThroughTimer = 0;
  heroHiddenTimer = 0;
  appState.duckCrouchRoll = false;

  peerJumpOffset = 0;
  peerJumpVel = 0;
  myDodgeTimer = 0;
  peerDodgeTimer = 0;
  myDashCooldown = 0;
  peerHiddenInWindow = false;
  peerBulletShielding = false;
  peerJetpackActive = false;
  peerSlidingActive = false;
  skillCooldowns = { sword: 0, laser: 0, thunder: 0, shield: 0 };
  clearPvpBolts();

  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  appState.posX = Math.max(130, Math.round(w * 0.28));
  appState.posY = floorY;
  appState.velX = 0;
  appState.velY = 0;
  appState.walkDir = 1;
  appState.setState('ALERT');
  setHeroWeapon('sword');

  peerPresentOnMyScreen = true;
  peerX = Math.min(w - 130, Math.round(w * 0.72));
  peerY = floorY;
  peerWalkDir = -1;
  peerAnimState = 'ALERT';
  ensurePeerDuckMesh();
  setPeerWeapon('sword');

  currentStatus.phase = 'pk_duel';
  simAiTimer = 1.1;

  spawnShockwave(appState.posX, floorY - 30, 0xf97316);
  spawnShockwave(peerX, floorY - 30, 0xf43f5e);
  playDuckQuackSound(appState.posX);

  if (currentStatus.is_room_host !== false) {
    lastSentWindowsJson = '';
    void sendHostWindowMapNow(true);
  } else {
    void invoke('p2p_send_packet', { packet: { kind: 'map_request' } }).catch(() => { });
  }

  if (sendStartPacket && !currentStatus.is_sim_mode) {
    void invoke('p2p_send_packet', {
      packet: {
        kind: 'pk_start',
        peer_name: currentStatus.local_name,
        windows_json: currentStatus.is_room_host !== false ? (lastSentWindowsJson || undefined) : undefined,
      },
    }).catch(() => { });
  }

  speak(
    `[PK ARENA] Tran dau P2P BAT DAU! Dung Shift+Len (Ten lua), Shift+Trai/Phai (Truot), Ctrl (Khien chan dan), B (Ho den an cua so) & Chuot de ban ha ${currentStatus.peer_name || 'Doi thu'}!`
  );
  updateP2pFloatingHud();
  updateP2pCombatOverlaysVisibility();
  setP2pModalOpenCb?.(false);
  syncUiCb?.();
}

export function startP2pPkMatch() {
  if (
    currentStatus.phase !== 'connected' &&
    currentStatus.phase !== 'winner_control' &&
    currentStatus.phase !== 'victim_controlled' &&
    currentStatus.phase !== 'pk_duel'
  ) {
    speak('[PK ARENA] Bạn cần kết nối Handshake với máy đối thủ (hoặc bật Giả Lập Máy B) trước khi PK!');
    return;
  }
  fireAnimationTrigger('tool', 'p2p_arena', 'start');
  setupLocalPkArena(true);
}

function finalizePkOutcome(localWon: boolean, notifyPeer: boolean) {
  myEnergy = MAX_ENERGY;
  peerEnergy = MAX_ENERGY;
  clearPkFoods();
  setHeroWeapon('none');
  setPeerWeapon('none');
  clearPvpBolts();
  disposeShieldDomes();
  heroMoveInput = 0;
  heroVelY = 0;
  heroSlideVelX = 0;
  heroSlideTimer = 0;
  heroJetpackActive = false;
  showJetpack(false);
  heroBulletShieldActive = false;
  heroHiddenTimer = 0;
  appState.duckCrouchRoll = false;
  appState.avatarGroup.visible = !appState.isMigratedOut;

  peerJumpOffset = 0;
  peerJumpVel = 0;
  myDodgeTimer = 0;
  peerDodgeTimer = 0;
  peerHiddenInWindow = false;
  peerBulletShielding = false;
  peerJetpackActive = false;
  peerSlidingActive = false;

  if (localWon) {
    currentStatus.phase = 'winner_control';
    currentStatus.winner_remaining_sec = 60;
    currentStatus.victim_remaining_sec = 0;
    lastRenderedFrameSeq = -1;
    lastRemoteFrameAt = 0;
    remoteViewerOpen = true;
    showWinnerVictoryBanner(appState.posX, appState.posY);
    triggerRandomSpecial3DEffect(appState.posX, appState.posY, 'cyber_fireworks');
    playSuccessChimeSound(appState.posX);
    appState.setState('DANCING');
    appState.setExpression('happy', 4.5);
    fireAnimationTrigger('event', 'p2p_victory', 'enter');
    removePeerDuckMesh();

    if (notifyPeer && !currentStatus.is_sim_mode) {
      void invoke('p2p_send_packet', {
        packet: { kind: 'pk_finish', winner_is_sender: true, hp: myHp, peer_hp: peerHp },
      }).catch(() => { });
    }

    speak(
      '[WINNER 60S] CHÚC MỪNG CHIẾN THẮNG! Cửa sổ UltraViewer trực tiếp đã mở — bạn có 60 giây điều khiển chuột & bàn phím máy đối thủ!'
    );
  } else {
    remoteViewerOpen = false;
    stopRemoteFramePolling();
    currentStatus.phase = 'victim_controlled';
    currentStatus.victim_remaining_sec = 60;
    currentStatus.winner_remaining_sec = 0;
    playAlertBeep(appState.posX);
    appState.setState('TIRED');
    appState.setExpression('sad', 5.0);
    spawnParticles(appState.posX, appState.posY - 80, 18, 0xef4444);
    fireAnimationTrigger('event', 'p2p_defeat', 'enter');

    if (notifyPeer && !currentStatus.is_sim_mode) {
      void invoke('p2p_send_packet', {
        packet: { kind: 'pk_finish', winner_is_sender: false, hp: myHp, peer_hp: peerHp },
      }).catch(() => { });
    }

    speak(
      '[THUA TRẬN - 60S] Vịt của bạn đã kiệt sức! Máy thắng có 60 giây xem màn hình & điều khiển chuột/phím từ xa (Bấm Alt+Q để thoát khẩn cấp).'
    );
  }

  void refreshP2pStatus();
  updateReturnAndVictimBanners();
  updateP2pCombatOverlaysVisibility();
  hideP2pFloatingHud();
  if (localWon) {
    updateUltraViewHeaderUi();
    startRemoteFramePolling();
    setP2pModalOpenCb?.(false);
    const vp = document.getElementById('p2p-uv-viewport');
    setTimeout(() => vp?.focus(), 80);
  }
  syncUiCb?.();
}

function applyPvpDamage(targetSide: 'hero' | 'peer', rawDamage: number, pushDir: number, s: number) {
  if (currentStatus.phase !== 'pk_duel' || rawDamage <= 0) return;

  if (targetSide === 'hero') {
    const effective = myShieldTimer > 0 ? Math.max(4, Math.round(rawDamage * 0.45)) : rawDamage;
    myHp = Math.max(0, myHp - effective);
    appState.posX = Math.max(60, Math.min((appState.W || 1920) - 60, appState.posX + pushDir * 24));
    appState.squashX = 1.2;
    appState.squashY = 0.84;
    playWhooshSound(appState.posX);
    spawnFloatingCombatText(appState.posX, appState.posY - 140 * s, `-${effective} HP`, '#f43f5e');
    if (myHp <= 0) {
      finalizePkOutcome(false, true);
      return;
    }
  } else {
    const effective = peerShieldTimer > 0 ? Math.max(4, Math.round(rawDamage * 0.45)) : rawDamage;
    peerHp = Math.max(0, peerHp - effective);
    peerX = Math.max(60, Math.min((appState.W || 1920) - 60, peerX + pushDir * 28));
    playWhooshSound(peerX);
    spawnFloatingCombatText(peerX, peerY - 140 * s, `-${effective} HP`, '#38bdf8');
    if (peerHp <= 0) {
      finalizePkOutcome(true, true);
      return;
    }
  }

  if (currentStatus.is_web_peer) {
    void invoke('p2p_send_packet', {
      packet: {
        kind: 'state_sync',
        hp: myHp,
        peer_hp: peerHp,
        x_ratio: appState.posX / Math.max(1, appState.W || 1920),
        y_ratio: appState.posY / Math.max(1, appState.H || 1080),
      },
    }).catch(() => { });
  }
  updateP2pFloatingHud();
  syncUiCb?.();
}

export function performP2pSkill(
  skill: 'sword' | 'laser' | 'thunder' | 'shield',
  customAimX?: number,
  customAimY?: number
) {
  if (currentStatus.phase !== 'pk_duel') {
    speak('[PK] Hãy bấm "Bắt Đầu PK" trước khi tung chiêu!');
    return;
  }
  if (skillCooldowns[skill] > 0) {
    return;
  }

  const s = appState.modelScale || 1.0;
  if (skill === 'laser') {
    if (myEnergy < SHOOT_ENERGY_COST) {
      playAlertBeep(appState.posX);
      spawnFloatingCombatText(
        appState.posX,
        appState.posY - 145 * s,
        'HET NANG LUONG! (AN DO AN)',
        '#fbbf24'
      );
      return;
    }
    myEnergy = Math.max(0, myEnergy - SHOOT_ENERGY_COST);
  }

  revealFromBlackHoleIfHidden(true);

  const wScreen = Math.max(1, appState.W || window.innerWidth || 1920);
  const hScreen = Math.max(1, appState.H || window.innerHeight || 1080);
  const targetAimX =
    typeof customAimX === 'number' ? customAimX : appState.globalCursorX || peerX;
  const targetAimY =
    typeof customAimY === 'number' ? customAimY : appState.globalCursorY || peerY - 72 * s;
  const dir =
    skill === 'laser'
      ? targetAimX >= appState.posX
        ? 1
        : -1
      : peerX >= appState.posX
        ? 1
        : -1;
  appState.walkDir = dir;
  let immediateDamage = 0;

  if (skill === 'sword') {
    skillCooldowns.sword = 0.62;
    setHeroWeapon('sword');
    heroAttackAnimTimer = 0.45;
    appState.posX += (peerX - appState.posX) * 0.36;
    const rawDmg = 22 + Math.floor(Math.random() * 5);
    playWhooshSound(appState.posX);
    if (
      peerHiddenInWindow ||
      peerDodgeTimer > 0 ||
      Math.abs((peerY - peerJumpOffset) - appState.posY) > 78 * s ||
      Math.abs(peerX - appState.posX) > 215 * s
    ) {
      spawnFloatingCombatText(peerX, peerY - 145 * s, 'NE KIEM!', '#fde047');
    } else {
      immediateDamage = rawDmg;
      spawnParticles(peerX, peerY - 65 * s, 14, 0x38bdf8);
      spawnShockwave(peerX, peerY - 40 * s, 0x22d3ee);
    }
  } else if (skill === 'laser') {
    skillCooldowns.laser = 0.38;
    setHeroWeapon('gun');
    heroAttackAnimTimer = 0.3;
    const rawDmg = 9 + Math.floor(Math.random() * 3);
    playWhooshSound(appState.posX);
    const muzzleX = appState.posX + dir * 24 * s;
    const muzzleY = appState.posY - 76 * s;
    spawnPvpLaser(muzzleX, muzzleY, targetAimX, targetAimY, 'peer', 0x22d3ee, rawDmg);
  } else if (skill === 'thunder') {
    skillCooldowns.thunder = 2.1;
    const rawDmg = 25 + Math.floor(Math.random() * 5);
    appState.squashY = 1.24;
    playAlertBeep(peerX);
    spawnThunderStrike('peer', peerX, peerY || hScreen - 48, 0xfacc15, rawDmg);
  } else if (skill === 'shield') {
    skillCooldowns.shield = 3.2;
    myShieldTimer = 2.6;
    myHp = Math.min(MAX_HP, myHp + 14);
    playSuccessChimeSound(appState.posX);
    spawnShockwave(appState.posX, appState.posY - 50 * s, 0x34d399);
    spawnParticles(appState.posX, appState.posY - 90 * s, 12, 0x34d399);
    spawnFloatingCombatText(appState.posX, appState.posY - 150 * s, '+14 HP', '#34d399');
  }

  if (immediateDamage > 0) {
    applyPvpDamage('peer', immediateDamage, dir, s);
  }

  if (!currentStatus.is_sim_mode && currentStatus.phase === 'pk_duel') {
    void invoke('p2p_send_packet', {
      packet: {
        kind: 'pk_attack',
        skill,
        damage: skill === 'laser' ? 10 : skill === 'thunder' ? 26 : immediateDamage,
        hp: myHp,
        peer_hp: peerHp,
        x_ratio: appState.posX / wScreen,
        y_ratio: appState.posY / hScreen,
        aim_x: targetAimX / wScreen,
        aim_y: targetAimY / hScreen,
      },
    }).catch(() => { });
  }

  updateP2pFloatingHud();
  syncUiCb?.();
}

function handleIncomingPkAttack(pkt: P2pWirePacket) {
  if (currentStatus.phase !== 'pk_duel') return;
  const skill = pkt.skill || 'sword';
  const rawDmg = pkt.damage ?? 22;
  const wScreen = appState.W || window.innerWidth || 1920;
  const hScreen = appState.H || window.innerHeight || 1080;
  const s = appState.modelScale || 1.0;
  const dir = appState.posX >= peerX ? 1 : -1;
  peerWalkDir = dir;
  peerAttackAnimTimer = 0.45;
  peerHiddenInWindow = false;

  if (skill === 'shield') {
    peerShieldTimer = 2.6;
    peerHp = Math.min(MAX_HP, peerHp + 14);
    spawnShockwave(peerX, peerY - 50 * s, 0xf43f5e);
    spawnFloatingCombatText(peerX, peerY - 150 * s, '+14 HP', '#fda4af');
    updateP2pFloatingHud();
    syncUiCb?.();
    return;
  }

  if (skill === 'laser') {
    setPeerWeapon('gun');
    const aimX = typeof pkt.aim_x === 'number' ? pkt.aim_x * wScreen : appState.posX;
    const aimY = typeof pkt.aim_y === 'number' ? pkt.aim_y * hScreen : appState.posY - 72 * s;
    const laserDmg = Math.min(12, Math.max(7, rawDmg));
    spawnPvpLaser(
      peerX + dir * 24 * s,
      peerY - 78 * s,
      aimX,
      aimY,
      'hero',
      0xf43f5e,
      laserDmg
    );
    return;
  }

  if (skill === 'thunder') {
    spawnThunderStrike('hero', appState.posX, appState.posY, 0xf43f5e, rawDmg);
    return;
  }

  // Sword melee with jump / window height / dash / stealth dodge check
  setPeerWeapon('sword');
  peerX += (appState.posX - peerX) * 0.34;
  if (
    heroHiddenTimer > 0 ||
    myDodgeTimer > 0 ||
    Math.abs(appState.posY - peerY) > 78 * s ||
    Math.abs(appState.posX - peerX) > 215 * s
  ) {
    playWhooshSound(appState.posX);
    spawnFloatingCombatText(appState.posX, appState.posY - 150 * s, 'NE KIEM!', '#fde047');
    return;
  }
  spawnParticles(appState.posX, appState.posY - 70 * s, 14, 0xf43f5e);
  spawnShockwave(appState.posX, appState.posY - 40 * s, 0xf43f5e);
  applyPvpDamage('hero', rawDmg, dir, s);
}

export async function sendWinnerRemoteCmd(
  cmdType: string,
  opts: {
    xNorm?: number;
    yNorm?: number;
    button?: 'left' | 'right' | 'middle' | 'sim_preview';
    vk?: number;
    wheelDelta?: number;
    text?: string;
    durationSec?: number;
    silent?: boolean;
  } = {}
): Promise<string> {
  if (cmdType === 'mouse_move') {
    const now = performance.now();
    if (now - lastMouseStreamSent < 36) return '';
    lastMouseStreamSent = now;
  }
  const quietCmd =
    Boolean(opts.silent) ||
    cmdType === 'mouse_move' ||
    cmdType === 'mouse_down' ||
    cmdType === 'mouse_up' ||
    cmdType === 'mouse_click' ||
    cmdType === 'mouse_dblclick' ||
    cmdType === 'mouse_wheel' ||
    cmdType === 'key_down' ||
    cmdType === 'key_up' ||
    cmdType === 'key_press' ||
    cmdType === 'hotkey';
  try {
    const res = await invoke<string>('p2p_send_remote_command', {
      cmdType,
      xNorm: opts.xNorm ?? null,
      yNorm: opts.yNorm ?? null,
      button: opts.button ?? null,
      vk: opts.vk ?? null,
      wheelDelta: opts.wheelDelta ?? null,
      text: opts.text ?? null,
      durationSec: opts.durationSec ?? null,
    });
    if (!quietCmd && res) {
      speak(`[REMOTE 60S] ${res}`);
    }
    return res;
  } catch (err) {
    if (!quietCmd) {
      speak(`[REMOTE] ${String(err)}`);
    }
    await refreshP2pStatus();
    return String(err);
  }
}

export function updateP2pArena(delta: number, elapsed: number) {
  const hasAnyP2pWork =
    isP2pSessionActive() ||
    peerPresentOnMyScreen ||
    pvpBolts.length > 0 ||
    pkFoods.length > 0 ||
    pendingThunders.length > 0 ||
    edgeMigrationCooldown > 0 ||
    myShieldTimer > 0 ||
    peerShieldTimer > 0 ||
    myDodgeTimer > 0 ||
    peerDodgeTimer > 0 ||
    myDashCooldown > 0 ||
    heroDropThroughTimer > 0 ||
    heroAttackAnimTimer > 0 ||
    peerAttackAnimTimer > 0 ||
    heroHiddenTimer > 0 ||
    heroSlideTimer > 0 ||
    heroBulletShieldActive ||
    heroBulletShieldCooldown > 0;

  if (!hasAnyP2pWork) {
    if (!p2pIdleOverlaysCleaned) {
      updateP2pCombatOverlaysVisibility();
      updateP2pFloatingHud();
      p2pIdleOverlaysCleaned = true;
    }
    return;
  }
  p2pIdleOverlaysCleaned = false;

  if (edgeMigrationCooldown > 0) edgeMigrationCooldown = Math.max(0, edgeMigrationCooldown - delta);
  if (myShieldTimer > 0) myShieldTimer = Math.max(0, myShieldTimer - delta);
  if (peerShieldTimer > 0) peerShieldTimer = Math.max(0, peerShieldTimer - delta);
  if (myDodgeTimer > 0) myDodgeTimer = Math.max(0, myDodgeTimer - delta);
  if (peerDodgeTimer > 0) peerDodgeTimer = Math.max(0, peerDodgeTimer - delta);
  if (myDashCooldown > 0) myDashCooldown = Math.max(0, myDashCooldown - delta);
  if (heroDropThroughTimer > 0) heroDropThroughTimer = Math.max(0, heroDropThroughTimer - delta);
  if (heroAttackAnimTimer > 0) heroAttackAnimTimer = Math.max(0, heroAttackAnimTimer - delta);
  if (peerAttackAnimTimer > 0) peerAttackAnimTimer = Math.max(0, peerAttackAnimTimer - delta);

  for (const k of Object.keys(skillCooldowns)) {
    if (skillCooldowns[k] > 0) {
      skillCooldowns[k] = Math.max(0, skillCooldowns[k] - delta);
    }
  }

  const wScreen = appState.W || window.innerWidth || 1920;
  const hScreen = appState.H || window.innerHeight || 1080;
  const floorY = getDesktopFloorY(hScreen);
  const s = appState.modelScale || 1.0;

  // Bullet Shield energy drain & recharge
  if (heroBulletShieldActive) {
    heroBulletShieldEnergy -= delta;
    if (heroBulletShieldEnergy <= 0) {
      heroBulletShieldEnergy = 0;
      heroBulletShieldActive = false;
      heroBulletShieldCooldown = 2.0;
      spawnFloatingCombatText(
        appState.posX,
        appState.posY - 140 * s,
        'HET NANG LUONG KHIEN!',
        '#94a3b8'
      );
    }
  } else {
    if (heroBulletShieldCooldown > 0) {
      heroBulletShieldCooldown = Math.max(0, heroBulletShieldCooldown - delta);
    }
    heroBulletShieldEnergy = Math.min(2.4, heroBulletShieldEnergy + delta * 0.75);
  }

  // Black hole window stealth countdown
  if (heroHiddenTimer > 0) {
    heroHiddenTimer = Math.max(0, heroHiddenTimer - delta);
    if (heroHiddenTimer <= 0) {
      revealFromBlackHoleIfHidden(true);
    }
  }

  // Slide velocity burst & drift smoke
  if (heroSlideTimer > 0) {
    heroSlideTimer = Math.max(0, heroSlideTimer - delta);
    appState.posX = Math.max(52, Math.min(wScreen - 52, appState.posX + heroSlideVelX * delta));
    slideFxAccum += delta;
    if (slideFxAccum >= 0.08) {
      slideFxAccum = 0;
      spawnDriftSmoke(
        appState.posX,
        appState.posY - 6,
        -(Math.sign(heroSlideVelX || appState.walkDir) || 1)
      );
    }
    if (heroSlideTimer <= 0) {
      heroSlideVelX = 0;
      appState.duckCrouchRoll = false;
    }
  }

  // P2P-only movement + rocket jetpack + Host Window landing physics
  if (
    isP2pCombatControlsActive() &&
    !appState.isMigratedOut &&
    appState.state !== 'DRAGGING' &&
    heroHiddenTimer <= 0
  ) {
    if (heroMoveInput !== 0) {
      appState.walkDir = heroMoveInput > 0 ? 1 : -1;
      appState.posX = Math.max(
        52,
        Math.min(wScreen - 52, appState.posX + heroMoveInput * 365 * delta)
      );
    }

    const prevY = appState.posY;
    if (heroJetpackActive) {
      heroVelY = Math.max(-520 * Math.max(0.85, s), heroVelY - 2100 * delta);
      jetpackFxAccum += delta;
      if (jetpackFxAccum >= 0.06) {
        jetpackFxAccum = 0;
        spawnParticles(appState.posX - appState.walkDir * 14, appState.posY - 26 * s, 2, 0xf97316);
      }
    } else {
      heroVelY += 1450 * delta;
    }

    appState.posY += heroVelY * delta;
    if (appState.posY < 90) {
      appState.posY = 90;
      if (heroVelY < 0) heroVelY = 0;
    }

    let landedPlatform = false;
    if (heroVelY >= 0 && heroDropThroughTimer <= 0) {
      const platforms = getActiveP2pPlatforms();
      for (const win of platforms) {
        if (
          appState.posX >= win.x + 10 &&
          appState.posX <= win.x + win.w - 10 &&
          prevY <= win.y + 14 &&
          appState.posY >= win.y
        ) {
          appState.posY = win.y;
          heroVelY = 0;
          landedPlatform = true;
          break;
        }
      }
    }

    if (!landedPlatform && appState.posY >= floorY) {
      appState.posY = floorY;
      heroVelY = 0;
      landedPlatform = true;
    }

    if (!landedPlatform || heroJetpackActive) {
      appState.setState('JUMPING');
    } else if (heroMoveInput !== 0 || heroSlideTimer > 0) {
      appState.setState('WALKING');
    } else if (appState.state === 'JUMPING' || appState.state === 'WALKING') {
      appState.setState('IDLE');
    }
  }

  // Peer jump physics (Sim AI / Mobile)
  if (peerJumpOffset > 0 || peerJumpVel !== 0) {
    peerJumpOffset += peerJumpVel * delta;
    peerJumpVel -= 1350 * delta;
    if (peerJumpOffset <= 0) {
      peerJumpOffset = 0;
      peerJumpVel = 0;
    }
  }

  // Countdown tick for 60s winner/victim control
  if (currentStatus.phase === 'winner_control' || currentStatus.phase === 'victim_controlled') {
    statusCountdownTimer += delta;
    if (statusCountdownTimer >= 1.0) {
      statusCountdownTimer = 0;
      void refreshP2pStatus();
    }
  } else {
    statusCountdownTimer = 0;
  }

  // Sync 3D Energy Bullet Shield Domes
  if (heroBulletShieldActive && !appState.isMigratedOut && heroHiddenTimer <= 0 && isP2pCombatControlsActive()) {
    if (!heroShieldDomeMesh) {
      heroShieldDomeMesh = createShieldDomeGroup(0x22d3ee);
      scene.add(heroShieldDomeMesh);
    }
    heroShieldDomeMesh.visible = true;
    heroShieldDomeMesh.scale.setScalar(s);
    heroShieldDomeMesh.position.set(appState.posX, -(appState.posY - 72 * s), 16);
    heroShieldDomeMesh.rotation.y += delta * 2.2;
  } else if (heroShieldDomeMesh) {
    heroShieldDomeMesh.visible = false;
  }

  if (peerPresentOnMyScreen && peerBulletShielding && !peerHiddenInWindow && isP2pCombatControlsActive()) {
    if (!peerShieldDomeMesh) {
      peerShieldDomeMesh = createShieldDomeGroup(0xf43f5e);
      scene.add(peerShieldDomeMesh);
    }
    peerShieldDomeMesh.visible = true;
    peerShieldDomeMesh.scale.setScalar(s);
    peerShieldDomeMesh.position.set(peerX, -(peerY - peerJumpOffset - 72 * s), 16);
    peerShieldDomeMesh.rotation.y -= delta * 2.2;
  } else if (peerShieldDomeMesh) {
    peerShieldDomeMesh.visible = false;
  }

  // Update 2D directional laser bolts with Shield Block, Black Hole Stealth & Dodge check
  for (let i = pvpBolts.length - 1; i >= 0; i--) {
    const b = pvpBolts[i];
    b.life += delta;
    b.x += b.vx * delta;
    b.y += b.vy * delta;
    b.mesh.position.set(b.x, -b.y, 18);

    const tx = b.targetSide === 'peer' ? peerX : appState.posX;
    const ty = (b.targetSide === 'peer' ? peerY - peerJumpOffset : appState.posY) - 70 * s;
    const targetHidden = b.targetSide === 'peer' ? peerHiddenInWindow : heroHiddenTimer > 0;
    const targetBulletShield =
      b.targetSide === 'peer' ? peerBulletShielding : heroBulletShieldActive;
    const dodgeTimer = b.targetSide === 'peer' ? peerDodgeTimer : myDodgeTimer;

    if (!b.resolved && !targetHidden && Math.hypot(b.x - tx, b.y - ty) <= 44 * s) {
      b.resolved = true;
      if (targetBulletShield) {
        spawnParticles(tx, ty, 12, 0x22d3ee);
        spawnShockwave(tx, ty, 0x22d3ee);
        playWhooshSound(tx);
        spawnFloatingCombatText(tx, ty - 52 * s, 'CHAN DAN!', '#22d3ee');
      } else if (dodgeTimer > 0) {
        spawnFloatingCombatText(tx, ty - 45 * s, 'NE DAN!', '#fde047');
      } else {
        const pushDir = b.vx >= 0 ? 1 : -1;
        spawnParticles(tx, ty, 14, b.color);
        spawnShockwave(tx, ty, b.color);
        applyPvpDamage(b.targetSide, b.damage, pushDir, s);
      }
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
      pvpBolts.splice(i, 1);
      continue;
    }

    if (b.life > 1.85 || b.x < -80 || b.x > wScreen + 80 || b.y < -80 || b.y > hScreen + 80) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
      pvpBolts.splice(i, 1);
    }
  }

  // Update delayed Thunder Strikes with height, stealth & dodge check
  for (let i = pendingThunders.length - 1; i >= 0; i--) {
    const th = pendingThunders[i];
    th.timer -= delta;
    const pulse = 1.0 + Math.sin(elapsed * 26) * 0.16;
    th.marker.scale.setScalar(pulse);
    if (th.timer <= 0) {
      const tx = th.targetSide === 'peer' ? peerX : appState.posX;
      const ty = (th.targetSide === 'peer' ? peerY - peerJumpOffset : appState.posY) - 70 * s;
      const targetHidden = th.targetSide === 'peer' ? peerHiddenInWindow : heroHiddenTimer > 0;
      const dodgeTimer = th.targetSide === 'peer' ? peerDodgeTimer : myDodgeTimer;
      spawnParticles(th.lockedX, th.floorY - 90 * s, 22, th.color);
      spawnShockwave(th.lockedX, th.floorY - 15 * s, th.color);
      playAlertBeep(th.lockedX);

      if (
        targetHidden ||
        Math.abs(tx - th.lockedX) > 78 * s ||
        Math.abs(ty - (th.floorY - 70 * s)) > 95 * s ||
        dodgeTimer > 0
      ) {
        spawnFloatingCombatText(tx, ty - 45 * s, 'NE SAM SET!', '#fde047');
      } else {
        const pushDir = tx >= th.lockedX ? 1 : -1;
        applyPvpDamage(th.targetSide, th.damage, pushDir, s);
      }

      scene.remove(th.marker);
      th.marker.geometry.dispose();
      (th.marker.material as THREE.Material).dispose();
      pendingThunders.splice(i, 1);
    }
  }

  // Hero weapon swing animation
  if (heroPvpSwordGroup) {
    heroPvpSwordGroup.rotation.z =
      heroAttackAnimTimer > 0 ? 0.8 + Math.sin(elapsed * 26) * 1.15 : -0.35 + Math.sin(elapsed * 5) * 0.1;
  }
  if (heroPvpGunGroup) {
    heroPvpGunGroup.rotation.x =
      heroAttackAnimTimer > 0 ? -0.3 - Math.abs(Math.sin(elapsed * 18)) * 0.25 : 0;
  }

  // P2P Energy Drain (Rocket) / Passive Regen + Collectible Energy Food Pickups
  if (currentStatus.phase === 'pk_duel') {
    if (heroJetpackActive) {
      myEnergy = Math.max(0, myEnergy - ROCKET_DRAIN_PER_SEC * delta);
      if (myEnergy <= 0) {
        heroJetpackActive = false;
        showJetpack(false);
        spawnFloatingCombatText(appState.posX, appState.posY - 145 * s, 'HET NANG LUONG!', '#fbbf24');
      }
    } else if (heroSlideTimer <= 0) {
      myEnergy = Math.min(MAX_ENERGY, myEnergy + PASSIVE_ENERGY_REGEN * delta);
    }

    if (currentStatus.is_room_host !== false || currentStatus.is_sim_mode || currentStatus.is_web_peer) {
      pkFoodSpawnTimer -= delta;
      if (pkFoodSpawnTimer <= 0 && pkFoods.length < 3) {
        pkFoodSpawnTimer = 5.0 + Math.random() * 2.2;
        spawnOnePkFood();
      }
    }

    for (let i = pkFoods.length - 1; i >= 0; i--) {
      const f = pkFoods[i];
      const fx = f.xRatio * wScreen;
      const fy = f.yRatio * hScreen;
      const bob = Math.sin(elapsed * 3.8 + f.bobPhase) * 5 * s;
      f.mesh.scale.setScalar(s);
      f.mesh.position.set(fx, -(fy - 18 * s + bob), 20 * s);
      f.mesh.rotation.y += delta * 2.4;

      if (!appState.isMigratedOut && heroHiddenTimer <= 0 && Math.hypot(appState.posX - fx, appState.posY - fy) <= 58 * s) {
        myEnergy = Math.min(MAX_ENERGY, myEnergy + FOOD_ENERGY_RESTORE);
        playSuccessChimeSound(fx);
        spawnParticles(fx, fy - 18 * s, 14, 0xfde047);
        spawnShockwave(fx, fy - 12 * s, 0x34d399);
        spawnFloatingCombatText(fx, fy - 75 * s, `+${FOOD_ENERGY_RESTORE} NANG LUONG!`, '#fde047');
        const pickedId = f.id;
        disposeThreeGroup(f.mesh);
        pkFoods.splice(i, 1);
        if (!currentStatus.is_sim_mode) {
          void invoke('p2p_send_packet', {
            packet: { kind: 'pk_food_pickup', food_id: pickedId },
          }).catch(() => { });
          if (currentStatus.is_room_host !== false) {
            void broadcastPkFoods();
          }
        }
      }
    }
  }

  // Sim Mode behaviors for 1-PC testing
  if (currentStatus.is_sim_mode) {
    if (simReturnTimer > 0) {
      simReturnTimer -= delta;
      if (simReturnTimer <= 0 && !peerPresentOnMyScreen) {
        peerPresentOnMyScreen = true;
        peerX = 80;
        peerY = floorY;
        peerWalkDir = 1;
        peerAnimState = 'WALKING';
        ensurePeerDuckMesh();
        playDuckQuackSound(peerX);
      }
    }

    if (currentStatus.phase === 'pk_duel') {
      peerEnergy = Math.min(MAX_ENERGY, peerEnergy + PASSIVE_ENERGY_REGEN * delta);
      simAiTimer -= delta;
      let desiredX = Math.min(wScreen - 110, Math.max(appState.posX + 170, wScreen * 0.65));
      if (peerEnergy < 45 && pkFoods.length > 0) {
        desiredX = pkFoods[0].xRatio * wScreen;
      }
      peerX += (desiredX - peerX) * Math.min(1, delta * 2.2);
      peerWalkDir = appState.posX >= peerX ? 1 : -1;
      for (let i = pkFoods.length - 1; i >= 0; i--) {
        const f = pkFoods[i];
        if (Math.hypot(peerX - f.xRatio * wScreen, (peerY - peerJumpOffset) - f.yRatio * hScreen) <= 56 * s) {
          removePkFoodById(f.id, true);
          break;
        }
      }
      if (peerJumpOffset <= 1 && Math.random() < delta * 0.45) {
        peerJumpVel = 500;
      }
      if (simAiTimer <= 0) {
        simAiTimer = 1.45 + Math.random() * 0.75;
        const canShoot = peerEnergy >= SHOOT_ENERGY_COST;
        const skills: Array<'sword' | 'laser' | 'thunder' | 'shield'> = [
          'sword',
          ...(canShoot ? (['laser'] as const) : []),
          'sword',
          'thunder',
          ...(peerHp < 55 ? (['shield'] as const) : []),
        ];
        const chosen = skills[Math.floor(Math.random() * skills.length)];
        if (chosen === 'laser') {
          peerEnergy = Math.max(0, peerEnergy - SHOOT_ENERGY_COST);
        }
        handleIncomingPkAttack({
          kind: 'pk_attack',
          skill: chosen,
          damage: chosen === 'laser' ? 10 : chosen === 'thunder' ? 18 : 16,
          aim_x: appState.posX / Math.max(1, wScreen),
          aim_y: (appState.posY - 72 * s) / Math.max(1, hScreen),
        });
      }
    }
  }

  // Animate Peer 3D Duck on local screen
  if (peerPresentOnMyScreen && peerDuckGroup) {
    if (currentStatus.phase === 'connected' && currentStatus.is_sim_mode) {
      peerX += peerWalkDir * 115 * delta;
      if (peerX < 70) peerWalkDir = 1;
      if (peerX > wScreen - 70) peerWalkDir = -1;
    }

    peerDuckGroup.visible = !peerHiddenInWindow;
    peerDuckGroup.scale.setScalar(s);
    peerDuckGroup.position.set(peerX, -(peerY - peerJumpOffset), 10);
    peerDuckGroup.rotation.y = peerWalkDir * 0.65;
    peerDuckGroup.rotation.z = peerSlidingActive ? -peerWalkDir * 0.35 : 0;

    if (!peerHiddenInWindow && peerJetpackActive && Math.random() < delta * 22) {
      spawnParticles(peerX - peerWalkDir * 14, peerY - peerJumpOffset - 26 * s, 1, 0xf97316);
    }

    const legL = peerDuckGroup.getObjectByName('legL');
    const legR = peerDuckGroup.getObjectByName('legR');
    const stride =
      peerAnimState === 'WALKING' || Math.abs(peerAttackAnimTimer) > 0
        ? Math.sin(elapsed * 14) * 0.5
        : Math.sin(elapsed * 3) * 0.08;
    if (legL) legL.rotation.x = stride;
    if (legR) legR.rotation.x = -stride;

    if (peerSwordGroup) {
      peerSwordGroup.rotation.z =
        peerAttackAnimTimer > 0 ? 0.8 + Math.sin(elapsed * 26) * 1.15 : -0.35 + Math.sin(elapsed * 5) * 0.1;
    }
    if (peerGunGroup) {
      peerGunGroup.rotation.x = peerAttackAnimTimer > 0 ? -0.3 : 0;
    }
  }

  // Periodically sync Room Host's open desktop windows for Guest PC & Mobile Web
  if (isP2pCombatControlsActive() && currentStatus.is_room_host !== false) {
    hostMapSyncAccum += delta;
    if (hostMapSyncAccum >= 0.85) {
      hostMapSyncAccum = 0;
      void sendHostWindowMapNow(false);
    }
  } else {
    hostMapSyncAccum = 0;
  }

  // Stream live state to real peer when connected / PK
  if (
    !currentStatus.is_sim_mode &&
    (currentStatus.phase === 'connected' || currentStatus.phase === 'pk_duel') &&
    !appState.isMigratedOut
  ) {
    stateSyncAccum += delta;
    if (stateSyncAccum >= 0.065) {
      stateSyncAccum = 0;
      const w = Math.max(1, appState.W || 1920);
      const h = Math.max(1, appState.H || 1080);
      void invoke('p2p_send_packet', {
        packet: {
          kind: 'state_sync',
          x_ratio: appState.posX / w,
          y_ratio: appState.posY / h,
          walk_dir: appState.walkDir,
          char_state: heroSlideTimer > 0 ? 'DASH' : appState.state,
          weapon: heroWeapon,
          hp: myHp,
          peer_hp: peerHp,
          max_hp: MAX_HP,
          energy: Math.round(myEnergy),
          peer_energy: Math.round(peerEnergy),
          is_hidden: heroHiddenTimer > 0,
          is_shielding: heroBulletShieldActive,
          is_jetpack: heroJetpackActive,
          is_sliding: heroSlideTimer > 0,
          windows_json: currentStatus.is_room_host !== false ? (lastSentWindowsJson || undefined) : undefined,
        },
      }).catch(() => { });
    }
  }

  // Auto Cross-Screen Edge Migration when connected (touching left/right screen edge while walking)
  if (
    crossScreenAutoMigrate &&
    edgeMigrationCooldown <= 0 &&
    currentStatus.phase === 'connected' &&
    !appState.isMigratedOut &&
    !appState.isEdgePeekMode &&
    appState.state === 'WALKING'
  ) {
    const w = appState.W || 1920;
    if (appState.posX <= 52) {
      void migrateDuckOutToPeer('left');
    } else if (appState.posX >= w - 52) {
      void migrateDuckOutToPeer('right');
    }
  }

  updateP2pCombatOverlaysVisibility();
  updateP2pFloatingHud();
}
