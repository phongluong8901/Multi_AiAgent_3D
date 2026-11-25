import * as THREE from 'three';
import { scene } from './scene';
import { appState } from './state';

export type ActionProp3DId =
  | 'prop_books'
  | 'prop_pipe'
  | 'prop_question'
  | 'prop_exclamation'
  | 'prop_lightbulb'
  | 'prop_coffee'
  | 'prop_zzz'
  | 'prop_magnifier'
  | 'prop_music'
  | 'prop_trophy'
  | 'prop_hearts'
  | 'prop_hologram'
  | 'prop_dumbbell'
  | 'prop_camera_flash'
  | 'prop_crown_aura'
  | 'prop_lightning_aura';

interface ActiveActionProp {
  id: ActionProp3DId;
  root: THREE.Group;
  life: number;
  duration: number;
  followFacing: boolean;
  onUpdate: (t: number, progress: number) => void;
}

const MAX_ACTIVE_PROPS = 2;
const activeProps: ActiveActionProp[] = [];

function disposeObjectTree(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
      if (obj.geometry) geos.add(obj.geometry);
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => mats.add(m));
      } else if (obj.material) {
        mats.add(obj.material);
      }
    }
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
}

function buildBooksProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const colors = [0x4f46e5, 0x10b981, 0xf59e0b];
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });
  const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const books: Array<{ grp: THREE.Group; baseA: number; leftCover?: THREE.Group; rightCover?: THREE.Group }> = [];

  const angles = [-0.85, 0, 0.85];
  for (let i = 0; i < 3; i++) {
    const coverMat = new THREE.MeshStandardMaterial({
      color: colors[i],
      roughness: 0.42,
      metalness: 0.14,
    });
    const grp = new THREE.Group();

    if (i === 1) {
      // Cuốn ở giữa hé mở lật trang nhẹ
      const spine = new THREE.Mesh(new THREE.BoxGeometry(3.2, 22, 3.2), coverMat);
      grp.add(spine);

      const leftPivot = new THREE.Group();
      leftPivot.position.x = -1.2;
      const lCover = new THREE.Mesh(new THREE.BoxGeometry(15, 22, 1.4), coverMat);
      lCover.position.set(-7.5, 0, 0);
      const lPages = new THREE.Mesh(new THREE.BoxGeometry(13.6, 20.4, 2.2), pageMat);
      lPages.position.set(-6.8, 0, 1.6);
      leftPivot.add(lCover, lPages);

      const rightPivot = new THREE.Group();
      rightPivot.position.x = 1.2;
      const rCover = new THREE.Mesh(new THREE.BoxGeometry(15, 22, 1.4), coverMat);
      rCover.position.set(7.5, 0, 0);
      const rPages = new THREE.Mesh(new THREE.BoxGeometry(13.6, 20.4, 2.2), pageMat);
      rPages.position.set(6.8, 0, 1.6);
      rightPivot.add(rCover, rPages);

      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 18, 0.5), ribbonMat);
      ribbon.position.set(0, -3, 2.2);
      grp.add(leftPivot, rightPivot, ribbon);
      root.add(grp);
      books.push({ grp, baseA: angles[i], leftCover: leftPivot, rightCover: rightPivot });
    } else {
      const coverFront = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 1.3), coverMat);
      coverFront.position.z = 2.6;
      const coverBack = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 1.3), coverMat);
      coverBack.position.z = -2.6;
      const spine = new THREE.Mesh(new THREE.BoxGeometry(2.2, 22.2, 6.4), coverMat);
      spine.position.x = -7.6;
      const pages = new THREE.Mesh(new THREE.BoxGeometry(14.4, 20.4, 4.2), pageMat);
      pages.position.x = 0.4;
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(1.3, 6, 0.6), ribbonMat);
      ribbon.position.set(3, -12.5, 0);
      grp.add(coverFront, coverBack, spine, pages, ribbon);
      grp.rotation.z = (i === 0 ? 1 : -1) * 0.22;
      root.add(grp);
      books.push({ grp, baseA: angles[i] });
    }
  }

  return (t) => {
    const orbitSpin = Math.sin(t * 1.1) * 0.28;
    books.forEach((b, idx) => {
      const a = b.baseA + orbitSpin;
      const radius = idx === 1 ? 58 : 64;
      const heightBase = idx === 1 ? 114 : 128;
      b.grp.position.set(
        Math.sin(a) * radius,
        heightBase + Math.sin(t * 2.8 + idx * 1.4) * 6,
        Math.cos(a) * 34 + 18
      );
      b.grp.rotation.y = a * 0.65 + (idx !== 1 ? Math.sin(t * 1.6 + idx) * 0.22 : 0);
      if (b.leftCover && b.rightCover) {
        const flap = 0.42 + Math.sin(t * 3.2) * 0.16;
        b.leftCover.rotation.y = flap;
        b.rightCover.rotation.y = -flap;
        b.grp.rotation.x = -0.32;
      }
    });
  };
}

function buildPipeProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const pipeGroup = new THREE.Group();
  pipeGroup.position.set(8, 114, 34);
  pipeGroup.rotation.y = 0.22;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.48, metalness: 0.08 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35, metalness: 0.2 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.8 });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    emissive: 0xf97316,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });

  const mouthpiece = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.0, 14, 10), stemMat);
  mouthpiece.rotation.x = Math.PI * 0.42;
  mouthpiece.position.set(0, 1, 2);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 2.6, 12), brassMat);
  ring.rotation.x = Math.PI * 0.42;
  ring.position.set(0, -1, 8.5);

  const shank = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.9, 10, 10), woodMat);
  shank.rotation.x = Math.PI * 0.46;
  shank.position.set(0, -2.5, 13.5);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 4.2, 12, 14), woodMat);
  bowl.position.set(0, 2.2, 19);

  const ember = new THREE.Mesh(new THREE.SphereGeometry(4.0, 12, 10), emberMat);
  ember.scale.set(1, 0.35, 1);
  ember.position.set(0, 8.0, 19);

  pipeGroup.add(mouthpiece, ring, shank, bowl, ember);
  root.add(pipeGroup);

  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.7 });
  const ringGeo = new THREE.TorusGeometry(4.2, 1.15, 8, 18);
  const puffGeo = new THREE.SphereGeometry(3.8, 10, 8);
  const rings: THREE.Mesh[] = [];
  const puffs: THREE.Mesh[] = [];

  for (let i = 0; i < 5; i++) {
    const rm = new THREE.Mesh(ringGeo, smokeMat.clone());
    rm.rotation.x = Math.PI / 2;
    root.add(rm);
    rings.push(rm);

    const pm = new THREE.Mesh(puffGeo, smokeMat.clone());
    root.add(pm);
    puffs.push(pm);
  }
  smokeMat.dispose();

  return (t) => {
    pipeGroup.rotation.z = Math.sin(t * 2.2) * 0.06;
    emberMat.emissiveIntensity = 0.75 + Math.max(0, Math.sin(t * 3.8)) * 0.65;

    for (let i = 0; i < rings.length; i++) {
      const ph = (t * 0.58 + i / rings.length) % 1;
      const fade = ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.85;
      const sx = 0.45 + ph * 2.2;
      rings[i].position.set(
        8 + Math.sin(t * 2.4 + i * 1.3) * (4 + ph * 9),
        124 + ph * 68,
        52 + Math.cos(t * 1.9 + i) * 4
      );
      rings[i].scale.setScalar(sx);
      rings[i].rotation.y = t * 1.4 + i;
      (rings[i].material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade * 0.72);

      const pph = (t * 0.46 + i / puffs.length + 0.1) % 1;
      const pfade = pph < 0.2 ? pph / 0.2 : 1 - (pph - 0.2) / 0.8;
      puffs[i].position.set(
        10 + Math.cos(t * 2.0 + i * 1.7) * (5 + pph * 11),
        126 + pph * 60,
        50
      );
      puffs[i].scale.setScalar(0.55 + pph * 1.85);
      (puffs[i].material as THREE.MeshBasicMaterial).opacity = Math.max(0, pfade * 0.46);
    }
  };
}

function buildQuestionProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const grp = new THREE.Group();
  const cyanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.35,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

  const hook = new THREE.Mesh(new THREE.TorusGeometry(10.5, 3.0, 10, 24, Math.PI * 1.42), cyanMat);
  hook.rotation.z = -Math.PI * 0.22;
  hook.position.set(0, 16, 0);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.5, 8.5, 10), cyanMat);
  stem.position.set(0, 4.5, 0);

  const dot = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 10), glowMat);
  dot.position.set(0, -4.5, 0);

  grp.add(hook, stem, dot);
  root.add(grp);

  return (t) => {
    grp.position.set(Math.sin(t * 2.4) * 4, 186 + Math.abs(Math.sin(t * 3.8)) * 9, 18);
    grp.rotation.z = Math.sin(t * 3.0) * 0.16;
    grp.rotation.y = Math.sin(t * 2.0) * 0.28;
  };
}

function buildExclamationProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const grp = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.3,
  });
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 2.1, 22, 12), redMat);
  bar.position.set(0, 11, 0);

  const dot = new THREE.Mesh(new THREE.SphereGeometry(3.8, 12, 10), goldMat);
  dot.position.set(0, -5, 0);

  const ring = new THREE.Mesh(new THREE.RingGeometry(15, 18.5, 24), ringMat);
  ring.position.set(0, 6, -3);

  grp.add(bar, dot, ring);
  root.add(grp);

  return (t) => {
    const hop = Math.abs(Math.sin(t * 8.5)) * 11;
    grp.position.set(0, 186 + hop, 20);
    grp.rotation.z = Math.sin(t * 14) * 0.08;
    const pulse = 0.85 + Math.abs(Math.sin(t * 6.5)) * 0.45;
    ring.scale.setScalar(pulse);
    ringMat.opacity = Math.max(0.15, 0.85 - (pulse - 0.85));
  };
}

function buildLightbulbProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const grp = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 });
  const rayMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

  const globe = new THREE.Mesh(new THREE.SphereGeometry(12.5, 18, 14), glassMat);
  globe.position.y = 8;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 6.2, 6, 14), glassMat);
  neck.position.y = -2;

  const screw = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 5.4, 7.5, 14), baseMat);
  screw.position.y = -8;

  const rays = new THREE.Group();
  rays.position.y = 8;
  const rayGeo = new THREE.ConeGeometry(2.0, 7.5, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = new THREE.Mesh(rayGeo, rayMat);
    r.position.set(Math.cos(a) * 20, Math.sin(a) * 20, 0);
    r.rotation.z = a - Math.PI / 2;
    rays.add(r);
  }

  grp.add(globe, neck, screw, rays);
  root.add(grp);

  return (t) => {
    grp.position.set(0, 192 + Math.sin(t * 3.2) * 5, 16);
    rays.rotation.z = t * 2.2;
    const glow = 0.7 + Math.sin(t * 6.5) * 0.45;
    glassMat.emissiveIntensity = Math.max(0.35, glow);
    rays.scale.setScalar(0.92 + Math.sin(t * 6.5) * 0.14);
  };
}

function buildCoffeeProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const cupGrp = new THREE.Group();
  cupGrp.position.set(58, 92, 22);

  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
  const saucerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
  const coffeeMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.2 });

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(16, 11, 2.4, 20), saucerMat);
  saucer.position.y = -8;

  const mug = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 9.2, 15, 20), ceramicMat);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(10.2, 10.2, 1.2, 18), coffeeMat);
  liquid.position.y = 7.1;

  const handle = new THREE.Mesh(new THREE.TorusGeometry(5.5, 1.6, 8, 16, Math.PI), ceramicMat);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(11.2, 0.5, 0);

  cupGrp.add(saucer, mug, liquid, handle);
  root.add(cupGrp);

  const steamGeo = new THREE.SphereGeometry(2.6, 8, 8);
  const steamBaseMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.6 });
  const wisps: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const w = new THREE.Mesh(steamGeo, steamBaseMat.clone());
    root.add(w);
    wisps.push(w);
  }
  steamBaseMat.dispose();

  return (t) => {
    const bob = Math.sin(t * 2.3) * 4;
    cupGrp.position.set(58, 92 + bob, 22);
    cupGrp.rotation.z = Math.sin(t * 1.8) * 0.06;

    for (let i = 0; i < wisps.length; i++) {
      const ph = (t * 0.52 + i / wisps.length) % 1;
      const fade = ph < 0.18 ? ph / 0.18 : 1 - (ph - 0.18) / 0.82;
      wisps[i].position.set(
        58 + Math.sin(t * 4.2 + i * 1.6) * (3.5 + ph * 6),
        102 + bob + ph * 42,
        22 + Math.cos(t * 3.1 + i) * 3
      );
      wisps[i].scale.setScalar(0.6 + ph * 1.15);
      (wisps[i].material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade * 0.58);
    }
  };
}

function createZLetterMesh(size: number, mat: THREE.Material): THREE.Group {
  const z = new THREE.Group();
  const thick = size * 0.24;
  const barGeo = new THREE.BoxGeometry(size, thick, thick);
  const diagGeo = new THREE.BoxGeometry(size * 1.18, thick, thick);

  const top = new THREE.Mesh(barGeo, mat);
  top.position.y = size * 0.42;
  const bottom = new THREE.Mesh(barGeo, mat);
  bottom.position.y = -size * 0.42;
  const diag = new THREE.Mesh(diagGeo, mat);
  diag.rotation.z = Math.PI * 0.26;

  z.add(top, bottom, diag);
  return z;
}

function buildZzzProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const palette = [0x93c5fd, 0xa5b4fc, 0xe0e7ff];
  const sizes = [10, 13, 16];
  const letters: Array<{ grp: THREE.Group; mat: THREE.MeshBasicMaterial }> = [];

  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: palette[i], transparent: true, opacity: 0.9 });
    const grp = createZLetterMesh(sizes[i], mat);
    root.add(grp);
    letters.push({ grp, mat });
  }

  return (t) => {
    for (let i = 0; i < letters.length; i++) {
      const ph = (t * 0.42 + i / 3) % 1;
      const fade = ph < 0.16 ? ph / 0.16 : 1 - (ph - 0.16) / 0.84;
      letters[i].grp.position.set(
        26 + ph * 34 + Math.sin(t * 2.2 + i) * 4,
        152 + ph * 56,
        24
      );
      letters[i].grp.rotation.z = -0.18 + Math.sin(t * 2.5 + i) * 0.1;
      letters[i].grp.scale.setScalar(0.75 + ph * 0.55);
      letters[i].mat.opacity = Math.max(0, fade * 0.92);
    }
  };
}

function buildMagnifierProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const grp = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.42 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });

  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 2.3, 10, 26), metalMat);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(14.2, 14.2, 1.4, 24), lensMat);
  lens.rotation.x = Math.PI / 2;

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 5, 10), metalMat);
  collar.rotation.z = -0.7;
  collar.position.set(-12, -12, 0);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.0, 20, 10), woodMat);
  handle.rotation.z = -0.7;
  handle.position.set(-20, -20, 0);

  grp.add(rim, lens, collar, handle);
  root.add(grp);

  return (t) => {
    grp.position.set(
      Math.sin(t * 2.5) * 34,
      108 + Math.cos(t * 3.1) * 10,
      46
    );
    grp.rotation.y = Math.sin(t * 2.5) * 0.35;
    grp.rotation.z = Math.sin(t * 1.9) * 0.18;
  };
}

