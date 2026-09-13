import React from 'react';
import { Play, Pause, RotateCcw, StepForward, Bug, Sparkles, Terminal, ArrowRight } from 'lucide-react';
import { Phase } from '../types';

interface ControlBarProps {
  prompt: string;
  onPromptChange: (val: string) => void;
  onRun: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  isRunning: boolean;
  currentPhase: Phase;
  injectRegression: boolean;
  onToggleRegression: (val: boolean) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  prompt,
  onPromptChange,
  onRun,
  onPause,
  onStep,
  onReset,
  isRunning,
  currentPhase,
  injectRegression,
  onToggleRegression,
  speed,
  onSpeedChange,
}) => {
  const PRESET_PROMPTS = [
    'make the dashboard cards smaller',
    'add vibration threshold alerts to machines api',
    'backfill maintenance events with composite index',
  ];

  return (
    <div className="border-t border-slate-800 bg-slate-900/90 p-3 select-none flex flex-col gap-2.5">
      {/* Prompt Input Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus-within:border-blue-500">
          <Terminal className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Enter engineering intent (e.g. 'make the dashboard cards smaller')..."
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
          />
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <button
              onClick={onPause}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={onRun}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Forge Loop</span>
            </button>
          )}

          <button
            onClick={onStep}
            disabled={isRunning || currentPhase === 'done'}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
            title="Execute single deterministic transition"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Step</span>
          </button>

          <button
            onClick={onReset}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
            title="Reset repository to baseline Checkpoint #1"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Options, Presets & Regression Injection */}
      <div className="flex flex-wrap items-center justify-between text-xs gap-3">
        {/* Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider hidden md:inline">Presets:</span>
          {PRESET_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => onPromptChange(p)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors truncate max-w-[200px] ${
                prompt === p
                  ? 'bg-slate-800 text-blue-300 border border-blue-800/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              &quot;{p}&quot;
            </button>
          ))}
        </div>

        {/* Right side: Regression toggle & speed */}
        <div className="flex items-center gap-4">
          {/* Inject Regression Switch */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={injectRegression}
              onChange={(e) => onToggleRegression(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-7 h-4 rounded-full transition-colors relative ${
                injectRegression ? 'bg-rose-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                  injectRegression ? 'left-3.5' : 'left-0.5'
                }`}
              />
            </div>
            <span
              className={`text-[11px] font-medium flex items-center gap-1 ${
                injectRegression ? 'text-rose-300' : 'text-slate-400'
              }`}
            >
              <Bug className="w-3 h-3" />
              <span>Inject Scope Regression (L4 Diff Test)</span>
            </span>
          </label>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
            <span className="text-[11px] text-slate-400">Speed:</span>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  speed === s
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
