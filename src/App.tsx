import { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterModeModal } from './components/CharacterModeModal';
import { GameHud } from './components/GameHud';
import { OutcomeModal, PauseModal } from './components/PauseAndOutcomeModals';
import { SettingsModal } from './components/SettingsModal';
import { TitleScreen } from './components/TitleScreen';
import { audioEngine } from './game/audio';
import { AKATSUKI_BOSSES } from './game/characters';
import {
  createDefaultSaveProgress,
  loadSaveProgress,
  persistSaveProgress,
  recordBossVictory,
} from './game/combatRules';
import { ShinobiWarEngine } from './game/engine';
import {
  ArenaId,
  GameModeId,
  GameScreenState,
  GraphicsSettings,
  HudSnapshot,
  MatchResultSnapshot,
  SaveProgress,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  playerName: 'Naruto Uzumaki',
  playerTitle: 'Child of Prophecy',
  playerHp: 1100,
  playerMaxHp: 1100,
  playerChakra: 100,
  playerMaxChakra: 100,
  playerAwaken: 0,
  isTransformed: false,
  transformName: 'Kurama Chakra Mode',
  bossName: 'Deidara',
  bossTitle: 'Explosion Artist of Iwagakure',
  bossHp: 980,
  bossMaxHp: 980,
  bossPhase: 1,
  comboCount: 0,
  comboTimer: 0,
  skillCooldowns: [0, 0, 0, 0],
  skillMaxCooldowns: [4.5, 5.5, 7.5, 9.0],
  specialCooldown: 0,
  kunaiCooldown: 0,
  isBlocking: false,
  isCharging: false,
  playerRoundsWon: 0,
  bossRoundsWon: 0,
  currentRound: 1,
  stageNumber: 1,
  totalStages: 10,
  waveNumber: 1,
  score: 0,
  elapsedTime: 0,
  bannerTitle: null,
  bannerSubtitle: null,
  bannerType: null,
  guardBroken: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ShinobiWarEngine | null>(null);

  const [save, setSave] = useState<SaveProgress>(() =>
    loadSaveProgress(typeof window !== 'undefined' ? window.localStorage : undefined),
  );
  const saveRef = useRef(save);
  saveRef.current = save;

  const [screenState, setScreenState] = useState<GameScreenState>('title');
  const screenStateRef = useRef<GameScreenState>('title');
  screenStateRef.current = screenState;

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [matchResult, setMatchResult] = useState<MatchResultSnapshot | null>(null);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [ready, setReady] = useState(false);

  const [selectedOpponentId, setSelectedOpponentId] = useState('deidara');
  const [selectedStageIndex, setSelectedStageIndex] = useState(() =>
    Math.min(AKATSUKI_BOSSES.length - 1, save.highestUnlockedBossIndex),
  );
  const [isTouchViewport, setIsTouchViewport] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchViewport(hasTouch || window.innerWidth < 860);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const updateSave = useCallback((updater: (prev: SaveProgress) => SaveProgress) => {
    setSave((prev) => {
      const next = updater(prev);
      persistSaveProgress(next, window.localStorage);
      return next;
    });
  }, []);

  const handleStartBattle = useCallback(() => {
    const currentSave = saveRef.current;
    const stageIdx =
      currentSave.selectedMode === 'story'
        ? Math.min(AKATSUKI_BOSSES.length - 1, currentSave.highestUnlockedBossIndex)
        : selectedStageIndex;

    setMatchResult(null);
    setShowSelectModal(false);
    setShowSettingsModal(false);
    setScreenState('playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current?.startNewMatch({
      mode: currentSave.selectedMode,
      playerId: currentSave.selectedCharacterId,
      opponentId: selectedOpponentId,
      arenaId: currentSave.selectedArena,
      stageIndex: stageIdx,
    });
  }, [selectedOpponentId, selectedStageIndex]);

  const handleTogglePause = useCallback(() => {
    const curr = screenStateRef.current;
    if (curr === 'playing') {
      setScreenState('paused');
      engineRef.current?.setScreenState('paused');
    } else if (curr === 'paused') {
      setShowSelectModal(false);
      setShowSettingsModal(false);
      setScreenState('playing');
      engineRef.current?.setScreenState('playing');
    }
  }, []);

  // Initialize Three.js engine once in isolated canvas container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const initial = saveRef.current;
    audioEngine.configure({
      volume: initial.settings.masterVolume,
      musicEnabled: initial.settings.musicEnabled,
      sfxEnabled: initial.settings.sfxEnabled,
    });

    const engine = new ShinobiWarEngine(mount, initial.settings, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onMatchEnd: (result) => {
        setMatchResult({
          ...result,
          bestScore: Math.max(
            result.score,
            saveRef.current.highScores[result.mode] ?? 0,
          ),
        });
        setScreenState('gameover');
      },
      onBossVictoryProgress: (boss, score, mode) => {
        updateSave((prev) => recordBossVictory(prev, boss, score, mode));
      },
      onPauseToggle: () => handleTogglePause(),
      onWebGLUnavailable: () => setWebglError(true),
    });

    engineRef.current = engine;
    document.body.dataset.state = 'title';
    setReady(true);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setScreenState('playing');
      engine.startNewMatch({
        mode: initial.selectedMode,
        playerId: initial.selectedCharacterId,
        stageIndex: 0,
      });
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleTogglePause, updateSave]);

  // Title Screen Enter / Space handshake & Playing M-key mute
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (
        screenStateRef.current === 'title' &&
        !showSelectModal &&
        !showSettingsModal &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        handleStartBattle();
      } else if (screenStateRef.current === 'playing' && e.code === 'KeyM') {
        updateSave((prev) => {
          const nextSettings: GraphicsSettings = {
            ...prev.settings,
            musicEnabled: !prev.settings.musicEnabled,
            sfxEnabled: !prev.settings.musicEnabled,
          };
          audioEngine.configure({
            volume: nextSettings.masterVolume,
            musicEnabled: nextSettings.musicEnabled,
            sfxEnabled: nextSettings.sfxEnabled,
          });
          return { ...prev, settings: nextSettings };
        });
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [handleStartBattle, showSelectModal, showSettingsModal, updateSave]);

  const handleSettingsChange = (nextSettings: GraphicsSettings) => {
    updateSave((prev) => ({ ...prev, settings: nextSettings }));
    engineRef.current?.applyGraphicsSettings(nextSettings);
    audioEngine.configure({
      volume: nextSettings.masterVolume,
      musicEnabled: nextSettings.musicEnabled,
      sfxEnabled: nextSettings.sfxEnabled,
    });
  };

  const handleConfiguredStart = (cfg: {
    characterId: string;
    mode: GameModeId;
    opponentId: string;
    arenaId: ArenaId;
    stageIndex: number;
  }) => {
    setSelectedOpponentId(cfg.opponentId);
    setSelectedStageIndex(cfg.stageIndex);
    updateSave((prev) => ({
      ...prev,
      selectedCharacterId: cfg.characterId,
      selectedMode: cfg.mode,
      selectedArena: cfg.arenaId,
    }));
    setShowSelectModal(false);
    setMatchResult(null);
    setScreenState('playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current?.startNewMatch({
      mode: cfg.mode,
      playerId: cfg.characterId,
      opponentId: cfg.opponentId,
      arenaId: cfg.arenaId,
      stageIndex: cfg.stageIndex,
    });
  };

  const showTouchControls =
    save.settings.touchControlsMode === 'on' ||
    (save.settings.touchControlsMode === 'auto' && isTouchViewport);

  const isMuted = !save.settings.musicEnabled && !save.settings.sfxEnabled;

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0B0E14]">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-viewport"
        className="fixed inset-0 w-full h-full"
      />

      {/* Initial Loading Curtain */}
      {!ready && !webglError && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E14] text-white">
          <div className="font-display text-2xl font-bold tracking-wider uppercase text-orange-400">
            Naruto Ultimate Shinobi War
          </div>
          <div className="mt-3 w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-orange-500 animate-pulse" />
          </div>
          <p className="mt-2 text-xs text-slate-400">Initializing 3D Shinobi Arena...</p>
        </div>
      )}

      {/* WebGL Unavailable Fallback */}
      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0E14] p-6 text-center">
          <div className="max-w-md bg-[#111827] border border-slate-700 rounded-lg p-6">
            <h1 className="font-display text-xl font-bold text-white mb-2">
              3D WebGL Context Unavailable
            </h1>
            <p className="text-sm text-slate-300">
              Hardware or software WebGL acceleration is disabled in this browser environment. Enable WebGL to enter the 3D battle arena.
            </p>
          </div>
        </div>
      )}

      {/* Title Screen */}
      {ready && screenState === 'title' && (
        <TitleScreen
          save={save}
          onStartBattle={handleStartBattle}
          onOpenSelect={() => setShowSelectModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      )}

      {/* Active Gameplay HUD */}
      {ready && screenState === 'playing' && (
        <GameHud
          hud={hud}
          mode={save.selectedMode}
          selectedPlayerId={save.selectedCharacterId}
          showTouchControls={showTouchControls}
          isMuted={isMuted}
          engineRef={engineRef}
          onToggleMute={() => {
            const nextMute = !isMuted;
            handleSettingsChange({
              ...save.settings,
              musicEnabled: !nextMute,
              sfxEnabled: !nextMute,
            });
          }}
          onPause={handleTogglePause}
          onOpenSettings={() => {
            setScreenState('paused');
            engineRef.current?.setScreenState('paused');
            setShowSettingsModal(true);
          }}
        />
      )}

      {/* Pause Modal */}
      {screenState === 'paused' && !showSelectModal && !showSettingsModal && (
        <PauseModal
          onResume={() => {
            setScreenState('playing');
            engineRef.current?.setScreenState('playing');
          }}
          onRestart={() => {
            setMatchResult(null);
            setScreenState('playing');
            engineRef.current?.restartCurrentMatch();
          }}
          onOpenSelect={() => setShowSelectModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onReturnTitle={() => {
            setMatchResult(null);
            setScreenState('title');
            engineRef.current?.setScreenState('title');
          }}
        />
      )}

      {/* Victory / Defeat Outcome Modal */}
      {screenState === 'gameover' && matchResult && !showSelectModal && (
        <OutcomeModal
          result={matchResult}
          onPlayAgain={() => {
            setMatchResult(null);
            setScreenState('playing');
            engineRef.current?.restartCurrentMatch();
          }}
          onNextBoss={() => {
            setMatchResult(null);
            setScreenState('playing');
            engineRef.current?.advanceNextBoss();
          }}
          onOpenSelect={() => setShowSelectModal(true)}
          onReturnTitle={() => {
            setMatchResult(null);
            setScreenState('title');
            engineRef.current?.setScreenState('title');
          }}
        />
      )}

      {/* Fighter & Mode Selection Modal */}
      {showSelectModal && (
        <CharacterModeModal
          save={save}
          selectedOpponentId={selectedOpponentId}
          selectedStageIndex={selectedStageIndex}
          onClose={() => setShowSelectModal(false)}
          onStartConfiguredBattle={handleConfiguredStart}
        />
      )}

      {/* Graphics & Audio Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          settings={save.settings}
          onChange={handleSettingsChange}
          onResetProgress={() => {
            const fresh = createDefaultSaveProgress();
            setSave(fresh);
            persistSaveProgress(fresh, window.localStorage);
            engineRef.current?.applyGraphicsSettings(fresh.settings);
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </main>
  );
}
