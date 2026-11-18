import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ArenaBuildResult, buildArena } from './arenaBuilder';
import { audioEngine } from './audio';
import { AnimPose, applyRigPose, createShinobiRig, disposeShinobiRig, ShinobiRig } from './characterMesh';
import { AKATSUKI_BOSSES, getAllOpponents, getBossById, getPlayableById } from './characters';
import {
  calculateCombatDamage,
  calculateMatchScore,
  canSpendChakra,
  decideBossIntent,
  spendChakra,
} from './combatRules';
import { EffectsPool, elementHex } from './particles';
import { ArenaTextureSet, createProceduralTextures } from './textures';
import {
  ArenaId,
  ElementType,
  FighterDef,
  GameModeId,
  GameScreenState,
  GraphicsSettings,
  HudSnapshot,
  MatchResultSnapshot,
  SkillDef,
} from './types';

interface FighterRuntime {
  def: FighterDef;
  rig: ShinobiRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  chakra: number;
  maxChakra: number;
  awaken: number;
  isTransformed: boolean;
  transformTimer: number;
  grounded: boolean;
  coyoteTimer: number;
  pose: AnimPose;
  animPhase: number;
  actionTimer: number;
  actionKind:
    | 'none'
    | 'light1'
    | 'light2'
    | 'light3'
    | 'heavy'
    | 'kunai'
    | 'skill'
    | 'special'
    | 'ultimate'
    | 'hitstun'
    | 'dash'
    | 'ko';
  actionHitFired: boolean;
  activeSkillIdx: number;
  comboStep: number;
  comboWindowTimer: number;
  skillCooldowns: [number, number, number, number];
  specialCooldown: number;
  kunaiCooldown: number;
  dashCooldown: number;
  isBlocking: boolean;
  parryWindowTimer: number;
  guardBrokenTimer: number;
  isCharging: boolean;
  hitFlashTimer: number;
  invulnTimer: number;
  squashScale: THREE.Vector2;
  aiThinkTimer: number;
  aiTelegraphTimer: number;
  aiPendingIntent: string | null;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onMatchEnd: (result: MatchResultSnapshot) => void;
  onBossVictoryProgress: (boss: FighterDef, score: number, mode: GameModeId) => void;
  onPauseToggle: () => void;
  onWebGLUnavailable: () => void;
}

const _tmpVec = new THREE.Vector3();
const _tmpForward = new THREE.Vector3();
const _tmpRight = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();

