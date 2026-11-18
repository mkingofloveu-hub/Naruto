import React, { useState } from 'react';
import { Lock, Play, X } from 'lucide-react';
import {
  AKATSUKI_BOSSES,
  GAME_MODES,
  getAllOpponents,
  PLAYABLE_CHARACTERS,
} from '../game/characters';
import { ArenaId, FighterDef, GameModeId, SaveProgress } from '../game/types';

interface CharacterModeModalProps {
  save: SaveProgress;
  selectedOpponentId: string;
  selectedStageIndex: number;
  onClose: () => void;
  onStartConfiguredBattle: (config: {
    characterId: string;
    mode: GameModeId;
    opponentId: string;
    arenaId: ArenaId;
    stageIndex: number;
  }) => void;
}

const ARENAS: { id: ArenaId; name: string }[] = [
  { id: 'final_valley', name: 'Final Valley Gorge' },
  { id: 'storm_canyon', name: 'Akatsuki Storm Canyon' },
  { id: 'war_battlefield', name: 'Shinobi War Battlefield' },
];

export const CharacterModeModal: React.FC<CharacterModeModalProps> = ({
  save,
  selectedOpponentId,
  selectedStageIndex,
  onClose,
  onStartConfiguredBattle,
}) => {
  const [tab, setTab] = useState<'fighters' | 'modes' | 'akatsuki'>('fighters');
  const [characterId, setCharacterId] = useState(save.selectedCharacterId);
  const [mode, setMode] = useState<GameModeId>(save.selectedMode);
  const [arenaId, setArenaId] = useState<ArenaId>(save.selectedArena);
  const [opponentId, setOpponentId] = useState(selectedOpponentId);
  const [stageIndex, setStageIndex] = useState(selectedStageIndex);

  const activeFighter: FighterDef =
    PLAYABLE_CHARACTERS.find((c) => c.id === characterId) ?? PLAYABLE_CHARACTERS[0];
  const allOpponents = getAllOpponents();

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Fighters and Game Modes"
    >
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0e131d] border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white uppercase tracking-wide">
              Shinobi Roster & Battle Modes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              12 Playable Shinobi · 10 Akatsuki Bosses · 7 Game Modes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Fighters and Modes"
            className="w-9 h-9 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800 bg-[#0b0f17]">
          <button
            type="button"
            onClick={() => setTab('fighters')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'fighters'
                ? 'bg-orange-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            1. Playable Shinobi (12)
          </button>
          <button
            type="button"
            onClick={() => setTab('modes')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'modes'
                ? 'bg-orange-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            2. Game Modes (7)
          </button>
          <button
            type="button"
            onClick={() => setTab('akatsuki')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'akatsuki'
                ? 'bg-orange-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            3. Akatsuki War & Arena
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'fighters' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PLAYABLE_CHARACTERS.map((char) => {
                  const selected = char.id === characterId;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => setCharacterId(char.id)}
                      className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-orange-500/15 border-orange-400 text-white'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-600 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className="w-3 h-3 rounded-xs shrink-0"
                          style={{ backgroundColor: char.visual.primaryColor }}
                        />
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">
                          {char.element}
                        </span>
                      </div>
                      <div className="font-display font-bold text-sm truncate">
                        {char.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {char.village}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Fighter Details */}
              <div className="lg:col-span-5 bg-[#0a0e16] border border-slate-800 rounded-md p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                  {activeFighter.village} · {activeFighter.element}
                </div>
                <h3 className="font-display text-2xl font-bold text-white mt-0.5">
                  {activeFighter.name}
                </h3>
                <p className="text-xs text-slate-400 mb-4">{activeFighter.title}</p>

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
                    <div className="text-[10px] text-slate-400 uppercase">Health</div>
                    <div className="font-mono-num text-sm font-bold text-emerald-400">
                      {activeFighter.maxHp}
                    </div>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
                    <div className="text-[10px] text-slate-400 uppercase">Attack</div>
                    <div className="font-mono-num text-sm font-bold text-amber-400">
                      {activeFighter.attackPower}
                    </div>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
                    <div className="text-[10px] text-slate-400 uppercase">Speed</div>
                    <div className="font-mono-num text-sm font-bold text-sky-400">
                      {activeFighter.moveSpeed.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Special [E]:</span>
                    <span className="font-semibold text-sky-300">
                      {activeFighter.specialName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Awakening [T]:</span>
                    <span className="font-semibold text-amber-300">
                      {activeFighter.transformName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ultimate [R]:</span>
                    <span className="font-semibold text-rose-300">
                      {activeFighter.ultimateName}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Character Skills [1-4]
                  </div>
                  <div className="space-y-1.5">
                    {activeFighter.skills.map((sk) => (
                      <div
                        key={sk.id}
                        className="flex items-center justify-between text-xs bg-slate-900/70 px-2.5 py-1.5 rounded"
                      >
                        <span className="font-semibold text-slate-100">
                          [{sk.key}] {sk.name}
                        </span>
                        <span className="text-slate-400 truncate ml-2">
                          {sk.shortDesc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'modes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {GAME_MODES.map((m) => {
                const selected = mode === m.id;
                const best = save.highScores[m.id] ?? 0;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`p-4 rounded-md border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-orange-500/15 border-orange-400'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-display font-bold text-base text-white">
                        {m.name}
                      </span>
                      <span className="font-mono-num text-xs text-amber-300">
                        Best: {best}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-2">{m.shortDesc}</p>
                    <div className="text-[11px] text-slate-400">{m.rulesHint}</div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'akatsuki' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-rose-400 mb-2.5">
                  Akatsuki War Progression (10 Bosses)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {AKATSUKI_BOSSES.map((boss, idx) => {
                    const locked =
                      mode === 'story' && idx > save.highestUnlockedBossIndex;
                    const defeated = save.defeatedBossIds.includes(boss.id);
                    const selected =
                      mode === 'story' || mode === 'boss_rush'
                        ? stageIndex === idx
                        : opponentId === boss.id;

                    return (
                      <button
                        key={boss.id}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          setStageIndex(idx);
                          setOpponentId(boss.id);
                        }}
                        className={`p-3 rounded-md border text-left transition-colors ${
                          locked
                            ? 'bg-slate-950 border-slate-800/70 opacity-50 cursor-not-allowed'
                            : selected
                              ? 'bg-rose-500/20 border-rose-400 cursor-pointer'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-600 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400 mb-1">
                          <span>BOSS {idx + 1}</span>
                          {locked ? (
                            <Lock className="w-3 h-3 text-slate-500" />
                          ) : defeated ? (
                            <span className="text-emerald-400 font-bold">CLEARED</span>
                          ) : null}
                        </div>
                        <div className="font-display font-bold text-sm text-white truncate">
                          {boss.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {boss.element}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(mode === 'free_battle' || mode === 'duel_1v1' || mode === 'training') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <label
                      htmlFor="opponent-select"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
                    >
                      Custom Opponent
                    </label>
                    <select
                      id="opponent-select"
                      value={opponentId}
                      onChange={(e) => setOpponentId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
                    >
                      {allOpponents.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.name} — {op.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="arena-select"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
                    >
                      Battle Arena
                    </label>
                    <select
                      id="arena-select"
                      value={arenaId}
                      onChange={(e) => setArenaId(e.target.value as ArenaId)}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
                    >
                      {ARENAS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-[#0b0f17]">
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">{activeFighter.name}</span>
            <span className="mx-2 text-slate-500">·</span>
            <span>{GAME_MODES.find((m) => m.id === mode)?.name}</span>
            <span className="mx-2 text-slate-500">·</span>
            <span className="text-rose-300">
              vs{' '}
              {mode === 'story' || mode === 'boss_rush'
                ? AKATSUKI_BOSSES[stageIndex]?.name
                : allOpponents.find((o) => o.id === opponentId)?.name ?? 'Deidara'}
            </span>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={() =>
              onStartConfiguredBattle({
                characterId,
                mode,
                opponentId,
                arenaId,
                stageIndex,
              })
            }
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm uppercase tracking-wide rounded-md cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Launch Battle
          </button>
        </div>
      </div>
    </div>
  );
};
