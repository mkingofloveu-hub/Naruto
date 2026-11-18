import * as THREE from 'three';
import { FighterDef, HairStyle, WeaponType } from './types';

export type AnimPose =
  | 'idle'
  | 'run'
  | 'jump'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'heavy'
  | 'jutsu'
  | 'charge'
  | 'block'
  | 'hit'
  | 'ko'
  | 'ultimate';

export interface ShinobiRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  auraGroup: THREE.Group;
  weaponGroup: THREE.Group;
  shadowDisc: THREE.Mesh;
  materialsToFlash: THREE.MeshStandardMaterial[];
  baseEmissives: THREE.Color[];
  disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] };
}

export function createShinobiRig(
  fighter: FighterDef,
  shadowDiscTexture: THREE.Texture,
): ShinobiRig {
  const v = fighter.visual;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const materialsToFlash: THREE.MeshStandardMaterial[] = [];
  const baseEmissives: THREE.Color[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const makeMat = (params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = new THREE.MeshStandardMaterial(params);
    materials.push(m);
    materialsToFlash.push(m);
    baseEmissives.push(m.emissive.clone());
    return m;
  };

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Soft contact shadow disc on ground (y = 0.015)
  const shadowGeo = trackGeo(new THREE.CircleGeometry(0.95, 24));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowDiscTexture,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  materials.push(shadowMat);
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // Shared materials with varied roughness/metalness >= 0.25 delta
  const primaryMat = makeMat({
    color: v.primaryColor,
    roughness: 0.72,
    metalness: 0.06,
  });
  const secondaryMat = makeMat({
    color: v.secondaryColor,
    roughness: 0.68,
    metalness: 0.1,
  });
  const accentMat = makeMat({
    color: v.accentColor,
    roughness: 0.35,
    metalness: 0.45,
    emissive: new THREE.Color(v.accentColor),
    emissiveIntensity: 0.12,
  });
  const skinMat = makeMat({
    color: v.skinColor,
    roughness: 0.78,
    metalness: 0.02,
  });
  const hairMat = makeMat({
    color: v.hairColor,
    roughness: 0.65,
    metalness: 0.08,
  });
  const metalMat = makeMat({
    color: 0xd1d5db,
    roughness: 0.22,
    metalness: 0.85,
  });
  const headbandMat = makeMat({
    color: v.headbandColor,
    roughness: 0.7,
    metalness: 0.1,
  });

  // Torso group (hip height ~0.95)
  const torso = new THREE.Group();
  torso.position.y = 0.96;
  bodyPivot.add(torso);

  // Chest / Jacket
  const chestGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.26, 0.72, 10));
  const chestMesh = new THREE.Mesh(chestGeo, primaryMat);
  chestMesh.position.y = 0.36;
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  // Waist sash / belt
  const beltGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10));
  const beltMesh = new THREE.Mesh(beltGeo, accentMat);
  beltMesh.position.y = 0.06;
  torso.add(beltMesh);

  // Shoulder collar / Akatsuki high collar or shinobi vest collar
  const collarGeo = trackGeo(
    new THREE.CylinderGeometry(0.34, 0.3, v.hasAkatsukiCloak ? 0.24 : 0.14, 10, 1, true),
  );
  const collarMat = makeMat({
    color: v.hasAkatsukiCloak ? '#0f172a' : v.secondaryColor,
    roughness: 0.7,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.position.y = v.hasAkatsukiCloak ? 0.74 : 0.68;
  torso.add(collarMesh);

  // Akatsuki Cloak lower skirt & crimson cloud emblems
  if (v.hasAkatsukiCloak) {
    const cloakSkirtGeo = trackGeo(new THREE.CylinderGeometry(0.3, 0.48, 0.74, 12, 1, true));
    const cloakSkirt = new THREE.Mesh(cloakSkirtGeo, primaryMat);
    cloakSkirt.position.y = -0.18;
    cloakSkirt.castShadow = true;
    torso.add(cloakSkirt);

    // Red cloud emblems front & back
    const cloudGeo = trackGeo(new THREE.SphereGeometry(0.085, 8, 6));
    cloudGeo.scale(1.4, 0.75, 0.35);
    const cloudMat = makeMat({
      color: '#dc2626',
      roughness: 0.45,
      metalness: 0.1,
      emissive: new THREE.Color('#7f1d1d'),
      emissiveIntensity: 0.25,
    });
    const c1 = new THREE.Mesh(cloudGeo, cloudMat);
    c1.position.set(0.14, 0.28, 0.28);
    torso.add(c1);
    const c2 = new THREE.Mesh(cloudGeo, cloudMat);
    c2.position.set(-0.15, -0.05, -0.34);
    torso.add(c2);
  }

  // Head group
  const head = new THREE.Group();
  head.position.y = 0.84;
  torso.add(head);

  const headGeo = trackGeo(new THREE.SphereGeometry(0.24, 14, 12));
  headGeo.scale(0.96, 1.08, 0.98);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.y = 0.14;
  headMesh.castShadow = true;
  head.add(headMesh);

  // Eyes / Mask
  if (v.hasMask === 'tobi') {
    const maskGeo = trackGeo(new THREE.CylinderGeometry(0.245, 0.23, 0.32, 14));
    const maskMat = makeMat({ color: '#ea580c', roughness: 0.4, metalness: 0.18 });
    const maskMesh = new THREE.Mesh(maskGeo, maskMat);
    maskMesh.position.set(0, 0.14, 0.02);
    head.add(maskMesh);

    const eyeGlowGeo = trackGeo(new THREE.SphereGeometry(0.036, 8, 8));
    const eyeMat = makeMat({
      color: '#dc2626',
      emissive: new THREE.Color('#ef4444'),
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const eye = new THREE.Mesh(eyeGlowGeo, eyeMat);
    eye.position.set(0.08, 0.16, 0.23);
    head.add(eye);
  } else {
    const eyeColor = v.hasRinnegan ? '#c084fc' : v.hasSharingan ? '#ef4444' : '#0f172a';
    const eyeMat = makeMat({
      color: eyeColor,
      emissive: new THREE.Color(v.hasRinnegan || v.hasSharingan ? eyeColor : '#000000'),
      emissiveIntensity: v.hasRinnegan || v.hasSharingan ? 1.1 : 0,
      roughness: 0.2,
    });
    const eyeGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.035, 0.03));
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.085, 0.15, 0.21);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.085, 0.15, 0.21);
    head.add(leftEye, rightEye);

    if (v.hasMask === 'kakuzu') {
      const wrapGeo = trackGeo(new THREE.CylinderGeometry(0.245, 0.24, 0.18, 12));
      const wrap = new THREE.Mesh(wrapGeo, secondaryMat);
      wrap.position.set(0, 0.06, 0.01);
      head.add(wrap);
    }
  }

  // Forehead protector band + metal plate
  const bandGeo = trackGeo(new THREE.CylinderGeometry(0.245, 0.245, 0.09, 14));
  const bandMesh = new THREE.Mesh(bandGeo, headbandMat);
  bandMesh.position.y = 0.23;
  head.add(bandMesh);

  const plateGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.085, 0.04));
  const plateMesh = new THREE.Mesh(plateGeo, metalMat);
  plateMesh.position.set(0, 0.23, 0.23);
  head.add(plateMesh);

  // Distinct Anime Hairstyle
  buildHairStyle(head, v.hairStyle, hairMat, trackGeo);

  // Arms
  const leftArm = buildLimbArm(
    -0.38,
    0.66,
    primaryMat,
    skinMat,
    accentMat,
    trackGeo,
  );
  const rightArm = buildLimbArm(
    0.38,
    0.66,
    primaryMat,
    skinMat,
    accentMat,
    trackGeo,
  );
  torso.add(leftArm, rightArm);

  // Weapon Socket on Right Arm or Torso Back
  const weaponGroup = new THREE.Group();
  buildWeapon(weaponGroup, torso, v.weapon, metalMat, accentMat, secondaryMat, trackGeo);
  if (v.weapon !== 'sand_gourd' && v.weapon !== 'paper_wings') {
    rightArm.add(weaponGroup);
    weaponGroup.position.set(0, -0.52, 0.06);
  }

  // Legs
  const leftLeg = buildLimbLeg(-0.14, 0.96, secondaryMat, accentMat, trackGeo);
  const rightLeg = buildLimbLeg(0.14, 0.96, secondaryMat, accentMat, trackGeo);
  bodyPivot.add(leftLeg, rightLeg);

  // Transformation Aura Ring / Ribcage
  const auraGroup = new THREE.Group();
  auraGroup.visible = false;
  const auraMat = new THREE.MeshBasicMaterial({
    color: v.transformAuraColor,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(auraMat);
  const auraRingGeo = trackGeo(new THREE.TorusGeometry(0.72, 0.055, 8, 24));
  auraRingGeo.rotateX(Math.PI / 2);
  const auraRing = new THREE.Mesh(auraRingGeo, auraMat);
  auraRing.position.y = 0.25;

  const auraCageGeo = trackGeo(new THREE.CylinderGeometry(0.66, 0.48, 1.85, 8, 1, true));
  const auraCageMat = new THREE.MeshBasicMaterial({
    color: v.transformAuraColor,
    transparent: true,
    opacity: 0.2,
    wireframe: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(auraCageMat);
  const auraCage = new THREE.Mesh(auraCageGeo, auraCageMat);
  auraCage.position.y = 1.15;

  auraGroup.add(auraRing, auraCage);
  bodyPivot.add(auraGroup);

  return {
    root,
    bodyPivot,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    auraGroup,
    weaponGroup,
    shadowDisc,
    materialsToFlash,
    baseEmissives,
    disposables: { geometries, materials },
  };
}

function buildLimbArm(
  x: number,
  y: number,
  sleeveMat: THREE.Material,
  skinMat: THREE.Material,
  gloveMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): THREE.Group {
  const arm = new THREE.Group();
  arm.position.set(x, y, 0);

  const upperGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.09, 0.34, 8));
  const upper = new THREE.Mesh(upperGeo, sleeveMat);
  upper.position.y = -0.17;
  upper.castShadow = true;

  const foreGeo = trackGeo(new THREE.CylinderGeometry(0.085, 0.075, 0.26, 8));
  const fore = new THREE.Mesh(foreGeo, skinMat);
  fore.position.y = -0.42;
  fore.castShadow = true;

  const fistGeo = trackGeo(new THREE.SphereGeometry(0.085, 8, 8));
  const fist = new THREE.Mesh(fistGeo, gloveMat);
  fist.position.y = -0.56;

  arm.add(upper, fore, fist);
  return arm;
}

function buildLimbLeg(
  x: number,
  y: number,
  pantMat: THREE.Material,
  sandalMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): THREE.Group {
  const leg = new THREE.Group();
  leg.position.set(x, y, 0);

  const thighGeo = trackGeo(new THREE.CylinderGeometry(0.125, 0.1, 0.46, 8));
  const thigh = new THREE.Mesh(thighGeo, pantMat);
  thigh.position.y = -0.23;
  thigh.castShadow = true;

  const shinGeo = trackGeo(new THREE.CylinderGeometry(0.095, 0.08, 0.42, 8));
  const shin = new THREE.Mesh(shinGeo, pantMat);
  shin.position.y = -0.64;
  shin.castShadow = true;

  const footGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.11, 0.26));
  const foot = new THREE.Mesh(footGeo, sandalMat);
  foot.position.set(0, -0.89, 0.05);
  foot.castShadow = true;

  leg.add(thigh, shin, foot);
  return leg;
}

