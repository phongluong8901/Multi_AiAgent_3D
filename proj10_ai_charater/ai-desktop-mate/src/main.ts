import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';
import { invoke } from '@tauri-apps/api/core';

interface WinRect {
  hwnd: number;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// 1. Khoi tao Three.js Scene & Orthographic Camera
const container = document.getElementById('canvas-container')!;
const speechBubble = document.getElementById('speech-bubble')!;
const bubbleContent = document.getElementById('bubble-content')!;
const bubbleInput = document.getElementById('bubble-input') as HTMLInputElement;
const btnSendMsg = document.getElementById('btn-send-msg') as HTMLButtonElement;
const btnLoadVrm = document.getElementById('btn-load-vrm') as HTMLButtonElement;
const btnMinimizeBubble = document.getElementById('btn-minimize-bubble') as HTMLButtonElement;
const bubbleMinimized = document.getElementById('speech-bubble-minimized')!;
const fileInput = document.getElementById('vrm-file-input') as HTMLInputElement;

let W = window.innerWidth;
let H = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, W, 0, -H, -1000, 1000);
camera.position.z = 500;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  W = window.innerWidth;
  H = window.innerHeight;
  camera.right = W;
  camera.bottom = -H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
});

// Chieu sang 3D
const mainLight = new THREE.DirectionalLight(0xffffff, 2.2);
mainLight.position.set(1.5, 3, 2.5);
scene.add(mainLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
scene.add(ambientLight);

// 2. Tao nhan vat 3D co khop xuong & hoat anh (Articulated 3D Mascot)
const avatarGroup = new THREE.Group();
scene.add(avatarGroup);

let currentVrm: VRM | null = null;
let hitBoxMesh: THREE.Mesh;

// Cac bo phan de thuc hien hoat anh 3D
let charHead: THREE.Group;
let charTorso: THREE.Mesh;
let charLeftArm: THREE.Group;
let charRightArm: THREE.Group;
let charLeftLeg: THREE.Group;
let charRightLeg: THREE.Group;
let charLeftEye: THREE.Mesh;
let charRightEye: THREE.Mesh;

function createArticulated3DCharacter() {
  avatarGroup.clear();

  const characterRoot = new THREE.Group();

  // Vat lieu 3D kim loai / toon hien dai
  const primaryMat = new THREE.MeshStandardMaterial({
    color: 0x4f46e5,
    roughness: 0.35,
    metalness: 0.2,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffedd5,
    roughness: 0.5,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    roughness: 0.4,
    metalness: 0.3,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });

  // Phan than (Torso)
  const torsoGeo = new THREE.CylinderGeometry(20, 16, 42, 16);
  charTorso = new THREE.Mesh(torsoGeo, primaryMat);
  charTorso.position.y = 52;
  characterRoot.add(charTorso);

  // Loi nang luong phat sang o nguc (Core reactor)
  const coreGeo = new THREE.SphereGeometry(6, 16, 16);
  const coreMesh = new THREE.Mesh(coreGeo, glowMat);
  coreMesh.position.set(0, 56, 16);
  characterRoot.add(coreMesh);

  // Phan dau (Head Group)
  charHead = new THREE.Group();
  charHead.position.set(0, 92, 0);

  const headGeo = new THREE.SphereGeometry(28, 24, 24);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  charHead.add(headMesh);

  // Toc / mu bao hiem chibi
  const helmetGeo = new THREE.SphereGeometry(30, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const helmetMesh = new THREE.Mesh(helmetGeo, darkMat);
  helmetMesh.position.y = 4;
  charHead.add(helmetMesh);

  // Mat trai va mat phai (Anime styled eyes)
  const eyeGeo = new THREE.CapsuleGeometry(2.5, 7, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  charLeftEye = new THREE.Mesh(eyeGeo, eyeMat);
  charLeftEye.position.set(-10, 0, 26);
  charRightEye = new THREE.Mesh(eyeGeo, eyeMat);
  charRightEye.position.set(10, 0, 26);
  charHead.add(charLeftEye, charRightEye);

  // Tai nghe / Anten hai ben dau
  const earGeo = new THREE.CylinderGeometry(5, 5, 8, 16);
  const earMat = new THREE.MeshStandardMaterial({ color: 0x6366f1 });
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.rotation.z = Math.PI / 2;
  leftEar.position.set(-29, 0, 0);

  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.rotation.z = Math.PI / 2;
  rightEar.position.set(29, 0, 0);

  // Den phat sang tren tai
  const earLightGeo = new THREE.SphereGeometry(3, 12, 12);
  const leftEarLight = new THREE.Mesh(earLightGeo, glowMat);
  leftEarLight.position.set(-34, 0, 0);
  const rightEarLight = new THREE.Mesh(earLightGeo, glowMat);
  rightEarLight.position.set(34, 0, 0);

  charHead.add(leftEar, rightEar, leftEarLight, rightEarLight);
  characterRoot.add(charHead);

  // Tay trai (Left Arm Group)
  charLeftArm = new THREE.Group();
  charLeftArm.position.set(-24, 68, 0);
  const armGeo = new THREE.CylinderGeometry(5, 4.5, 26, 12);
  const leftArmMesh = new THREE.Mesh(armGeo, primaryMat);
  leftArmMesh.position.y = -13;
  const handGeo = new THREE.SphereGeometry(6, 12, 12);
  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.position.y = -27;
  charLeftArm.add(leftArmMesh, leftHand);
  characterRoot.add(charLeftArm);

  // Tay phai (Right Arm Group)
  charRightArm = new THREE.Group();
  charRightArm.position.set(24, 68, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, primaryMat);
  rightArmMesh.position.y = -13;
  const rightHand = new THREE.Mesh(handGeo, skinMat);
  rightHand.position.y = -27;
  charRightArm.add(rightArmMesh, rightHand);
  characterRoot.add(charRightArm);

  // Chan trai (Left Leg Group)
  charLeftLeg = new THREE.Group();
  charLeftLeg.position.set(-10, 32, 0);
  const legGeo = new THREE.CylinderGeometry(6, 5, 28, 12);
  const leftLegMesh = new THREE.Mesh(legGeo, darkMat);
  leftLegMesh.position.y = -14;
  const bootGeo = new THREE.BoxGeometry(11, 8, 18);
  const leftBoot = new THREE.Mesh(bootGeo, primaryMat);
  leftBoot.position.set(0, -28, 3);
  charLeftLeg.add(leftLegMesh, leftBoot);
  characterRoot.add(charLeftLeg);

  // Chan phai (Right Leg Group)
  charRightLeg = new THREE.Group();
  charRightLeg.position.set(10, 32, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, darkMat);
  rightLegMesh.position.y = -14;
  const rightBoot = new THREE.Mesh(bootGeo, primaryMat);
  rightBoot.position.set(0, -28, 3);
  charRightLeg.add(rightLegMesh, rightBoot);
  characterRoot.add(charRightLeg);

  avatarGroup.add(characterRoot);

  // Hitbox vo hinh de bat click chuot
  const hitGeo = new THREE.BoxGeometry(110, 180, 110);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  hitBoxMesh = new THREE.Mesh(hitGeo, hitMat);
  hitBoxMesh.position.y = 80;
  avatarGroup.add(hitBoxMesh);
}

createArticulated3DCharacter();

// 3. Ho tro nap & luu tru mo hinh .VRM (IndexedDB persistence)
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('AiDesktopMateDb', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('models')) {
        db.createObjectStore('models');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveVrmToCache(buffer: ArrayBuffer, name: string) {
  try {
    const db = await initDb();
    const tx = db.transaction('models', 'readwrite');
    tx.objectStore('models').put({ buffer, name }, 'currentModel');
  } catch (_) {}
}

async function loadCachedVrm(): Promise<{ buffer: ArrayBuffer; name: string } | null> {
  try {
    const db = await initDb();
    return new Promise((resolve) => {
      const tx = db.transaction('models', 'readonly');
      const req = tx.objectStore('models').get('currentModel');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function loadVRMFromFile(url: string, fileName?: string) {
  setBubbleMessage(`[DANG NAP] Dang khoi tao mo hinh 3D: ${fileName || '.vrm'}...`);
  loader.load(
    url,
    (gltf) => {
      const vrm = gltf.userData.vrm as VRM;
      if (!vrm) {
        setBubbleMessage('[LOI] File khong phai dinh dang VRM 3D hop le.');
        return;
      }

      avatarGroup.clear();
      avatarGroup.add(hitBoxMesh);

      currentVrm = vrm;
      vrm.scene.scale.set(120, 120, 120);
      vrm.scene.rotation.y = Math.PI;
      avatarGroup.add(vrm.scene);

      setBubbleMessage(`[THANH CONG] Da nap mo hinh 3D: ${fileName || 'VRM Model'}. Keo tha to len Folder de thu nhe!`);
    },
    undefined,
    () => {
      setBubbleMessage('[LOI] Khong the doc file 3D VRM.');
    }
  );
}

// Khoi phuc mo hinh VRM da luu tru truoc do (neu co)
loadCachedVrm().then((cached) => {
  if (cached) {
    const blob = new Blob([cached.buffer]);
    loadVRMFromFile(URL.createObjectURL(blob), cached.name);
  }
});

async function handleFileSelect(file: File) {
  const buffer = await file.arrayBuffer();
  await saveVrmToCache(buffer, file.name);
  const blob = new Blob([buffer]);
  loadVRMFromFile(URL.createObjectURL(blob), file.name);
}

if (btnLoadVrm) {
  btnLoadVrm.addEventListener('click', () => fileInput.click());
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'F4') {
    fileInput.click();
  }
});

fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    handleFileSelect(file);
  }
});

// Keo tha file .vrm truc tiep tu Windows vao cua so
window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file && (file.name.endsWith('.vrm') || file.name.endsWith('.glb'))) {
    handleFileSelect(file);
  }
});

