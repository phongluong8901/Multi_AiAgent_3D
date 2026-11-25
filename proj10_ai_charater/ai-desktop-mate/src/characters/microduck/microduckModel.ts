import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  duckNodes,
  resetRigNodes,
} from '../rigState';
import { resetFaceCanvas } from '../animeIdol/animeFace';
import { reattachActiveAccessory } from '../accessories3d';

function mergeStaticMeshesInGroup(
  group: THREE.Group,
  excludeNodes: Set<THREE.Object3D>
) {
  group.updateMatrixWorld(true);
  const invGroupMat = group.matrixWorld.clone().invert();
  const relMat = new THREE.Matrix4();

  const buckets = new Map<THREE.Material, THREE.Mesh[]>();
  const collect = (obj: THREE.Object3D) => {
    if (obj !== group && excludeNodes.has(obj)) return;
    if (obj instanceof THREE.Mesh && !Array.isArray(obj.material)) {
      const list = buckets.get(obj.material) || [];
      list.push(obj);
      buckets.set(obj.material, list);
    }
    for (const child of obj.children) {
      collect(child);
    }
  };
  collect(group);

  const candidateGeosToDispose = new Set<THREE.BufferGeometry>();

  for (const [mat, meshes] of buckets.entries()) {
    if (meshes.length < 2) continue;

    const normalizedGeos: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      relMat.multiplyMatrices(invGroupMat, m.matrixWorld);
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(relMat);
      if (!g.getAttribute('normal')) {
        g.computeVertexNormals();
      }
      for (const attrName of Object.keys(g.attributes)) {
        if (attrName !== 'position' && attrName !== 'normal') {
          g.deleteAttribute(attrName);
        }
      }
      normalizedGeos.push(g);
    }

    const merged = mergeGeometries(normalizedGeos, false);
    normalizedGeos.forEach((g) => g.dispose());
    if (!merged) continue;

    for (const m of meshes) {
      if (m.children.length > 0) {
        for (const ch of [...m.children]) {
          group.attach(ch);
        }
      }
      m.parent?.remove(m);
      candidateGeosToDispose.add(m.geometry);
    }

    group.add(new THREE.Mesh(merged, mat));
  }

  const pruneEmptyGroups = (obj: THREE.Object3D) => {
    for (const ch of [...obj.children]) {
      pruneEmptyGroups(ch);
    }
    if (
      obj !== group &&
      !excludeNodes.has(obj) &&
      !(obj instanceof THREE.Mesh) &&
      obj.children.length === 0
    ) {
      obj.parent?.remove(obj);
    }
  };
  pruneEmptyGroups(group);

  const activeGeos = new Set<THREE.BufferGeometry>();
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      activeGeos.add(obj.geometry);
    }
  });
  for (const geo of candidateGeosToDispose) {
    if (!activeGeos.has(geo)) {
      geo.dispose();
    }
  }
}

