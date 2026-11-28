import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm';
import { appState } from '../../core/state';
import { spawnParticles } from '../../core/particles';
import { saveVrmToCache } from './vrmCache';
import { createMicroDuckCharacter } from '../microduck/microduckModel';
import { reattachActiveAccessory } from '../accessories3d';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

export const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.register((parser) => new VRMLoaderPlugin(parser));

let uiSpeakCallback: ((msg: string) => void) | null = null;

export function registerSpeakCallback(cb: (msg: string) => void) {
  uiSpeakCallback = cb;
}

export function speak(msg: string) {
  if (uiSpeakCallback) {
    uiSpeakCallback(msg);
  }
}

export function applyVrmScaleAndOffset(vrm: VRM) {
  vrm.scene.scale.setScalar(appState.vrmBaseScale * appState.modelScale);
  vrm.scene.position.y = appState.vrmFloorOffset * appState.modelScale;
}

export function applyGlbScaleAndOffset(glbRoot: THREE.Object3D) {
  glbRoot.scale.setScalar(appState.vrmBaseScale * appState.modelScale);
  glbRoot.position.y = appState.vrmFloorOffset * appState.modelScale;
}

export function loadVrmFromBlobUrl(url: string, label: string) {
  speak(`[ĐANG NẠP] Đang khởi tạo Mô hình 3D: ${label}...`);
  gltfLoader.load(
    url,
    (gltf) => {
      const vrm = gltf.userData.vrm as VRM | undefined;

      if (vrm) {
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.rotateVRM0(vrm);

        vrm.scene.scale.setScalar(1);
        vrm.scene.position.set(0, 0, 0);
        vrm.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(vrm.scene);
        const height = Math.max(0.5, box.max.y - box.min.y);
        appState.vrmBaseScale = 165 / height;
        appState.vrmFloorOffset = -box.min.y * appState.vrmBaseScale;

        appState.avatarGroup.clear();
        appState.ensureHitbox();
        appState.avatarGroup.add(appState.hitBoxMesh);

        appState.currentGlbScene = null;
        appState.currentGlbMixer = null;
        appState.currentVrm = vrm;
        applyVrmScaleAndOffset(vrm);
        appState.avatarGroup.add(vrm.scene);
        reattachActiveAccessory();

        spawnParticles(appState.posX, appState.posY - 90, 12, 0x38bdf8);
        speak(`Đã nạp xong Avatar VRM: ${label}! Kéo thả tớ lên cửa sổ nhé.`);
        appState.changeMood(10);
        return;
      }

      // Hỗ trợ file .GLB / .GLTF chuẩn không có dữ liệu VRM humanoid
      gltf.scene.scale.setScalar(1);
      gltf.scene.position.set(0, 0, 0);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const height = Math.max(0.01, size.y);
      const safeRef = Math.max(0.01, height, Math.max(size.x, size.z) * 0.65);

      // Đưa tâm đáy về gốc tọa độ (0, 0, 0)
      gltf.scene.position.set(-center.x, -box.min.y, -center.z);
      const wrapper = new THREE.Group();
      wrapper.add(gltf.scene);

      appState.vrmBaseScale = 150 / safeRef;
      appState.vrmFloorOffset = 0;

      appState.avatarGroup.clear();
      appState.ensureHitbox();
      appState.avatarGroup.add(appState.hitBoxMesh);

      appState.currentVrm = null;
      appState.currentGlbScene = wrapper;
      appState.currentGlbMixer = null;

      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(gltf.scene);
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
        appState.currentGlbMixer = mixer;
      }

      applyGlbScaleAndOffset(wrapper);
      appState.avatarGroup.add(wrapper);

      spawnParticles(appState.posX, appState.posY - 90, 12, 0x76b900);
      speak(`Đã nạp xong mô hình 3D GLB: ${label}! Kéo thả hoặc ra lệnh cho tớ nhé.`);
      appState.changeMood(10);
    },
    undefined,
    () => {
      speak('[LỖI] Không thể đọc mô hình 3D. Đang tự động hoàn tác về NVIDIA MicroDuck mặc định!');
      localStorage.setItem('mate_active_character_type', 'microduck');
      createMicroDuckCharacter();
    }
  );
}

export async function loadVrmFromBuffer(buffer: ArrayBuffer, name: string) {
  await saveVrmToCache(buffer, name);
  const blobUrl = URL.createObjectURL(new Blob([buffer]));
  loadVrmFromBlobUrl(blobUrl, name);
}

export async function loadVrmFromUrl(url: string, name: string) {
  speak(`[ĐANG TẢI] Đang tải Avatar 3D từ mạng: ${name}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    await loadVrmFromBuffer(buffer, name);
  } catch {
    speak('[LỖI] Không thể tải URL VRM (kiểm tra kết nối mạng hoặc dùng file .vrm từ máy tính).');
  }
}

