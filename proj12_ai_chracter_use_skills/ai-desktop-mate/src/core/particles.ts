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
let weatherFollowX = 0;
let weatherFollowY = 0;
let weatherVelX = 0;
let weatherVelY = 0;
let weatherFollowInit = false;
let weatherRefs: {
  skyAnchor: THREE.Object3D | null;
  cloud: THREE.Object3D | null;
  sunRays: THREE.Object3D | null;
  lightning: THREE.Object3D | null;
  snowman: THREE.Object3D | null;
  vortex: THREE.Object3D | null;
  stars: THREE.Object3D | null;
  rainDrops: THREE.Object3D | null;
} | null = null;

interface TarotCard3DItem {
  group: THREE.Group;
  slot: number; // -1, 0, 1
  textures: THREE.CanvasTexture[];
}

interface Tarot3DFlipState {
  root: THREE.Group;
  cards: TarotCard3DItem[];
  elapsed: number;
  duration: number;
  flippedTriggered: boolean;
  fortuneColor: number;
  isReversed: boolean;
}

let tarot3DFlipState: Tarot3DFlipState | null = null;

function disposeTarot3DFlipEffect() {
  if (!tarot3DFlipState) return;
  scene.remove(tarot3DFlipState.root);
  for (const c of tarot3DFlipState.cards) {
    for (const tex of c.textures) tex.dispose();
  }
  tarot3DFlipState.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  tarot3DFlipState = null;
}

function createTarotBackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 384);
  grad.addColorStop(0, '#1e1b4b');
  grad.addColorStop(0.5, '#312e81');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 232, 360);
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 212, 340);

  ctx.save();
  ctx.translate(128, 192);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? 48 : 22;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DUCK TAROT', 128, 56);
  ctx.fillText('ARCANA', 128, 342);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTarotFrontTexture(
  cardNameVi: string,
  cardNameEn: string,
  fortuneCode: string,
  fortuneLabel: string,
  isReversed: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  const palette: Record<string, { bg1: string; bg2: string; accent: string }> = {
    dai_cat: { bg1: '#422006', bg2: '#713f12', accent: '#facc15' },
    tieu_cat: { bg1: '#064e3b', bg2: '#0f766e', accent: '#34d399' },
    binh_hoa: { bg1: '#0c4a6e', bg2: '#1e3a8a', accent: '#38bdf8' },
    tieu_hung: { bg1: '#431407', bg2: '#7c2d12', accent: '#fb923c' },
    dai_hung: { bg1: '#450a0a', bg2: '#7f1d1d', accent: '#f87171' },
  };
  const pal = palette[fortuneCode] || palette.binh_hoa;

  const grad = ctx.createLinearGradient(0, 0, 256, 384);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 7;
  ctx.strokeRect(12, 12, 232, 360);

  ctx.fillStyle = pal.accent;
  ctx.fillRect(32, 30, 192, 38);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 21px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(fortuneLabel, 128, 56);

  // Biểu tượng trung tâm (xoay ngược 180 độ nếu Ngược Chiều)
  ctx.save();
  ctx.translate(128, 166);
  if (isReversed) ctx.rotate(Math.PI);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(34, 24);
  ctx.lineTo(-34, 24);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px sans-serif';
  const titleLines = cardNameVi.length > 22 ? [cardNameVi.slice(0, 20), cardNameVi.slice(20)] : [cardNameVi];
  titleLines.forEach((line, idx) => {
    ctx.fillText(line.trim(), 128, 256 + idx * 24);
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px sans-serif';
  ctx.fillText(cardNameEn.slice(0, 24), 128, 314);

  ctx.fillStyle = pal.accent;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(isReversed ? '[NGUOC CHIEU]' : '[THUAN CHIEU]', 128, 348);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function triggerDuckTarot3DFlipEffect(
  cardNameVi: string,
  cardNameEn: string,
  fortuneCode: string,
  fortuneLabel: string,
  isReversed: boolean
) {
  disposeTarot3DFlipEffect();

  const colorMap: Record<string, number> = {
    dai_cat: 0xfacc15,
    tieu_cat: 0x34d399,
    binh_hoa: 0x38bdf8,
    tieu_hung: 0xfb923c,
    dai_hung: 0xf87171,
  };
  const fortuneColor = colorMap[fortuneCode] || 0xa78bfa;

  const root = new THREE.Group();
  const cards: TarotCard3DItem[] = [];
  const geo = new THREE.PlaneGeometry(52, 78);
  const frameGeo = new THREE.BoxGeometry(54, 80, 2.2);

  for (const slot of [-1, 0, 1]) {
    const g = new THREE.Group();
    const backTex = createTarotBackTexture();
    const textures: THREE.CanvasTexture[] = [backTex];

    const backMat = new THREE.MeshBasicMaterial({ map: backTex, side: THREE.FrontSide });
    const backPlane = new THREE.Mesh(geo.clone(), backMat);
    backPlane.position.z = 1.25;
    g.add(backPlane);

    const trimMat = new THREE.MeshStandardMaterial({
      color: slot === 0 ? fortuneColor : 0x6366f1,
      roughness: 0.35,
      metalness: 0.6,
    });
    const frameMesh = new THREE.Mesh(frameGeo.clone(), trimMat);
    g.add(frameMesh);

    if (slot === 0) {
      const frontTex = createTarotFrontTexture(
        cardNameVi,
        cardNameEn,
        fortuneCode,
        fortuneLabel,
        isReversed
      );
      textures.push(frontTex);
      const frontMat = new THREE.MeshBasicMaterial({ map: frontTex, side: THREE.FrontSide });
      const frontPlane = new THREE.Mesh(geo.clone(), frontMat);
      frontPlane.rotation.y = Math.PI;
      frontPlane.position.z = -1.25;
      g.add(frontPlane);
    } else {
      const rearPlane = new THREE.Mesh(
        geo.clone(),
        new THREE.MeshBasicMaterial({ map: backTex, side: THREE.FrontSide })
      );
      rearPlane.rotation.y = Math.PI;
      rearPlane.position.z = -1.25;
      g.add(rearPlane);
    }

    g.position.set(slot * 64, Math.abs(slot) * -8, -Math.abs(slot) * 10);
    g.rotation.z = -slot * 0.16;
    root.add(g);
    cards.push({ group: g, slot, textures });
  }

  geo.dispose();
  frameGeo.dispose();

  const s = appState.modelScale || 1.0;
  root.scale.setScalar(s);
  root.position.set(appState.posX, -appState.posY + 190 * s, 28 * s);
  scene.add(root);

  spawnShockwave(appState.posX, appState.posY - 110 * s, 0xa78bfa);
  spawnParticles(appState.posX, appState.posY - 140 * s, 18, fortuneColor);

  tarot3DFlipState = {
    root,
    cards,
    elapsed: 0,
    duration: 5.8,
    flippedTriggered: false,
    fortuneColor,
    isReversed,
  };
}

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
  weatherRefs = null;
  builtWeatherPropMode = '';
}

function resolveWeatherVisualKey(): string {
  const mode = appState.weatherMode || 'clear';
  const desc = (appState.weatherDesc || '').toLowerCase();
  const hour = new Date().getHours();
  const isNight = mode === 'night' || hour >= 18 || hour < 6;
  const isWarmSun = (hour >= 5 && hour < 7) || (hour >= 16 && hour < 18);
  const timeTag = isNight ? 'night' : isWarmSun ? 'dusk' : 'day';

  const hasStorm = /dông|sấm|sét|bão|thunder|storm|squall/i.test(desc);
  const hasRain = mode === 'rain' || /mưa|rain|drizzle|shower/i.test(desc);
  const hasOvercast = /nhiều mây|u ám|âm u|sương mù|overcast|cloudy|fog|mist|haze/i.test(desc);
  const hasPartlyCloud = /ít mây|có mây|rải rác|partly|few clouds|scattered/i.test(desc);
  const hasClearSun = /quang|nắng|trong xanh|clear|sunny/i.test(desc);

  if (mode === 'cold') return `cold_${timeTag}`;
  if (mode === 'wind') return `wind_${timeTag}`;
  if (hasRain) {
    return `${hasStorm ? 'rain_storm' : 'rain_light'}_${timeTag}`;
  }
  if (mode === 'hot') {
    return isNight ? 'moon_only_night' : `sun_only_${timeTag}`;
  }
  if (isNight) {
    return hasOvercast || hasPartlyCloud ? 'moon_cloud_night' : 'moon_only_night';
  }
  if (hasOvercast) return `cloud_only_${timeTag}`;
  if (hasClearSun && !hasPartlyCloud) return `sun_only_${timeTag}`;
  return `sun_cloud_${timeTag}`;
}

function buildSun3D(s: number, warmDusk: boolean, intense: boolean): THREE.Group {
  const sunGroup = new THREE.Group();
  sunGroup.name = 'sunGroup';
  const coreColor = warmDusk ? 0xfb923c : intense ? 0xfbbf24 : 0xfde047;
  const emissiveColor = warmDusk ? 0xea580c : 0xf59e0b;
  const coreRadius = (intense ? 14.5 : 12.5) * s;

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(coreRadius, 18, 16),
    new THREE.MeshStandardMaterial({
      color: coreColor,
      emissive: emissiveColor,
      emissiveIntensity: intense ? 0.9 : 0.62,
      roughness: 0.28,
    })
  );
  sunGroup.add(core);

  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(coreRadius + 2.5 * s, coreRadius + 6 * s, 24),
    new THREE.MeshBasicMaterial({
      color: warmDusk ? 0xfdba74 : 0xfef08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: intense ? 0.58 : 0.42,
    })
  );
  sunGroup.add(glowRing);

  const rays = new THREE.Group();
  rays.name = 'sunRays';
  const rayGeo = new THREE.ConeGeometry(2.2 * s, (intense ? 8.5 : 7.0) * s, 6);
  const rayMat = new THREE.MeshBasicMaterial({ color: warmDusk ? 0xfb923c : 0xfacc15 });
  const rayDist = coreRadius + 8 * s;
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const r = new THREE.Mesh(rayGeo, rayMat);
    r.position.set(Math.cos(ang) * rayDist, Math.sin(ang) * rayDist, 0);
    r.rotation.z = ang - Math.PI / 2;
    rays.add(r);
  }
  sunGroup.add(rays);
  return sunGroup;
}