function buildHairStyle(
  head: THREE.Group,
  style: HairStyle,
  hairMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): void {
  const crownGeo = trackGeo(new THREE.SphereGeometry(0.255, 12, 10));
  const crown = new THREE.Mesh(crownGeo, hairMat);
  crown.position.set(0, 0.22, -0.02);
  head.add(crown);

  const spikeGeo = trackGeo(new THREE.ConeGeometry(0.08, 0.28, 6));
  const addSpike = (x: number, y: number, z: number, rx: number, rz: number, scale = 1) => {
    const s = new THREE.Mesh(spikeGeo, hairMat);
    s.position.set(x, y, z);
    s.rotation.set(rx, 0, rz);
    s.scale.setScalar(scale);
    head.add(s);
  };

  switch (style) {
    case 'spiky_naruto':
    case 'spiky_minato':
    case 'spiky_pain':
      addSpike(0, 0.44, 0, 0, 0, 1.1);
      addSpike(-0.18, 0.36, 0.04, 0.2, 0.65, 1.0);
      addSpike(0.18, 0.36, 0.04, 0.2, -0.65, 1.0);
      addSpike(-0.14, 0.35, -0.14, -0.5, 0.45, 0.95);
      addSpike(0.14, 0.35, -0.14, -0.5, -0.45, 0.95);
      addSpike(0, 0.36, -0.22, -0.85, 0, 1.05);
      break;

    case 'duckbutt_sasuke':
      addSpike(0, 0.34, -0.24, -1.1, 0, 1.35);
      addSpike(-0.16, 0.28, -0.22, -0.9, 0.5, 1.2);
      addSpike(0.16, 0.28, -0.22, -0.9, -0.5, 1.2);
      addSpike(-0.15, 0.14, 0.14, 2.5, 0.2, 0.85);
      addSpike(0.15, 0.14, 0.14, 2.5, -0.2, 0.85);
      break;

    case 'long_madara':
    case 'long_hashirama': {
      const maneGeo = trackGeo(new THREE.ConeGeometry(0.34, 0.85, 8));
      const mane = new THREE.Mesh(maneGeo, hairMat);
      mane.position.set(0, 0.02, -0.18);
      mane.rotation.x = 0.25;
      head.add(mane);
      addSpike(-0.22, 0.22, -0.05, 0, 1.0, 1.1);
      addSpike(0.22, 0.22, -0.05, 0, -1.0, 1.1);
      break;
    }

    case 'ponytail_itachi':
    case 'ponytail_deidara': {
      const tailGeo = trackGeo(new THREE.ConeGeometry(0.1, 0.45, 7));
      const tail = new THREE.Mesh(tailGeo, hairMat);
      tail.position.set(0, 0.15, -0.28);
      tail.rotation.x = -2.35;
      head.add(tail);
      if (style === 'ponytail_deidara') {
        addSpike(-0.12, 0.18, 0.18, 2.6, 0.2, 0.95);
      }
      break;
    }

    case 'bowl_guy': {
      const bowlGeo = trackGeo(new THREE.CylinderGeometry(0.27, 0.27, 0.16, 14));
      const bowl = new THREE.Mesh(bowlGeo, hairMat);
      bowl.position.set(0, 0.25, -0.01);
      head.add(bowl);
      break;
    }

    case 'bun_konan': {
      const bunGeo = trackGeo(new THREE.SphereGeometry(0.14, 10, 10));
      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.position.set(0, 0.42, -0.08);
      head.add(bun);
      break;
    }

    default:
      addSpike(0, 0.4, -0.06, -0.35, 0, 0.9);
      addSpike(-0.16, 0.34, -0.04, -0.2, 0.55, 0.85);
      addSpike(0.16, 0.34, -0.04, -0.2, -0.55, 0.85);
      break;
  }
}