// 4. Vat ly trong luc & bam dinh mep cua so
type State = 'IDLE' | 'DRAGGING' | 'FALLING' | 'SITTING_WINDOW';
let state: State = 'FALLING';

let posX = W - 220;
let posY = 240;
let velY = 0;
const GRAVITY = 0.72;
const TASKBAR_FLOOR = H - 48;

let openWindows: WinRect[] = [];
let attachedWindowHwnd: number | null = null;
let attachedOffsetX = 0;
let attachedWinTitle = '';

// Quet danh sach cua so Windows moi 150ms
setInterval(async () => {
  try {
    openWindows = await invoke<WinRect[]>('get_open_windows');
    if (state === 'SITTING_WINDOW' && attachedWindowHwnd !== null) {
      const targetWin = openWindows.find((w) => w.hwnd === attachedWindowHwnd);
      if (targetWin) {
        posX = targetWin.x + attachedOffsetX;
        posY = targetWin.y;
        attachedWinTitle = targetWin.title;
      } else {
        state = 'FALLING';
        attachedWindowHwnd = null;
        setBubbleMessage('Cua so da bi dong hoac thu nho. To dang roi xuong!');
      }
    }
  } catch (_) {}
}, 150);

// 5. Quan ly bong bong chat (Speech Bubble)
let isBubbleVisible = true;

