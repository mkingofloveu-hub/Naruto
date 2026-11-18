import * as THREE from 'three';
import { ArenaTextureSet } from './textures';
import { ArenaId } from './types';

export interface DestructibleRock {
  id: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  hp: number;
  destroyed: boolean;
}

export interface ArenaBuildResult {
  group: THREE.Group;
  arenaRadius: number;
  destructibles: DestructibleRock[];
  animatedWater?: THREE.Mesh;
  waterfallMesh?: THREE.Mesh;
  dispose: () => void;
}

export function buildArena(
  arenaId: ArenaId,
  textures: ArenaTextureSet,
  scene: THREE.Scene,
): ArenaBuildResult {
  const group = new THREE.Group();
  const arenaRadius = 32;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const destructibles: DestructibleRock[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Theme colors matched to horizon fog & sky background
  const theme =
    arenaId === 'final_valley'
      ? {
          skyColor: 0x16243b,
          fogColor: 0x1c2d48,
          groundTint: 0x8c877c,
          cliffColor: 0x3b4252,
          accentColor: 0x38bdf8,
        }
      : arenaId === 'storm_canyon'
        ? {
            skyColor: 0x2a141d,
            fogColor: 0x361924,
            groundTint: 0x8b6f63,
            cliffColor: 0x45272d,
            accentColor: 0xf97316,
          }
        : {
            skyColor: 0x1c1926,
            fogColor: 0x262133,
            groundTint: 0x7e766b,
            cliffColor: 0x3a3747,
            accentColor: 0xef4444,
          };

  scene.background = new THREE.Color(theme.skyColor);
  scene.fog = new THREE.FogExp2(theme.fogColor, 0.0085);

  // Extended Outer Terrain (so horizon never ends in a hard floating box)
  const outerGroundGeo = trackGeo(new THREE.CircleGeometry(190, 48));
  outerGroundGeo.rotateX(-Math.PI / 2);
  const outerGroundMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: theme.groundTint,
      map: textures.groundColor,
      bumpMap: textures.groundBump,
      bumpScale: 0.14,
      roughness: 0.88,
      metalness: 0.04,
    }),
  );
  const outerGround = new THREE.Mesh(outerGroundGeo, outerGroundMat);
  outerGround.position.y = -0.05;
  outerGround.receiveShadow = true;
  group.add(outerGround);

  // Main Elevated Combat Arena Platform (offset >= 0.05 to avoid Z-fighting)
  const platformGeo = trackGeo(new THREE.CylinderGeometry(arenaRadius, arenaRadius + 2.5, 0.8, 48));
  const platformMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.groundColor,
      bumpMap: textures.groundBump,
      bumpScale: 0.18,
      roughness: 0.82,
      metalness: 0.08,
    }),
  );
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.y = -0.4;
  platform.receiveShadow = true;
  group.add(platform);

  // Arena Carved Outer Ring Boundary Stones (polygonOffset safe)
  const rimGeo = trackGeo(new THREE.RingGeometry(arenaRadius - 0.8, arenaRadius, 48));
  rimGeo.rotateX(-Math.PI / 2);
  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: theme.accentColor,
      emissive: new THREE.Color(theme.accentColor),
      emissiveIntensity: 0.25,
      roughness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.025;
  group.add(rim);

  // Natural Perimeter Cliff Spires (InstancedMesh for high-performance outdoor containment)
  const cliffGeo = trackGeo(new THREE.ConeGeometry(4.5, 22, 6));
  const cliffMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: theme.cliffColor,
      map: textures.stoneColor,
      roughness: 0.9,
      metalness: 0.06,
    }),
  );
  const cliffCount = 36;
  const cliffInst = new THREE.InstancedMesh(cliffGeo, cliffMat, cliffCount);
  cliffInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < cliffCount; i++) {
    const angle = (i / cliffCount) * Math.PI * 2;
    const dist = arenaRadius + 10 + (i % 3) * 7;
    const scaleY = 0.85 + ((i * 7) % 10) * 0.14;
    const scaleXZ = 0.9 + ((i * 5) % 8) * 0.12;
    dummy.position.set(Math.cos(angle) * dist, 8.5 * scaleY - 1, Math.sin(angle) * dist);
    dummy.rotation.set(0, angle * 1.7, (i % 2 === 0 ? 1 : -1) * 0.08);
    dummy.scale.set(scaleXZ, scaleY, scaleXZ);
    dummy.updateMatrix();
    cliffInst.setMatrixAt(i, dummy.matrix);
    tint.setHex(0xffffff).multiplyScalar(0.82 + (i % 4) * 0.08);
    cliffInst.setColorAt(i, tint);
  }
  cliffInst.computeBoundingSphere();
  group.add(cliffInst);

  let animatedWater: THREE.Mesh | undefined;
  let waterfallMesh: THREE.Mesh | undefined;

  // Arena-Specific Landmark Silhouettes (3-12 part composite groups)
  if (arenaId === 'final_valley') {
    // Sacred River cutting past the arena edge + towering waterfall
    const riverGeo = trackGeo(new THREE.PlaneGeometry(180, 34));
    riverGeo.rotateX(-Math.PI / 2);
    const riverMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.waterColor,
        roughness: 0.18,
        metalness: 0.35,
      }),
    );
    animatedWater = new THREE.Mesh(riverGeo, riverMat);
    animatedWater.position.set(0, -0.02, -52);
    group.add(animatedWater);

    const fallGeo = trackGeo(new THREE.PlaneGeometry(14, 34));
    const fallMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        map: textures.waterColor,
        emissive: new THREE.Color('#0284c7'),
        emissiveIntensity: 0.3,
        roughness: 0.25,
      }),
    );
    waterfallMesh = new THREE.Mesh(fallGeo, fallMat);
    waterfallMesh.position.set(0, 15, -66);
    group.add(waterfallMesh);

    // Colossal Dual Shinobi Statues flanking the waterfall
    const statueMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        map: textures.stoneColor,
        roughness: 0.85,
        metalness: 0.08,
      }),
    );
    const leftStatue = buildColossalStatue(statueMat, trackGeo, 1);
    leftStatue.position.set(-22, 0, -54);
    leftStatue.rotation.y = 0.28;
    const rightStatue = buildColossalStatue(statueMat, trackGeo, -1);
    rightStatue.position.set(22, 0, -54);
    rightStatue.rotation.y = -0.28;
    group.add(leftStatue, rightStatue);
  } else if (arenaId === 'storm_canyon') {
    // Giant Akatsuki Stone Monoliths & Shrine Torii
    const pillarMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x523438,
        map: textures.stoneColor,
        roughness: 0.86,
      }),
    );
    const crimsonMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        roughness: 0.5,
        metalness: 0.15,
      }),
    );
    const torii = buildToriiGate(crimsonMat, pillarMat, trackGeo);
    torii.position.set(0, 0, -34);
    torii.scale.setScalar(2.4);
    group.add(torii);
  } else {
    // War Battlefield: Shattered Fortress Archways & Crimson War Banners
    const stoneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x4b5563,
        map: textures.stoneColor,
        roughness: 0.88,
      }),
    );
    const bannerMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        roughness: 0.72,
      }),
    );
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const ruin = buildRuinedPillar(stoneMat, bannerMat, trackGeo);
      ruin.position.set(i * 12, 0, -33 - Math.abs(i) * 3);
      group.add(ruin);
    }
  }

  // Destructible Arena Boulders (multi-part rock clusters inside perimeter)
  const boulderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x78716c,
      map: textures.stoneColor,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  const boulderCoords: [number, number][] = [
    [-13, -11],
    [13, -10],
    [-15, 9],
    [14, 11],
    [0, -17],
    [0, 17],
  ];
  boulderCoords.forEach(([bx, bz], idx) => {
    const rockGroup = new THREE.Group();
    const mainRock = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(1.35, 0)), boulderMat);
    mainRock.position.y = 0.95;
    mainRock.scale.set(1.1, 0.88, 1.0);
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    const sideRock = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.75, 0)), boulderMat);
    sideRock.position.set(0.95, 0.5, 0.4);
    sideRock.castShadow = true;
    const capRock = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.6, 0)), boulderMat);
    capRock.position.set(-0.7, 0.42, -0.5);
    rockGroup.add(mainRock, sideRock, capRock);
    rockGroup.position.set(bx, 0, bz);
    group.add(rockGroup);

    destructibles.push({
      id: idx,
      mesh: rockGroup,
      position: new THREE.Vector3(bx, 0, bz),
      radius: 1.75,
      hp: 85,
      destroyed: false,
    });
  });

  scene.add(group);

  return {
    group,
    arenaRadius,
    destructibles,
    animatedWater,
    waterfallMesh,
    dispose: () => {
      scene.remove(group);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

function buildColossalStatue(
  mat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  signSide: number,
): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11, 6, 9)), mat);
  base.position.y = 3;
  const robe = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.4, 4.8, 16, 8)), mat);
  robe.position.y = 14;
  const chest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.5, 7, 4.5)), mat);
  chest.position.y = 22;
  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(2.3, 10, 8)), mat);
  head.position.y = 27.5;
  const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 8.5, 2.2)), mat);
  arm.position.set(signSide * 3.8, 22.5, 2.2);
  arm.rotation.x = -0.85;
  g.add(base, robe, chest, head, arm);
  return g;
}

function buildToriiGate(
  redMat: THREE.Material,
  stoneMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): THREE.Group {
  const g = new THREE.Group();
  const colGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.4, 5.2, 10));
  const c1 = new THREE.Mesh(colGeo, redMat);
  c1.position.set(-2.2, 2.6, 0);
  const c2 = new THREE.Mesh(colGeo, redMat);
  c2.position.set(2.2, 2.6, 0);
  const topBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.8, 0.5, 0.7)), redMat);
  topBeam.position.y = 5.2;
  const subBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.6, 0.35, 0.45)), stoneMat);
  subBeam.position.y = 4.2;
  g.add(c1, c2, topBeam, subBeam);
  return g;
}

function buildRuinedPillar(
  stoneMat: THREE.Material,
  bannerMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): THREE.Group {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 1.4, 2.6)), stoneMat);
  plinth.position.y = 0.7;
  const shaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.9, 1.05, 8.5, 8)), stoneMat);
  shaft.position.y = 5.5;
  const banner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 3.8, 0.1)), bannerMat);
  banner.position.set(0, 6.2, 1.05);
  g.add(plinth, shaft, banner);
  return g;
}
