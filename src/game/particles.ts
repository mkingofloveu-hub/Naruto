import * as THREE from 'three';
import { ElementType } from './types';

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  r: number;
  g: number;
  b: number;
}

export interface ProjectileEntity {
  active: boolean;
  owner: 'player' | 'boss';
  kind: 'kunai' | 'jutsu_orb' | 'meteor';
  element: ElementType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damageMultiplier: number;
  knockback: number;
  radius: number;
  life: number;
  mesh: THREE.Mesh;
}

export interface ShockwaveRing {
  active: boolean;
  life: number;
  maxLife: number;
  maxRadius: number;
  mesh: THREE.Mesh;
}

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

export function elementHex(el: ElementType): string {
  switch (el) {
    case 'fire':
      return '#f97316';
    case 'lightning':
      return '#38bdf8';
    case 'water':
      return '#0ea5e9';
    case 'wind':
      return '#a7f3d0';
    case 'earth':
      return '#d97706';
    case 'sand':
      return '#eab308';
    case 'paper':
      return '#e2e8f0';
    case 'wood':
      return '#22c55e';
    case 'taijutsu':
      return '#fb7185';
    case 'chakra':
    default:
      return '#60a5fa';
  }
}

export class EffectsPool {
  private particles: ParticleSlot[] = [];
  private maxParticles = 320;
  private cursor = 0;
  private instancedParticles: THREE.InstancedMesh;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.MeshBasicMaterial;

  public projectiles: ProjectileEntity[] = [];
  private projGeoOrb: THREE.SphereGeometry;
  private projGeoKunai: THREE.ConeGeometry;

