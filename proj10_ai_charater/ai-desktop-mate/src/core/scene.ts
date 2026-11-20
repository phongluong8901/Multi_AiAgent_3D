import * as THREE from 'three';
import { appState } from './state';

export const scene = new THREE.Scene();
export const camera = new THREE.OrthographicCamera(0, appState.W, 0, -appState.H, -1000, 1000);
camera.position.z = 500;

export const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  stencil: false,
});
renderer.setSize(appState.W, appState.H);
renderer.setPixelRatio(
  appState.ecoMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

export interface RenderViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  isFullScreen: boolean;
}

let vpLeft = 0;
let vpTop = 0;
let vpWidth = Math.max(64, appState.W || window.innerWidth || 1920);
let vpHeight = Math.max(64, appState.H || window.innerHeight || 1080);
let vpIsFullScreen = true;
let vpCameraSynced = false;
let compactCooldownSec = 0;
let lastAppliedTransform = '';
let lastAppliedCanvasW = 0;
let lastAppliedCanvasH = 0;
let lastAppliedDpr = 0;

export function getRenderViewport(): RenderViewport {
  return {
    left: vpLeft,
    top: vpTop,
    width: vpWidth,
    height: vpHeight,
    isFullScreen: vpIsFullScreen,
  };
}

export function markFullScreenDirty(_frames = 3) {
  compactCooldownSec = Math.max(compactCooldownSec, 0.35);
}

function applyViewportLayout(
  left: number,
  top: number,
  width: number,
  height: number,
  isFull: boolean
) {
  const screenW = Math.max(64, appState.W || 1920);
  const screenH = Math.max(64, appState.H || 1080);
  const w = Math.max(64, Math.min(screenW, Math.round(width)));
  const h = Math.max(64, Math.min(screenH, Math.round(height)));
  const l = Math.max(0, Math.min(Math.max(0, screenW - w), Math.round(left)));
  const t = Math.max(0, Math.min(Math.max(0, screenH - h), Math.round(top)));
  const dpr = appState.ecoMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);

  if (w !== lastAppliedCanvasW || h !== lastAppliedCanvasH || dpr !== lastAppliedDpr) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    lastAppliedCanvasW = w;
    lastAppliedCanvasH = h;
    lastAppliedDpr = dpr;
  }

  const nextTransform = `translate3d(${l}px, ${t}px, 0)`;
  if (nextTransform !== lastAppliedTransform) {
    renderer.domElement.style.transform = nextTransform;
    lastAppliedTransform = nextTransform;
  }

  if (
    !vpCameraSynced ||
    l !== vpLeft ||
    t !== vpTop ||
    w !== vpWidth ||
    h !== vpHeight
  ) {
    camera.left = l;
    camera.right = l + w;
    camera.top = -t;
    camera.bottom = -(t + h);
    camera.updateProjectionMatrix();
    vpCameraSynced = true;
  }

  vpLeft = l;
  vpTop = t;
  vpWidth = w;
  vpHeight = h;
  vpIsFullScreen = isFull;
}

export function renderSceneOptimized(needsFullScreen: boolean, delta = 1 / 60) {
  if (appState.W <= 0 || appState.H <= 0) {
    return;
  }
  if (needsFullScreen) {
    compactCooldownSec = 1.5;
    applyViewportLayout(0, 0, appState.W, appState.H, true);
    renderer.render(scene, camera);
    return;
  }
  if (compactCooldownSec > 0) {
    compactCooldownSec = Math.max(0, compactCooldownSec - delta);
    if (vpIsFullScreen) {
      applyViewportLayout(0, 0, appState.W, appState.H, true);
      renderer.render(scene, camera);
      return;
    }
  }

  const s = appState.modelScale || 1.0;
  const boxW = Math.max(256, Math.min(appState.W, Math.ceil((460 * s) / 64) * 64));
  const boxH = Math.max(256, Math.min(appState.H, Math.ceil((480 * s) / 64) * 64));
  if (boxW >= appState.W * 0.85 && boxH >= appState.H * 0.85) {
    applyViewportLayout(0, 0, appState.W, appState.H, true);
    renderer.render(scene, camera);
    return;
  }

  const maxLeft = Math.max(0, appState.W - boxW);
  const maxTop = Math.max(0, appState.H - boxH);
  let nextLeft = appState.posX - boxW * 0.5;
  let nextTop = appState.posY - boxH * 0.78;

  if (!vpIsFullScreen && vpWidth === boxW && vpHeight === boxH) {
    const insideX =
      (appState.posX >= vpLeft + 150 * s || vpLeft <= 1) &&
      (appState.posX <= vpLeft + boxW - 150 * s || vpLeft >= maxLeft - 1);
    const insideY =
      (appState.posY >= vpTop + 310 * s || vpTop <= 1) &&
      (appState.posY <= vpTop + boxH - 85 * s || vpTop >= maxTop - 1);
    if (insideX && insideY) {
      nextLeft = vpLeft;
      nextTop = vpTop;
    }
  }

  applyViewportLayout(
    Math.max(0, Math.min(maxLeft, nextLeft)),
    Math.max(0, Math.min(maxTop, nextTop)),
    boxW,
    boxH,
    false
  );
  renderer.render(scene, camera);
}

