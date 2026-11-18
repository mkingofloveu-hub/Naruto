import {
  AIPolicy,
  FighterDef,
  GameModeId,
  GraphicsPreset,
  GraphicsSettings,
  SaveProgress,
} from './types';

export const SAVE_STORAGE_KEY = 'naruto_ultimate_shinobi_war_save_v1';

export function getPresetSettings(
  preset: GraphicsPreset,
  prev?: Partial<GraphicsSettings>,
): GraphicsSettings {
  const baseAudio = {
    masterVolume: prev?.masterVolume ?? 0.7,
    musicEnabled: prev?.musicEnabled ?? true,
    sfxEnabled: prev?.sfxEnabled ?? true,
    touchControlsMode: prev?.touchControlsMode ?? 'auto',
  };

  switch (preset) {
    case 'EXTREME':
      return {
        preset: 'EXTREME',
        resolutionScale: 1.5,
        fpsLimit: 120,
        shadows: true,
        particleDensity: 'high',
        postProcessing: true,
        ...baseAudio,
      };
    case 'ULTRA':
      return {
        preset: 'ULTRA',
        resolutionScale: 1.0,
        fpsLimit: 60,
        shadows: true,
        particleDensity: 'medium',
        postProcessing: true,
        ...baseAudio,
      };
    case 'PERFORMANCE':
      return {
        preset: 'PERFORMANCE',
        resolutionScale: 0.75,
        fpsLimit: 60,
        shadows: false,
        particleDensity: 'low',
        postProcessing: false,
        ...baseAudio,
      };
  }
}

export function createDefaultSaveProgress(): SaveProgress {
  return {
    highestUnlockedBossIndex: 0,
    defeatedBossIds: [],
    highScores: {
      story: 0,
      war: 0,
      survival: 0,
      boss_rush: 0,
      free_battle: 0,
      training: 0,
      duel_1v1: 0,
    },
    selectedCharacterId: 'naruto',
    selectedMode: 'story',
    selectedArena: 'final_valley',
    settings: getPresetSettings('ULTRA'),
  };
}