function buildMoon3D(s: number, withStars: boolean): THREE.Group {
  const moonWrap = new THREE.Group();
  moonWrap.name = 'moonGroup';

  // Mặt trăng sáng ánh vàng nhạt + vầng hào quang đêm dịu
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(12.5 * s, 18, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.42,
    })
  );
  moonWrap.add(moon);

  // Vết khuyết mờ tạo cảm giác mặt trăng rõ rệt hơn mặt trời
  const crescentShadow = new THREE.Mesh(
    new THREE.SphereGeometry(10.5 * s, 16, 14),
    new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.72,
    })
  );
  crescentShadow.position.set(5.2 * s, 3.2 * s, 5.5 * s);
  moonWrap.add(crescentShadow);

  const moonHalo = new THREE.Mesh(
    new THREE.RingGeometry(15 * s, 19 * s, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.34,
    })
  );
  moonWrap.add(moonHalo);

  if (withStars) {
    const stars = new THREE.Group();
    stars.name = 'nightStars';
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const starPts: Array<[number, number, number]> = [
      [-26, 14, -2],
      [-14, 24, -2],
      [22, 18, -2],
      [28, -4, -2],
    ];
    for (const [sx, sy, sz] of starPts) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(3.0 * s, 0), starMat);
      st.position.set(sx * s, sy * s, sz);
      stars.add(st);
    }
    moonWrap.add(stars);
  }
  return moonWrap;
}

function buildMiniRainDrops(s: number, heavy: boolean): THREE.Group {
  const drops = new THREE.Group();
  drops.name = 'rainDrops';
  const mat = new THREE.MeshBasicMaterial({
    color: heavy ? 0x38bdf8 : 0x7dd3fc,
    transparent: true,
    opacity: 0.85,
  });
  const count = heavy ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s, 1.3 * s, 7.5 * s, 5), mat);
    const ox = (i - (count - 1) / 2) * 10 * s;
    d.position.set(ox, -15 * s - (i % 2) * 7 * s, 2);
    d.rotation.z = -0.18;
    d.userData.phase = i * 1.15;
    drops.add(d);
  }
  return drops;
}

