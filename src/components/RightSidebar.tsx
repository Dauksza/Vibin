import React, { useState } from 'react';
import { Shield, CheckCircle2, XCircle, MinusCircle, RefreshCw, Cpu, GitBranch, History, ChevronRight, Award } from 'lucide-react';
import { ContractResult, ModelInfo, Checkpoint, TaskKind } from '../types';

interface RightSidebarProps {
  contracts: ContractResult[];
  models: ModelInfo[];
  checkpoints: Checkpoint[];
  currentCheckpoint: number;
  onRewind: (checkpointId: number) => void;
  onSelectContractEvidence?: (layer: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  contracts,
  models,
  checkpoints,
  currentCheckpoint,
  onRewind,
  onSelectContractEvidence,
}) => {
  const [selectedKind, setSelectedKind] = useState<TaskKind>('judge');

  // Compute dynamic score matching router.py formula:
  // if kind in ('architect', 'debug', 'judge'):
  //   if 'coder' in name: s -= 50.0
  //   s += min(params, 70.0) / 10.0
  const computeScore = (m: ModelInfo, kind: TaskKind) => {
    let s = m.capabilities[kind] || 50;
    const name = m.name.toLowerCase();
    if (['architect', 'debug', 'judge'].includes(kind)) {
      if (name.includes('coder')) {
        s -= 50.0;
      }
      s += Math.min(m.params, 70.0) / 10.0;
    }
    return Math.round(s * 10) / 10;
  };

  const rankedModels = [...models].sort(
    (a, b) => computeScore(b, selectedKind) - computeScore(a, selectedKind)
  );

  return (
    <aside className="w-84 border-l border-slate-800 bg-slate-900/60 flex flex-col h-full shrink-0 select-none overflow-y-auto">
      {/* 1. The 6-Layer Contract Stack */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-xs text-slate-100 uppercase tracking-wider">
              Verification Contract Stack
            </h3>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            L0 - L5
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mb-2.5">
          The system owns verdicts; models propose at 3 points and grade nothing.
        </p>

        <div className="space-y-1.5">
          {contracts.map((c) => {
            const isPass = c.status === 'pass';
            const isFail = c.status === 'fail';
            const isSkip = c.status === 'skip';
            const isPending = c.status === 'pending';

            return (
              <div
                key={c.layer}
                onClick={() => onSelectContractEvidence?.(c.layer)}
                className={`p-2 rounded-md border text-xs transition-all cursor-pointer ${
                  isFail
                    ? 'bg-rose-950/30 border-rose-600/50 text-rose-200 hover:border-rose-500'
                    : isPass
                    ? 'bg-slate-950/80 border-emerald-800/40 text-slate-200 hover:border-emerald-600/50'
                    : isSkip
                    ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isFail
                          ? 'bg-rose-900/60 text-rose-200'
                          : isPass
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {c.layer}
                    </span>
                    <span className="font-medium text-[11px] text-slate-200">{c.name}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isPass && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        pass
                      </span>
                    )}
                    {isFail && (
                      <span className="flex items-center gap-1 text-[11px] text-rose-400 font-mono font-bold animate-pulse">
                        <XCircle className="w-3.5 h-3.5" />
                        fail
                      </span>
                    )}
                    {isSkip && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <MinusCircle className="w-3.5 h-3.5" />
                        neutral
                      </span>
                    )}
                    {isPending && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                        awaiting
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-mono truncate">{c.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Capability-Based Model Router with Interactive Probe */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-sky-400" />
            <h3 className="font-semibold text-xs text-slate-100 uppercase tracking-wider">
              Capability Model Router
            </h3>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/50">
            forge/router.py
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">
          Ranked by task affinity. Coder model penalized by -50 for judge tasks.
        </p>

        {/* Task Kind Selector Chips */}
        <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1 text-[10px] font-mono">
          {(['judge', 'code', 'architect', 'debug', 'migrate', 'fast'] as TaskKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setSelectedKind(k)}
              className={`px-2 py-0.5 rounded capitalize transition-colors shrink-0 ${
                selectedKind === k
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Ranked Model List for Selected Task Kind */}
        <div className="space-y-1.5">
          {rankedModels.map((m, idx) => {
            const score = computeScore(m, selectedKind);
            const isTop = idx === 0;
            const isPenalized = ['architect', 'debug', 'judge'].includes(selectedKind) && m.isCoder;

            return (
              <div
                key={m.name}
                className={`p-2 rounded border text-xs transition-all ${
                  isTop
                    ? 'bg-slate-950 border-sky-600/60 ring-1 ring-sky-600/30'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {isTop && <Award className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                    <span className="font-mono text-xs font-semibold text-slate-200">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-[10px] text-slate-400">score:</span>
                    <span
                      className={`text-xs font-bold ${
                        isPenalized ? 'text-rose-400' : isTop ? 'text-sky-400' : 'text-slate-300'
                      }`}
                    >
                      {score}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{m.primaryClass}</span>
                  {isPenalized ? (
                    <span className="text-rose-400 font-mono font-medium">Penalty -50 applied</span>
                  ) : isTop ? (
                    <span className="text-emerald-400 font-mono">Dispatched for {selectedKind}</span>
                  ) : (
                    <span>{m.params}B · {Math.round(m.sizeMB / 1000)}GB</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Checkpoints & Time Travel (Forge Rewind) */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <h3 className="font-semibold text-xs text-slate-100 uppercase tracking-wider">
              Time Travel & Snapshots
            </h3>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/50">
            git tags
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mb-2.5">
          Every mutation is snapshot. Failure rewinds safely without dirtying workspace.
        </p>

        <div className="space-y-1.5">
          {checkpoints.map((ck) => {
            const isCurrent = currentCheckpoint === ck.id;
            return (
              <div
                key={ck.id}
                className={`p-2 rounded border text-xs flex items-center justify-between transition-colors ${
                  isCurrent
                    ? 'bg-purple-950/30 border-purple-600/50 text-purple-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[11px] text-purple-300">#{ck.id}</span>
                    <span className="font-medium text-[11px]">{ck.label}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    tag: <span className="text-slate-300">{ck.gitTag}</span> · {ck.timestamp}
                  </div>
                </div>

                <button
                  onClick={() => onRewind(ck.id)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium flex items-center gap-1 transition-colors"
                  title={`Rewind repository to checkpoint #${ck.id}`}
                >
                  <History className="w-3 h-3 text-purple-400" />
                  <span>Rewind</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
