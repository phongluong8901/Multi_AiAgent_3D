import * as THREE from 'three';
import { appState } from '../../core/state';
import {
  setRigRoot,
  setRigHips,
  setRigTorso,
  setRigHead,
  setRigLeftTwinTail,
  setRigRightTwinTail,
  setRigLeftArm,
  setRigRightArm,
  setRigLeftForearm,
  setRigRightForearm,
  setRigLeftLeg,
  setRigRightLeg,
  setRigLeftShin,
  setRigRightShin,
  resetRigNodes,
} from '../rigState';
import { initFaceCanvas } from './animeFace';
import { reattachActiveAccessory } from '../accessories3d';

export function createDetailedAnimeCharacter() {
  appState.avatarGroup.clear();
  appState.ensureHitbox();
  appState.avatarGroup.add(appState.hitBoxMesh);

  appState.currentVrm = null;
  appState.currentGlbScene = null;
  appState.currentGlbMixer = null;
  appState.builtinModelType = 'idol';

  resetRigNodes();

  const root = new THREE.Group();
  setRigRoot(root);

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x312e81,
    roughness: 0.45,
    metalness: 0.15,
  });
  const hairHighlightMat = new THREE.MeshStandardMaterial({
    color: 0x4338ca,
    roughness: 0.4,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffeedd,
    roughness: 0.65,
  });
  const uniformTopMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.5,
  });
  const navyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
  });
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    roughness: 0.4,
  });
  const accentGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });
  const sockMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.25,
  });

  const faceTexture = initFaceCanvas();
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.6,
  });

  const hips = new THREE.Group();
  hips.position.y = 62;
  root.add(hips);
  setRigHips(hips);

  const torso = new THREE.Group();
  hips.add(torso);
  setRigTorso(torso);

  const chestMesh = new THREE.Mesh(new THREE.CylinderGeometry(13, 11, 36, 18), uniformTopMat);
  chestMesh.position.y = 20;
  torso.add(chestMesh);

  const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 16, 10, 18), navyMat);
  collarMesh.position.y = 33;
  torso.add(collarMesh);

  const bowLeft = new THREE.Mesh(new THREE.ConeGeometry(5, 9, 4), ribbonMat);
  bowLeft.position.set(-4, 27, 13);
  bowLeft.rotation.z = -Math.PI / 2;
  const bowRight = new THREE.Mesh(new THREE.ConeGeometry(5, 9, 4), ribbonMat);
  bowRight.position.set(4, 27, 13);
  bowRight.rotation.z = Math.PI / 2;
  const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 10), ribbonMat);
  bowCenter.position.set(0, 27, 14);
  torso.add(bowLeft, bowRight, bowCenter);

  const skirtMesh = new THREE.Mesh(new THREE.ConeGeometry(23, 24, 20, 1, false), navyMat);
  skirtMesh.position.y = 2;
  torso.add(skirtMesh);

  const skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(21.5, 1.1, 8, 24), accentGlowMat);
  skirtTrim.rotation.x = Math.PI / 2;
  skirtTrim.position.y = -8;
  torso.add(skirtTrim);

  const head = new THREE.Group();
  head.position.y = 44;
  torso.add(head);
  setRigHead(head);

  const headGeo = new THREE.SphereGeometry(25, 28, 24, -Math.PI / 2, Math.PI * 2);
  const headMesh = new THREE.Mesh(headGeo, faceMat);
  headMesh.position.y = 22;
  headMesh.scale.set(1.0, 0.98, 0.94);
  head.add(headMesh);

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(26.8, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairBack.position.set(0, 24, -2);
  hairBack.rotation.x = -0.3;
  head.add(hairBack);

  const bangsGroup = new THREE.Group();
  bangsGroup.position.set(0, 38, 17);
  for (let i = -2; i <= 2; i++) {
    const bang = new THREE.Mesh(new THREE.ConeGeometry(5.2, 16, 6), hairHighlightMat);
    bang.position.set(i * 6.5, -4, 3 - Math.abs(i) * 1.6);
    bang.rotation.x = Math.PI + 0.25;
    bang.rotation.z = i * -0.08;
    bangsGroup.add(bang);
  }
  head.add(bangsGroup);

  const leftSideLock = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.5, 26, 8), hairHighlightMat);
  leftSideLock.position.set(-20, 14, 11);
  leftSideLock.rotation.z = 0.08;
  const rightSideLock = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.5, 26, 8), hairHighlightMat);
  rightSideLock.position.set(20, 14, 11);
  rightSideLock.rotation.z = -0.08;
  head.add(leftSideLock, rightSideLock);

  const createTwinTail = (side: -1 | 1): THREE.Group => {
    const tailGroup = new THREE.Group();
    tailGroup.position.set(side * 24, 32, -8);

    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(4.5, 1.6, 8, 16), accentGlowMat);
    ribbon.rotation.y = Math.PI / 2;
    tailGroup.add(ribbon);

    const upperTail = new THREE.Mesh(new THREE.ConeGeometry(7.5, 42, 12), hairMat);
    upperTail.position.set(side * 6, -20, -4);
    upperTail.rotation.z = side * 0.25;
    upperTail.rotation.x = Math.PI;
    tailGroup.add(upperTail);

    const lowerTip = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 10), hairHighlightMat);
    lowerTip.position.set(side * 11, -38, -6);
    lowerTip.rotation.z = side * 0.12;
    lowerTip.rotation.x = Math.PI;
    tailGroup.add(lowerTip);

    return tailGroup;
  };

  const leftTwinTail = createTwinTail(-1);
  const rightTwinTail = createTwinTail(1);
  setRigLeftTwinTail(leftTwinTail);
  setRigRightTwinTail(rightTwinTail);
  head.add(leftTwinTail, rightTwinTail);

  const buildArm = (side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 16, 35, 0);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.6, 18, 12), uniformTopMat);
    upperArm.position.y = -9;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -18;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 2.8, 17, 12), skinMat);
    forearm.position.y = -8.5;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 12), skinMat);
    hand.position.y = -18;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArmRig = buildArm(-1);
  const rightArmRig = buildArm(1);
  setRigLeftArm(leftArmRig.shoulder);
  setRigLeftForearm(leftArmRig.elbow);
  setRigRightArm(rightArmRig.shoulder);
  setRigRightForearm(rightArmRig.elbow);
  torso.add(leftArmRig.shoulder, rightArmRig.shoulder);

  const buildLeg = (side: -1 | 1): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 8.5, 0, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 4.6, 26, 12), skinMat);
    thigh.position.y = -13;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -26;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 3.6, 26, 12), sockMat);
    shin.position.y = -13;
    knee.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(9.5, 7, 15), shoeMat);
    shoe.position.set(0, -28, 3);
    knee.add(shoe);

    return { hip, knee };
  };

  const leftLegRig = buildLeg(-1);
  const rightLegRig = buildLeg(1);
  setRigLeftLeg(leftLegRig.hip);
  setRigLeftShin(leftLegRig.knee);
  setRigRightLeg(rightLegRig.hip);
  setRigRightShin(rightLegRig.knee);
  hips.add(leftLegRig.hip, rightLegRig.hip);

  root.scale.setScalar(appState.modelScale);
  appState.avatarGroup.add(root);
  reattachActiveAccessory();
}
