import React from 'react';
import { ShieldCheck, Cpu, HardDrive, Globe, Server, CheckCircle2, AlertCircle, Clock, Hash } from 'lucide-react';
import { Phase } from '../types';

interface HeaderProps {
  currentPhase: Phase;
  tokensUsed: number;
  elapsedSeconds: number;
  diagnoseRounds: number;
  currentCheckpoint: number;
}

const PHASES: { id: Phase; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'build', label: 'Build (Worktrees)' },
  { id: 'verify', label: 'Verify (Contracts)' },
  { id: 'diagnose', label: 'Diagnose' },
  { id: 'merge', label: 'Merge Gate' },
  { id: 'done', label: 'Done' },
];

export const Header: React.FC<HeaderProps> = ({
  currentPhase,
  tokensUsed,
  elapsedSeconds,
  diagnoseRounds,
  currentCheckpoint,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder < 10 ? '0' : ''}${remainder}s`;
  };

  const getPhaseIndex = (phase: Phase) => {
    if (phase === 'idle') return -1;
    if (phase === 'failed') return -2;
    return PHASES.findIndex((p) => p.id === phase);
  };

  const activeIdx = getPhaseIndex(currentPhase);

  return (
    <header className="border-b border-slate-800 bg-slate-950 text-slate-100 select-none">
      {/* Top Banner: Brand, Realms & Models */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 gap-3">
        {/* Left: Brand & Wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-wider text-base text-white">FORGE</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  v0.1.0-e2e
                </span>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  Deterministic Verification Control Plane
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Sandbox Realms Status */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider hidden md:inline">Realms:</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[11px]">FileRealm (git)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[11px]">BrowserRealm</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hidden lg:flex">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[11px]">ServiceRealm</span>
          </div>
        </div>

        {/* Right: Telemetry & Model Pool */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden xl:flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5" />
            <span className="text-[11px]">Pool:</span>
            <span className="font-mono text-[11px] text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/50">
              qwen3-coder:30b
            </span>
            <span className="font-mono text-[11px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
              deepseek-r1:14b
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px] text-slate-200">{formatTime(elapsedSeconds)}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Hash className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px] text-slate-200">{(tokensUsed / 1000).toFixed(1)}k tokens</span>
            </div>
            <div className="flex items-center gap-1.5 bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded">
              <span className="text-[10px] font-mono">CK#{currentCheckpoint}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Deterministic Phase Stepper */}
      <div className="bg-slate-900/90 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between overflow-x-auto gap-4">
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap min-w-max">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Loop:</span>
          {PHASES.map((p, idx) => {
            const isCurrent = currentPhase === p.id;
            const isCompleted = activeIdx > idx || currentPhase === 'done';
            const isDiagnosing = currentPhase === 'diagnose' && p.id === 'diagnose';
            const isFailed = currentPhase === 'failed' && p.id === 'verify';

            let stateClasses = 'bg-slate-800/50 text-slate-400 border-slate-700/40';
            if (isDiagnosing) {
              stateClasses = 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/30 animate-pulse';
            } else if (isCurrent) {
              stateClasses = 'bg-blue-500/20 text-blue-300 border-blue-500/60 ring-1 ring-blue-500/30';
            } else if (isCompleted) {
              stateClasses = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40';
            } else if (isFailed) {
              stateClasses = 'bg-rose-500/20 text-rose-300 border-rose-500/60';
            }

            return (
              <React.Fragment key={p.id}>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${stateClasses}`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : isDiagnosing ? (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px] font-mono shrink-0">
                      {idx + 1}
                    </span>
                  )}
                  <span className="truncate">{p.label}</span>
                  {p.id === 'diagnose' && diagnoseRounds > 0 && (
                    <span className="text-[10px] font-mono px-1 rounded bg-amber-900/60 text-amber-200 ml-0.5">
                      R{diagnoseRounds}
                    </span>
                  )}
                </div>
                {idx < PHASES.length - 1 && (
                  <div className="w-3 h-px bg-slate-700 shrink-0 hidden sm:block"></div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="text-xs font-mono text-slate-400 shrink-0 hidden md:block">
          {currentPhase === 'idle' && <span className="text-slate-400">Ready to execute</span>}
          {currentPhase === 'plan' && <span className="text-blue-400">Decomposing prompt into DAG...</span>}
          {currentPhase === 'build' && <span className="text-sky-400">Spawning 3 parallel git worktrees...</span>}
          {currentPhase === 'verify' && <span className="text-indigo-400">Evaluating 6-layer contract stack...</span>}
          {currentPhase === 'diagnose' && <span className="text-amber-400">L4 visual regression caught → Diagnosing</span>}
          {currentPhase === 'merge' && <span className="text-emerald-400">Merging lanes behind green gate...</span>}
          {currentPhase === 'done' && <span className="text-emerald-400 font-semibold">Verification green · Merged</span>}
          {currentPhase === 'failed' && <span className="text-rose-400">Verification red · Rewound</span>}
        </div>
      </div>
    </header>
  );
};