/** Dựng cây khung 3D MicroDuck dùng chung cho nhân vật chính và bản sao (đổi màu, không kèm rig/hiệu ứng phụ) */
function buildMicroDuckHierarchy(
  bodyColor: THREE.ColorRepresentation,
  accentColor: THREE.ColorRepresentation,
  bindGlobalRig: boolean
): { root: THREE.Group; legL: THREE.Group; legR: THREE.Group } {
  const localWheels: THREE.Group[] = [];
  const localFootRollers: THREE.Group[] = [];
  const localFeet: THREE.Group[] = [];

  if (bindGlobalRig) {
    appState.avatarGroup.clear();
    appState.ensureHitbox();
    appState.avatarGroup.add(appState.hitBoxMesh);

    appState.currentVrm = null;
    appState.currentGlbScene = null;
    appState.currentGlbMixer = null;
    appState.builtinModelType = 'microduck';

    resetFaceCanvas();
    resetRigNodes();
    setRigLeftTwinTail(null);
    setRigRightTwinTail(null);
  }

  const root = new THREE.Group();
  if (bindGlobalRig) {
    setRigRoot(root);
  }

  const whitePrintMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(bodyColor),
    shininess: 38,
    specular: 0x333333,
  });
  const innerFaceMat = new THREE.MeshPhongMaterial({
    color: 0xe2e8f0,
    shininess: 24,
    specular: 0x222222,
  });
  const orangePrintMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(accentColor),
    shininess: 42,
    specular: 0x3a2818,
  });
  const camRingMat = new THREE.MeshPhongMaterial({
    color: 0xf59e0b,
    shininess: 55,
    specular: 0x554422,
  });
  if (bindGlobalRig) {
    duckNodes.cameraRingMat = camRingMat;
  }
  const blackServoMat = new THREE.MeshPhongMaterial({
    color: 0x18181b,
    shininess: 45,
    specular: 0x444444,
  });
  const silverBracketMat = new THREE.MeshPhongMaterial({
    color: 0xd4d4d8,
    shininess: 78,
    specular: 0x888888,
  });
  const lensGlassMat = new THREE.MeshPhongMaterial({
    color: 0x050811,
    shininess: 95,
    specular: 0x99aabb,
  });
  const boltDotMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const makeRoundedRect = (w: number, h: number, r: number): THREE.Shape => {
    const s = new THREE.Shape();
    const hw = w / 2;
    const hh = h / 2;
    const cr = Math.min(r, hw, hh);
    s.moveTo(-hw + cr, -hh);
    s.lineTo(hw - cr, -hh);
    s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
    s.lineTo(hw, hh - cr);
    s.quadraticCurveTo(hw, hh, hw - cr, hh);
    s.lineTo(-hw + cr, hh);
    s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
    s.lineTo(-hw, -hh + cr);
    s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
    return s;
  };

  const makeSolidArch = (w: number, h: number): THREE.Shape => {
    const s = new THREE.Shape();
    const hw = w / 2;
    const sh = h * 0.28;
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, sh);
    s.absellipse(0, sh, hw, h - sh, 0, Math.PI, false, 0);
    s.lineTo(-hw, 0);
    return s;
  };

  const makeHollowArch = (w: number, h: number, t: number): THREE.Shape => {
    const s = new THREE.Shape();
    const hw = w / 2;
    const sh = h * 0.28;
    s.moveTo(hw, 0);
    s.lineTo(hw, sh);
    s.absellipse(0, sh, hw, h - sh, 0, Math.PI, false, 0);
    s.lineTo(-hw, 0);
    s.lineTo(-hw + t, 0);
    s.lineTo(-hw + t, sh);
    s.absellipse(0, sh, hw - t, h - t - sh, Math.PI, 0, true, 0);
    s.lineTo(hw - t, 0);
    s.lineTo(hw, 0);
    return s;
  };

  const addBoltDots = (parent: THREE.Object3D, pts: Array<[number, number, number]>, r = 0.85) => {
    const geo = new THREE.SphereGeometry(r, 8, 8);
    pts.forEach(([bx, by, bz]) => {
      const m = new THREE.Mesh(geo, boltDotMat);
      m.position.set(bx, by, bz);
      parent.add(m);
    });
  };

  if (bindGlobalRig) {
    duckNodes.wheels = localWheels;
    duckNodes.footRollers = localFootRollers;
    duckNodes.feet = localFeet;
  }

  const hips = new THREE.Group();
  hips.position.y = 66;
  root.add(hips);
  if (bindGlobalRig) {
    setRigHips(hips);
  }

  const hipConnector = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 18), blackServoMat);
  hipConnector.position.set(0, -6, 0);
  hips.add(hipConnector);

  [-7.8, 7.8].forEach((sx) => {
    const hipServoBox = new THREE.Mesh(new THREE.BoxGeometry(11.5, 16, 17), blackServoMat);
    hipServoBox.position.set(sx, -8, 1);
    hips.add(hipServoBox);

    const frontUBracket = new THREE.Mesh(new THREE.BoxGeometry(9.5, 10, 6), silverBracketMat);
    frontUBracket.position.set(sx, -6, 9);
    hips.add(frontUBracket);

    const frontDisc = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 3.2, 16), silverBracketMat);
    frontDisc.rotation.x = Math.PI / 2;
    frontDisc.position.set(sx, -6, 11.5);
    hips.add(frontDisc);

    const centerHole = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3.6, 12), blackServoMat);
    centerHole.rotation.x = Math.PI / 2;
    centerHole.position.set(sx, -6, 11.5);
    hips.add(centerHole);

    addBoltDots(
      hips,
      [
        [sx - 3.3, -6, 13.1],
        [sx + 3.3, -6, 13.1],
        [sx, -2.7, 13.1],
        [sx, -9.3, 13.1],
      ],
      0.55
    );
  });

  const torso = new THREE.Group();
  torso.position.set(0, 6, 0);
  hips.add(torso);
  if (bindGlobalRig) {
    setRigTorso(torso);
  }

  const torsoGeo = new THREE.ExtrudeGeometry(makeRoundedRect(46, 17, 6.2), {
    depth: 32,
    bevelEnabled: true,
    bevelThickness: 2.5,
    bevelSize: 2.2,
    bevelSegments: 4,
  });
  torsoGeo.translate(0, 0, -16);
  const whiteTorsoMesh = new THREE.Mesh(torsoGeo, whitePrintMat);
  whiteTorsoMesh.position.set(0, 8, 0);
  torso.add(whiteTorsoMesh);

  const neckCollar = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 14), whitePrintMat);
  neckCollar.position.set(0, 15, 7);
  torso.add(neckCollar);
  addBoltDots(
    neckCollar,
    [
      [-7.5, 2, 7.2],
      [7.5, 2, 7.2],
      [-7.5, -2, 7.2],
      [7.5, -2, 7.2],
    ],
    0.85
  );

  const neck = new THREE.Group();
  neck.position.set(0, 15, 5);
  neck.rotation.x = 0.14;
  torso.add(neck);
  if (bindGlobalRig) {
    duckNodes.neck = neck;
  }

  const buildNeckServoSegment = (segY: number, tiltX: number) => {
    const seg = new THREE.Group();
    seg.position.set(0, segY, 0);
    seg.rotation.x = tiltX;

    const core = new THREE.Mesh(new THREE.BoxGeometry(13.5, 15, 13.5), blackServoMat);
    core.position.y = 7.5;
    seg.add(core);

    [-7.3, 7.3].forEach((sideX) => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.6, 12, 9), silverBracketMat);
      bracket.position.set(sideX, 7.5, 0);
      seg.add(bracket);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 1.8, 14), silverBracketMat);
      disc.rotation.z = Math.PI / 2;
      disc.position.set(sideX, 1, 0);
      seg.add(disc);
      addBoltDots(
        seg,
        [
          [sideX + Math.sign(sideX) * 0.9, 10, -2.5],
          [sideX + Math.sign(sideX) * 0.9, 10, 2.5],
          [sideX + Math.sign(sideX) * 0.9, 5, 0],
        ],
        0.65
      );
    });

    const frontSpecSticker = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 1), silverBracketMat);
    frontSpecSticker.position.set(-2, 8, 6.9);
    seg.add(frontSpecSticker);

    neck.add(seg);
  };

  buildNeckServoSegment(0, -0.05);
  buildNeckServoSegment(16, -0.14);

  const topNeckPivot = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 16, 14), silverBracketMat);
  topNeckPivot.rotation.z = Math.PI / 2;
  topNeckPivot.position.set(0, 32, -2);
  neck.add(topNeckPivot);

  const cableLoop = new THREE.Mesh(new THREE.TorusGeometry(6.5, 1.3, 8, 18, Math.PI * 1.2), blackServoMat);
  cableLoop.rotation.y = Math.PI / 2;
  cableLoop.rotation.z = Math.PI * 0.4;
  cableLoop.position.set(0, 25, -7);
  neck.add(cableLoop);

  const head = new THREE.Group();
  head.position.set(0, 34, 4);
  neck.add(head);
  if (bindGlobalRig) {
    setRigHead(head);
  }

  const headRearGeo = new THREE.ExtrudeGeometry(makeSolidArch(58, 36), {
    depth: 26,
    bevelEnabled: true,
    bevelThickness: 2.2,
    bevelSize: 2.0,
    bevelSegments: 4,
  });
  headRearGeo.translate(0, 0, -20);
  const headRearMesh = new THREE.Mesh(headRearGeo, whitePrintMat);
  head.add(headRearMesh);

  const hoodLipGeo = new THREE.ExtrudeGeometry(makeHollowArch(62, 38.5, 4.6), {
    depth: 12,
    bevelEnabled: true,
    bevelThickness: 1.5,
    bevelSize: 1.2,
    bevelSegments: 3,
  });
  hoodLipGeo.translate(0, 0, 5.5);
  const hoodLipMesh = new THREE.Mesh(hoodLipGeo, whitePrintMat);
  head.add(hoodLipMesh);

  const facePlateGeo = new THREE.ExtrudeGeometry(makeSolidArch(52, 30.5), {
    depth: 2.2,
    bevelEnabled: false,
  });
  facePlateGeo.translate(0, 0, 5.5);
  const facePlateMesh = new THREE.Mesh(facePlateGeo, innerFaceMat);
  head.add(facePlateMesh);

  const camEyeGroup = new THREE.Group();
  camEyeGroup.position.set(-2.5, 18.5, 8.2);
  head.add(camEyeGroup);

  const camBezelRing = new THREE.Mesh(new THREE.TorusGeometry(6.6, 2.4, 16, 30), camRingMat);
  camEyeGroup.add(camBezelRing);

  const camSleeve = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.9, 3.6, 24), camRingMat);
  camSleeve.rotation.x = Math.PI / 2;
  camSleeve.position.z = -1.2;
  camEyeGroup.add(camSleeve);

  const camInnerBarrel = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.1, 4.2, 22), blackServoMat);
  camInnerBarrel.rotation.x = Math.PI / 2;
  camEyeGroup.add(camInnerBarrel);

  const camLensDome = new THREE.Mesh(new THREE.SphereGeometry(4.0, 16, 12), lensGlassMat);
  camLensDome.scale.set(1, 1, 0.45);
  camLensDome.position.z = 1.6;
  camEyeGroup.add(camLensDome);

  const camGlint = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 8), highlightMat);
  camGlint.position.set(-1.3, 1.4, 3.1);
  camEyeGroup.add(camGlint);

  const shutterMat = new THREE.MeshPhongMaterial({
    color: 0x1e293b,
    shininess: 68,
    specular: 0x64748b,
    side: THREE.DoubleSide,
  });
  const eyelidUpperGeo = new THREE.SphereGeometry(4.34, 20, 10, 0, Math.PI, 0, Math.PI * 0.52);
  const eyelidUpper = new THREE.Mesh(eyelidUpperGeo, shutterMat);
  eyelidUpper.position.set(0, 0, 0.12);
  eyelidUpper.rotation.x = -1.42;
  camEyeGroup.add(eyelidUpper);

  const eyelidLowerGeo = new THREE.SphereGeometry(
    4.31,
    20,
    10,
    0,
    Math.PI,
    Math.PI * 0.48,
    Math.PI * 0.52
  );
  const eyelidLower = new THREE.Mesh(eyelidLowerGeo, shutterMat);
  eyelidLower.position.set(0, 0, 0.12);
  eyelidLower.rotation.x = 1.42;
  camEyeGroup.add(eyelidLower);

  if (bindGlobalRig) {
    duckNodes.camGlint = camGlint;
    duckNodes.eyelidUpper = eyelidUpper;
    duckNodes.eyelidLower = eyelidLower;
  }

  const irSlotGeo = new THREE.ExtrudeGeometry(makeRoundedRect(7.5, 3.2, 1.5), {
    depth: 1.4,
    bevelEnabled: false,
  });
  const irSlotMesh = new THREE.Mesh(irSlotGeo, blackServoMat);
  irSlotMesh.position.set(13, 13.5, 7.6);
  head.add(irSlotMesh);

  const upperBeak = new THREE.Group();
  upperBeak.position.set(0, 1.4, -12);
  const upperBillGeo = new THREE.ExtrudeGeometry(makeRoundedRect(63, 38, 4.5), {
    depth: 2.6,
    bevelEnabled: true,
    bevelThickness: 0.7,
    bevelSize: 0.7,
    bevelSegments: 2,
  });
  upperBillGeo.rotateX(Math.PI / 2);
  upperBillGeo.translate(0, 0, 11.5);
  const upperBillMesh = new THREE.Mesh(upperBillGeo, orangePrintMat);
  upperBeak.add(upperBillMesh);
  head.add(upperBeak);
  if (bindGlobalRig) {
    duckNodes.beakUpper = upperBeak;
  }

  const lowerBeak = new THREE.Group();
  lowerBeak.position.set(0, -1.6, -12);
  const lowerBillGeo = new THREE.ExtrudeGeometry(makeRoundedRect(61.5, 36.5, 4.2), {
    depth: 2.6,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.6,
    bevelSegments: 2,
  });
  lowerBillGeo.rotateX(Math.PI / 2);
  lowerBillGeo.translate(0, 0, 11.5);
  const lowerBillMesh = new THREE.Mesh(lowerBillGeo, orangePrintMat);
  lowerBeak.add(lowerBillMesh);

  const throatCavityMat = new THREE.MeshBasicMaterial({ color: 0x3b0764 });
  const tongueMat = new THREE.MeshPhongMaterial({ color: 0xfb7185, shininess: 30, specular: 0x2a1518 });
  const innerMouthTray = new THREE.Mesh(new THREE.BoxGeometry(55, 1.1, 30), throatCavityMat);
  innerMouthTray.position.set(0, 0.45, 12.5);
  lowerBeak.add(innerMouthTray);

  const tongueMesh = new THREE.Mesh(new THREE.BoxGeometry(34, 1.4, 20), tongueMat);
  tongueMesh.position.set(0, 0.9, 13.5);
  lowerBeak.add(tongueMesh);

  head.add(lowerBeak);
  if (bindGlobalRig) {
    duckNodes.beakLower = lowerBeak;
  }

  let earLeftGroup: THREE.Group | null = null;
  let earRightGroup: THREE.Group | null = null;
  ([-1, 1] as const).forEach((side) => {
    const earPivot = new THREE.Group();
    earPivot.position.set(side * 30.8, 1.5, -5);
    head.add(earPivot);

    const earShape = new THREE.Shape();
    earShape.moveTo(-6, -2);
    earShape.lineTo(6, -2);
    earShape.lineTo(2.5, 11);
    earShape.lineTo(-4.5, 9);
    earShape.closePath();
    const earGeo = new THREE.ExtrudeGeometry(earShape, {
      depth: 2.2,
      bevelEnabled: true,
      bevelThickness: 0.4,
      bevelSize: 0.4,
      bevelSegments: 2,
    });
    earGeo.rotateY((side * Math.PI) / 2);
    const earMesh = new THREE.Mesh(earGeo, orangePrintMat);
    earPivot.add(earMesh);
    addBoltDots(
      earPivot,
      [
        [side * 2.5, 2, 1.5],
        [side * 2.5, 6.2, -1],
        [side * 2.5, 1.5, -3],
      ],
      0.75
    );
    if (side === -1) earLeftGroup = earPivot;
    else earRightGroup = earPivot;
  });
  if (bindGlobalRig) {
    duckNodes.earLeft = earLeftGroup;
    duckNodes.earRight = earRightGroup;
  }

  const buildCyberWinglet = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * 24.4, 11.5, 1.2);

    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 2.2, 12), silverBracketMat);
    hinge.rotation.z = Math.PI / 2;
    arm.add(hinge);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(-5.2, 1.5);
    wingShape.lineTo(5.8, 1.5);
    wingShape.quadraticCurveTo(7.0, -6.5, 2.2, -14.5);
    wingShape.quadraticCurveTo(-3.8, -16.2, -8.5, -9.5);
    wingShape.quadraticCurveTo(-8.2, -2.5, -5.2, 1.5);

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 2.6,
      bevelEnabled: true,
      bevelThickness: 0.7,
      bevelSize: 0.6,
      bevelSegments: 2,
    });
    wingGeo.translate(0, 0, -1.3);
    wingGeo.rotateY(Math.PI / 2);
    const wingMesh = new THREE.Mesh(wingGeo, whitePrintMat);
    wingMesh.position.set(side * 1.6, -1.0, -1.2);
    arm.add(wingMesh);

    const wingTipGeo = new THREE.BoxGeometry(1.8, 4.8, 8.2);
    const wingTip = new THREE.Mesh(wingTipGeo, orangePrintMat);
    wingTip.position.set(side * 2.3, -11.2, -2.6);
    wingTip.rotation.x = 0.28;
    arm.add(wingTip);

    return arm;
  };

  const leftArm = buildCyberWinglet(-1);
  const rightArm = buildCyberWinglet(1);
  const leftForearm = new THREE.Group();
  const rightForearm = new THREE.Group();
  leftArm.add(leftForearm);
  rightArm.add(rightForearm);
  if (bindGlobalRig) {
    setRigLeftArm(leftArm);
    setRigRightArm(rightArm);
    setRigLeftForearm(leftForearm);
    setRigRightForearm(rightForearm);
  }
  torso.add(leftArm, rightArm);

  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 9.5, -17.2);
  const tailBase = new THREE.Mesh(new THREE.BoxGeometry(12, 6.2, 7.5), whitePrintMat);
  tailBase.position.set(0, 1.4, -2.6);
  tailBase.rotation.x = 0.38;
  tailGroup.add(tailBase);
  const tailTip = new THREE.Mesh(new THREE.BoxGeometry(8.6, 3.6, 5.2), orangePrintMat);
  tailTip.position.set(0, 4.0, -5.8);
  tailTip.rotation.x = 0.56;
  tailGroup.add(tailTip);
  torso.add(tailGroup);
  if (bindGlobalRig) {
    duckNodes.tail = tailGroup;
  }

  const buildOpenDuckLeg = (side: -1 | 1): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 16.5, -6, 1);

    const hipServoUpper = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 12), blackServoMat);
    hipServoUpper.position.set(0, -4, -1);
    hip.add(hipServoUpper);

    const thighFrame = new THREE.Mesh(new THREE.BoxGeometry(8, 25, 9), blackServoMat);
    thighFrame.position.set(0, -11, -4.5);
    thighFrame.rotation.x = 0.39;
    hip.add(thighFrame);

    const linkGeo = new THREE.ExtrudeGeometry(makeRoundedRect(12.5, 31, 5.8), {
      depth: 3.4,
      bevelEnabled: true,
      bevelThickness: 0.9,
      bevelSize: 0.9,
      bevelSegments: 3,
    });
    linkGeo.translate(0, 0, -1.7);
    linkGeo.rotateY(Math.PI / 2);
    const whiteSideLink = new THREE.Mesh(linkGeo, whitePrintMat);
    whiteSideLink.position.set(side * 6.5, -11, -4.5);
    whiteSideLink.rotation.x = 0.39;
    hip.add(whiteSideLink);

    [
      [side * 8.4, 0, 0],
      [side * 8.4, -22, -9],
    ].forEach(([px, py, pz]) => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.5, 12), silverBracketMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(px, py, pz);
      hip.add(cap);
    });

    const knee = new THREE.Group();
    knee.position.set(0, -22, -9);
    hip.add(knee);

    const kneeJointBracket = new THREE.Mesh(new THREE.BoxGeometry(8.5, 16, 8), silverBracketMat);
    kneeJointBracket.position.set(0, -7, 2.8);
    kneeJointBracket.rotation.x = -0.34;
    knee.add(kneeJointBracket);

    const ankleServo = new THREE.Mesh(new THREE.BoxGeometry(11.5, 15.5, 13.5), blackServoMat);
    ankleServo.position.set(0, -18, 6.2);
    ankleServo.rotation.x = -0.34;
    knee.add(ankleServo);

    const wirePort = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.6, 1.4), whitePrintMat);
    wirePort.position.set(side * -1.8, -17.5, 13.1);
    wirePort.rotation.x = -0.34;
    knee.add(wirePort);

    const footGroup = new THREE.Group();
    footGroup.position.set(0, -26, 9);
    knee.add(footGroup);
    localFeet.push(footGroup);

    const ankleCollarCam = new THREE.Mesh(new THREE.BoxGeometry(15.5, 7, 13), orangePrintMat);
    ankleCollarCam.position.set(0, -1.5, 0);
    footGroup.add(ankleCollarCam);

    const ankleAxle = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 16.8, 14), silverBracketMat);
    ankleAxle.rotation.z = Math.PI / 2;
    ankleAxle.position.set(0, -0.5, 0);
    footGroup.add(ankleAxle);

    addBoltDots(
      footGroup,
      [
        [side * 8.1, 2.2, 0],
        [side * 8.1, -2.5, 3],
        [side * 8.1, -2.5, -3],
      ],
      0.7
    );

    const upperFootGeo = new THREE.ExtrudeGeometry(makeRoundedRect(17.5, 24.5, 4.8), {
      depth: 5.2,
      bevelEnabled: true,
      bevelThickness: 0.9,
      bevelSize: 0.9,
      bevelSegments: 3,
    });
    upperFootGeo.rotateX(Math.PI / 2);
    const upperFootMesh = new THREE.Mesh(upperFootGeo, orangePrintMat);
    upperFootMesh.position.set(0, -3.5, 2.2);
    footGroup.add(upperFootMesh);

    const yellowSoleGeo = new THREE.ExtrudeGeometry(makeRoundedRect(18, 25.2, 4.8), {
      depth: 3.4,
      bevelEnabled: true,
      bevelThickness: 0.7,
      bevelSize: 0.7,
      bevelSegments: 3,
    });
    yellowSoleGeo.rotateX(Math.PI / 2);
    const yellowSoleMesh = new THREE.Mesh(yellowSoleGeo, camRingMat);
    yellowSoleMesh.position.set(0, -8.3, 2.2);
    footGroup.add(yellowSoleMesh);

    const rollerGroup = new THREE.Group();
    rollerGroup.position.set(0, 0.5, 0);
    footGroup.add(rollerGroup);
    localFootRollers.push(rollerGroup);

    const wheelMat = new THREE.MeshPhongMaterial({
      color: 0x111827,
      shininess: 30,
      specular: 0x262626,
    });
    [10.8, -7.2].forEach((wz) => {
      const wheel = new THREE.Group();
      wheel.position.set(0, -9.2, wz);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 4.2, 16), wheelMat);
      tire.rotation.z = Math.PI / 2;
      wheel.add(tire);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 4.6, 12), silverBracketMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);

      rollerGroup.add(wheel);
      localWheels.push(wheel);
    });

    return { hip, knee };
  };

  const leftLeg = buildOpenDuckLeg(-1);
  const rightLeg = buildOpenDuckLeg(1);
  if (bindGlobalRig) {
    setRigLeftLeg(leftLeg.hip);
    setRigLeftShin(leftLeg.knee);
    setRigRightLeg(rightLeg.hip);
    setRigRightShin(rightLeg.knee);
  }
  hips.add(leftLeg.hip, rightLeg.hip);

  const excludeNodes = new Set<THREE.Object3D>([
    torso,
    neck,
    head,
    camEyeGroup,
    eyelidUpper,
    eyelidLower,
    camGlint,
    upperBeak,
    lowerBeak,
    leftArm,
    rightArm,
    leftForearm,
    rightForearm,
    tailGroup,
    leftLeg.hip,
    rightLeg.hip,
    leftLeg.knee,
    rightLeg.knee,
    ...localFeet,
    ...localFootRollers,
    ...localWheels,
  ]);
  if (earLeftGroup) excludeNodes.add(earLeftGroup);
  if (earRightGroup) excludeNodes.add(earRightGroup);
  root.updateMatrixWorld(true);
  mergeStaticMeshesInGroup(hips, excludeNodes);
  mergeStaticMeshesInGroup(torso, excludeNodes);
  mergeStaticMeshesInGroup(neck, excludeNodes);
  mergeStaticMeshesInGroup(head, excludeNodes);
  mergeStaticMeshesInGroup(leftLeg.hip, excludeNodes);
  mergeStaticMeshesInGroup(rightLeg.hip, excludeNodes);
  for (const foot of localFeet) {
    mergeStaticMeshesInGroup(foot, excludeNodes);
  }

  return { root, legL: leftLeg.hip, legR: rightLeg.hip };
}

/** Tạo mô hình 3D OpenDuck Mini / MicroDuck đúng dáng thực tế (vòm trắng, 1 mắt cam, cổ servo đen, bàn chân khối cam) */
export function createMicroDuckCharacter() {
  const { root } = buildMicroDuckHierarchy(
    appState.duckBodyColor || '#f4f4f6',
    appState.duckAccentColor || '#f97316',
    true
  );
  root.scale.setScalar(appState.modelScale);
  appState.avatarGroup.add(root);
  reattachActiveAccessory();
}

/** Tạo bản sao MicroDuck 3D khác màu (không kèm hiệu ứng hay phụ kiện) dùng cho sự kiện xâm phạm lãnh thổ */
export function createCloneMicroDuckMesh(
  bodyColor: THREE.ColorRepresentation,
  accentColor: THREE.ColorRepresentation
): THREE.Group {
  const { root, legL, legR } = buildMicroDuckHierarchy(bodyColor, accentColor, false);
  legL.name = 'legL';
  legR.name = 'legR';
  root.scale.setScalar(appState.modelScale || 1.0);
  return root;
}