function setBubbleMessage(msg: string) {
  bubbleContent.textContent = msg;
}

btnMinimizeBubble.addEventListener('click', () => {
  isBubbleVisible = false;
  speechBubble.style.display = 'none';
  bubbleMinimized.style.display = 'block';
});

bubbleMinimized.addEventListener('click', () => {
  isBubbleVisible = true;
  speechBubble.style.display = 'block';
  bubbleMinimized.style.display = 'none';
  syncHitboxToRust(true);
});

function handleSendMessage() {
  const text = bubbleInput.value.trim();
  if (!text) return;
  bubbleInput.value = '';

  const lower = text.toLowerCase();
  if (lower.includes('vrm') || lower.includes('avatar') || lower.includes('doi')) {
    setBubbleMessage('Hay bam nut "Chon .VRM (F4)" hoac keo tha file 3D .vrm vao de doi nhan vat nhe!');
    fileInput.click();
  } else if (lower.includes('chao') || lower.includes('hello') || lower.includes('hi')) {
    setBubbleMessage('Chao ban! Hom nay cong viec the nao? Keo to len mep ung dung de to xem nhe!');
  } else if (lower.includes('ten') || lower.includes('ai')) {
    setBubbleMessage('To la AI Desktop Mate - tro ly ban dong hanh 3D tren man hinh cua ban.');
  } else {
    setBubbleMessage(`Da ghi nhan lenh: "${text}". To dang xu ly cung he thong!`);
    posY -= 30;
    velY = -5;
    state = 'FALLING';
  }
}