function ensureWeatherProps(visualKey: string) {
  if (builtWeatherPropMode === visualKey && weatherPropGroup) return;
  disposeWeatherProps();
  builtWeatherPropMode = visualKey;

  const group = new THREE.Group();
  const s = 1.0;
  const skyAnchor = new THREE.Group();
  skyAnchor.name = 'skyAnchor';
  group.add(skyAnchor);

  const isNight = visualKey.endsWith('_night');
  const isDusk = visualKey.endsWith('_dusk');
  const baseKind = visualKey.replace(/_(day|dusk|night)$/, '');

  if (baseKind === 'rain_storm' || baseKind === 'rain_light') {
    const isStorm = baseKind === 'rain_storm';
    if (isNight) {
      const dimMoon = buildMoon3D(0.72 * s, false);
      dimMoon.position.set(18 * s, 10 * s, -6);
      skyAnchor.add(dimMoon);
    }
    const stormCloud = buildCloudCluster(isStorm ? 0x334155 : 0x64748b, (isStorm ? 0.96 : 0.88) * s);
    stormCloud.position.set(0, 0, -2);
    stormCloud.userData.baseY = 0;
    stormCloud.name = 'cloudFloat';
    skyAnchor.add(stormCloud);

    const drops = buildMiniRainDrops(s, isStorm);
    skyAnchor.add(drops);

    if (isStorm) {
      const boltMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const lightning = new THREE.Group();
      lightning.name = 'lightning';
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(4.2 * s, 13 * s, 2.5 * s), boltMat);
      b1.rotation.z = -0.35;
      b1.position.set(-2 * s, -12 * s, 1);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(3.4 * s, 12 * s, 2.5 * s), boltMat);
      b2.rotation.z = 0.45;
      b2.position.set(-4.5 * s, -22 * s, 1);
      lightning.add(b1, b2);
      skyAnchor.add(lightning);
    }
  } else if (baseKind === 'sun_only') {
    const sun = buildSun3D(s, isDusk, appState.weatherMode === 'hot');
    skyAnchor.add(sun);
  } else if (baseKind === 'sun_cloud') {
    const sun = buildSun3D(0.86 * s, isDusk, false);
    sun.position.set(16 * s, 8 * s, -5);
    skyAnchor.add(sun);

    const clearCloud = buildCloudCluster(isDusk ? 0xfed7aa : 0xf8fafc, 0.78 * s);
    clearCloud.position.set(-8 * s, -4 * s, 0);
    clearCloud.userData.baseY = -4 * s;
    clearCloud.name = 'cloudFloat';
    skyAnchor.add(clearCloud);
  } else if (baseKind === 'cloud_only') {
    const backCloud = buildCloudCluster(0x94a3b8, 0.72 * s);
    backCloud.position.set(14 * s, 6 * s, -5);
    skyAnchor.add(backCloud);

    const mainCloud = buildCloudCluster(0xcbd5e1, 0.86 * s);
    mainCloud.position.set(-4 * s, -2 * s, 0);
    mainCloud.userData.baseY = -2 * s;
    mainCloud.name = 'cloudFloat';
    skyAnchor.add(mainCloud);
  } else if (baseKind === 'moon_only') {
    const moon = buildMoon3D(s, true);
    skyAnchor.add(moon);
  } else if (baseKind === 'moon_cloud') {
    const moon = buildMoon3D(0.86 * s, true);
    moon.position.set(15 * s, 8 * s, -5);
    skyAnchor.add(moon);

    const nightCloud = buildCloudCluster(0x475569, 0.78 * s);
    nightCloud.position.set(-7 * s, -4 * s, 0);
    nightCloud.userData.baseY = -4 * s;
    nightCloud.name = 'cloudFloat';
    skyAnchor.add(nightCloud);
  } else if (baseKind === 'cold') {
    if (isNight) {
      const dimMoon = buildMoon3D(0.75 * s, true);
      dimMoon.position.set(18 * s, 10 * s, -6);
      skyAnchor.add(dimMoon);
    }
    const snowCloud = buildCloudCluster(0xe2e8f0, 0.88 * s);
    snowCloud.position.set(0, 0, -2);
    snowCloud.userData.baseY = 0;
    snowCloud.name = 'cloudFloat';
    skyAnchor.add(snowCloud);

    const snowman = new THREE.Group();
    snowman.name = 'snowman';
    snowman.position.set(-62 * s, 0, -4);
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
  } else {
    // wind
    const windCloud = buildCloudCluster(isNight ? 0x64748b : 0xe2e8f0, 0.78 * s);
    windCloud.position.set(0, 6 * s, -2);
    windCloud.userData.baseY = 6 * s;
    windCloud.name = 'cloudFloat';
    skyAnchor.add(windCloud);

    const vortex = new THREE.Group();
    vortex.name = 'windVortex';
    vortex.position.set(-16 * s, -22 * s, -2);
    const windMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.78,
    });
    for (let i = 0; i < 5; i++) {
      const radius = (4.5 + i * 2.4) * s;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.3 * s, 8, 20), windMat);
      ring.rotation.x = Math.PI / 2 + 0.14;
      ring.position.set(Math.sin(i * 1.1) * 3.5 * s, (i - 2) * 7 * s, 0);
      vortex.add(ring);
    }
    skyAnchor.add(vortex);
  }

  const initScale = appState.modelScale || 1.0;
  group.scale.setScalar(initScale);
  group.position.set(appState.posX, -appState.posY, 18 * initScale);
  scene.add(group);
  weatherPropGroup = group;
  weatherRefs = {
    skyAnchor,
    cloud: group.getObjectByName('cloudFloat') ?? null,
    sunRays: group.getObjectByName('sunRays') ?? null,
    lightning: group.getObjectByName('lightning') ?? null,
    snowman: group.getObjectByName('snowman') ?? null,
    vortex: group.getObjectByName('windVortex') ?? null,
    stars: group.getObjectByName('nightStars') ?? null,
    rainDrops: group.getObjectByName('rainDrops') ?? null,
  };
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

const MAX_ACTIVE_PARTICLES = 120;
const MAX_POOLED_PARTICLES = 120;
const MAX_POOLED_SHOCKWAVES = 16;
const particleMeshPool: THREE.Mesh[] = [];
const shockwaveMeshPool: THREE.Mesh[] = [];

function acquireParticleMesh(colorHex: number, opacity: number): THREE.Mesh {
  const pooled = particleMeshPool.pop();
  if (pooled) {
    const mat = pooled.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = opacity;
    pooled.rotation.set(0, 0, 0);
    pooled.visible = true;
    return pooled;
  }
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
  });
  const mesh = new THREE.Mesh(particleGeo, mat);
  scene.add(mesh);
  return mesh;
}

function releaseParticleMesh(mesh: THREE.Mesh) {
  if (particleMeshPool.length < MAX_POOLED_PARTICLES) {
    mesh.visible = false;
    particleMeshPool.push(mesh);
    return;
  }
  scene.remove(mesh);
  (mesh.material as THREE.Material).dispose();
}

function acquireShockwaveMesh(colorHex: number, opacity: number): THREE.Mesh {
  const pooled = shockwaveMeshPool.pop();
  if (pooled) {
    const mat = pooled.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = opacity;
    pooled.rotation.set(-Math.PI / 2, 0, 0);
    pooled.visible = true;
    return pooled;
  }
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
  });
  const mesh = new THREE.Mesh(shockwaveGeo, mat);
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);
  return mesh;
}