function createMusicNoteMesh(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.4,
    roughness: 0.25,
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.8, 12, 10), mat);
  head.scale.set(1.25, 0.88, 0.88);
  head.rotation.z = 0.35;

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 18, 8), mat);
  stem.position.set(4.2, 9, 0);

  const flag = new THREE.Mesh(new THREE.BoxGeometry(8.5, 3.2, 1.8), mat);
  flag.position.set(8.2, 16.5, 0);
  flag.rotation.z = -0.35;

  g.add(head, stem, flag);
  return g;
}

function buildMusicProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const cols = [0x22d3ee, 0xf472b6, 0xfacc15];
  const notes = cols.map((c) => {
    const n = createMusicNoteMesh(c);
    root.add(n);
    return n;
  });

  return (t) => {
    notes.forEach((n, i) => {
      const a = t * 1.8 + i * ((Math.PI * 2) / 3);
      n.position.set(
        Math.cos(a) * 52,
        148 + Math.sin(t * 3.6 + i * 1.9) * 18,
        Math.sin(a) * 24 + 14
      );
      n.rotation.z = Math.sin(t * 4.5 + i) * 0.22;
      n.rotation.y = Math.sin(t * 2.0 + i) * 0.35;
    });
  };
}

function buildTrophyProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const grp = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.28,
    metalness: 0.82,
    roughness: 0.2,
  });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.55 });
  const starMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 14), baseMat);
  plinth.position.y = -13;

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.2, 10, 12), goldMat);
  stem.position.y = -5.5;

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(12, 5.5, 16, 18), goldMat);
  cup.position.y = 7;

  [-1, 1].forEach((side) => {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(5.5, 1.4, 8, 16, Math.PI), goldMat);
    handle.rotation.z = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    handle.position.set(side * 10.5, 7.5, 0);
    grp.add(handle);
  });

  const star = new THREE.Mesh(new THREE.OctahedronGeometry(4.6, 0), starMat);
  star.position.y = 22;

  grp.add(plinth, stem, cup, star);
  root.add(grp);

  return (t) => {
    grp.position.set(44, 152 + Math.sin(t * 3.0) * 7, 22);
    grp.rotation.y = Math.sin(t * 2.1) * 0.45;
    star.rotation.y = t * 4.2;
    star.position.y = 22 + Math.sin(t * 5.0) * 2.2;
  };
}

function createHeartMesh(colorHex: number): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(0, 3);
  s.bezierCurveTo(0, 6.5, -5.5, 9.5, -9, 6);
  s.bezierCurveTo(-12.5, 2.5, -9, -3.5, 0, -10.5);
  s.bezierCurveTo(9, -3.5, 12.5, 2.5, 9, 6);
  s.bezierCurveTo(5.5, 9.5, 0, 6.5, 0, 3);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 2.6,
    bevelEnabled: true,
    bevelThickness: 0.9,
    bevelSize: 0.7,
    bevelSegments: 2,
  });
  geo.center();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    transparent: true,
    opacity: 0.95,
  });
  return new THREE.Mesh(geo, mat);
}

function buildHeartsProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const palette = [0xf43f5e, 0xfb7185, 0xf472b6];
  const hearts = palette.map((c, idx) => {
    const h = createHeartMesh(c);
    h.scale.setScalar(idx === 1 ? 1.15 : 0.9);
    root.add(h);
    return h;
  });

  return (t) => {
    hearts.forEach((h, idx) => {
      const ph = (t * 0.55 + idx * 0.33) % 1;
      const fade = ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.85;
      const angle = t * 2.2 + idx * ((Math.PI * 2) / 3);
      const radius = 30 + ph * 18;
      h.position.set(
        Math.cos(angle) * radius,
        125 + ph * 76,
        Math.sin(angle) * 16 + 22
      );
      h.rotation.y = Math.sin(t * 2.5 + idx) * 0.45;
      h.rotation.z = Math.sin(t * 3.1 + idx) * 0.14;
      const sc = (idx === 1 ? 1.12 : 0.9) * (0.75 + Math.sin(t * 5 + idx) * 0.12);
      h.scale.setScalar(sc);
      (h.material as THREE.MeshStandardMaterial).opacity = Math.max(0.1, fade);
    });
  };
}

function buildHologramProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const grp = new THREE.Group();
  grp.position.set(0, 132, 46);

  const panelGeo = new THREE.BoxGeometry(64, 40, 1.2);
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.24,
  });
  const bgPanel = new THREE.Mesh(panelGeo, bgMat);
  grp.add(bgPanel);

  const edgeMesh = new THREE.LineSegments(
    new THREE.EdgesGeometry(panelGeo),
    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.92 })
  );
  grp.add(edgeMesh);

  const bars: THREE.Mesh[] = [];
  const barColors = [0x38bdf8, 0x34d399, 0xa855f7];
  const barGeo = new THREE.BoxGeometry(10, 1, 1.6);
  for (let i = 0; i < 3; i++) {
    const bm = new THREE.Mesh(
      barGeo,
      new THREE.MeshBasicMaterial({ color: barColors[i], transparent: true, opacity: 0.88 })
    );
    bm.position.set(-16 + i * 16, -6, 1.2);
    grp.add(bm);
    bars.push(bm);
  }

  const scanLine = new THREE.Mesh(
    new THREE.BoxGeometry(60, 1.8, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.85 })
  );
  scanLine.position.set(0, 0, 1.5);
  grp.add(scanLine);

  root.add(grp);

  return (t) => {
    grp.position.set(0, 132 + Math.sin(t * 2.6) * 4, 46);
    grp.rotation.x = -0.14 + Math.sin(t * 2.0) * 0.04;
    bars.forEach((b, i) => {
      const h = 8 + Math.abs(Math.sin(t * 4.5 + i * 1.4)) * 18;
      b.scale.y = h;
      b.position.y = -13 + h * 0.5;
    });
    scanLine.position.y = Math.sin(t * 3.8) * 16;
  };
}

function buildDumbbellMesh(): THREE.Group {
  const g = new THREE.Group();
  const barMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.25 });
  const innerPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 });

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 22, 10), barMat);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);

  for (const side of [-1, 1]) {
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 6.8, 3.2, 14), plateMat);
    outer.rotation.z = Math.PI / 2;
    outer.position.x = side * 9.5;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 2.2, 14), innerPlateMat);
    inner.rotation.z = Math.PI / 2;
    inner.position.x = side * 6.8;
    g.add(outer, inner);
  }
  return g;
}

function buildDumbbellProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const leftDb = buildDumbbellMesh();
  const rightDb = buildDumbbellMesh();
  leftDb.position.set(-42, 98, 18);
  rightDb.position.set(42, 98, 18);
  root.add(leftDb, rightDb);

  return (t) => {
    const liftL = Math.max(0, Math.sin(t * 7.5));
    const liftR = Math.max(0, Math.sin(t * 7.5 + 0.35));
    leftDb.position.set(-42, 94 + liftL * 22, 18 + liftL * 4);
    rightDb.position.set(42, 94 + liftR * 22, 18 + liftR * 4);
    leftDb.rotation.z = 0.14 - liftL * 0.26;
    rightDb.rotation.z = -0.14 + liftR * 0.26;
  };
}

function buildCameraFlashProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.55 });
  const silverMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.8 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(26, 17, 11), bodyMat);
  const topHump = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 8), silverMat);
  topHump.position.set(0, 10, 0);

  const lensRing = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 5, 18), silverMat);
  lensRing.rotation.x = Math.PI / 2;
  lensRing.position.set(0, 0, -6.5);

  const lensCore = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 5.5, 16), lensMat);
  lensCore.rotation.x = Math.PI / 2;
  lensCore.position.set(0, 0, -6.8);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const flashRing = new THREE.Mesh(new THREE.RingGeometry(8, 22, 24), flashMat);
  flashRing.position.set(7, 8, -9);

  grp.add(body, topHump, lensRing, lensCore, flashRing);
  root.add(grp);

  return (t) => {
    const orbit = Math.sin(t * 2.1) * 0.35;
    grp.position.set(46 + Math.sin(t * 1.9) * 8, 138 + Math.cos(t * 2.7) * 6, 38);
    grp.rotation.y = 0.55 + orbit;
    grp.rotation.z = Math.sin(t * 3.0) * 0.08;

    const cycle = (t * 1.25) % 1;
    const burst = cycle < 0.26 ? 1 - cycle / 0.26 : 0;
    flashRing.scale.setScalar(0.6 + (1 - burst) * 1.45);
    flashMat.opacity = burst * 0.85;
  };
}

function buildCrownAuraProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const grp = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.85,
    roughness: 0.2,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(36, 2.2, 10, 32), goldMat);
  halo.rotation.x = Math.PI / 2;
  grp.add(halo);

  const gemColors = [0x38bdf8, 0xfacc15, 0x34d399, 0xf472b6];
  const gems: THREE.Mesh[] = [];
  const gemGeo = new THREE.OctahedronGeometry(5.2, 0);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Mesh(
      gemGeo,
      new THREE.MeshBasicMaterial({ color: gemColors[i] })
    );
    grp.add(g);
    gems.push(g);
  }
  root.add(grp);

  return (t) => {
    grp.position.set(0, 176 + Math.sin(t * 2.8) * 5, 10);
    halo.rotation.z = t * 1.5;
    gems.forEach((g, i) => {
      const a = t * 2.4 + (i * Math.PI) / 2;
      g.position.set(Math.cos(a) * 38, Math.sin(t * 4.2 + i) * 4, Math.sin(a) * 38);
      g.rotation.y = t * 3.8 + i;
    });
  };
}

function buildLightningAuraProp(root: THREE.Group): ActiveActionProp['onUpdate'] {
  const r1Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.78 });
  const r2Mat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.72 });
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(42, 47, 28), r1Mat);
  ring1.rotation.x = -Math.PI / 2;
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(32, 36, 28), r2Mat);
  ring2.rotation.x = -Math.PI / 2;
  root.add(ring1, ring2);

  const boltMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  const bolts: THREE.Group[] = [];
  const segGeo = new THREE.BoxGeometry(2.6, 20, 2.6);
  for (let i = 0; i < 5; i++) {
    const bg = new THREE.Group();
    const s1 = new THREE.Mesh(segGeo, boltMat);
    s1.rotation.z = 0.42;
    s1.position.y = 8;
    const s2 = new THREE.Mesh(segGeo, boltMat);
    s2.rotation.z = -0.42;
    s2.position.y = -8;
    bg.add(s1, s2);
    root.add(bg);
    bolts.push(bg);
  }

  return (t) => {
    const ph1 = (t * 1.6) % 1;
    const ph2 = (t * 1.6 + 0.5) % 1;
    ring1.position.set(0, 12 + ph1 * 155, 0);
    ring1.scale.setScalar(0.85 + ph1 * 0.45);
    r1Mat.opacity = (1 - ph1) * 0.85;

    ring2.position.set(0, 12 + ph2 * 155, 0);
    ring2.scale.setScalar(0.85 + ph2 * 0.45);
    r2Mat.opacity = (1 - ph2) * 0.82;

    bolts.forEach((b, i) => {
      const a = t * 5.2 + i * ((Math.PI * 2) / 5);
      b.position.set(
        Math.cos(a) * 48,
        52 + ((i * 28 + t * 90) % 115),
        Math.sin(a) * 26 + 12
      );
      b.rotation.y = a;
      b.visible = Math.sin(t * 28 + i * 1.9) > -0.35;
    });
  };
}

