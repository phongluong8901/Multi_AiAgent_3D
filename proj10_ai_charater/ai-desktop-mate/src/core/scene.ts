import * as THREE from 'three';
import { appState } from './state';

export const scene = new THREE.Scene();
export const camera = new THREE.OrthographicCamera(0, appState.W, 0, -appState.H, -1000, 1000);
camera.position.z = 500;

export const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(appState.W, appState.H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

let groundGroup: THREE.Group | null = null;
let groundRingMat: THREE.MeshBasicMaterial | null = null;
let groundDiscMat: THREE.MeshBasicMaterial | null = null;
const eqBars: THREE.Mesh[] = [];

export function initScene(container: HTMLElement) {
  appState.W = window.innerWidth || 1920;
  appState.H = window.innerHeight || 1080;
  camera.left = 0;
  camera.right = appState.W;
  camera.top = 0;
  camera.bottom = -appState.H;
  camera.updateProjectionMatrix();
  renderer.setSize(appState.W, appState.H);

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
    appState.W = window.innerWidth;
    appState.H = window.innerHeight;
    camera.right = appState.W;
    camera.bottom = -appState.H;
    camera.updateProjectionMatrix();
    renderer.setSize(appState.W, appState.H);
  });
}

const ringColorTarget = new THREE.Color();

export function updateGroundAura(elapsed: number) {
  if (!groundGroup || !groundRingMat || !groundDiscMat) return;

  if (appState.state === 'SWIMMING') {
    groundRingMat.opacity = 0;
    groundDiscMat.opacity = 0;
    eqBars.forEach((b) => {
      b.visible = false;
    });
    return;
  }

  const rhythmActive = appState.rhythmIntensity > 0.05;
  eqBars.forEach((bar, i) => {
    if (!rhythmActive) {
      bar.visible = false;
      return;
    }
    bar.visible = true;
    const hScale = Math.max(
      0.15,
      appState.rhythmIntensity * (0.4 + 0.6 * Math.abs(Math.sin(elapsed * 12 + i * 0.7)))
    );
    bar.scale.y = hScale;
    bar.position.y = 9 * hScale;
  });

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
  groundRingMat.color.lerp(ringColorTarget, 0.12);
}