function releaseShockwaveMesh(mesh: THREE.Mesh) {
  if (shockwaveMeshPool.length < MAX_POOLED_SHOCKWAVES) {
    mesh.visible = false;
    shockwaveMeshPool.push(mesh);
    return;
  }
  scene.remove(mesh);
  (mesh.material as THREE.Material).dispose();
}

export function hasWideParticlesOrEffects(): boolean {
  if (
    shockwaves.length > 0 ||
    blackHolePortals.length > 0 ||
    frameHighlights.length > 0 ||
    foodMesh !== null ||
    ladderMesh !== null ||
    parachuteMesh !== null ||
    jetpackMesh !== null ||
    radarMesh !== null ||
    fishingRodMesh !== null ||
    tarot3DFlipState !== null
  ) {
    return true;
  }
  if (particles.length === 0) return false;
  const s = appState.modelScale || 1.0;
  const minX = appState.posX - 200 * s;
  const maxX = appState.posX + 200 * s;
  const minY = appState.posY - 350 * s;
  const maxY = appState.posY + 80 * s;
  for (let i = 0; i < particles.length; i++) {
    const px = particles[i].mesh.position.x;
    const py = -particles[i].mesh.position.y;
    if (px < minX || px > maxX || py < minY || py > maxY) {
      return true;
    }
  }
  return false;
}

export function spawnParticles(x: number, y: number, count: number, colorHex: number) {
  const s = appState.modelScale || 1.0;
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_ACTIVE_PARTICLES) return;
    const mesh = acquireParticleMesh(colorHex, 1);
    mesh.scale.setScalar(s);
    mesh.position.set(
      x + (Math.random() - 0.5) * 55 * s,
      -(y + (Math.random() - 0.5) * 40 * s),
      30 + Math.random() * 20
    );

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
    if (particles.length >= MAX_ACTIVE_PARTICLES) return;
    const mesh = acquireParticleMesh(smokeColor, 0.85);
    mesh.position.set(
      x + (Math.random() - 0.5) * 16 * s,
      -(y - 4 * s + Math.random() * 8 * s),
      15 + Math.random() * 15
    );
    const bScale = (0.7 + Math.random() * 0.7) * s;
    mesh.scale.setScalar(bScale);

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
    if (particles.length >= MAX_ACTIVE_PARTICLES) return;
    const mesh = acquireParticleMesh(
      flameColors[Math.floor(Math.random() * flameColors.length)],
      0.92
    );
    mesh.position.set(
      x + (Math.random() - 0.5) * 10 * s,
      -(y + Math.random() * 6 * s),
      12 + Math.random() * 8
    );
    const bScale = (0.55 + Math.random() * 0.45) * s;
    mesh.scale.setScalar(bScale);

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
  const mesh = acquireShockwaveMesh(colorHex, 0.85);
  mesh.scale.setScalar(s);
  mesh.position.set(x, -y + 2 * s, 0);

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

export const SPECIAL_EFFECT_TYPES = [
  'meteor_shower',
  'aurora_ring',
  'cyber_fireworks',
  'starlight_fountain',
  'matrix_pulse',
  'plasma_nova',
  'sakura_vortex',
  'cyber_dna_helix',
  'golden_jackpot',
] as const;

export type Special3DEffectType = (typeof SPECIAL_EFFECT_TYPES)[number];

export const SPECIAL_3D_EFFECT_CATALOG: Array<{ id: Special3DEffectType; label: string }> = [
  { id: 'meteor_shower', label: 'Mưa Sao Băng 3D' },
  { id: 'aurora_ring', label: 'Vòng Cực Quang Đa Sắc' },
  { id: 'cyber_fireworks', label: 'Pháo Hoa 3D Cyber' },
  { id: 'starlight_fountain', label: 'Đài Phun Ánh Sao' },
  { id: 'matrix_pulse', label: 'Sóng Dữ Liệu Matrix' },
  { id: 'plasma_nova', label: 'Vụ Nổ Plasma Nova 3D' },
  { id: 'sakura_vortex', label: 'Lốc Xoáy Hoa Anh Đào' },
  { id: 'cyber_dna_helix', label: 'Chuỗi Xoắn Kép Cyber DNA' },
  { id: 'golden_jackpot', label: 'Suối Vàng Thần Tài' },
];

const specialFxDeck: Special3DEffectType[] = [];
let lastSpecialFx: string = '';

function drawSpecialFxFromDeck(): Special3DEffectType {
  if (specialFxDeck.length === 0) {
    specialFxDeck.push(...SPECIAL_EFFECT_TYPES);
    for (let i = specialFxDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = specialFxDeck[i];
      specialFxDeck[i] = specialFxDeck[j];
      specialFxDeck[j] = tmp;
    }
    if (specialFxDeck.length > 1 && specialFxDeck[specialFxDeck.length - 1] === lastSpecialFx) {
      const swapIdx = Math.floor(Math.random() * (specialFxDeck.length - 1));
      const top = specialFxDeck[specialFxDeck.length - 1];
      specialFxDeck[specialFxDeck.length - 1] = specialFxDeck[swapIdx];
      specialFxDeck[swapIdx] = top;
    }
  }
  const picked = specialFxDeck.pop()!;
  lastSpecialFx = picked;
  return picked;
}