btnSendMsg.addEventListener('click', handleSendMessage);
bubbleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleSendMessage();
  }
});

// 6. Tuong tac chuot & dong bo Hitbox voi Rust backend
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let dragDeltaX = 0;
let dragDeltaY = 0;

let lastHitboxSync = 0;
function syncHitboxToRust(force = false) {
  const now = performance.now();
  if (force || now - lastHitboxSync >= 30) {
    lastHitboxSync = now;
    invoke('update_character_hitbox', {
      x: Math.round(posX),
      y: Math.round(posY - 80),
      radius: isBubbleVisible ? 180 : 95,
      isDragging: state === 'DRAGGING',
      isUiOpen: isBubbleVisible,
    }).catch(() => {});
  }
}

function checkMouseIntersect(clientX: number, clientY: number): boolean {
  mouseNDC.x = (clientX / W) * 2 - 1;
  mouseNDC.y = -(clientY / H) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObject(hitBoxMesh, true);
  return hits.length > 0;
}

window.addEventListener('mousemove', (e) => {
  if (state === 'DRAGGING') {
    posX = e.clientX - dragDeltaX;
    posY = e.clientY - dragDeltaY;
    syncHitboxToRust(true);
    return;
  }

  if (checkMouseIntersect(e.clientX, e.clientY)) {
    document.body.style.cursor = 'grab';
  } else {
    document.body.style.cursor = 'default';
  }
});

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;

  // Neu click vao UI bong bong chat thi khong bat drag nhan vat
  if (isBubbleVisible && speechBubble.contains(e.target as Node)) {
    return;
  }
  if (bubbleMinimized.contains(e.target as Node)) {
    return;
  }

  if (checkMouseIntersect(e.clientX, e.clientY)) {
    state = 'DRAGGING';
    attachedWindowHwnd = null;
    velY = 0;
    dragDeltaX = e.clientX - posX;
    dragDeltaY = e.clientY - posY;
    document.body.style.cursor = 'grabbing';
    setBubbleMessage('Aaaa tha to ra! Dang duoc be di choi ne!');
    syncHitboxToRust(true);
  }
});

window.addEventListener('mouseup', () => {
  if (state === 'DRAGGING') {
    state = 'FALLING';
    document.body.style.cursor = 'grab';
    syncHitboxToRust(true);
  }
});

// Click dup de bat/tat bong bong chat
window.addEventListener('dblclick', (e) => {
  if (checkMouseIntersect(e.clientX, e.clientY)) {
    isBubbleVisible = !isBubbleVisible;
    speechBubble.style.display = isBubbleVisible ? 'block' : 'none';
    bubbleMinimized.style.display = isBubbleVisible ? 'none' : 'block';
    syncHitboxToRust(true);
  }
});