export function applyRendererEcoQuality() {
  if (vpIsFullScreen) {
    applyViewportLayout(0, 0, appState.W, appState.H, true);
  } else {
    applyViewportLayout(vpLeft, vpTop, vpWidth, vpHeight, false);
  }
}

let groundGroup: THREE.Group | null = null;
let groundRingMat: THREE.MeshBasicMaterial | null = null;
let groundDiscMat: THREE.MeshBasicMaterial | null = null;
const eqBars: THREE.Mesh[] = [];
let eqBarsVisible = false;

export function initScene(container: HTMLElement) {
  appState.W = window.innerWidth || 1920;
  appState.H = window.innerHeight || 1080;

  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.left = '0px';
  renderer.domElement.style.top = '0px';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.style.willChange = 'transform';
  applyViewportLayout(0, 0, Math.max(64, appState.W), Math.max(64, appState.H), true);

  container.appendChild(renderer.domElement);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(1.5, 3.0, 2.5);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xa5b4fc, 0.9);
  rimLight.position.set(-2.0, 1.5, -2.0);
  scene.add(rimLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
  scene.add(ambientLight);

  // Vòng sáng & bóng đổ mềm dưới chân nhân vật
  groundGroup = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(24, 31, 32);
  groundRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
  });
  const ringMesh = new THREE.Mesh(ringGeo, groundRingMat);
  ringMesh.rotation.x = -Math.PI / 2;

  const discGeo = new THREE.CircleGeometry(24, 28);
  groundDiscMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
  });
  const discMesh = new THREE.Mesh(discGeo, groundDiscMat);
  discMesh.rotation.x = -Math.PI / 2;
  discMesh.position.y = -0.5;

  groundGroup.add(discMesh, ringMesh);

  // 16 thanh Equalizer 3D phản ứng theo nhịp nhạc & gõ phím
  const barColors = [0x38bdf8, 0x818cf8, 0xf472b6, 0x34d399];
  const barGeo = new THREE.BoxGeometry(3.2, 18, 3.2);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const barMat = new THREE.MeshBasicMaterial({
      color: barColors[i % barColors.length],
      transparent: true,
      opacity: 0.88,
    });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(Math.cos(angle) * 34, 9, Math.sin(angle) * 34);
    bar.visible = false;
    groundGroup.add(bar);
    eqBars.push(bar);
  }

  scene.add(groundGroup);

  scene.add(appState.avatarGroup);

  window.addEventListener('resize', () => {
    appState.W = window.innerWidth || 1920;
    appState.H = window.innerHeight || 1080;
    if (vpIsFullScreen) {
      applyViewportLayout(0, 0, appState.W, appState.H, true);
    } else {
      applyViewportLayout(vpLeft, vpTop, vpWidth, vpHeight, false);
    }
  });
}

const ringColorTarget = new THREE.Color();

export function updateGroundAura(elapsed: number, delta = 1 / 60) {
  if (!groundGroup || !groundRingMat || !groundDiscMat) return;

  if (appState.state === 'SWIMMING') {
    groundRingMat.opacity = 0;
    groundDiscMat.opacity = 0;
    if (eqBarsVisible) {
      eqBars.forEach((b) => {
        b.visible = false;
      });
      eqBarsVisible = false;
    }
    return;
  }

  const rhythmActive = appState.rhythmIntensity > 0.05;
  if (rhythmActive) {
    eqBarsVisible = true;
    eqBars.forEach((bar, i) => {
      bar.visible = true;
      const hScale = Math.max(
        0.15,
        appState.rhythmIntensity * (0.4 + 0.6 * Math.abs(Math.sin(elapsed * 12 + i * 0.7)))
      );
      bar.scale.y = hScale;
      bar.position.y = 9 * hScale;
    });
  } else if (eqBarsVisible) {
    eqBars.forEach((bar) => {
      bar.visible = false;
    });
    eqBarsVisible = false;
  }

  const floorY = appState.H - 48;
  const distAboveFloor = Math.max(0, floorY - appState.posY);
  const inAir = appState.state === 'FALLING' || appState.state === 'JUMPING' || appState.state === 'DRAGGING';

  // Nếu đang ngồi trên cửa sổ thì vòng sáng nằm ngay dưới chân trên mép cửa sổ
  const auraY = appState.attachedWindowHwnd !== null ? appState.posY : inAir ? Math.min(floorY, appState.posY + Math.min(40, distAboveFloor)) : appState.posY;
  groundGroup.position.set(appState.posX, -auraY + 2, -5);

  const heightFactor = inAir ? Math.max(0.45, 1 - distAboveFloor / 500) : 1.0;
  const pulse = 1 + Math.sin(elapsed * 4) * 0.05;
  groundGroup.scale.setScalar(appState.modelScale * heightFactor * pulse);

  groundRingMat.opacity = 0.55 * heightFactor;
  groundDiscMat.opacity = 0.32 * heightFactor;

  if (appState.state === 'DANCING' || appState.state === 'HEADPAT') {
    ringColorTarget.setHex(0xf472b6);
  } else if (appState.state === 'PUSHING' || appState.state === 'PULLING') {
    ringColorTarget.setHex(0xfbbf24);
  } else if (appState.state === 'FALLING' || appState.state === 'JUMPING') {
    ringColorTarget.setHex(0xa78bfa);
  } else {
    ringColorTarget.setHex(0x38bdf8);
  }
  groundRingMat.color.lerp(ringColorTarget, Math.min(1, delta * 7.5));
}