export function triggerRandomSpecial3DEffect(
  x: number,
  y: number,
  forcedType?: string
): string {
  const s = appState.modelScale || 1.0;
  const chosen =
    forcedType && SPECIAL_EFFECT_TYPES.includes(forcedType as (typeof SPECIAL_EFFECT_TYPES)[number])
      ? forcedType
      : drawSpecialFxFromDeck();

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
    if (particles.length >= MAX_ACTIVE_PARTICLES) return;
    const mesh = acquireParticleMesh(colorHex, 0.96);
    const scaled = scale * s;
    mesh.scale.setScalar(scaled);
    mesh.position.set(px, -py, (28 + Math.random() * 14) * s);
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
  } else if (chosen === 'matrix_pulse') {
    spawnShockwave(x, y - 35 * s, 0x22c55e);
    spawnShockwave(x, y - 85 * s, 0x06b6d4);
    for (let i = 0; i < 24; i++) {
      const colX = x + (-95 + (i % 8) * 26) * s;
      const col = i % 2 === 0 ? 0x22c55e : 0x06b6d4;
      addParticle(colX, y - (30 + (i % 3) * 35) * s, 0, 2.2 + Math.random() * 1.8, 0, col, 0.72, 0.9);
    }
  } else if (chosen === 'plasma_nova') {
    spawnShockwave(x, y - 65 * s, 0xec4899);
    spawnShockwave(x, y - 72 * s, 0x22d3ee);
    spawnShockwave(x, y - 80 * s, 0xfacc15);
    const novaCols = [0xec4899, 0x22d3ee, 0xfacc15, 0xa855f7];
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const elev = ((i % 5) - 2) * 0.42;
      const spd = 2.8 + Math.random() * 2.2;
      addParticle(
        x,
        y - 72 * s,
        Math.cos(a) * spd,
        Math.sin(a) * spd * 0.7 + elev * 2.2,
        Math.sin(a * 2) * 1.8,
        novaCols[i % novaCols.length],
        0.92,
        0.85
      );
    }
  } else if (chosen === 'sakura_vortex') {
    spawnShockwave(x, y - 20 * s, 0xf472b6);
    const sakuraCols = [0xf472b6, 0xfb7185, 0xfdf2f8];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 4;
      const r = (24 + (i % 6) * 8) * s;
      addParticle(
        x + Math.cos(a) * r,
        y - (15 + i * 5) * s,
        -Math.sin(a) * 1.6,
        1.9 + Math.random() * 1.4,
        Math.cos(a) * 1.4,
        sakuraCols[i % sakuraCols.length],
        0.82,
        1.05
      );
    }
  } else if (chosen === 'cyber_dna_helix') {
    spawnShockwave(x, y - 35 * s, 0x06b6d4);
    spawnShockwave(x, y - 105 * s, 0xa855f7);
    for (let i = 0; i < 28; i++) {
      const strand = i % 2;
      const a = (i / 14) * Math.PI * 2 + (strand === 1 ? Math.PI : 0);
      const col = strand === 0 ? 0x06b6d4 : 0xa855f7;
      addParticle(
        x + Math.cos(a) * 44 * s,
        y - (18 + Math.floor(i / 2) * 11) * s,
        Math.cos(a) * 0.45,
        2.1,
        Math.sin(a) * 0.85,
        col,
        0.85,
        0.95
      );
    }
  } else {
    // golden_jackpot
    spawnShockwave(x, y - 18 * s, 0xfacc15);
    spawnShockwave(x, y - 48 * s, 0xfde047);
    spawnShockwave(x, y - 78 * s, 0x34d399);
    const goldCols = [0xfacc15, 0xfde047, 0x34d399, 0xf59e0b];
    for (let i = 0; i < 30; i++) {
      const ang = (i / 30) * Math.PI * 2;
      addParticle(
        x + Math.cos(ang) * 14 * s,
        y - 45 * s,
        Math.cos(ang) * (1.8 + Math.random() * 1.6),
        3.0 + Math.random() * 2.5,
        Math.sin(ang) * 1.4,
        goldCols[i % goldCols.length],
        0.92,
        0.9
      );
    }
  }

  return chosen;
}

