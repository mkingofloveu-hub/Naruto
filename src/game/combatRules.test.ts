import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCombatDamage,
  calculateMatchScore,
  canSpendChakra,
  createDefaultSaveProgress,
  decideBossIntent,
  getPresetSettings,
  loadSaveProgress,
  persistSaveProgress,
  recordBossVictory,
  spendChakra,
} from './combatRules';
import { AKATSUKI_BOSSES, PLAYABLE_CHARACTERS } from './characters';

test('roster includes 12 playable shinobi and 10 sequential Akatsuki bosses', () => {
  assert.equal(PLAYABLE_CHARACTERS.length, 12);
  assert.equal(AKATSUKI_BOSSES.length, 10);
  assert.equal(AKATSUKI_BOSSES[0].id, 'deidara');
  assert.equal(AKATSUKI_BOSSES[9].id, 'madara');
});

test('damage calculation handles normal hits, combo scaling, guard, guard break, and parry', () => {
  const normalHit = calculateCombatDamage({
    attackerPower: 50,
    moveMultiplier: 1.0,
    comboCount: 1,
    isTransformed: false,
    defenderDefense: 0.1,
    isBlocking: false,
    parryWindowActive: false,
  });
  assert.equal(normalHit.damage, 45);
  assert.equal(normalHit.wasBlocked, false);

  const transformedHit = calculateCombatDamage({
    attackerPower: 50,
    moveMultiplier: 1.0,
    comboCount: 1,
    isTransformed: true,
    defenderDefense: 0.1,
    isBlocking: false,
    parryWindowActive: false,
  });
  assert.ok(transformedHit.damage > normalHit.damage);

  const blockedHit = calculateCombatDamage({
    attackerPower: 50,
    moveMultiplier: 1.0,
    comboCount: 1,
    isTransformed: false,
    defenderDefense: 0.1,
    isBlocking: true,
    parryWindowActive: false,
  });
  assert.equal(blockedHit.wasBlocked, true);
  assert.equal(blockedHit.guardBroken, false);
  assert.ok(blockedHit.damage < normalHit.damage);

  const guardBreaker = calculateCombatDamage({
    attackerPower: 50,
    moveMultiplier: 2.3,
    comboCount: 1,
    isTransformed: false,
    defenderDefense: 0.1,
    isBlocking: true,
    parryWindowActive: false,
  });
  assert.equal(guardBreaker.guardBroken, true);

  const parried = calculateCombatDamage({
    attackerPower: 50,
    moveMultiplier: 2.3,
    comboCount: 1,
    isTransformed: false,
    defenderDefense: 0.1,
    isBlocking: true,
    parryWindowActive: true,
  });
  assert.equal(parried.damage, 0);
  assert.equal(parried.wasParried, true);
});

test('chakra management enforces costs in battle and infinite chakra in training', () => {
  assert.equal(canSpendChakra(25, 30, 'story'), false);
  assert.equal(canSpendChakra(30, 30, 'story'), true);
  assert.equal(spendChakra(50, 20, 'story'), 30);

  assert.equal(canSpendChakra(0, 50, 'training'), true);
  assert.equal(spendChakra(100, 50, 'training'), 100);
});

test('boss AI policies differentiate ranged kiters from berserkers', () => {
  const deidaraDecision = decideBossIntent({
    policy: 'kiter_bomber',
    distance: 2.5,
    aiHpRatio: 0.9,
    aiChakra: 10,
    playerAttacking: false,
    skillReady: [true, true, false, true],
    awakenReady: false,
    rngValue: 0.3,
  });
  assert.equal(deidaraDecision, 'retreat_kite');

  const hidanDecision = decideBossIntent({
    policy: 'berserker_rusher',
    distance: 2.5,
    aiHpRatio: 0.9,
    aiChakra: 10,
    playerAttacking: false,
    skillReady: [true, true, false, true],
    awakenReady: false,
    rngValue: 0.3,
  });
  assert.equal(hidanDecision, 'light_combo');
});

test('graphics presets and localStorage progression save/load work deterministically', () => {
  const extreme = getPresetSettings('EXTREME');
  const perf = getPresetSettings('PERFORMANCE');
  assert.equal(extreme.shadows, true);
  assert.equal(extreme.particleDensity, 'high');
  assert.equal(perf.shadows, false);
  assert.equal(perf.particleDensity, 'low');

  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  let save = createDefaultSaveProgress();
  const score = calculateMatchScore({
    damageDealt: 1100,
    maxCombo: 14,
    clearTimeSec: 52,
    hpRemainingRatio: 0.72,
    bossesDefeated: 1,
    victory: true,
  });
  save = recordBossVictory(save, AKATSUKI_BOSSES[0], score, 'story');
  persistSaveProgress(save, mockStorage);

  const loaded = loadSaveProgress(mockStorage);
  assert.equal(loaded.highestUnlockedBossIndex, 1);
  assert.deepEqual(loaded.defeatedBossIds, ['deidara']);
  assert.equal(loaded.highScores.story, score);
});