export function loadSaveProgress(storage?: Pick<Storage, 'getItem'>): SaveProgress {
  const defaults = createDefaultSaveProgress();
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SaveProgress>;
    return {
      ...defaults,
      ...parsed,
      highScores: {
        ...defaults.highScores,
        ...(parsed.highScores ?? {}),
      },
      settings: {
        ...defaults.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function persistSaveProgress(
  progress: SaveProgress,
  storage?: Pick<Storage, 'setItem'>,
): void {
  if (!storage) return;
  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore quota errors cleanly
  }
}

export interface DamageInput {
  attackerPower: number;
  moveMultiplier: number;
  comboCount: number;
  isTransformed: boolean;
  defenderDefense: number;
  isBlocking: boolean;
  parryWindowActive: boolean;
  isAirborne?: boolean;
}

export interface DamageOutput {
  damage: number;
  wasBlocked: boolean;
  wasParried: boolean;
  guardBroken: boolean;
  awakenGainAttacker: number;
  awakenGainDefender: number;
}

export function calculateCombatDamage(input: DamageInput): DamageOutput {
  if (input.parryWindowActive) {
    return {
      damage: 0,
      wasBlocked: true,
      wasParried: true,
      guardBroken: false,
      awakenGainAttacker: 0,
      awakenGainDefender: 18,
    };
  }

  const transformBoost = input.isTransformed ? 1.28 : 1.0;
  const comboScaling = Math.max(0.55, 1 - Math.max(0, input.comboCount - 1) * 0.04);
  const airBonus = input.isAirborne ? 1.12 : 1.0;
  const raw =
    input.attackerPower *
    input.moveMultiplier *
    transformBoost *
    comboScaling *
    airBonus;
  const mitigated = raw * (1 - Math.min(0.45, Math.max(0, input.defenderDefense)));

  if (input.isBlocking) {
    const heavyBreaksGuard = input.moveMultiplier >= 2.1;
    const chip = Math.round(mitigated * (heavyBreaksGuard ? 0.45 : 0.18));
    return {
      damage: Math.max(2, chip),
      wasBlocked: true,
      wasParried: false,
      guardBroken: heavyBreaksGuard,
      awakenGainAttacker: 4,
      awakenGainDefender: 6,
    };
  }

  const finalDamage = Math.max(5, Math.round(mitigated));
  return {
    damage: finalDamage,
    wasBlocked: false,
    wasParried: false,
    guardBroken: false,
    awakenGainAttacker: Math.min(16, Math.round(finalDamage * 0.12)),
    awakenGainDefender: Math.min(14, Math.round(finalDamage * 0.1)),
  };
}

export function canSpendChakra(
  currentChakra: number,
  cost: number,
  mode: GameModeId,
): boolean {
  if (mode === 'training') return true;
  return currentChakra >= cost;
}

export function spendChakra(
  currentChakra: number,
  cost: number,
  mode: GameModeId,
): number {
  if (mode === 'training') return currentChakra;
  return Math.max(0, currentChakra - cost);
}

export function calculateMatchScore(params: {
  damageDealt: number;
  maxCombo: number;
  clearTimeSec: number;
  hpRemainingRatio: number;
  bossesDefeated: number;
  victory: boolean;
}): number {
  const base = Math.round(params.damageDealt * 1.4);
  const comboBonus = params.maxCombo * 85;
  const bossBonus = params.bossesDefeated * 600;
  const speedBonus = params.victory
    ? Math.max(0, Math.round((180 - params.clearTimeSec) * 12))
    : 0;
  const hpBonus = params.victory ? Math.round(params.hpRemainingRatio * 1000) : 0;
  return Math.max(0, base + comboBonus + bossBonus + speedBonus + hpBonus);
}

export function recordBossVictory(
  save: SaveProgress,
  boss: FighterDef,
  score: number,
  mode: GameModeId,
): SaveProgress {
  const next = { ...save, highScores: { ...save.highScores } };
  if (score > (next.highScores[mode] ?? 0)) {
    next.highScores[mode] = score;
  }
  if (!next.defeatedBossIds.includes(boss.id)) {
    next.defeatedBossIds = [...next.defeatedBossIds, boss.id];
  }
  if (typeof boss.bossOrder === 'number') {
    const nextIdx = Math.min(9, boss.bossOrder);
    if (nextIdx > next.highestUnlockedBossIndex) {
      next.highestUnlockedBossIndex = nextIdx;
    }
  }
  return next;
}

export type AIActionIntent =
  | 'approach'
  | 'strafe'
  | 'retreat_kite'
  | 'light_combo'
  | 'heavy_attack'
  | 'projectile_skill'
  | 'aoe_skill'
  | 'rush_skill'
  | 'block'
  | 'dash_flank'
  | 'ultimate';

export interface AIDecisionContext {
  policy: AIPolicy;
  distance: number;
  aiHpRatio: number;
  aiChakra: number;
  playerAttacking: boolean;
  skillReady: [boolean, boolean, boolean, boolean];
  awakenReady: boolean;
  rngValue: number; // 0..1
}

export function decideBossIntent(ctx: AIDecisionContext): AIActionIntent {
  if (ctx.awakenReady && ctx.aiHpRatio < 0.65 && ctx.distance < 12 && ctx.rngValue < 0.35) {
    return 'ultimate';
  }

  if (ctx.playerAttacking && ctx.distance < 4.5 && ctx.rngValue < 0.38) {
    return 'block';
  }

  switch (ctx.policy) {
    case 'kiter_bomber':
    case 'puppet_zoner':
    case 'aerial_barrage':
      if (ctx.distance < 3.8) {
        if (ctx.skillReady[2] && ctx.aiChakra >= 28) return 'aoe_skill';
        return ctx.rngValue < 0.65 ? 'retreat_kite' : 'heavy_attack';
      }
      if (ctx.distance > 6.0 && ctx.skillReady[1] && ctx.aiChakra >= 20) {
        return 'projectile_skill';
      }
      if (ctx.distance > 11.0 && ctx.skillReady[0] && ctx.aiChakra >= 18) {
        return 'rush_skill';
      }
      return ctx.distance < 5.5 ? 'strafe' : 'approach';

    case 'berserker_rusher':
    case 'chakra_drainer':
      if (ctx.distance > 6.5) {
        if (ctx.skillReady[0] && ctx.aiChakra >= 18) return 'rush_skill';
        return 'dash_flank';
      }
      if (ctx.distance <= 3.6) {
        if (ctx.skillReady[2] && ctx.aiChakra >= 28 && ctx.rngValue < 0.32) {
          return 'aoe_skill';
        }
        return ctx.rngValue < 0.7 ? 'light_combo' : 'heavy_attack';
      }
      return 'approach';

    case 'illusion_feinter':
    case 'phase_striker':
      if (ctx.distance > 7.0 && ctx.skillReady[1] && ctx.aiChakra >= 22 && ctx.rngValue < 0.5) {
        return 'projectile_skill';
      }
      if (ctx.distance > 4.2 && ctx.rngValue < 0.4) {
        return 'dash_flank';
      }
      if (ctx.distance <= 3.8) {
        if (ctx.skillReady[0] && ctx.aiChakra >= 18 && ctx.rngValue < 0.45) {
          return 'rush_skill';
        }
        return ctx.rngValue < 0.65 ? 'light_combo' : 'heavy_attack';
      }
      return 'strafe';

    case 'elemental_hybrid':
    case 'gravity_controller':
    case 'meteor_warlord':
    default:
      if (ctx.distance <= 4.2) {
        if (ctx.skillReady[2] && ctx.aiChakra >= 30 && ctx.rngValue < 0.4) {
          return 'aoe_skill';
        }
        return ctx.rngValue < 0.55 ? 'light_combo' : 'heavy_attack';
      }
      if (ctx.distance <= 16 && ctx.skillReady[1] && ctx.aiChakra >= 22 && ctx.rngValue < 0.55) {
        return 'projectile_skill';
      }
      if (ctx.skillReady[0] && ctx.aiChakra >= 18 && ctx.rngValue < 0.45) {
        return 'rush_skill';
      }
      return 'approach';
  }
}