export function updateParticles(delta: number) {
  const s = appState.modelScale || 1.0;
  const step = delta * 60;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += delta;
    if (p.life >= p.maxLife) {
      releaseParticleMesh(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    const progress = p.life / p.maxLife;
    p.mesh.position.x += p.vx * step;
    p.mesh.position.y += p.vy * step;
    p.mesh.position.z += p.vz * step;
    p.mesh.rotation.y += delta * 6;
    p.mesh.rotation.x += delta * 4;
    p.mesh.scale.setScalar((p.baseScale ?? 1.0) * (1 - progress * 0.7));
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life += delta;
    if (sw.life >= sw.maxLife) {
      releaseShockwaveMesh(sw.mesh);
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

  // Cập nhật hiệu ứng thẻ Tarot 3D lơ lửng & lật mặt trên đầu Vịt
  if (tarot3DFlipState) {
    tarot3DFlipState.elapsed += delta;
    const t = tarot3DFlipState.elapsed;
    tarot3DFlipState.root.scale.setScalar(s);
    tarot3DFlipState.root.position.set(appState.posX, -appState.posY + 188 * s, 30 * s);

    if (t < 1.1) {
      // Pha 1: 3 lá bài xoay vòng tụ linh quanh trục trên đầu Vịt
      const spinAngle = t * 5.2;
      for (const c of tarot3DFlipState.cards) {
        const angle = spinAngle + c.slot * ((Math.PI * 2) / 3);
        const radius = 58 * (1 - t / 1.4);
        c.group.position.set(Math.cos(angle) * radius, Math.sin(angle * 2) * 10, Math.sin(angle) * 26);
        c.group.rotation.y = Math.sin(t * 6 + c.slot) * 0.35;
        c.group.rotation.z = -Math.cos(angle) * 0.14;
      }
      if (Math.random() < delta * 18) {
        spawnParticles(appState.posX + (Math.random() - 0.5) * 90 * s, appState.posY - 185 * s, 1, 0xa78bfa);
      }
    } else if (t < 2.05) {
      // Pha 2: 2 lá phụ tách ra biến mất, lá chính phóng to & lật 180 độ lộ mặt Cát/Hung
      const p = Math.min(1, (t - 1.1) / 0.95);
      const ease = 1 - Math.pow(1 - p, 3);
      if (!tarot3DFlipState.flippedTriggered && p >= 0.55) {
        tarot3DFlipState.flippedTriggered = true;
        spawnShockwave(appState.posX, appState.posY - 188 * s, tarot3DFlipState.fortuneColor);
        spawnParticles(appState.posX, appState.posY - 188 * s, 20, tarot3DFlipState.fortuneColor);
      }
      for (const c of tarot3DFlipState.cards) {
        if (c.slot === 0) {
          c.group.position.set(0, ease * 10, 14);
          c.group.rotation.z = 0;
          c.group.rotation.y = ease * Math.PI;
          c.group.scale.setScalar(1 + ease * 0.32);
        } else {
          c.group.visible = p < 0.35;
          c.group.position.x = c.slot * (60 + p * 85);
          c.group.scale.setScalar(Math.max(0.01, 1 - p * 2.5));
        }
      }
    } else if (t < tarot3DFlipState.duration) {
      // Pha 3: Lá bài đã lật tỏa hào quang nhẹ và nhấp nhô, sau 4.9s thu gọn biến mất
      const remain = tarot3DFlipState.duration - t;
      const outScale = remain < 0.7 ? Math.max(0.01, remain / 0.7) : 1.0;
      for (const c of tarot3DFlipState.cards) {
        if (c.slot === 0) {
          c.group.position.set(0, 10 + Math.sin(t * 3.2) * 5, 14);
          c.group.rotation.y = Math.PI + Math.sin(t * 2.1) * 0.14;
          c.group.rotation.x = Math.cos(t * 1.8) * 0.06;
          c.group.scale.setScalar(1.32 * outScale);
        } else {
          c.group.visible = false;
        }
      }
      if (Math.random() < delta * 8) {
        spawnParticles(
          appState.posX + (Math.random() - 0.5) * 60 * s,
          appState.posY - 195 * s,
          1,
          tarot3DFlipState.fortuneColor
        );
      }
    } else {
      disposeTarot3DFlipEffect();
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

  // Vật thể thời tiết 3D theo thời tiết thật + thời gian (ngày/hoàng hôn/đêm) & bay lẽo đẽo theo Vịt như nút orb
  if (appState.state !== 'SWIMMING' && !appState.isEdgePeekMode && !isP2pSessionActive()) {
    const visualKey = resolveWeatherVisualKey();
    ensureWeatherProps(visualKey);
    if (weatherPropGroup && weatherRefs) {
      weatherPropGroup.scale.setScalar(s);
      weatherPropGroup.position.set(appState.posX, -appState.posY, 18 * s);
      const tNow = performance.now() * 0.001;
      const dt = Math.min(0.05, Math.max(0.001, delta));
      const trailDir = appState.walkDir >= 0 ? -1 : 1;
      const targetX = appState.posX + trailDir * 48 * s;
      const targetY = appState.posY - 168 * s;
      if (!weatherFollowInit) {
        weatherFollowX = targetX;
        weatherFollowY = targetY;
        weatherVelX = 0;
        weatherVelY = 0;
        weatherFollowInit = true;
      } else {
        const stiffness = 26;
        const damping = 7.2;
        const ax = (targetX - weatherFollowX) * stiffness - weatherVelX * damping;
        const ay = (targetY - weatherFollowY) * stiffness - weatherVelY * damping;
        weatherVelX += ax * dt;
        weatherVelY += ay * dt;
        weatherFollowX += weatherVelX * dt;
        weatherFollowY += weatherVelY * dt;
      }

      const { skyAnchor, cloud, sunRays, lightning, snowman, vortex, stars, rainDrops } = weatherRefs;
      if (skyAnchor) {
        const bobY = Math.sin(tNow * 2.4) * 5.0;
        skyAnchor.position.set(
          (weatherFollowX - appState.posX) / Math.max(0.25, s),
          (appState.posY - weatherFollowY) / Math.max(0.25, s) + bobY,
          0
        );
        skyAnchor.rotation.z = THREE.MathUtils.clamp(-weatherVelX * 0.00055, -0.22, 0.22);
      }
      if (cloud) {
        cloud.position.y = (cloud.userData.baseY ?? 0) + Math.sin(tNow * 2.2) * 2.4;
      }
      if (sunRays) {
        sunRays.rotation.z += delta * 1.4;
      }
      if (lightning) {
        lightning.visible = Math.sin(tNow * 13) > 0.72;
      }
      if (rainDrops) {
        rainDrops.children.forEach((drop) => {
          const ph = (tNow * 4.5 + (drop.userData.phase || 0)) % 1;
          drop.position.y = -11 - ph * 16;
          drop.scale.y = 0.7 + (1 - ph) * 0.5;
        });
      }
      if (snowman) {
        snowman.rotation.z = Math.sin(tNow * 2.4) * 0.05;
      }
      if (vortex) {
        vortex.rotation.y += delta * 8.5;
        vortex.children.forEach((ring, idx) => {
          ring.position.x = Math.sin(tNow * 6 + idx * 0.9) * 5;
        });
      }
      if (stars) {
        stars.children.forEach((st, idx) => {
          st.rotation.y += delta * (1.8 + idx * 0.5);
          st.scale.setScalar(0.85 + Math.sin(tNow * 4 + idx) * 0.25);
        });
      }
    }
  } else {
    weatherFollowInit = false;
    disposeWeatherProps();
  }

  // Hiệu ứng hạt thời tiết 3D Live Weather Aura rơi từ cụm mây đang bay theo Vịt
  if (appState.weatherMode !== 'clear' && appState.state !== 'SWIMMING' && !isP2pSessionActive()) {
    const mode = appState.weatherMode;
    const anchorX = weatherFollowInit ? weatherFollowX : appState.posX;
    const anchorY = weatherFollowInit ? weatherFollowY : appState.posY - 168 * s;
    const prob = mode === 'rain' ? delta * 18 : mode === 'wind' ? delta * 14 : delta * 7;
    if (Math.random() < prob) {
      let colorHex = 0x38bdf8;
      let vx = (Math.random() - 0.5) * 0.6;
      let vy = -6.5;
      let px = anchorX + (Math.random() - 0.5) * 60 * s;
      let py = anchorY + 12 * s;
      let maxLife = 0.75;
      let scale = 0.75;

      if (mode === 'rain') {
        colorHex = Math.random() < 0.6 ? 0x38bdf8 : 0x7dd3fc;
        vx = -0.65;
        vy = -6.5;
        px = anchorX + (Math.random() - 0.5) * 48 * s;
        py = anchorY + 10 * s;
        maxLife = 0.52;
        scale = 0.58;
      } else if (mode === 'hot') {
        colorHex = Math.random() < 0.5 ? 0xf97316 : 0xfacc15;
        vx = (Math.random() - 0.5) * 0.9;
        vy = 1.6 + Math.random() * 1.4;
        px = anchorX + (Math.random() - 0.5) * 64 * s;
        py = anchorY + (Math.random() * 70) * s;
        maxLife = 0.72;
        scale = 0.62;
      } else if (mode === 'cold') {
        colorHex = 0xe0f2fe;
        vx = Math.sin(performance.now() * 0.004 + px) * 0.9;
        vy = -2.2 - Math.random() * 0.8;
        px = anchorX + (Math.random() - 0.5) * 56 * s;
        py = anchorY + 10 * s;
        maxLife = 1.45;
        scale = 0.82;
      } else if (mode === 'wind') {
        colorHex = Math.random() < 0.5 ? 0xbae6fd : 0x86efac;
        vx = 5.2 + Math.random() * 2.2;
        vy = Math.sin(performance.now() * 0.01 + px) * 1.2;
        px = anchorX - 24 * s;
        py = anchorY + (Math.random() * 65) * s;
        maxLife = 0.65;
        scale = 0.68;
      } else if (mode === 'night') {
        colorHex = Math.random() < 0.5 ? 0xa78bfa : 0x34d399;
        vx = (Math.random() - 0.5) * 0.8;
        vy = (Math.random() - 0.5) * 0.6 + 0.3;
        px = appState.posX + (Math.random() - 0.5) * 90 * s;
        py = appState.posY - (140 + Math.random() * 65) * s;
        maxLife = 1.15;
        scale = 0.62;
      }

      if (particles.length < MAX_ACTIVE_PARTICLES) {
        const mesh = acquireParticleMesh(colorHex, 0.88);
        const scaledParticle = scale * s;
        mesh.scale.setScalar(scaledParticle);
        mesh.position.set(px, -py, 22);
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
}
