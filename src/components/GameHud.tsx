import React, { useEffect, useRef, useState } from 'react';
import { Pause, Settings, Volume2, VolumeX } from 'lucide-react';
import { getPlayableById } from '../game/characters';
import { ShinobiWarEngine } from '../game/engine';
import { GameModeId, HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  mode: GameModeId;
  selectedPlayerId: string;
  showTouchControls: boolean;
  isMuted: boolean;
  engineRef: React.RefObject<ShinobiWarEngine | null>;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenSettings: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  mode,
  selectedPlayerId,
  showTouchControls,
  isMuted,
  engineRef,
  onToggleMute,
  onPause,
  onOpenSettings,
}) => {
  const playerDef = getPlayableById(selectedPlayerId);
  const [ghostPlayerPct, setGhostPlayerPct] = useState(100);
  const [ghostBossPct, setGhostBossPct] = useState(100);
  const joyRef = useRef<HTMLDivElement | null>(null);
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const activeTouchId = useRef<number | null>(null);

  const playerHpPct = Math.max(0, Math.min(100, (hud.playerHp / hud.playerMaxHp) * 100));
  const bossHpPct = Math.max(0, Math.min(100, (hud.bossHp / hud.bossMaxHp) * 100));
  const chakraPct = Math.max(
    0,
    Math.min(100, (hud.playerChakra / hud.playerMaxChakra) * 100),
  );

  // Delayed trailing damage ghost bar
  useEffect(() => {
    const t = window.setTimeout(() => setGhostPlayerPct(playerHpPct), 320);
    return () => clearTimeout(t);
  }, [playerHpPct]);

  useEffect(() => {
    const t = window.setTimeout(() => setGhostBossPct(bossHpPct), 320);
    return () => clearTimeout(t);
  }, [bossHpPct]);

  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouchId.current) {
        updateJoystick(t.clientX, t.clientY);
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setJoyOffset({ x: 0, y: 0 });
        engineRef.current?.setTouchMove(0, 0);
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    setJoyOffset({ x: ox, y: oy });
    engineRef.current?.setTouchMove(ox / maxR, -oy / maxR);
  };

  const formatClock = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const ultimateReady = hud.playerAwaken >= 100;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Top Perimeter Row: Player Cluster | Stage/Timer | Boss Cluster + Utilities */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Player Vitality, Chakra & Awakening */}
        <div
          className="w-[38vw] max-w-[340px] bg-[#0c1018]/90 border border-slate-700/80 rounded-md px-3 py-2.5 shadow-lg"
          data-testid="player-hud"
        >
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <div className="truncate">
              <span className="font-display font-bold text-sm sm:text-base text-white tracking-wide">
                {hud.playerName}
              </span>
              {hud.isTransformed && (
                <span className="ml-2 text-[11px] font-semibold text-amber-300 uppercase">
                  {hud.transformName}
                </span>
              )}
            </div>
            <span className="font-mono-num text-xs text-slate-200 shrink-0">
              {hud.playerHp}/{hud.playerMaxHp}
            </span>
          </div>

          {/* HP Bar with delayed damage ghost */}
          <div className="relative h-3.5 bg-slate-900 border border-slate-700 rounded-sm overflow-hidden mb-1.5">
            <div
              className="absolute inset-y-0 left-0 bg-amber-300/75 transition-all duration-300"
              style={{ width: `${ghostPlayerPct}%` }}
            />
            <div
              className={`relative h-full transition-all duration-100 ${
                playerHpPct < 28 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${playerHpPct}%` }}
            />
          </div>

          {/* Chakra Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 h-2 bg-slate-900 border border-slate-700 rounded-sm overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all duration-100"
                style={{ width: `${chakraPct}%` }}
              />
            </div>
            <span className="font-mono-num text-[11px] text-sky-300 shrink-0">
              CK {mode === 'training' ? 'MAX' : hud.playerChakra}
            </span>
          </div>

          {/* Awakening / Ultimate Meter */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative flex-1 h-1.5 bg-slate-900 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  ultimateReady ? 'bg-amber-400' : 'bg-orange-500'
                }`}
                style={{ width: `${Math.min(100, hud.playerAwaken)}%` }}
              />
            </div>
            <span
              className={`font-mono-num text-[10px] font-bold uppercase shrink-0 ${
                ultimateReady ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              {ultimateReady ? 'ULT READY [R/T]' : `ULT ${hud.playerAwaken}%`}
            </span>
          </div>
        </div>

        {/* Top-Center: Compact Stage / Mode / Timer */}
        <div className="hidden sm:flex flex-col items-center bg-[#0c1018]/90 border border-slate-700/80 rounded-md px-4 py-1.5 shadow-lg">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            {mode === 'story' || mode === 'boss_rush'
              ? `Akatsuki Stage ${hud.stageNumber}/${hud.totalStages}`
              : mode === 'war' || mode === 'survival'
                ? `Wave ${hud.waveNumber}`
                : mode === 'duel_1v1'
                  ? `Round ${hud.currentRound} (${hud.playerRoundsWon}-${hud.bossRoundsWon})`
                  : mode === 'training'
                    ? 'Training Dojo'
                    : 'Free Battle'}
          </div>
          <div className="font-mono-num text-lg font-bold text-white leading-tight">
            {formatClock(hud.elapsedTime)}
          </div>
        </div>

        {/* Top-Right: Boss Vitality + Compact Utility Buttons */}
        <div className="flex items-start gap-2">
          <div
            className="w-[38vw] max-w-[340px] bg-[#0c1018]/90 border border-rose-900/70 rounded-md px-3 py-2.5 shadow-lg"
            data-testid="boss-hud"
          >
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="font-mono-num text-xs text-rose-200 shrink-0">
                {hud.bossHp}/{hud.bossMaxHp}
              </span>
              <div className="truncate text-right">
                <span className="font-display font-bold text-sm sm:text-base text-white tracking-wide">
                  {hud.bossName}
                </span>
                {hud.bossPhase === 2 && (
                  <span className="ml-2 text-[10px] font-bold text-rose-400 uppercase">
                    Enraged
                  </span>
                )}
              </div>
            </div>

            <div className="relative h-3.5 bg-slate-900 border border-rose-950 rounded-sm overflow-hidden">
              <div
                className="absolute inset-y-0 right-0 bg-amber-300/70 transition-all duration-300"
                style={{ width: `${ghostBossPct}%` }}
              />
              <div
                className="relative ml-auto h-full bg-rose-600 transition-all duration-100"
                style={{ width: `${bossHpPct}%` }}
              />
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate">{hud.bossTitle}</span>
              <span className="font-mono-num text-amber-300 shrink-0 ml-2">
                {hud.score} PTS
              </span>
            </div>
          </div>

          {/* Utility Buttons (tabIndex=-1 so Space/Enter never re-triggers) */}
          <div className="pointer-events-auto flex flex-col sm:flex-row gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              aria-label={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-9 h-9 flex items-center justify-center bg-[#0c1018]/90 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-200 cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Open Settings"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenSettings();
              }}
              className="w-9 h-9 flex items-center justify-center bg-[#0c1018]/90 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-200 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Game [P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-9 h-9 flex items-center justify-center bg-[#0c1018]/90 hover:bg-slate-800 border border-slate-700 rounded-md text-slate-200 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mid-Left Combo & Guard Status (keeps central 35%-65% viewport clear) */}
      <div className="flex flex-col items-start gap-2 my-auto pointer-events-none">
        {hud.comboCount > 1 && (
          <div className="px-3 py-1.5" data-testid="combo-counter">
            <div className="font-display text-4xl font-bold text-amber-400 text-stroke-dark font-mono-num leading-none">
              {hud.comboCount} HIT
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-white text-stroke-sm">
              Shinobi Combo
            </div>
          </div>
        )}
        {hud.guardBroken && (
          <div className="px-3 py-1 bg-rose-600/90 text-white text-xs font-bold uppercase rounded">
            Guard Broken!
          </div>
        )}
        {hud.isBlocking && !hud.guardBroken && (
          <div className="px-2.5 py-1 bg-sky-600/85 text-white text-xs font-semibold uppercase rounded">
            Guarding
          </div>
        )}
        {hud.isCharging && (
          <div className="px-2.5 py-1 bg-amber-500/90 text-slate-950 text-xs font-bold uppercase rounded">
            Charging Chakra
          </div>
        )}
      </div>

      {/* Dramatic Cut-in Banner for Boss Intros, Transformations & Ultimates */}
      {hud.bannerTitle && (
        <div
          key={`${hud.bannerTitle}-${hud.bannerType}`}
          className="fixed inset-x-0 top-1/4 flex justify-center pointer-events-none px-4"
        >
          <div
            className={`animate-cut-in px-8 py-4 border-y-2 shadow-2xl text-center max-w-2xl w-full ${
              hud.bannerType === 'ultimate'
                ? 'bg-[#1a0b12]/92 border-amber-400'
                : hud.bannerType === 'boss_intro'
                  ? 'bg-[#14090c]/92 border-rose-500'
                  : 'bg-[#0b1322]/92 border-sky-400'
            }`}
          >
            <div className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white text-stroke-sm">
              {hud.bannerTitle}
            </div>
            {hud.bannerSubtitle && (
              <div className="text-xs sm:text-sm text-amber-200 mt-1">
                {hud.bannerSubtitle}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Area: Desktop Skill Bar OR Touch Controls */}
      {showTouchControls ? (
        <div className="flex items-end justify-between gap-2 pb-1">
          {/* Virtual Joystick */}
          <div
            ref={joyRef}
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
            className="pointer-events-auto relative w-28 h-28 rounded-full bg-[#0c1018]/80 border-2 border-slate-600 flex items-center justify-center touch-none"
            aria-label="Movement Joystick"
          >
            <div
              className="w-12 h-12 rounded-full bg-orange-500/90 border-2 border-amber-200 shadow-lg"
              style={{
                transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`,
              }}
            />
          </div>

          {/* Touch Action Cluster */}
          <div className="pointer-events-auto grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => engineRef.current?.triggerTouchAction('skill1')}
              className="w-12 h-12 rounded-md bg-[#0c1018]/90 border border-slate-600 text-[11px] font-bold text-white active:bg-orange-500"
            >
              S1
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.triggerTouchAction('skill2')}
              className="w-12 h-12 rounded-md bg-[#0c1018]/90 border border-slate-600 text-[11px] font-bold text-white active:bg-orange-500"
            >
              S2
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.triggerTouchAction('special')}
              className="w-12 h-12 rounded-md bg-sky-700/90 border border-sky-400 text-[11px] font-bold text-white active:bg-sky-500"
            >
              JUTSU
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.triggerTouchAction('ultimate')}
              disabled={!ultimateReady}
              className={`w-12 h-12 rounded-md border text-[11px] font-bold ${
                ultimateReady
                  ? 'bg-amber-500 border-amber-200 text-slate-950'
                  : 'bg-slate-900/80 border-slate-700 text-slate-500'
              }`}
            >
              ULT
            </button>

            <button
              type="button"
              onTouchStart={() => engineRef.current?.setTouchHold('block', true)}
              onTouchEnd={() => engineRef.current?.setTouchHold('block', false)}
              className="w-12 h-12 rounded-md bg-[#0c1018]/90 border border-slate-600 text-[11px] font-bold text-slate-200"
            >
              BLK
            </button>
            <button
              type="button"
              onTouchStart={() => engineRef.current?.setTouchHold('charge', true)}
              onTouchEnd={() => engineRef.current?.setTouchHold('charge', false)}
              className="w-12 h-12 rounded-md bg-[#0c1018]/90 border border-sky-700 text-[11px] font-bold text-sky-300"
            >
              CHK
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.triggerTouchAction('jump')}
              className="w-12 h-12 rounded-md bg-[#0c1018]/90 border border-slate-600 text-[11px] font-bold text-white"
            >
              JMP
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.triggerTouchAction('light')}
              className="w-12 h-12 rounded-md bg-orange-600 border border-orange-300 text-[11px] font-bold text-white active:bg-orange-400"
            >
              ATK
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 bg-[#0c1018]/92 border border-slate-700/85 rounded-md px-2.5 py-2 shadow-xl">
            {playerDef.skills.map((skill, idx) => {
              const cd = hud.skillCooldowns[idx];
              const enoughChakra =
                mode === 'training' || hud.playerChakra >= skill.chakraCost;
              return (
                <button
                  key={skill.id}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.triggerTouchAction(
                      `skill${idx + 1}` as 'skill1' | 'skill2' | 'skill3' | 'skill4',
                    );
                  }}
                  title={`${skill.name} — ${skill.shortDesc}`}
                  className={`relative min-w-[84px] sm:min-w-[116px] px-2.5 py-1.5 rounded border text-left transition-colors cursor-pointer ${
                    cd > 0 || !enoughChakra
                      ? 'bg-slate-900/90 border-slate-700 opacity-65'
                      : 'bg-slate-800/95 hover:bg-slate-700 border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono-num">
                    <span className="font-bold text-amber-400">[{skill.key}]</span>
                    <span className="text-sky-300">
                      {cd > 0 ? `${cd.toFixed(1)}s` : `${skill.chakraCost} CK`}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate mt-0.5">
                    {skill.name}
                  </div>
                </button>
              );
            })}

            <div className="w-px h-8 bg-slate-700 mx-0.5" />

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.triggerTouchAction('kunai');
              }}
              className="px-2.5 py-1.5 rounded bg-slate-800/95 hover:bg-slate-700 border border-slate-600 text-left cursor-pointer"
            >
              <div className="text-[10px] font-mono-num font-bold text-slate-300">
                [Q] {hud.kunaiCooldown > 0 ? `${hud.kunaiCooldown.toFixed(1)}s` : 'READY'}
              </div>
              <div className="text-xs font-semibold text-white">Kunai</div>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.triggerTouchAction('special');
              }}
              className="px-2.5 py-1.5 rounded bg-sky-950/90 hover:bg-sky-900 border border-sky-500/70 text-left cursor-pointer"
            >
              <div className="text-[10px] font-mono-num font-bold text-sky-300">
                [E] {hud.specialCooldown > 0 ? `${hud.specialCooldown.toFixed(1)}s` : '30 CK'}
              </div>
              <div className="text-xs font-semibold text-white truncate max-w-[90px]">
                {playerDef.specialName}
              </div>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.triggerTouchAction('ultimate');
              }}
              className={`px-3 py-1.5 rounded border text-left cursor-pointer ${
                ultimateReady
                  ? 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <div className="text-[10px] font-mono-num font-bold">
                [R] {ultimateReady ? 'READY' : `${hud.playerAwaken}%`}
              </div>
              <div className="text-xs font-bold truncate max-w-[96px]">
                Ultimate
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
