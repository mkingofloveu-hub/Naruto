import React from 'react';
import { Play, Settings, Swords } from 'lucide-react';
import { AKATSUKI_BOSSES, GAME_MODES, getPlayableById } from '../game/characters';
import { GameModeId, SaveProgress } from '../game/types';

interface TitleScreenProps {
  save: SaveProgress;
  onStartBattle: () => void;
  onOpenSelect: () => void;
  onOpenSettings: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  save,
  onStartBattle,
  onOpenSelect,
  onOpenSettings,
}) => {
  const player = getPlayableById(save.selectedCharacterId);
  const modeMeta =
    GAME_MODES.find((m) => m.id === save.selectedMode) ?? GAME_MODES[0];
  const currentBoss =
    AKATSUKI_BOSSES[
      Math.min(AKATSUKI_BOSSES.length - 1, save.highestUnlockedBossIndex)
    ];

  const getNextOpponentLabel = (mode: GameModeId) => {
    if (mode === 'story') return `Next Boss: ${currentBoss.name}`;
    return modeMeta.rulesHint;
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between">
      {/* Left-third contrast scrim keeping right 65% of 3D arena open */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(8,11,17,0.92) 0%, rgba(8,11,17,0.72) 38%, rgba(8,11,17,0.12) 72%, rgba(8,11,17,0.0) 100%)',
        }}
      />

      <div className="relative z-10 flex-1 flex items-center px-6 sm:px-12 lg:px-16">
        <div className="max-w-xl w-full pointer-events-auto">
          {/* Bespoke Inline SVG Shinobi Crest + Title Lockup */}
          <div className="flex items-center gap-4 mb-5">
            <svg
              viewBox="0 0 64 64"
              className="w-14 h-14 shrink-0"
              aria-hidden="true"
            >
              <circle
                cx="32"
                cy="32"
                r="29"
                fill="#111827"
                stroke="#F97316"
                strokeWidth="3"
              />
              {/* Kunai Crossed Blades */}
              <path
                d="M16 48 L46 18 L50 14 L42 22 M48 48 L18 18 L14 14 L22 22"
                stroke="#E2E8F0"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
              {/* Leaf Swirl Core */}
              <path
                d="M32 20 C39 20 43 26 42 32 C41 38 35 42 29 40 C24 38 22 32 25 28 C28 24 33 25 34 29 C35 32 32 34 30 33"
                stroke="#F59E0B"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="text-xs font-medium tracking-wider uppercase text-amber-400">
              3D Shinobi Arena Fighter
            </div>
          </div>

          <h1
            className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.03] text-stroke-dark mb-4"
            style={{ textWrap: 'balance' }}
          >
            NARUTO
            <span className="block text-orange-400 mt-1">
              ULTIMATE SHINOBI WAR
            </span>
          </h1>

          {/* Active Loadout Summary as quiet unboxed typography */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-300 mb-8">
            <span className="font-semibold text-white">{player.name}</span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span>{modeMeta.name}</span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="text-amber-300">
              {getNextOpponentLabel(save.selectedMode)}
            </span>
          </div>

          {/* Primary & Secondary Actions (<= 3 total) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStartBattle}
              className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-slate-950 font-display font-bold text-base tracking-wide uppercase rounded-md shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Play className="w-5 h-5 fill-current" />
              Start Battle
            </button>

            <button
              type="button"
              onClick={onOpenSelect}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#131823]/95 hover:bg-[#1c2434] text-slate-100 border border-slate-700/80 font-semibold text-sm rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Swords className="w-4 h-4 text-orange-400" />
              Fighters & Modes
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Open Settings"
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-[#131823]/95 hover:bg-[#1c2434] text-slate-200 border border-slate-700/80 font-semibold text-sm rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Settings className="w-4 h-4 text-slate-300" />
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Single Flat Borderless Control Hint */}
      <div className="relative z-10 px-6 sm:px-12 lg:px-16 pb-5 text-xs text-slate-300/90 tracking-wide">
        <span className="hidden md:inline">
          WASD Move · Mouse Camera · LMB/RMB Attack · Space Jump · Shift Dash · Q Kunai · E/R Jutsu · F Block · G Charge · 1-4 Skills
        </span>
        <span className="md:hidden">
          Touch Joystick Move · Tap Combat Buttons to Attack, Block & Unleash Jutsu
        </span>
      </div>
    </div>
  );
};
