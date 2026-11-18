export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type GameModeId =
  | 'story'
  | 'war'
  | 'survival'
  | 'boss_rush'
  | 'free_battle'
  | 'training'
  | 'duel_1v1';

export type ArenaId = 'final_valley' | 'storm_canyon' | 'war_battlefield';

export type ElementType =
  | 'wind'
  | 'fire'
  | 'lightning'
  | 'water'
  | 'earth'
  | 'chakra'
  | 'taijutsu'
  | 'sand'
  | 'paper'
  | 'wood';

export type SkillCategory = 'melee_rush' | 'projectile' | 'aoe_burst' | 'buff_counter';

export interface SkillDef {
  id: string;
  key: '1' | '2' | '3' | '4';
  name: string;
  shortDesc: string;
  element: ElementType;
  category: SkillCategory;
  chakraCost: number;
  cooldown: number;
  damageMultiplier: number;
  range: number;
  knockback: number;
  color: string;
}

export type HairStyle =
  | 'spiky_naruto'
  | 'duckbutt_sasuke'
  | 'bob_sakura'
  | 'asym_kakashi'
  | 'ponytail_itachi'
  | 'long_madara'
  | 'short_obito'
  | 'spiky_pain'
  | 'spiky_minato'
  | 'long_hashirama'
  | 'bowl_guy'
  | 'short_gaara'
  | 'ponytail_deidara'
  | 'messy_sasori'
  | 'slick_hidan'
  | 'hood_kakuzu'
  | 'shark_kisame'
  | 'bun_konan';

export type WeaponType =
  | 'none'
  | 'katana'
  | 'kunai_blade'
  | 'samehada'
  | 'triple_scythe'
  | 'gunbai_fan'
  | 'puppet_scroll'
  | 'sand_gourd'
  | 'paper_wings';

export type AIPolicy =
  | 'kiter_bomber'
  | 'puppet_zoner'
  | 'berserker_rusher'
  | 'elemental_hybrid'
  | 'chakra_drainer'
  | 'aerial_barrage'
  | 'illusion_feinter'
  | 'gravity_controller'
  | 'phase_striker'
  | 'meteor_warlord';

export interface CharacterVisualProfile {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  skinColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  headbandColor: string;
  hasAkatsukiCloak: boolean;
  hasMask?: 'tobi' | 'kakuzu' | 'none';
  hasRinnegan?: boolean;
  hasSharingan?: boolean;
  weapon: WeaponType;
  transformAuraColor: string;
}

export interface FighterDef {
  id: string;
  name: string;
  title: string;
  village: string;
  isPlayable: boolean;
  isAkatsukiBoss: boolean;
  bossOrder?: number;
  element: ElementType;
  maxHp: number;
  maxChakra: number;
  moveSpeed: number;
  attackPower: number;
  attackSpeed: number;
  defense: number;
  transformName: string;
  specialName: string;
  specialElement: ElementType;
  ultimateName: string;
  ultimateElement: ElementType;
  skills: [SkillDef, SkillDef, SkillDef, SkillDef];
  visual: CharacterVisualProfile;
  aiPolicy?: AIPolicy;
  introQuote: string;
  arenaId?: ArenaId;
}

export type GraphicsPreset = 'EXTREME' | 'ULTRA' | 'PERFORMANCE';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  resolutionScale: number;
  fpsLimit: 30 | 60 | 120;
  shadows: boolean;
  particleDensity: 'low' | 'medium' | 'high';
  postProcessing: boolean;
  masterVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  touchControlsMode: 'auto' | 'on' | 'off';
}

export interface SaveProgress {
  highestUnlockedBossIndex: number; // 0..9
  defeatedBossIds: string[];
  highScores: Record<GameModeId, number>;
  selectedCharacterId: string;
  selectedMode: GameModeId;
  selectedArena: ArenaId;
  settings: GraphicsSettings;
}

export interface HudSnapshot {
  playerName: string;
  playerTitle: string;
  playerHp: number;
  playerMaxHp: number;
  playerChakra: number;
  playerMaxChakra: number;
  playerAwaken: number; // 0..100
  isTransformed: boolean;
  transformName: string;
  bossName: string;
  bossTitle: string;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: number;
  comboCount: number;
  comboTimer: number;
  skillCooldowns: [number, number, number, number];
  skillMaxCooldowns: [number, number, number, number];
  specialCooldown: number;
  kunaiCooldown: number;
  isBlocking: boolean;
  isCharging: boolean;
  playerRoundsWon: number;
  bossRoundsWon: number;
  currentRound: number;
  stageNumber: number;
  totalStages: number;
  waveNumber: number;
  score: number;
  elapsedTime: number;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  bannerType: 'boss_intro' | 'ultimate' | 'round' | 'transform' | null;
  guardBroken: boolean;
}

export interface MatchResultSnapshot {
  outcome: 'victory' | 'defeat';
  mode: GameModeId;
  playerName: string;
  bossName: string;
  stageReached: number;
  totalStages: number;
  bossHpRemainingPct: number;
  clearTimeSec: number;
  maxCombo: number;
  damageDealt: number;
  score: number;
  bestScore: number;
  bossesDefeated: number;
  canAdvanceNextBoss: boolean;
}
