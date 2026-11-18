import React from 'react';
import { ArrowRight, Home, Play, RotateCcw, Settings, Swords } from 'lucide-react';
import { MatchResultSnapshot } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenSelect: () => void;
  onOpenSettings: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onOpenSelect,
  onOpenSettings,
  onReturnTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game Paused"
    >
      <div className="w-full max-w-md bg-[#0e131d] border border-slate-700 rounded-lg p-6 shadow-2xl">
        <h2 className="font-display text-2xl font-bold text-white uppercase tracking-wide mb-1">
          Battle Paused
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Press Escape or P to resume combat immediately.
        </p>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm uppercase rounded-md cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Resume Battle
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-md cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Restart Match
          </button>

          <button
            type="button"
            onClick={onOpenSelect}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-md cursor-pointer"
          >
            <Swords className="w-4 h-4 text-orange-400" />
            Change Fighter & Mode
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-md cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            Graphics & Audio Settings
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-transparent hover:bg-slate-800/70 border border-slate-700 text-slate-300 text-sm font-semibold rounded-md cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};

interface OutcomeModalProps {
  result: MatchResultSnapshot;
  onPlayAgain: () => void;
  onNextBoss: () => void;
  onOpenSelect: () => void;
  onReturnTitle: () => void;
}

export const OutcomeModal: React.FC<OutcomeModalProps> = ({
  result,
  onPlayAgain,
  onNextBoss,
  onOpenSelect,
  onReturnTitle,
}) => {
  const isVictory = result.outcome === 'victory';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? 'Victory' : 'Defeat'}
    >
      <div
        className={`w-full max-w-lg bg-[#0e131d] border rounded-lg p-6 shadow-2xl ${
          isVictory ? 'border-amber-500/70' : 'border-rose-700/80'
        }`}
      >
        <div
          className={`text-xs font-bold uppercase tracking-wider mb-1 ${
            isVictory ? 'text-amber-400' : 'text-rose-400'
          }`}
        >
          {result.playerName} vs {result.bossName}
        </div>
        <h2 className="font-display text-3xl font-bold text-white uppercase tracking-wide mb-4">
          {isVictory ? 'Shinobi Victory' : 'Defeated in Battle'}
        </h2>

        {/* 3 Outcome-Matched Tabular Stat Tiles */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
            <div className="text-[10px] uppercase text-slate-400">
              {isVictory ? 'Clear Time' : 'Boss HP Left'}
            </div>
            <div className="font-mono-num text-xl font-bold text-white mt-0.5">
              {isVictory
                ? `${result.clearTimeSec}s`
                : `${result.bossHpRemainingPct}%`}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
            <div className="text-[10px] uppercase text-slate-400">Max Combo</div>
            <div className="font-mono-num text-xl font-bold text-amber-400 mt-0.5">
              {result.maxCombo} HIT
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
            <div className="text-[10px] uppercase text-slate-400">Score</div>
            <div className="font-mono-num text-xl font-bold text-sky-300 mt-0.5">
              {result.score}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          {result.canAdvanceNextBoss ? (
            <button
              type="button"
              data-start="true"
              onClick={onNextBoss}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm uppercase rounded-md cursor-pointer"
            >
              Next Akatsuki Boss
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onPlayAgain}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm uppercase rounded-md cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              {isVictory ? 'Play Again' : 'Try Again'}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSelect}
            className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-md cursor-pointer"
          >
            <Swords className="w-4 h-4 text-orange-400" />
            Fighters & Modes
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-transparent hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold rounded-md cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Title
          </button>
        </div>
      </div>
    </div>
  );
};
