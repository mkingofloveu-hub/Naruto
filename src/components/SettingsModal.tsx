import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { getPresetSettings } from '../game/combatRules';
import { GraphicsPreset, GraphicsSettings } from '../game/types';

interface SettingsModalProps {
  settings: GraphicsSettings;
  onChange: (next: GraphicsSettings) => void;
  onResetProgress: () => void;
  onClose: () => void;
}

const PRESETS: { id: GraphicsPreset; label: string; desc: string }[] = [
  {
    id: 'EXTREME',
    label: 'EXTREME',
    desc: 'Max particles, dynamic shadows & 1.5x render scale',
  },
  {
    id: 'ULTRA',
    label: 'ULTRA',
    desc: 'High-quality 3D shaders, shadows & 60 FPS target',
  },
  {
    id: 'PERFORMANCE',
    label: 'PERFORMANCE',
    desc: 'Optimized for laptops, integrated GPUs & mobile',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChange,
  onResetProgress,
  onClose,
}) => {
  const applyPreset = (preset: GraphicsPreset) => {
    onChange(getPresetSettings(preset, settings));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0e131d] border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-display text-xl font-bold text-white uppercase tracking-wide">
            Graphics, Controls & Audio Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="w-9 h-9 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Graphics Presets */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2.5">
              Graphics Quality Preset
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                    settings.preset === p.id
                      ? 'bg-orange-500/15 border-orange-400 text-white'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="font-display font-bold text-sm">{p.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fine Graphics Sliders & Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="res-scale"
                className="flex justify-between text-xs font-medium text-slate-300 mb-1.5"
              >
                <span>Resolution Scale</span>
                <span className="font-mono-num text-amber-300">
                  {settings.resolutionScale.toFixed(2)}x
                </span>
              </label>
              <input
                id="res-scale"
                type="range"
                min={0.5}
                max={1.5}
                step={0.25}
                value={settings.resolutionScale}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    resolutionScale: Number(e.target.value),
                  })
                }
                className="w-full accent-orange-500"
              />
            </div>

            <div>
              <label
                htmlFor="fps-limit"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                FPS Limit
              </label>
              <select
                id="fps-limit"
                value={settings.fpsLimit}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    fpsLimit: Number(e.target.value) as 30 | 60 | 120,
                  })
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
              >
                <option value={30}>30 FPS (Battery Saver)</option>
                <option value={60}>60 FPS (Standard)</option>
                <option value={120}>120 FPS (High Refresh)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="particle-density"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Particle Effects Density
              </label>
              <select
                id="particle-density"
                value={settings.particleDensity}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    particleDensity: e.target.value as 'low' | 'medium' | 'high',
                  })
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="touch-mode"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Mobile Touch Controls
              </label>
              <select
                id="touch-mode"
                value={settings.touchControlsMode}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    touchControlsMode: e.target.value as 'auto' | 'on' | 'off',
                  })
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
              >
                <option value="auto">Auto (Touch / Narrow Screens)</option>
                <option value="on">Always Show Touch Pad</option>
                <option value="off">Off (Keyboard & Mouse)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.shadows}
                onChange={(e) =>
                  onChange({ ...settings, shadows: e.target.checked })
                }
                className="w-4 h-4 accent-orange-500"
              />
              Dynamic Shadows
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.postProcessing}
                onChange={(e) =>
                  onChange({ ...settings, postProcessing: e.target.checked })
                }
                className="w-4 h-4 accent-orange-500"
              />
              Cinematic Camera & FX
            </label>
          </div>

          {/* Audio */}
          <div className="border-t border-slate-800 pt-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Audio & Soundtrack
            </div>
            <div>
              <label
                htmlFor="master-vol"
                className="flex justify-between text-xs font-medium text-slate-300 mb-1.5"
              >
                <span>Master Volume</span>
                <span className="font-mono-num text-amber-300">
                  {Math.round(settings.masterVolume * 100)}%
                </span>
              </label>
              <input
                id="master-vol"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) =>
                  onChange({ ...settings, masterVolume: Number(e.target.value) })
                }
                className="w-full accent-orange-500"
              />
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.musicEnabled}
                  onChange={(e) =>
                    onChange({ ...settings, musicEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-orange-500"
                />
                Battle Music
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sfxEnabled}
                  onChange={(e) =>
                    onChange({ ...settings, sfxEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-orange-500"
                />
                Combat & Jutsu SFX
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#0b0f17]">
          <button
            type="button"
            onClick={onResetProgress}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-300 hover:text-rose-200 border border-rose-900/70 rounded-md cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Saved Progress
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm uppercase rounded-md cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