function buildWeapon(
  weaponGroup: THREE.Group,
  torso: THREE.Group,
  weapon: WeaponType,
  metalMat: THREE.Material,
  accentMat: THREE.Material,
  secondaryMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): void {
  switch (weapon) {
    case 'katana': {
      const bladeGeo = trackGeo(new THREE.BoxGeometry(0.04, 1.05, 0.08));
      const blade = new THREE.Mesh(bladeGeo, metalMat);
      blade.position.set(0, -0.1, 0.52);
      blade.rotation.x = Math.PI / 2;
      const hiltGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8));
      const hilt = new THREE.Mesh(hiltGeo, secondaryMat);
      hilt.rotation.x = Math.PI / 2;
      weaponGroup.add(blade, hilt);
      break;
    }
    case 'kunai_blade': {
      const bladeGeo = trackGeo(new THREE.ConeGeometry(0.055, 0.42, 4));
      const blade = new THREE.Mesh(bladeGeo, metalMat);
      blade.rotation.x = Math.PI / 2;
      blade.position.z = 0.24;
      weaponGroup.add(blade);
      break;
    }
    case 'samehada': {
      const bodyGeo = trackGeo(new THREE.CylinderGeometry(0.17, 0.13, 1.45, 8));
      const body = new THREE.Mesh(bodyGeo, secondaryMat);
      body.rotation.x = Math.PI / 2;
      body.position.z = 0.65;
      weaponGroup.add(body);
      break;
    }
    case 'triple_scythe': {
      const shaftGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.65, 8));
      const shaft = new THREE.Mesh(shaftGeo, metalMat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.5;
      weaponGroup.add(shaft);
      for (let i = 0; i < 3; i++) {
        const bladeGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.03, 0.12));
        const b = new THREE.Mesh(bladeGeo, accentMat);
        b.position.set(0.18, 0, 0.85 + i * 0.18);
        b.rotation.y = 0.25;
        weaponGroup.add(b);
      }
      break;
    }
    case 'gunbai_fan': {
      const fanGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 14));
      fanGeo.rotateZ(Math.PI / 2);
      const fan = new THREE.Mesh(fanGeo, accentMat);
      fan.position.set(0, 0.1, 0.6);
      const staffGeo = trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8));
      const staff = new THREE.Mesh(staffGeo, secondaryMat);
      staff.rotation.x = Math.PI / 2;
      staff.position.z = 0.35;
      weaponGroup.add(fan, staff);
      break;
    }
    case 'sand_gourd': {
      const gourdBottom = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.28, 12, 10)),
        accentMat,
      );
      gourdBottom.position.set(0, 0.28, -0.4);
      const gourdTop = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.2, 10, 8)),
        accentMat,
      );
      gourdTop.position.set(0, 0.66, -0.4);
      torso.add(gourdBottom, gourdTop);
      break;
    }
    case 'paper_wings': {
      const wingGeo = trackGeo(new THREE.BoxGeometry(0.85, 0.55, 0.04));
      const lw = new THREE.Mesh(wingGeo, accentMat);
      lw.position.set(-0.55, 0.52, -0.32);
      lw.rotation.set(0.2, 0.35, 0.28);
      const rw = new THREE.Mesh(wingGeo, accentMat);
      rw.position.set(0.55, 0.52, -0.32);
      rw.rotation.set(0.2, -0.35, -0.28);
      torso.add(lw, rw);
      break;
    }
    case 'puppet_scroll': {
      const scrollGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 10));
      scrollGeo.rotateZ(Math.PI / 2.6);
      const scroll = new THREE.Mesh(scrollGeo, accentMat);
      scroll.position.set(0, 0.42, -0.32);
      torso.add(scroll);
      break;
    }
    default:
      break;
  }
}