  private rings: ShockwaveRing[] = [];
  private ringGeo: THREE.RingGeometry;
  private scene: THREE.Scene;
  private densityMultiplier = 1.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pooled InstancedMesh particles (zero GC in loop)
    this.particleGeo = new THREE.OctahedronGeometry(0.18, 0);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.instancedParticles = new THREE.InstancedMesh(
      this.particleGeo,
      this.particleMat,
      this.maxParticles,
    );
    this.instancedParticles.frustumCulled = false;
    this.instancedParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0,
        gravity: 0,
        r: 1,
        g: 1,
        b: 1,
      });
      _mat4.makeScale(0, 0, 0);
      this.instancedParticles.setMatrixAt(i, _mat4);
      this.instancedParticles.setColorAt(i, _color.setHex(0xffffff));
    }
    scene.add(this.instancedParticles);

    // Pooled projectiles (up to 24 active simultaneously)
    this.projGeoOrb = new THREE.SphereGeometry(0.45, 12, 10);
    this.projGeoKunai = new THREE.ConeGeometry(0.11, 0.65, 5);
    this.projGeoKunai.rotateX(Math.PI / 2);

    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const mesh = new THREE.Mesh(this.projGeoOrb, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.projectiles.push({
        active: false,
        owner: 'player',
        kind: 'jutsu_orb',
        element: 'chakra',
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        damageMultiplier: 1,
        knockback: 4,
        radius: 0.6,
        life: 0,
        mesh,
      });
    }

    // Pooled ground shockwave rings
    this.ringGeo = new THREE.RingGeometry(0.65, 1.0, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const rMesh = new THREE.Mesh(this.ringGeo, rMat);
      rMesh.visible = false;
      scene.add(rMesh);
      this.rings.push({
        active: false,
        life: 0,
        maxLife: 0.5,
        maxRadius: 5,
        mesh: rMesh,
      });
    }
  }

  public setDensity(density: 'low' | 'medium' | 'high'): void {
    this.densityMultiplier = density === 'low' ? 0.45 : density === 'medium' ? 0.8 : 1.25;
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    colorHex: string,
    count: number,
    speed = 8,
    size = 1.0,
    gravity = -9,
  ): void {
    const actualCount = Math.max(2, Math.round(count * this.densityMultiplier));
    _color.set(colorHex);
    for (let i = 0; i < actualCount; i++) {
      const p = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.maxParticles;

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.25) * Math.PI;
      const spd = speed * (0.4 + Math.random() * 0.85);
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.4;
      p.y = y + (Math.random() - 0.5) * 0.4;
      p.z = z + (Math.random() - 0.5) * 0.4;
      p.vx = Math.cos(theta) * Math.cos(phi) * spd;
      p.vy = Math.abs(Math.sin(phi)) * spd * 0.85 + 1.5;
      p.vz = Math.sin(theta) * Math.cos(phi) * spd;
      p.maxLife = 0.28 + Math.random() * 0.42;
      p.life = p.maxLife;
      p.size = size * (0.65 + Math.random() * 0.85);
      p.gravity = gravity;
      p.r = _color.r;
      p.g = _color.g;
      p.b = _color.b;
    }
  }

  public spawnShockwave(
    x: number,
    y: number,
    z: number,
    colorHex: string,
    maxRadius = 6,
    duration = 0.42,
  ): void {
    const slot = this.rings.find((r) => !r.active) ?? this.rings[0];
    slot.active = true;
    slot.life = duration;
    slot.maxLife = duration;
    slot.maxRadius = maxRadius;
    slot.mesh.position.set(x, Math.max(0.06, y), z);
    slot.mesh.scale.setScalar(0.35);
    slot.mesh.visible = true;
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(colorHex);
    mat.opacity = 0.85;
  }

  public spawnProjectile(params: {
    owner: 'player' | 'boss';
    kind: 'kunai' | 'jutsu_orb' | 'meteor';
    element: ElementType;
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    speed: number;
    damageMultiplier: number;
    knockback: number;
    radius?: number;
    colorHex?: string;
    life?: number;
  }): void {
    const slot = this.projectiles.find((p) => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.owner = params.owner;
    slot.kind = params.kind;
    slot.element = params.element;
    slot.position.copy(params.origin);
    slot.velocity.copy(params.direction).normalize().multiplyScalar(params.speed);
    slot.damageMultiplier = params.damageMultiplier;
    slot.knockback = params.knockback;
    slot.radius = params.radius ?? (params.kind === 'kunai' ? 0.55 : 1.05);
    slot.life = params.life ?? 2.2;

    slot.mesh.geometry = params.kind === 'kunai' ? this.projGeoKunai : this.projGeoOrb;
    const scale = params.kind === 'meteor' ? 3.8 : params.kind === 'kunai' ? 1.0 : 1.25;
    slot.mesh.scale.setScalar(scale);
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(params.colorHex ?? elementHex(params.element));
    slot.mesh.position.copy(slot.position);
    slot.mesh.lookAt(
      slot.position.x + slot.velocity.x,
      slot.position.y + slot.velocity.y,
      slot.position.z + slot.velocity.z,
    );
    slot.mesh.visible = true;
  }

  public update(dt: number): void {
    // Update particles
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.instancedParticles.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy *= -0.35;
      }
      const ratio = p.life / p.maxLife;
      const s = p.size * ratio;
      _pos.set(p.x, p.y, p.z);
      _scale.set(s, s, s);
      _mat4.compose(_pos, _quat, _scale);
      this.instancedParticles.setMatrixAt(i, _mat4);
      _color.setRGB(p.r, p.g, p.b);
      this.instancedParticles.setColorAt(i, _color);
    }
    this.instancedParticles.instanceMatrix.needsUpdate = true;
    if (this.instancedParticles.instanceColor) {
      this.instancedParticles.instanceColor.needsUpdate = true;
    }

    // Update shockwave rings
    for (const r of this.rings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      const rad = THREE.MathUtils.lerp(0.4, r.maxRadius, progress);
      r.mesh.scale.setScalar(rad);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.82;
    }

    // Update projectiles movement (collision handled in engine)
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      proj.life -= dt;
      if (proj.life <= 0) {
        proj.active = false;
        proj.mesh.visible = false;
        continue;
      }
      proj.position.addScaledVector(proj.velocity, dt);
      proj.mesh.position.copy(proj.position);
      if (proj.kind === 'jutsu_orb') {
        proj.mesh.rotation.y += dt * 9;
        proj.mesh.rotation.x += dt * 5;
      }
    }
  }

  public clearActive(): void {
    for (const p of this.particles) p.active = false;
    for (const r of this.rings) {
      r.active = false;
      r.mesh.visible = false;
    }
    for (const proj of this.projectiles) {
      proj.active = false;
      proj.mesh.visible = false;
    }
  }

  public dispose(): void {
    this.scene.remove(this.instancedParticles);
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.projGeoOrb.dispose();
    this.projGeoKunai.dispose();
    this.ringGeo.dispose();
    for (const proj of this.projectiles) {
      this.scene.remove(proj.mesh);
      (proj.mesh.material as THREE.Material).dispose();
    }
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
  }
}