export class ShinobiWarEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private keyLight!: THREE.DirectionalLight;
  private isSoftwareGl = false;
  private textures!: ArenaTextureSet;
  private arena: ArenaBuildResult | null = null;
  private effects!: EffectsPool;
  private telegraphRing!: THREE.Mesh;

  private player!: FighterRuntime;
  private boss!: FighterRuntime;

  private screenState: GameScreenState = 'title';
  private mode: GameModeId = 'story';
  private arenaId: ArenaId = 'final_valley';
  private selectedPlayerId = 'naruto';
  private selectedOpponentId = 'deidara';
  private settings: GraphicsSettings;

  private stageIndex = 0;
  private waveNumber = 1;
  private bossesDefeatedThisRun = 0;
  private playerRoundsWon = 0;
  private bossRoundsWon = 0;
  private currentRound = 1;
  private totalDamageDealt = 0;
  private comboCount = 0;
  private comboResetTimer = 0;
  private maxCombo = 0;
  private matchElapsed = 0;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private outcomePendingTimer = 0;
  private pendingOutcome: 'victory' | 'defeat' | null = null;

  private bannerTitle: string | null = null;
  private bannerSubtitle: string | null = null;
  private bannerType: HudSnapshot['bannerType'] = null;
  private bannerTimer = 0;
  private ultimateCamTimer = 0;

  // Input state
  private keysHeld = new Set<string>();
  private justPressed = new Set<string>();
  private jumpBufferTimer = 0;
  private touchMove = new THREE.Vector2(0, 0);
  private cameraYaw = 0;
  private cameraPitch = 0.34;
  private isPointerDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Loop & lifecycle
  private frameId = 0;
  private lastTimestamp = 0;
  private lastRenderTime = 0;
  private hudEmitAccum = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private titleOrbitAngle = 0.55;

  constructor(
    container: HTMLElement,
    initialSettings: GraphicsSettings,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.callbacks = callbacks;

    this.initRendererAndScene();
    this.loadMatchEntities('naruto', 'deidara', 'final_valley');
    this.bindInputListeners();
    this.step(0.016);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
    this.startLoop();
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      this.callbacks.onWebGLUnavailable();
      return;
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.scene = new THREE.Scene();

    const width = Math.max(320, this.container.clientWidth || window.innerWidth);
    const height = Math.max(240, this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.2, 260);
    this.camera.position.set(0, 6, 15);

    // Mandatory studio environment map for PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Warm/cool 3-point outdoor lighting rig
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x3b2f2f, 0.72);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xffedd5, 1.85);
    this.keyLight.position.set(22, 34, 18);
    this.keyLight.castShadow = !this.isSoftwareGl && this.settings.shadows;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    const d = 28;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 90;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.75);
    rimLight.position.set(-18, 14, -22);
    this.scene.add(rimLight);

    this.textures = createProceduralTextures(
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.effects = new EffectsPool(this.scene);

    // Ground attack telegraph danger ring for boss windups
    const teleGeo = new THREE.RingGeometry(1.8, 2.35, 32);
    teleGeo.rotateX(-Math.PI / 2);
    const teleMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.telegraphRing = new THREE.Mesh(teleGeo, teleMat);
    this.telegraphRing.visible = false;
    this.scene.add(this.telegraphRing);

    this.applyGraphicsSettings(this.settings);
    this.handleResize();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  public applyGraphicsSettings(next: GraphicsSettings): void {
    this.settings = { ...next };
    if (!this.renderer) return;

    const pixelRatio = this.isSoftwareGl
      ? 1
      : Math.min(window.devicePixelRatio, Math.max(0.6, next.resolutionScale));
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && next.shadows;
    if (this.keyLight) {
      this.keyLight.castShadow = !this.isSoftwareGl && next.shadows;
    }
    this.effects?.setDensity(next.particleDensity);
    this.handleResize();
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(320, this.container.clientWidth || window.innerWidth);
    const height = Math.max(240, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private loadMatchEntities(
    playerId: string,
    opponentId: string,
    arenaId: ArenaId,
  ): void {
    if (this.arena) {
      this.arena.dispose();
      this.arena = null;
    }
    if (this.player) {
      this.scene.remove(this.player.rig.root);
      disposeShinobiRig(this.player.rig);
    }
    if (this.boss) {
      this.scene.remove(this.boss.rig.root);
      disposeShinobiRig(this.boss.rig);
    }

    this.effects.clearActive();
    this.arenaId = arenaId;
    this.arena = buildArena(arenaId, this.textures, this.scene);

    const pDef = getPlayableById(playerId);
    const bDef =
      getAllOpponents().find((o) => o.id === opponentId) ?? getBossById(opponentId);

    this.player = this.createFighterRuntime(pDef, new THREE.Vector3(0, 0, 9), Math.PI);
    this.boss = this.createFighterRuntime(bDef, new THREE.Vector3(0, 0, -9), 0);

    // Scale boss slightly for War wave escalation
    if (this.mode === 'war' && this.waveNumber > 1) {
      const mult = 1 + (this.waveNumber - 1) * 0.14;
      this.boss.maxHp = Math.round(this.boss.maxHp * mult);
      this.boss.hp = this.boss.maxHp;
    }

    this.scene.add(this.player.rig.root, this.boss.rig.root);
    this.cameraYaw = 0;

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private createFighterRuntime(
    def: FighterDef,
    spawnPos: THREE.Vector3,
    yaw: number,
  ): FighterRuntime {
    const rig = createShinobiRig(def, this.textures.shadowDisc);
    rig.root.position.copy(spawnPos);
    rig.root.rotation.y = yaw;
    return {
      def,
      rig,
      pos: spawnPos.clone(),
      vel: new THREE.Vector3(),
      yaw,
      hp: def.maxHp,
      maxHp: def.maxHp,
      chakra: def.maxChakra,
      maxChakra: def.maxChakra,
      awaken: 0,
      isTransformed: false,
      transformTimer: 0,
      grounded: true,
      coyoteTimer: 0,
      pose: 'idle',
      animPhase: 0,
      actionTimer: 0,
      actionKind: 'none',
      actionHitFired: false,
      activeSkillIdx: 0,
      comboStep: 0,
      comboWindowTimer: 0,
      skillCooldowns: [0, 0, 0, 0],
      specialCooldown: 0,
      kunaiCooldown: 0,
      dashCooldown: 0,
      isBlocking: false,
      parryWindowTimer: 0,
      guardBrokenTimer: 0,
      isCharging: false,
      hitFlashTimer: 0,
      invulnTimer: 0,
      squashScale: new THREE.Vector2(1, 1),
      aiThinkTimer: 0.45,
      aiTelegraphTimer: 0,
      aiPendingIntent: null,
    };
  }

  public setScreenState(state: GameScreenState): void {
    this.screenState = state;
    document.body.dataset.state = state;
    if (state !== 'playing') {
      this.clearAllInputs();
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
    if (state === 'title') {
      audioEngine.startMusic('title');
    } else if (state === 'playing') {
      audioEngine.startMusic('battle');
    } else if (state === 'paused') {
      audioEngine.stopMusic();
    }
  }

  public startNewMatch(opts: {
    mode: GameModeId;
    playerId: string;
    opponentId?: string;
    arenaId?: ArenaId;
    stageIndex?: number;
  }): void {
    audioEngine.unlock();
    this.mode = opts.mode;
    this.selectedPlayerId = opts.playerId;

    if (opts.mode === 'story' || opts.mode === 'boss_rush') {
      this.stageIndex = opts.stageIndex ?? 0;
      const boss = AKATSUKI_BOSSES[Math.min(AKATSUKI_BOSSES.length - 1, this.stageIndex)];
      this.selectedOpponentId = boss.id;
      this.arenaId = boss.arenaId ?? 'final_valley';
    } else if (opts.mode === 'war' || opts.mode === 'survival') {
      this.stageIndex = 0;
      this.waveNumber = 1;
      const boss = AKATSUKI_BOSSES[0];
      this.selectedOpponentId = boss.id;
      this.arenaId = opts.arenaId ?? boss.arenaId ?? 'war_battlefield';
    } else {
      this.stageIndex = 0;
      this.selectedOpponentId = opts.opponentId ?? 'deidara';
      this.arenaId = opts.arenaId ?? 'final_valley';
    }

    this.bossesDefeatedThisRun = 0;
    this.playerRoundsWon = 0;
    this.bossRoundsWon = 0;
    this.currentRound = 1;
    this.totalDamageDealt = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
    this.matchElapsed = 0;
    this.pendingOutcome = null;
    this.outcomePendingTimer = 0;

    this.loadMatchEntities(this.selectedPlayerId, this.selectedOpponentId, this.arenaId);
    this.setScreenState('playing');
    this.triggerBanner(
      this.boss.def.name,
      `${this.boss.def.title} · "${this.boss.def.introQuote}"`,
      'boss_intro',
      2.3,
    );
    audioEngine.playBossIntro();
    this.emitHud();
  }

  public advanceNextBoss(): void {
    const nextIdx = Math.min(AKATSUKI_BOSSES.length - 1, this.stageIndex + 1);
    this.startNewMatch({
      mode: this.mode,
      playerId: this.selectedPlayerId,
      stageIndex: nextIdx,
    });
  }

  public restartCurrentMatch(): void {
    this.startNewMatch({
      mode: this.mode,
      playerId: this.selectedPlayerId,
      opponentId: this.selectedOpponentId,
      arenaId: this.arenaId,
      stageIndex: this.stageIndex,
    });
  }

  public setTouchMove(nx: number, ny: number): void {
    this.touchMove.set(nx, ny);
  }

  public triggerTouchAction(
    action:
      | 'light'
      | 'heavy'
      | 'jump'
      | 'dash'
      | 'kunai'
      | 'special'
      | 'ultimate'
      | 'skill1'
      | 'skill2'
      | 'skill3'
      | 'skill4'
      | 'transform',
  ): void {
    if (this.screenState !== 'playing') return;
    audioEngine.unlock();
    switch (action) {
      case 'light':
        this.justPressed.add('attack_light');
        break;
      case 'heavy':
        this.justPressed.add('attack_heavy');
        break;
      case 'jump':
        this.jumpBufferTimer = 0.14;
        break;
      case 'dash':
        this.justPressed.add('dash');
        break;
      case 'kunai':
        this.justPressed.add('kunai');
        break;
      case 'special':
        this.justPressed.add('special');
        break;
      case 'ultimate':
        this.justPressed.add('ultimate');
        break;
      case 'skill1':
        this.justPressed.add('Digit1');
        break;
      case 'skill2':
        this.justPressed.add('Digit2');
        break;
      case 'skill3':
        this.justPressed.add('Digit3');
        break;
      case 'skill4':
        this.justPressed.add('Digit4');
        break;
      case 'transform':
        this.justPressed.add('KeyT');
        break;
    }
  }

  public setTouchHold(kind: 'block' | 'charge', active: boolean): void {
    if (kind === 'block') {
      if (active) this.keysHeld.add('KeyF');
      else this.keysHeld.delete('KeyF');
    } else {
      if (active) this.keysHeld.add('KeyG');
      else this.keysHeld.delete('KeyG');
    }
  }

  private triggerBanner(
    title: string,
    subtitle: string,
    type: HudSnapshot['bannerType'],
    duration: number,
  ): void {
    this.bannerTitle = title;
    this.bannerSubtitle = subtitle;
    this.bannerType = type;
    this.bannerTimer = duration;
    this.emitHud();
  }

  private clearAllInputs(): void {
    this.keysHeld.clear();
    this.justPressed.clear();
    this.touchMove.set(0, 0);
    this.isPointerDragging = false;
  }

  private bindInputListeners(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
      ) {
        if (this.screenState === 'playing') e.preventDefault();
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.screenState === 'playing' || this.screenState === 'paused') {
          this.callbacks.onPauseToggle();
        }
        return;
      }

      if (this.screenState !== 'playing') return;
      audioEngine.unlock();

      if (!e.repeat) {
        this.justPressed.add(e.code);
        if (e.code === 'Space') this.jumpBufferTimer = 0.14;
        if (e.code === 'KeyJ') this.justPressed.add('attack_light');
        if (e.code === 'KeyK') this.justPressed.add('attack_heavy');
        if (e.code === 'KeyQ') this.justPressed.add('kunai');
        if (e.code === 'KeyE') this.justPressed.add('special');
        if (e.code === 'KeyR') this.justPressed.add('ultimate');
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          this.justPressed.add('dash');
        }
        if (e.code === 'KeyF' && this.player && !this.player.isBlocking) {
          this.player.parryWindowTimer = 0.22;
        }
      }
      this.keysHeld.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
      if (
        e.code === 'Space' &&
        this.player &&
        !this.player.grounded &&
        this.player.vel.y > 2.5
      ) {
        this.player.vel.y *= 0.45;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (this.screenState !== 'playing') return;
      if (e.target !== this.renderer?.domElement) return;
      audioEngine.unlock();
      if (e.button === 0) {
        this.justPressed.add('attack_light');
        this.isPointerDragging = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      } else if (e.button === 2) {
        this.justPressed.add('attack_heavy');
      }
    };

    const onMouseUp = () => {
      this.isPointerDragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.screenState !== 'playing') return;
      if (document.pointerLockElement === this.renderer?.domElement) {
        this.cameraYaw -= e.movementX * 0.0038;
        this.cameraPitch = THREE.MathUtils.clamp(
          this.cameraPitch + e.movementY * 0.0025,
          0.12,
          0.85,
        );
      } else if (this.isPointerDragging) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.cameraYaw -= dx * 0.0055;
        this.cameraPitch = THREE.MathUtils.clamp(
          this.cameraPitch + dy * 0.0035,
          0.12,
          0.85,
        );
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (this.screenState === 'playing' && e.target === this.renderer?.domElement) {
        e.preventDefault();
      }
    };

    const onBlur = () => this.clearAllInputs();
    const onVisChange = () => {
      if (document.hidden) this.clearAllInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisChange);

    this.unbindInputListeners = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }

  private unbindInputListeners: () => void = () => {};

  private startLoop(): void {
    this.lastTimestamp = performance.now();
    const tick = (now?: number) => {
      if (this.disposed) return;
      const current = now ?? performance.now();
      const rawDt = Math.max(0.001, (current - this.lastTimestamp) / 1000);
      this.lastTimestamp = current;

      const minFrameMs = 1000 / this.settings.fpsLimit;
      if (this.isSoftwareGl || current - this.lastRenderTime >= minFrameMs - 2) {
        this.lastRenderTime = current;
        const dt = Math.min(rawDt, 0.05);
        this.step(dt);
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      }

      if (this.isSoftwareGl) {
        this.afterDraw(() => {
          if (!this.disposed) {
            this.frameId = requestAnimationFrame(tick);
          }
        });
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private step(dt: number): void {
    if (this.arena?.animatedWater) {
      this.textures.waterColor.offset.y -= dt * 0.18;
    }

    if (this.screenState === 'title') {
      this.titleOrbitAngle += dt * 0.14;
      const sway = Math.sin(this.titleOrbitAngle) * 2.5;
      // Frame Naruto & Deidara with Final Valley statues on the right 60% of viewport
      this.camera.position.set(11.5 + sway, 4.6, 15.5);
      this.camera.lookAt(-3.2, 2.2, -4.0);
      this.player.animPhase += dt;
      this.boss.animPhase += dt;
      applyRigPose(this.player.rig, 'idle', this.player.animPhase, false, dt);
      applyRigPose(this.boss.rig, 'idle', this.boss.animPhase, false, dt);
      return;
    }

    if (this.screenState !== 'playing') {
      return;
    }

    // Visual-only timers always run in real dt
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerTitle = null;
        this.bannerSubtitle = null;
        this.bannerType = null;
      }
    }
    if (this.ultimateCamTimer > 0) {
      this.ultimateCamTimer -= dt;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateHitFlash(this.player, dt);
      this.updateHitFlash(this.boss, dt);
      this.effects.update(dt * 0.25);
      this.updateGameplayCamera(dt);
      return;
    }

    this.matchElapsed += dt;
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.comboCount = 0;
      }
    }

    if (this.pendingOutcome) {
      this.outcomePendingTimer -= dt;
      this.effects.update(dt);
      this.updateFighterVisuals(this.player, dt);
      this.updateFighterVisuals(this.boss, dt);
      this.updateGameplayCamera(dt);
      if (this.outcomePendingTimer <= 0) {
        this.finalizeOutcome(this.pendingOutcome);
      }
      return;
    }

    // 100% Manual Player Input & Simulation
    this.updatePlayerManual(dt);
    // Intelligent Independent Boss AI
    this.updateBossAI(dt);

    // Physics, Arena Bounds, Projectiles & Hit Resolution
    this.stepFighterPhysics(this.player, dt);
    this.stepFighterPhysics(this.boss, dt);
    this.resolveFighterSeparation();
    this.resolveProjectiles();

    // Training Mode Auto-Heal Opponent + Infinite Chakra
    if (this.mode === 'training') {
      this.player.chakra = this.player.maxChakra;
      if (this.boss.actionKind !== 'hitstun' && this.boss.hp < this.boss.maxHp) {
        this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + dt * 140);
      }
    }

    this.effects.update(dt);
    this.updateFighterVisuals(this.player, dt);
    this.updateFighterVisuals(this.boss, dt);
    this.updateGameplayCamera(dt);

    this.justPressed.clear();

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.066) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updatePlayerManual(dt: number): void {
    const p = this.player;
    this.tickCooldowns(p, dt);

    if (p.actionKind === 'ko' || p.guardBrokenTimer > 0) {
      p.guardBrokenTimer = Math.max(0, p.guardBrokenTimer - dt);
      p.isBlocking = false;
      p.isCharging = false;
      return;
    }

    if (p.actionKind === 'hitstun') {
      p.actionTimer -= dt;
      if (p.actionTimer <= 0) p.actionKind = 'none';
      return;
    }

    // Camera-relative WASD + Touch movement vector
    let mx = this.touchMove.x;
    let mz = this.touchMove.y;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) mx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) mx += 1;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) mz -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) mz += 1;

    const inputLen = Math.hypot(mx, mz);
    if (inputLen > 1) {
      mx /= inputLen;
      mz /= inputLen;
    }

    _tmpForward.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    _tmpRight.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

    // Blocking (F)
    p.isBlocking = this.keysHeld.has('KeyF') && p.actionKind === 'none' && p.grounded;
    if (p.parryWindowTimer > 0) p.parryWindowTimer -= dt;

    // Charging Chakra (G)
    p.isCharging =
      this.keysHeld.has('KeyG') && !p.isBlocking && p.actionKind === 'none' && p.grounded;
    if (p.isCharging) {
      p.chakra = Math.min(p.maxChakra, p.chakra + dt * 28);
      p.awaken = Math.min(100, p.awaken + dt * 8);
      if (Math.random() < 0.38) {
        this.effects.spawnBurst(
          p.pos.x,
          p.pos.y + 0.4,
          p.pos.z,
          elementHex(p.def.element),
          2,
          4.5,
          0.9,
          4.0,
        );
      }
      if (Math.floor(this.matchElapsed * 6) !== Math.floor((this.matchElapsed - dt) * 6)) {
        audioEngine.playChakraTick();
      }
      p.pose = 'charge';
      p.vel.x *= 0.8;
      p.vel.z *= 0.8;
      return;
    }

    // Transformation Awakening (T or full awaken + R)
    if (this.justPressed.has('KeyT') && p.awaken >= 100 && !p.isTransformed) {
      this.activateTransformation(p);
    }

    // Active attack execution
    if (p.actionKind !== 'none') {
      p.actionTimer -= dt;
      this.evaluateActiveAttackHit(p, this.boss, true);
      if (p.actionTimer <= 0) {
        p.actionKind = 'none';
      }
      return;
    }

    // Combat actions (manual edge triggers)
    if (!p.isBlocking) {
      if (this.justPressed.has('attack_light')) {
        this.faceOpponent(p, this.boss);
        this.startLightCombo(p);
        return;
      }
      if (this.justPressed.has('attack_heavy')) {
        this.faceOpponent(p, this.boss);
        this.startHeavyAttack(p);
        return;
      }
      if (this.justPressed.has('kunai') && p.kunaiCooldown <= 0) {
        this.faceOpponent(p, this.boss);
        this.fireKunai(p);
        return;
      }
      if (this.justPressed.has('special') && p.specialCooldown <= 0) {
        this.faceOpponent(p, this.boss);
        this.fireSpecialJutsu(p);
        return;
      }
      if (this.justPressed.has('ultimate') && p.awaken >= 100) {
        this.faceOpponent(p, this.boss);
        this.fireUltimateJutsu(p);
        return;
      }

      const skillKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
      for (let i = 0; i < 4; i++) {
        if (this.justPressed.has(skillKeys[i])) {
          this.faceOpponent(p, this.boss);
          this.fireCharacterSkill(p, i);
          return;
        }
      }

      if (this.justPressed.has('dash') && p.dashCooldown <= 0) {
        this.triggerDash(p, mx, mz);
        return;
      }
    }

    // Jump with input buffer & coyote time
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (p.grounded || p.coyoteTimer > 0) {
        p.vel.y = 13.5;
        p.grounded = false;
        p.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        p.squashScale.set(0.84, 1.2);
        audioEngine.playSwing();
        this.effects.spawnBurst(p.pos.x, 0.1, p.pos.z, '#e2e8f0', 6, 4.5, 0.7, -8);
      }
    }

    // Movement
    if (p.isBlocking) {
      p.vel.x = THREE.MathUtils.damp(p.vel.x, 0, 16, dt);
      p.vel.z = THREE.MathUtils.damp(p.vel.z, 0, 16, dt);
      this.faceOpponent(p, this.boss);
      p.pose = 'block';
    } else if (inputLen > 0.08) {
      const sprintMult = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight') ? 1.38 : 1.0;
      const spd = p.def.moveSpeed * sprintMult * (p.isTransformed ? 1.15 : 1.0);
      _tmpVec
        .set(0, 0, 0)
        .addScaledVector(_tmpRight, mx)
        .addScaledVector(_tmpForward, -mz)
        .normalize();
      p.vel.x = THREE.MathUtils.damp(p.vel.x, _tmpVec.x * spd, 14, dt);
      p.vel.z = THREE.MathUtils.damp(p.vel.z, _tmpVec.z * spd, 14, dt);
      p.yaw = Math.atan2(_tmpVec.x, _tmpVec.z);
      p.pose = p.grounded ? 'run' : 'jump';
    } else {
      p.vel.x = THREE.MathUtils.damp(p.vel.x, 0, 14, dt);
      p.vel.z = THREE.MathUtils.damp(p.vel.z, 0, 14, dt);
      p.pose = p.grounded ? 'idle' : 'jump';
    }
  }

  private updateBossAI(dt: number): void {
    const b = this.boss;
    const p = this.player;
    this.tickCooldowns(b, dt);
    b.chakra = Math.min(b.maxChakra, b.chakra + dt * 9);

    if (b.actionKind === 'ko' || b.guardBrokenTimer > 0) {
      b.guardBrokenTimer = Math.max(0, b.guardBrokenTimer - dt);
      b.isBlocking = false;
      this.telegraphRing.visible = false;
      return;
    }

    if (b.actionKind === 'hitstun') {
      b.actionTimer -= dt;
      this.telegraphRing.visible = false;
      if (b.actionTimer <= 0) b.actionKind = 'none';
      return;
    }

    // Execute windup telegraph before heavy/aoe/ultimate boss strikes
    if (b.aiTelegraphTimer > 0) {
      b.aiTelegraphTimer -= dt;
      this.faceOpponent(b, p);
      b.vel.x *= 0.85;
      b.vel.z *= 0.85;
      this.telegraphRing.visible = true;
      this.telegraphRing.position.set(b.pos.x, 0.05, b.pos.z);
      const pulse = 1 + Math.sin(this.matchElapsed * 24) * 0.14;
      this.telegraphRing.scale.setScalar(pulse * 1.4);

      if (b.aiTelegraphTimer <= 0 && b.aiPendingIntent) {
        this.telegraphRing.visible = false;
        const intent = b.aiPendingIntent;
        b.aiPendingIntent = null;
        if (intent === 'heavy_attack') this.startHeavyAttack(b);
        else if (intent === 'aoe_skill') this.fireCharacterSkill(b, 2);
        else if (intent === 'ultimate') this.fireUltimateJutsu(b);
      }
      return;
    }

    if (b.actionKind !== 'none') {
      b.actionTimer -= dt;
      this.evaluateActiveAttackHit(b, p, false);
      if (b.actionTimer <= 0) b.actionKind = 'none';
      return;
    }

    b.aiThinkTimer -= dt;
    const toPlayer = _tmpVec.subVectors(p.pos, b.pos);
    const dist = Math.hypot(toPlayer.x, toPlayer.z);
    if (dist > 0.01) toPlayer.divideScalar(dist);

    if (b.aiThinkTimer <= 0) {
      b.aiThinkTimer = 0.28 + Math.random() * 0.25;
      const intent = decideBossIntent({
        policy: b.def.aiPolicy ?? 'elemental_hybrid',
        distance: dist,
        aiHpRatio: b.hp / b.maxHp,
        aiChakra: b.chakra,
        playerAttacking: p.actionKind !== 'none' && p.actionKind !== 'hitstun',
        skillReady: [
          b.skillCooldowns[0] <= 0,
          b.skillCooldowns[1] <= 0,
          b.skillCooldowns[2] <= 0,
          b.skillCooldowns[3] <= 0,
        ],
        awakenReady: b.awaken >= 100,
        rngValue: Math.random(),
      });

      b.isBlocking = intent === 'block';
      if (intent === 'light_combo') {
        this.faceOpponent(b, p);
        this.startLightCombo(b);
        return;
      }
      if (intent === 'heavy_attack' || intent === 'aoe_skill' || intent === 'ultimate') {
        // 0.42s visible telegraph + ring
        b.aiPendingIntent = intent;
        b.aiTelegraphTimer = 0.42;
        b.pose = 'charge';
        audioEngine.playChakraTick();
        return;
      }
      if (intent === 'projectile_skill') {
        this.faceOpponent(b, p);
        this.fireCharacterSkill(b, 1);
        return;
      }
      if (intent === 'rush_skill') {
        this.faceOpponent(b, p);
        this.fireCharacterSkill(b, 0);
        return;
      }
      if (intent === 'dash_flank' && b.dashCooldown <= 0) {
        this.faceOpponent(b, p);
        const side = Math.random() < 0.5 ? 1 : -1;
        b.vel.x = (toPlayer.x * 0.7 - toPlayer.z * 0.7 * side) * 20;
        b.vel.z = (toPlayer.z * 0.7 + toPlayer.x * 0.7 * side) * 20;
        b.dashCooldown = 1.6;
        b.actionKind = 'dash';
        b.actionTimer = 0.22;
        b.pose = 'run';
        audioEngine.playDash();
        return;
      }
      b.aiPendingIntent = intent;
    }

    // Continuous movement based on current intent
    this.faceOpponent(b, p);
    const spd = b.def.moveSpeed * (this.mode === 'war' ? 1.05 : 0.94);
    if (b.isBlocking) {
      b.vel.x *= 0.8;
      b.vel.z *= 0.8;
      b.pose = 'block';
    } else if (b.aiPendingIntent === 'retreat_kite') {
      b.vel.x = THREE.MathUtils.damp(b.vel.x, -toPlayer.x * spd, 10, dt);
      b.vel.z = THREE.MathUtils.damp(b.vel.z, -toPlayer.z * spd, 10, dt);
      b.pose = 'run';
    } else if (b.aiPendingIntent === 'strafe') {
      b.vel.x = THREE.MathUtils.damp(b.vel.x, -toPlayer.z * spd * 0.85, 10, dt);
      b.vel.z = THREE.MathUtils.damp(b.vel.z, toPlayer.x * spd * 0.85, 10, dt);
      b.pose = 'run';
    } else if (dist > 2.8) {
      b.vel.x = THREE.MathUtils.damp(b.vel.x, toPlayer.x * spd, 10, dt);
      b.vel.z = THREE.MathUtils.damp(b.vel.z, toPlayer.z * spd, 10, dt);
      b.pose = 'run';
    } else {
      b.vel.x = THREE.MathUtils.damp(b.vel.x, 0, 12, dt);
      b.vel.z = THREE.MathUtils.damp(b.vel.z, 0, 12, dt);
      b.pose = 'idle';
    }
  }

  private tickCooldowns(f: FighterRuntime, dt: number): void {
    f.chakra = Math.min(f.maxChakra, f.chakra + dt * 3.8);
    for (let i = 0; i < 4; i++) {
      f.skillCooldowns[i] = Math.max(0, f.skillCooldowns[i] - dt);
    }
    f.specialCooldown = Math.max(0, f.specialCooldown - dt);
    f.kunaiCooldown = Math.max(0, f.kunaiCooldown - dt);
    f.dashCooldown = Math.max(0, f.dashCooldown - dt);
    f.comboWindowTimer = Math.max(0, f.comboWindowTimer - dt);
    f.invulnTimer = Math.max(0, f.invulnTimer - dt);
    if (f.isTransformed) {
      f.transformTimer -= dt;
      if (f.transformTimer <= 0) {
        f.isTransformed = false;
      }
    }
  }

  private faceOpponent(a: FighterRuntime, b: FighterRuntime): void {
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    a.yaw = Math.atan2(dx, dz);
  }

  private triggerDash(f: FighterRuntime, mx: number, mz: number): void {
    f.dashCooldown = 1.1;
    f.invulnTimer = 0.22;
    f.actionKind = 'dash';
    f.actionTimer = 0.2;
    f.pose = 'run';

    if (Math.hypot(mx, mz) > 0.1) {
      _tmpVec
        .set(0, 0, 0)
        .addScaledVector(_tmpRight, mx)
        .addScaledVector(_tmpForward, -mz)
        .normalize();
    } else {
      _tmpVec.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    }
    f.vel.x = _tmpVec.x * 26;
    f.vel.z = _tmpVec.z * 26;
    f.yaw = Math.atan2(_tmpVec.x, _tmpVec.z);
    audioEngine.playDash();
    this.effects.spawnBurst(f.pos.x, f.pos.y + 0.6, f.pos.z, '#e2e8f0', 10, 7, 0.85, -4);
  }

  private startLightCombo(f: FighterRuntime): void {
    f.comboStep = f.comboWindowTimer > 0 ? (f.comboStep % 3) + 1 : 1;
    f.comboWindowTimer = 0.65;
    const kind = f.comboStep === 1 ? 'light1' : f.comboStep === 2 ? 'light2' : 'light3';
    f.actionKind = kind;
    f.actionTimer = 0.26 / f.def.attackSpeed;
    f.actionHitFired = false;
    f.pose = f.comboStep === 1 ? 'attack1' : f.comboStep === 2 ? 'attack2' : 'attack3';

    const lunge = f.comboStep === 3 ? 11 : 7;
    f.vel.x = Math.sin(f.yaw) * lunge;
    f.vel.z = Math.cos(f.yaw) * lunge;
    audioEngine.playSwing();
  }

  private startHeavyAttack(f: FighterRuntime): void {
    f.actionKind = 'heavy';
    f.actionTimer = 0.42 / f.def.attackSpeed;
    f.actionHitFired = false;
    f.pose = 'heavy';
    f.vel.x = Math.sin(f.yaw) * 12;
    f.vel.z = Math.cos(f.yaw) * 12;
    audioEngine.playSwing();
  }

  private fireKunai(f: FighterRuntime): void {
    f.kunaiCooldown = 0.55;
    f.actionKind = 'kunai';
    f.actionTimer = 0.18;
    f.actionHitFired = true;
    f.pose = 'attack1';
    const owner = f === this.player ? 'player' : 'boss';
    const target = owner === 'player' ? this.boss : this.player;
    const dir = new THREE.Vector3()
      .subVectors(target.pos, f.pos)
      .setY((target.pos.y - f.pos.y) * 0.5);
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    this.effects.spawnProjectile({
      owner,
      kind: 'kunai',
      element: f.def.element,
      origin: new THREE.Vector3(f.pos.x, f.pos.y + 1.25, f.pos.z),
      direction: dir,
      speed: 28,
      damageMultiplier: 0.65,
      knockback: 3,
      colorHex: '#cbd5e1',
    });
    audioEngine.playKunai();
  }

  private fireCharacterSkill(f: FighterRuntime, idx: number): void {
    const skill: SkillDef = f.def.skills[idx];
    if (f.skillCooldowns[idx] > 0) return;
    if (f === this.player && !canSpendChakra(f.chakra, skill.chakraCost, this.mode)) {
      return;
    }
    if (f === this.player) {
      f.chakra = spendChakra(f.chakra, skill.chakraCost, this.mode);
    } else {
      f.chakra = Math.max(0, f.chakra - skill.chakraCost);
    }

    f.skillCooldowns[idx] = skill.cooldown;
    f.activeSkillIdx = idx;
    f.actionKind = 'skill';
    f.actionTimer = 0.44;
    f.actionHitFired = false;
    f.pose = 'jutsu';

    audioEngine.playJutsu(skill.element, false);
    this.effects.spawnBurst(
      f.pos.x,
      f.pos.y + 1.2,
      f.pos.z,
      skill.color,
      14,
      8,
      1.1,
      -3,
    );

    if (skill.category === 'melee_rush') {
      f.vel.x = Math.sin(f.yaw) * 20;
      f.vel.z = Math.cos(f.yaw) * 20;
    } else if (skill.category === 'projectile') {
      f.actionHitFired = true;
      const owner = f === this.player ? 'player' : 'boss';
      const target = owner === 'player' ? this.boss : this.player;
      const dir = new THREE.Vector3().subVectors(target.pos, f.pos);
      this.effects.spawnProjectile({
        owner,
        kind: 'jutsu_orb',
        element: skill.element,
        origin: new THREE.Vector3(f.pos.x, f.pos.y + 1.25, f.pos.z),
        direction: dir,
        speed: 22,
        damageMultiplier: skill.damageMultiplier,
        knockback: skill.knockback,
        radius: 1.2,
        colorHex: skill.color,
      });
    } else if (skill.category === 'buff_counter') {
      // Self-heal for Sakura/Hashirama/Hidan style + radial burst
      if (skill.name.includes('Regeneration') || skill.name.includes('Seal') || skill.name.includes('Endurance')) {
        f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.14);
      }
      f.invulnTimer = 0.55;
      this.effects.spawnShockwave(f.pos.x, 0.1, f.pos.z, skill.color, skill.range, 0.45);
    }
  }

  private fireSpecialJutsu(f: FighterRuntime): void {
    const cost = 30;
    if (f === this.player && !canSpendChakra(f.chakra, cost, this.mode)) return;
    if (f === this.player) f.chakra = spendChakra(f.chakra, cost, this.mode);
    f.specialCooldown = 5.5;
    f.actionKind = 'special';
    f.actionTimer = 0.48;
    f.actionHitFired = false;
    f.pose = 'jutsu';
    f.vel.x = Math.sin(f.yaw) * 16;
    f.vel.z = Math.cos(f.yaw) * 16;
    audioEngine.playJutsu(f.def.specialElement, false);
    this.effects.spawnShockwave(
      f.pos.x,
      0.1,
      f.pos.z,
      elementHex(f.def.specialElement),
      5.5,
      0.4,
    );
  }

  private activateTransformation(f: FighterRuntime): void {
    f.isTransformed = true;
    f.transformTimer = 18;
    f.awaken = 0;
    f.invulnTimer = 0.8;
    audioEngine.playJutsu(f.def.element, true);
    this.effects.spawnShockwave(
      f.pos.x,
      0.15,
      f.pos.z,
      f.def.visual.transformAuraColor,
      9,
      0.6,
    );
    this.effects.spawnBurst(
      f.pos.x,
      1.2,
      f.pos.z,
      f.def.visual.transformAuraColor,
      28,
      12,
      1.5,
      -2,
    );
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
    this.triggerBanner(
      f.def.transformName,
      `${f.def.name} Awakens Full Power`,
      'transform',
      1.9,
    );
  }

  private fireUltimateJutsu(f: FighterRuntime): void {
    f.awaken = 0;
    f.isTransformed = true;
    f.transformTimer = 14;
    f.actionKind = 'ultimate';
    f.actionTimer = 0.72;
    f.actionHitFired = false;
    f.invulnTimer = 0.9;
    f.pose = 'ultimate';
    this.ultimateCamTimer = 1.1;
    this.hitstopTimer = 0.08;
    this.cameraTrauma = 0.85;

    audioEngine.playJutsu(f.def.ultimateElement, true);
    this.triggerBanner(
      f.def.ultimateName,
      `${f.def.name} · Secret Technique`,
      'ultimate',
      2.1,
    );
    this.effects.spawnBurst(
      f.pos.x,
      1.6,
      f.pos.z,
      elementHex(f.def.ultimateElement),
      32,
      14,
      1.6,
      -2,
    );
    this.effects.spawnShockwave(
      f.pos.x,
      0.12,
      f.pos.z,
      elementHex(f.def.ultimateElement),
      11,
      0.65,
    );
  }

  private evaluateActiveAttackHit(
    attacker: FighterRuntime,
    defender: FighterRuntime,
    isPlayerAttacking: boolean,
  ): void {
    if (attacker.actionHitFired) return;
    if (attacker.actionTimer > 0.24) return;

    attacker.actionHitFired = true;

    let range = 3.2;
    let multiplier = 1.0;
    let knockback = 4.5;
    let element: ElementType = attacker.def.element;
    let isHeavy = false;

    if (attacker.actionKind === 'light1') {
      multiplier = 0.85;
      knockback = 3.0;
    } else if (attacker.actionKind === 'light2') {
      multiplier = 1.0;
      knockback = 4.0;
    } else if (attacker.actionKind === 'light3') {
      multiplier = 1.35;
      knockback = 9.0;
      isHeavy = true;
    } else if (attacker.actionKind === 'heavy') {
      range = 3.7;
      multiplier = 2.15;
      knockback = 13.0;
      isHeavy = true;
    } else if (attacker.actionKind === 'special') {
      range = 5.4;
      multiplier = 2.45;
      knockback = 14.0;
      element = attacker.def.specialElement;
      isHeavy = true;
      this.effects.spawnBurst(
        defender.pos.x,
        1.2,
        defender.pos.z,
        elementHex(element),
        22,
        11,
        1.3,
        -6,
      );
    } else if (attacker.actionKind === 'skill') {
      const sk = attacker.def.skills[attacker.activeSkillIdx];
      range = sk.range;
      multiplier = sk.damageMultiplier;
      knockback = sk.knockback;
      element = sk.element;
      isHeavy = true;
      this.effects.spawnShockwave(
        attacker.pos.x,
        0.1,
        attacker.pos.z,
        sk.color,
        sk.range,
        0.45,
      );
    } else if (attacker.actionKind === 'ultimate') {
      range = 13.5;
      multiplier = 4.2;
      knockback = 20.0;
      element = attacker.def.ultimateElement;
      isHeavy = true;
      this.effects.spawnShockwave(
        defender.pos.x,
        0.12,
        defender.pos.z,
        elementHex(element),
        12,
        0.7,
      );
      this.effects.spawnBurst(
        defender.pos.x,
        1.6,
        defender.pos.z,
        elementHex(element),
        34,
        16,
        1.7,
        -4,
      );
    }

    // Check destructible rocks in attack radius
    if (this.arena) {
      for (const rock of this.arena.destructibles) {
        if (rock.destroyed) continue;
        const dRock = attacker.pos.distanceTo(rock.position);
        if (dRock <= range + rock.radius) {
          rock.hp -= attacker.def.attackPower * multiplier;
          this.effects.spawnBurst(rock.position.x, 1, rock.position.z, '#a8a29e', 10, 7, 1.1, -14);
          if (rock.hp <= 0) {
            rock.destroyed = true;
            rock.mesh.visible = false;
            audioEngine.playExplosion(false);
            this.effects.spawnBurst(rock.position.x, 1.2, rock.position.z, '#78716c', 22, 11, 1.5, -16);
          }
        }
      }
    }

    const dist = attacker.pos.distanceTo(defender.pos);
    if (dist <= range) {
      this.applyHit(attacker, defender, multiplier, knockback, element, isHeavy, isPlayerAttacking);
    }
  }

  private applyHit(
    attacker: FighterRuntime,
    defender: FighterRuntime,
    multiplier: number,
    knockback: number,
    element: ElementType,
    isHeavy: boolean,
    isPlayerAttacking: boolean,
  ): void {
    if (defender.invulnTimer > 0 || defender.actionKind === 'ko') return;

    const result = calculateCombatDamage({
      attackerPower: attacker.def.attackPower,
      moveMultiplier: multiplier,
      comboCount: isPlayerAttacking ? this.comboCount + 1 : 1,
      isTransformed: attacker.isTransformed,
      defenderDefense: defender.def.defense,
      isBlocking: defender.isBlocking,
      parryWindowActive: defender.parryWindowTimer > 0,
      isAirborne: !defender.grounded,
    });

    if (result.wasParried) {
      audioEngine.playBlock(true);
      this.effects.spawnShockwave(defender.pos.x, 1.1, defender.pos.z, '#facc15', 4.5, 0.3);
      attacker.actionKind = 'hitstun';
      attacker.actionTimer = 0.45;
      attacker.pose = 'hit';
      defender.awaken = Math.min(100, defender.awaken + result.awakenGainDefender);
      this.hitstopTimer = 0.06;
      return;
    }

    defender.hp = Math.max(0, defender.hp - result.damage);
    attacker.awaken = Math.min(100, attacker.awaken + result.awakenGainAttacker);
    defender.awaken = Math.min(100, defender.awaken + result.awakenGainDefender);

    if (isPlayerAttacking) {
      this.totalDamageDealt += result.damage;
      this.comboCount += 1;
      this.comboResetTimer = 2.4;
      if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;
    }

    if (result.wasBlocked && !result.guardBroken) {
      audioEngine.playBlock(false);
      this.effects.spawnBurst(defender.pos.x, 1.2, defender.pos.z, '#94a3b8', 7, 5, 0.8, -8);
      return;
    }

    if (result.guardBroken) {
      defender.guardBrokenTimer = 1.1;
      defender.isBlocking = false;
      audioEngine.playExplosion(false);
    } else {
      audioEngine.playHit(isHeavy);
    }

    defender.hitFlashTimer = 0.065;
    defender.actionKind = 'hitstun';
    defender.actionTimer = isHeavy ? 0.36 : 0.22;
    defender.pose = 'hit';
    defender.squashScale.set(1.22, 0.8);

    const pushDir = _tmpVec.subVectors(defender.pos, attacker.pos);
    pushDir.y = 0;
    if (pushDir.lengthSq() < 0.001) pushDir.set(0, 0, 1);
    pushDir.normalize();
    defender.vel.x = pushDir.x * knockback;
    defender.vel.z = pushDir.z * knockback;
    if (isHeavy) {
      defender.vel.y = Math.max(defender.vel.y, 6.2);
      defender.grounded = false;
      this.hitstopTimer = 0.055;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);
    } else {
      this.hitstopTimer = 0.025;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.16);
    }

    this.effects.spawnBurst(
      defender.pos.x,
      defender.pos.y + 1.15,
      defender.pos.z,
      elementHex(element),
      isHeavy ? 18 : 8,
      isHeavy ? 10 : 6,
      isHeavy ? 1.2 : 0.85,
      -8,
    );

    if (defender.hp <= 0) {
      this.handleFighterKO(defender, isPlayerAttacking);
    }
  }

  private handleFighterKO(koFighter: FighterRuntime, playerWonExchange: boolean): void {
    if (this.mode === 'training') {
      koFighter.hp = koFighter.maxHp;
      return;
    }

    koFighter.actionKind = 'ko';
    koFighter.pose = 'ko';
    audioEngine.playExplosion(true);
    this.cameraTrauma = 0.75;

    if (playerWonExchange) {
      this.bossesDefeatedThisRun += 1;

      if (this.mode === 'duel_1v1') {
        this.playerRoundsWon += 1;
        if (this.playerRoundsWon < 2) {
          this.startNextDuelRound();
          return;
        }
      } else if (this.mode === 'boss_rush' && this.stageIndex < AKATSUKI_BOSSES.length - 1) {
        this.stageIndex += 1;
        const nextBoss = AKATSUKI_BOSSES[this.stageIndex];
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.35);
        this.swapBossInArena(nextBoss);
        return;
      } else if (this.mode === 'war' || this.mode === 'survival') {
        this.waveNumber += 1;
        const nextBoss = AKATSUKI_BOSSES[(this.waveNumber - 1) % AKATSUKI_BOSSES.length];
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.3);
        this.swapBossInArena(nextBoss);
        return;
      }

      this.pendingOutcome = 'victory';
      this.outcomePendingTimer = 0.65;
    } else {
      if (this.mode === 'duel_1v1') {
        this.bossRoundsWon += 1;
        if (this.bossRoundsWon < 2) {
          this.startNextDuelRound();
          return;
        }
      }
      this.pendingOutcome = 'defeat';
      this.outcomePendingTimer = 0.65;
    }
  }

  private startNextDuelRound(): void {
    this.currentRound += 1;
    this.player.hp = this.player.maxHp;
    this.boss.hp = this.boss.maxHp;
    this.player.pos.set(0, 0, 9);
    this.boss.pos.set(0, 0, -9);
    this.player.actionKind = 'none';
    this.boss.actionKind = 'none';
    this.triggerBanner(`Round ${this.currentRound}`, 'Fight!', 'round', 1.6);
  }

  private swapBossInArena(nextBoss: FighterDef): void {
    this.scene.remove(this.boss.rig.root);
    disposeShinobiRig(this.boss.rig);
    this.boss = this.createFighterRuntime(nextBoss, new THREE.Vector3(0, 0, -10), 0);
    if (this.mode === 'war') {
      const mult = 1 + (this.waveNumber - 1) * 0.14;
      this.boss.maxHp = Math.round(this.boss.maxHp * mult);
      this.boss.hp = this.boss.maxHp;
    }
    this.scene.add(this.boss.rig.root);
    this.triggerBanner(
      nextBoss.name,
      `Wave ${this.waveNumber} · "${nextBoss.introQuote}"`,
      'boss_intro',
      2.2,
    );
    audioEngine.playBossIntro();
  }

  private finalizeOutcome(outcome: 'victory' | 'defeat'): void {
    this.pendingOutcome = null;
    const victory = outcome === 'victory';
    audioEngine.stopMusic();
    audioEngine.playOutcome(victory);

    const score = calculateMatchScore({
      damageDealt: this.totalDamageDealt,
      maxCombo: this.maxCombo,
      clearTimeSec: this.matchElapsed,
      hpRemainingRatio: this.player.hp / this.player.maxHp,
      bossesDefeated: this.bossesDefeatedThisRun,
      victory,
    });

    if (victory && this.mode === 'story') {
      this.callbacks.onBossVictoryProgress(this.boss.def, score, this.mode);
    } else if (victory) {
      this.callbacks.onBossVictoryProgress(this.boss.def, score, this.mode);
    }

    this.setScreenState('gameover');
    this.callbacks.onMatchEnd({
      outcome,
      mode: this.mode,
      playerName: this.player.def.name,
      bossName: this.boss.def.name,
      stageReached: this.stageIndex + 1,
      totalStages: this.mode === 'story' || this.mode === 'boss_rush' ? AKATSUKI_BOSSES.length : this.waveNumber,
      bossHpRemainingPct: Math.round((this.boss.hp / this.boss.maxHp) * 100),
      clearTimeSec: Math.round(this.matchElapsed),
      maxCombo: this.maxCombo,
      damageDealt: Math.round(this.totalDamageDealt),
      score,
      bestScore: score,
      bossesDefeated: this.bossesDefeatedThisRun,
      canAdvanceNextBoss:
        victory &&
        this.mode === 'story' &&
        this.stageIndex < AKATSUKI_BOSSES.length - 1,
    });
  }

  private stepFighterPhysics(f: FighterRuntime, dt: number): void {
    const gravity = -32;
    if (!f.grounded) {
      f.vel.y += gravity * dt;
    }

    f.pos.addScaledVector(f.vel, dt);

    if (f.pos.y <= 0) {
      if (!f.grounded && f.vel.y < -4) {
        f.squashScale.set(1.22, 0.78);
        this.effects.spawnBurst(f.pos.x, 0.08, f.pos.z, '#94a3b8', 5, 3.5, 0.65, -8);
      }
      f.pos.y = 0;
      f.vel.y = 0;
      f.grounded = true;
      f.coyoteTimer = 0.1;
    } else {
      f.grounded = false;
      f.coyoteTimer = Math.max(0, f.coyoteTimer - dt);
    }

    // Clamp to outdoor arena perimeter
    const maxR = (this.arena?.arenaRadius ?? 32) - 1.2;
    const r = Math.hypot(f.pos.x, f.pos.z);
    if (r > maxR) {
      f.pos.x = (f.pos.x / r) * maxR;
      f.pos.z = (f.pos.z / r) * maxR;
    }

    // Collide softly against intact destructible boulders
    if (this.arena) {
      for (const rock of this.arena.destructibles) {
        if (rock.destroyed) continue;
        const dx = f.pos.x - rock.position.x;
        const dz = f.pos.z - rock.position.z;
        const d = Math.hypot(dx, dz);
        const minD = rock.radius + 0.65;
        if (d > 0.001 && d < minD) {
          f.pos.x = rock.position.x + (dx / d) * minD;
          f.pos.z = rock.position.z + (dz / d) * minD;
        }
      }
    }
  }

  private resolveFighterSeparation(): void {
    const dx = this.boss.pos.x - this.player.pos.x;
    const dz = this.boss.pos.z - this.player.pos.z;
    const dist = Math.hypot(dx, dz);
    const minSep = 1.25;
    if (dist > 0.001 && dist < minSep && Math.abs(this.player.pos.y - this.boss.pos.y) < 1.8) {
      const push = (minSep - dist) * 0.5;
      const nx = dx / dist;
      const nz = dz / dist;
      this.player.pos.x -= nx * push;
      this.player.pos.z -= nz * push;
      this.boss.pos.x += nx * push;
      this.boss.pos.z += nz * push;
    }
  }

  private resolveProjectiles(): void {
    for (const proj of this.effects.projectiles) {
      if (!proj.active) continue;
      const target = proj.owner === 'player' ? this.boss : this.player;
      const attacker = proj.owner === 'player' ? this.player : this.boss;
      const dx = proj.position.x - target.pos.x;
      const dy = proj.position.y - (target.pos.y + 1.15);
      const dz = proj.position.z - target.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist <= proj.radius + 0.75) {
        proj.active = false;
        proj.mesh.visible = false;
        this.applyHit(
          attacker,
          target,
          proj.damageMultiplier,
          proj.knockback,
          proj.element,
          proj.kind !== 'kunai',
          proj.owner === 'player',
        );
      }
    }
  }

  private updateHitFlash(f: FighterRuntime, dt: number): void {
    if (f.hitFlashTimer > 0) {
      f.hitFlashTimer -= dt;
      f.rig.materialsToFlash.forEach((m) => {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 1.3;
      });
    } else {
      f.rig.materialsToFlash.forEach((m, idx) => {
        m.emissive.copy(f.rig.baseEmissives[idx]);
        m.emissiveIntensity = f.isTransformed ? 0.35 : 0.12;
      });
    }
  }

  private updateFighterVisuals(f: FighterRuntime, dt: number): void {
    this.updateHitFlash(f, dt);

    const speed = Math.hypot(f.vel.x, f.vel.z);
    if (f.pose === 'run') {
      f.animPhase += dt * Math.max(4, speed * 0.9);
    } else {
      f.animPhase += dt;
    }

    f.squashScale.x = THREE.MathUtils.damp(f.squashScale.x, 1, 16, dt);
    f.squashScale.y = THREE.MathUtils.damp(f.squashScale.y, 1, 16, dt);

    f.rig.root.position.copy(f.pos);
    f.rig.root.rotation.y = f.yaw;
    f.rig.bodyPivot.scale.set(f.squashScale.x, f.squashScale.y, f.squashScale.x);
    f.rig.shadowDisc.position.y = -f.pos.y + 0.02;
    const shadowScale = Math.max(0.45, 1 - f.pos.y * 0.08);
    f.rig.shadowDisc.scale.setScalar(shadowScale);

    applyRigPose(f.rig, f.pose, f.animPhase, f.isTransformed, dt);
  }

  private updateGameplayCamera(dt: number): void {
    const p = this.player;
    const b = this.boss;

    // Look target blends player shoulder and opponent midpoint for anime arena readability
    _camTarget.set(
      THREE.MathUtils.lerp(p.pos.x, b.pos.x, 0.28),
      p.pos.y + 1.85,
      THREE.MathUtils.lerp(p.pos.z, b.pos.z, 0.28),
    );

    const dist = this.ultimateCamTimer > 0 ? 7.2 : 11.2;
    const pitch = this.ultimateCamTimer > 0 ? 0.22 : this.cameraPitch;
    const yaw = this.ultimateCamTimer > 0 ? this.cameraYaw + 0.45 : this.cameraYaw;

    _camDesired.set(
      p.pos.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      p.pos.y + 2.1 + Math.sin(pitch) * dist,
      p.pos.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );

    const smooth = 1 - Math.exp(-10 * dt);
    this.camera.position.lerp(_camDesired, smooth);
    this.camera.lookAt(_camTarget);

    // Decaying trauma * trauma shake
    if (this.cameraTrauma > 0.001) {
      const shake = this.cameraTrauma * this.cameraTrauma;
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.9;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.6;
      this.camera.rotation.z += (Math.random() - 0.5) * shake * 0.05;
    }

    const targetFov = this.player.actionKind === 'dash' ? 58 : 52;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate({
      playerName: this.player.def.name,
      playerTitle: this.player.def.title,
      playerHp: Math.round(this.player.hp),
      playerMaxHp: Math.round(this.player.maxHp),
      playerChakra: Math.round(this.player.chakra),
      playerMaxChakra: Math.round(this.player.maxChakra),
      playerAwaken: Math.round(this.player.awaken),
      isTransformed: this.player.isTransformed,
      transformName: this.player.def.transformName,
      bossName: this.boss.def.name,
      bossTitle: this.boss.def.title,
      bossHp: Math.round(this.boss.hp),
      bossMaxHp: Math.round(this.boss.maxHp),
      bossPhase: this.boss.hp < this.boss.maxHp * 0.45 ? 2 : 1,
      comboCount: this.comboCount,
      comboTimer: this.comboResetTimer,
      skillCooldowns: [
        Number(this.player.skillCooldowns[0].toFixed(1)),
        Number(this.player.skillCooldowns[1].toFixed(1)),
        Number(this.player.skillCooldowns[2].toFixed(1)),
        Number(this.player.skillCooldowns[3].toFixed(1)),
      ],
      skillMaxCooldowns: [
        this.player.def.skills[0].cooldown,
        this.player.def.skills[1].cooldown,
        this.player.def.skills[2].cooldown,
        this.player.def.skills[3].cooldown,
      ],
      specialCooldown: Number(this.player.specialCooldown.toFixed(1)),
      kunaiCooldown: Number(this.player.kunaiCooldown.toFixed(1)),
      isBlocking: this.player.isBlocking,
      isCharging: this.player.isCharging,
      playerRoundsWon: this.playerRoundsWon,
      bossRoundsWon: this.bossRoundsWon,
      currentRound: this.currentRound,
      stageNumber: this.stageIndex + 1,
      totalStages: AKATSUKI_BOSSES.length,
      waveNumber: this.waveNumber,
      score: Math.round(this.totalDamageDealt * 1.4 + this.maxCombo * 85),
      elapsedTime: Math.round(this.matchElapsed),
      bannerTitle: this.bannerTitle,
      bannerSubtitle: this.bannerSubtitle,
      bannerType: this.bannerType,
      guardBroken: this.player.guardBrokenTimer > 0,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver?.disconnect();
    this.unbindInputListeners();
    audioEngine.stopMusic();

    if (this.arena) this.arena.dispose();
    if (this.player) disposeShinobiRig(this.player.rig);
    if (this.boss) disposeShinobiRig(this.boss.rig);
    this.effects?.dispose();
    this.telegraphRing?.geometry.dispose();
    (this.telegraphRing?.material as THREE.Material)?.dispose();

    Object.values(this.textures ?? {}).forEach((tex) => tex.dispose());
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