// 7. Render Loop & Hoat anh 3D (Khop xuong, nhay, roi, ngoi)
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  if (state === 'FALLING') {
    const prevY = posY;
    velY += GRAVITY;
    posY += velY;

    for (const win of openWindows) {
      const withinX = posX >= win.x + 20 && posX <= win.x + win.width - 20;
      const crossedTopEdge = prevY <= win.y + 14 && posY >= win.y - 8;

      if (withinX && crossedTopEdge && velY > 0) {
        posY = win.y;
        velY = 0;
        state = 'SITTING_WINDOW';
        attachedWindowHwnd = win.hwnd;
        attachedOffsetX = posX - win.x;
        attachedWinTitle = win.title;
        setBubbleMessage(`To dang ngoi nghi tren: ${attachedWinTitle.slice(0, 26)}`);
        break;
      }
    }

    if (posY >= TASKBAR_FLOOR) {
      posY = TASKBAR_FLOOR;
      velY = 0;
      state = 'IDLE';
    }
  }

  avatarGroup.position.set(posX, -posY, 0);

  // Hoat anh 3D cac khop chan, tay, dau khi chua nap VRM
  if (!currentVrm && charTorso) {
    if (state === 'SITTING_WINDOW') {
      // Tu the ngoi: Chan gap ve phia truoc 90 do, rung rinh chan
      charLeftLeg.rotation.x = -Math.PI / 2 + Math.sin(elapsed * 3.5) * 0.18;
      charRightLeg.rotation.x = -Math.PI / 2 + Math.cos(elapsed * 3.5) * 0.18;
      charLeftArm.rotation.x = -0.35;
      charRightArm.rotation.x = -0.35;
      charHead.rotation.y = Math.sin(elapsed * 1.5) * 0.22;
      charHead.rotation.z = Math.sin(elapsed * 2) * 0.05;
      avatarGroup.rotation.z = Math.sin(elapsed * 3) * 0.04;
    } else if (state === 'FALLING') {
      // Tu the roi: Hai tay gio len cao, chan vay dap
      charLeftArm.rotation.z = 2.2;
      charRightArm.rotation.z = -2.2;
      charLeftLeg.rotation.x = Math.sin(elapsed * 12) * 0.4;
      charRightLeg.rotation.x = -Math.sin(elapsed * 12) * 0.4;
      charHead.rotation.x = -0.2;
      avatarGroup.rotation.z = 0;
    } else if (state === 'DRAGGING') {
      // Tu the bi keo: Nguoi vung vay, lac lu hai ben
      avatarGroup.rotation.z = Math.sin(elapsed * 14) * 0.22;
      charLeftArm.rotation.z = 1.4 + Math.sin(elapsed * 14) * 0.3;
      charRightArm.rotation.z = -1.4 - Math.sin(elapsed * 14) * 0.3;
      charLeftLeg.rotation.x = Math.sin(elapsed * 14) * 0.3;
      charRightLeg.rotation.x = -Math.sin(elapsed * 14) * 0.3;
    } else {
      // Tu the dung tho (Idle breathing)
      charLeftLeg.rotation.x = 0;
      charRightLeg.rotation.x = 0;
      charLeftArm.rotation.z = 0.15;
      charRightArm.rotation.z = -0.15;
      charLeftArm.rotation.x = Math.sin(elapsed * 2.5) * 0.1;
      charRightArm.rotation.x = -Math.sin(elapsed * 2.5) * 0.1;
      charHead.rotation.y = Math.sin(elapsed * 1.2) * 0.15;
      avatarGroup.rotation.z = 0;
      avatarGroup.position.y += Math.sin(elapsed * 2.5) * 3;
    }

    // Chop mat 3D dinh ky
    const blinkCycle = Math.sin(elapsed * 1.8);
    const scaleY = blinkCycle > 0.95 ? 0.1 : 1.0;
    charLeftEye.scale.y = scaleY;
    charRightEye.scale.y = scaleY;
  } else if (currentVrm) {
    currentVrm.update(delta);
    if (state === 'DRAGGING') {
      avatarGroup.rotation.z = Math.sin(elapsed * 14) * 0.18;
    } else {
      avatarGroup.rotation.z = 0;
    }
  }

  // Cap nhat vi tri bong bong chat theo dau nhan vat
  if (isBubbleVisible) {
    speechBubble.style.left = `${Math.max(12, Math.min(W - 310, posX - 145))}px`;
    speechBubble.style.top = `${Math.max(12, posY - 245)}px`;
  } else {
    bubbleMinimized.style.left = `${Math.max(12, Math.min(W - 100, posX - 45))}px`;
    bubbleMinimized.style.top = `${Math.max(12, posY - 170)}px`;
  }

  syncHitboxToRust();
  renderer.render(scene, camera);
}

animate();