export function applyRigPose(
  rig: ShinobiRig,
  pose: AnimPose,
  phase: number,
  isTransformed: boolean,
  dt: number,
): void {
  const damp = (curr: number, target: number, lambda = 16) =>
    THREE.MathUtils.damp(curr, target, lambda, dt);

  rig.auraGroup.visible = isTransformed;
  if (isTransformed) {
    rig.auraGroup.rotation.y += dt * 3.2;
  }

  let torsoRotX = 0;
  let torsoRotY = 0;
  let lArmX = 0.15;
  let rArmX = 0.15;
  let lArmZ = 0.18;
  let rArmZ = -0.18;
  let lLegX = 0;
  let rLegX = 0;
  let pivotY = 0;

  switch (pose) {
    case 'idle':
      pivotY = Math.sin(phase * 3.0) * 0.035;
      torsoRotX = 0.08;
      lArmX = -0.55 + Math.sin(phase * 3.0) * 0.05;
      rArmX = -0.65 - Math.sin(phase * 3.0) * 0.05;
      lArmZ = -0.32;
      rArmZ = 0.32;
      break;

    case 'run':
      // Iconic shinobi forward-lean sprint!
      torsoRotX = 0.48;
      pivotY = Math.abs(Math.sin(phase * 2.0)) * 0.11;
      lArmX = 0.95 + Math.sin(phase) * 0.12;
      rArmX = 0.95 - Math.sin(phase) * 0.12;
      lArmZ = -0.35;
      rArmZ = 0.35;
      lLegX = Math.sin(phase * 2.0) * 0.85;
      rLegX = -Math.sin(phase * 2.0) * 0.85;
      break;

    case 'jump':
      torsoRotX = 0.16;
      lArmX = -0.7;
      rArmX = -0.7;
      lArmZ = -0.48;
      rArmZ = 0.48;
      lLegX = -0.55;
      rLegX = 0.35;
      break;

    case 'attack1':
      torsoRotX = 0.25;
      torsoRotY = -0.45;
      rArmX = -1.55;
      lArmX = 0.35;
      lArmZ = -0.25;
      rArmZ = 0.15;
      lLegX = -0.35;
      rLegX = 0.35;
      break;

    case 'attack2':
      torsoRotX = 0.28;
      torsoRotY = 0.5;
      lArmX = -1.6;
      rArmX = 0.4;
      lArmZ = -0.15;
      rArmZ = 0.25;
      lLegX = 0.4;
      rLegX = -0.35;
      break;

    case 'attack3':
      torsoRotX = 0.38;
      torsoRotY = Math.sin(phase * 14) * 0.6;
      rArmX = -1.7;
      lArmX = -1.2;
      lArmZ = -0.25;
      rArmZ = 0.25;
      rLegX = -0.75;
      break;

    case 'heavy':
      torsoRotX = 0.42;
      torsoRotY = -0.25;
      lArmX = -1.95;
      rArmX = -1.95;
      lArmZ = -0.18;
      rArmZ = 0.18;
      break;

    case 'jutsu':
      torsoRotX = 0.18;
      rArmX = -1.45;
      lArmX = -1.1;
      lArmZ = 0.22;
      rArmZ = -0.22;
      break;

    case 'charge':
      pivotY = Math.sin(phase * 18) * 0.025;
      torsoRotX = -0.08;
      lArmX = -0.85;
      rArmX = -0.85;
      lArmZ = -0.45;
      rArmZ = 0.45;
      lLegX = 0.18;
      rLegX = -0.18;
      break;

    case 'block':
      torsoRotX = 0.12;
      lArmX = -1.25;
      rArmX = -1.25;
      lArmZ = 0.42;
      rArmZ = -0.42;
      break;

    case 'hit':
      torsoRotX = -0.38;
      lArmX = -0.5;
      rArmX = -0.5;
      lArmZ = -0.65;
      rArmZ = 0.65;
      break;

    case 'ultimate':
      pivotY = 0.35 + Math.sin(phase * 10) * 0.08;
      torsoRotX = -0.18;
      lArmX = -2.4;
      rArmX = -2.4;
      lArmZ = -0.6;
      rArmZ = 0.6;
      break;

    case 'ko':
      torsoRotX = -1.35;
      pivotY = -0.55;
      lArmX = -0.4;
      rArmX = -0.4;
      lArmZ = -0.85;
      rArmZ = 0.85;
      break;
  }

  rig.bodyPivot.position.y = damp(rig.bodyPivot.position.y, pivotY, 18);
  rig.torso.rotation.x = damp(rig.torso.rotation.x, torsoRotX, 18);
  rig.torso.rotation.y = damp(rig.torso.rotation.y, torsoRotY, 18);
  rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, lArmX, 20);
  rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, rArmX, 20);
  rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, lArmZ, 18);
  rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, rArmZ, 18);
  rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, lLegX, 18);
  rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, rLegX, 18);
}

export function disposeShinobiRig(rig: ShinobiRig): void {
  rig.disposables.geometries.forEach((g) => g.dispose());
  rig.disposables.materials.forEach((m) => m.dispose());
}