function createPropUpdater(id: ActionProp3DId, root: THREE.Group): ActiveActionProp['onUpdate'] {
  switch (id) {
    case 'prop_books':
      return buildBooksProp(root);
    case 'prop_pipe':
      return buildPipeProp(root);
    case 'prop_question':
      return buildQuestionProp(root);
    case 'prop_exclamation':
      return buildExclamationProp(root);
    case 'prop_lightbulb':
      return buildLightbulbProp(root);
    case 'prop_coffee':
      return buildCoffeeProp(root);
    case 'prop_zzz':
      return buildZzzProp(root);
    case 'prop_magnifier':
      return buildMagnifierProp(root);
    case 'prop_music':
      return buildMusicProp(root);
    case 'prop_trophy':
      return buildTrophyProp(root);
    case 'prop_hearts':
      return buildHeartsProp(root);
    case 'prop_hologram':
      return buildHologramProp(root);
    case 'prop_dumbbell':
      return buildDumbbellProp(root);
    case 'prop_camera_flash':
      return buildCameraFlashProp(root);
    case 'prop_crown_aura':
      return buildCrownAuraProp(root);
    case 'prop_lightning_aura':
      return buildLightningAuraProp(root);
  }
}

function removePropAt(index: number) {
  const item = activeProps[index];
  if (!item) return;
  scene.remove(item.root);
  disposeObjectTree(item.root);
  activeProps.splice(index, 1);
}

export function spawnActionProp3D(id: ActionProp3DId, durationSec = 3.2) {
  const duration = THREE.MathUtils.clamp(durationSec || 3.2, 0.8, 12);
  const existing = activeProps.find((p) => p.id === id);
  if (existing) {
    existing.life = 0;
    existing.duration = duration;
    return;
  }

  while (activeProps.length >= MAX_ACTIVE_PROPS) {
    removePropAt(0);
  }

  const root = new THREE.Group();
  const s = appState.modelScale || 1.0;
  root.scale.setScalar(s);
  root.position.set(appState.posX, -appState.posY, (appState.posZ || 0) + 12 * s);
  const followFacing =
    id === 'prop_pipe' ||
    id === 'prop_magnifier' ||
    id === 'prop_hologram' ||
    id === 'prop_dumbbell';
  if (followFacing) {
    root.rotation.y = appState.facingAngle || 0;
  }

  const onUpdate = createPropUpdater(id, root);
  onUpdate(0, 0);
  scene.add(root);

  activeProps.push({
    id,
    root,
    life: 0,
    duration,
    followFacing,
    onUpdate,
  });
}

export function stopAllActionProps3D() {
  while (activeProps.length > 0) {
    removePropAt(activeProps.length - 1);
  }
}

export function hasActiveActionProps3D(): boolean {
  return activeProps.length > 0;
}

export function updateActionProps3D(delta: number, _elapsed: number) {
  if (activeProps.length === 0) return;
  const s = appState.modelScale || 1.0;

  for (let i = activeProps.length - 1; i >= 0; i--) {
    const p = activeProps[i];
    p.life += delta;
    if (p.life >= p.duration) {
      removePropAt(i);
      continue;
    }
    const progress = p.life / p.duration;
    const fadeIn = p.life < 0.18 ? p.life / 0.18 : 1;
    const fadeOut = p.duration - p.life < 0.24 ? (p.duration - p.life) / 0.24 : 1;
    const env = Math.max(0.05, Math.min(1, fadeIn, fadeOut));

    p.root.position.set(appState.posX, -appState.posY, (appState.posZ || 0) + 12 * s);
    p.root.scale.setScalar(s * (0.4 + 0.6 * env));
    if (p.followFacing) {
      p.root.rotation.y = appState.facingAngle || 0;
    }
    p.onUpdate(p.life, progress);
  }
}
