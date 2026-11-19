import * as THREE from 'three';

export interface DuckNodes {
  beakUpper: THREE.Group | null;
  beakLower: THREE.Group | null;
  neck: THREE.Group | null;
  cameraRingMat: THREE.MeshStandardMaterial | null;
  wheels: THREE.Object3D[];
  footRollers: THREE.Group[];
  feet: THREE.Group[];
}

export let rigRoot: THREE.Group | null = null;
export let rigHips: THREE.Group | null = null;
export let rigTorso: THREE.Group | null = null;
export let rigHead: THREE.Group | null = null;
export let rigLeftTwinTail: THREE.Group | null = null;
export let rigRightTwinTail: THREE.Group | null = null;
export let rigLeftArm: THREE.Group | null = null;
export let rigRightArm: THREE.Group | null = null;
export let rigLeftForearm: THREE.Group | null = null;
export let rigRightForearm: THREE.Group | null = null;
export let rigLeftLeg: THREE.Group | null = null;
export let rigRightLeg: THREE.Group | null = null;
export let rigLeftShin: THREE.Group | null = null;
export let rigRightShin: THREE.Group | null = null;

export const duckNodes: DuckNodes = {
  beakUpper: null,
  beakLower: null,
  neck: null,
  cameraRingMat: null,
  wheels: [],
  footRollers: [],
  feet: [],
};

export function setRigRoot(node: THREE.Group | null) { rigRoot = node; }
export function setRigHips(node: THREE.Group | null) { rigHips = node; }
export function setRigTorso(node: THREE.Group | null) { rigTorso = node; }
export function setRigHead(node: THREE.Group | null) { rigHead = node; }
export function setRigLeftTwinTail(node: THREE.Group | null) { rigLeftTwinTail = node; }
export function setRigRightTwinTail(node: THREE.Group | null) { rigRightTwinTail = node; }
export function setRigLeftArm(node: THREE.Group | null) { rigLeftArm = node; }
export function setRigRightArm(node: THREE.Group | null) { rigRightArm = node; }
export function setRigLeftForearm(node: THREE.Group | null) { rigLeftForearm = node; }
export function setRigRightForearm(node: THREE.Group | null) { rigRightForearm = node; }
export function setRigLeftLeg(node: THREE.Group | null) { rigLeftLeg = node; }
export function setRigRightLeg(node: THREE.Group | null) { rigRightLeg = node; }
export function setRigLeftShin(node: THREE.Group | null) { rigLeftShin = node; }
export function setRigRightShin(node: THREE.Group | null) { rigRightShin = node; }

export function resetRigNodes() {
  rigRoot = null;
  rigHips = null;
  rigTorso = null;
  rigHead = null;
  rigLeftTwinTail = null;
  rigRightTwinTail = null;
  rigLeftArm = null;
  rigRightArm = null;
  rigLeftForearm = null;
  rigRightForearm = null;
  rigLeftLeg = null;
  rigRightLeg = null;
  rigLeftShin = null;
  rigRightShin = null;

  duckNodes.beakUpper = null;
  duckNodes.beakLower = null;
  duckNodes.neck = null;
  duckNodes.cameraRingMat = null;
  duckNodes.wheels = [];
  duckNodes.footRollers = [];
  duckNodes.feet = [];
}

export function lerpRot(
  obj: THREE.Object3D | null,
  ax: 'x' | 'y' | 'z',
  target: number,
  lerpRate: number
) {
  if (obj) {
    obj.rotation[ax] = THREE.MathUtils.lerp(obj.rotation[ax], target, lerpRate);
  }
}

