import React, { useState } from 'react';
import { Network, Eye, FileText, Code2, AlertTriangle, GitMerge, FileCode, Check, RefreshCw, Terminal } from 'lucide-react';
import { Task, EvidenceFile } from '../types';
import { PLANTWATCH_FILES, FORGE_SOURCE_FILES, TEST_SUITE_DETAILS } from '../data/forgeData';

interface CenterStageProps {
  activeTab: 'dag' | 'preview' | 'evidence' | 'code';
  onTabChange: (tab: 'dag' | 'preview' | 'evidence' | 'code') => void;
  tasks: Task[];
  evidenceFiles: EvidenceFile[];
  selectedFile: string;
  onSelectFile: (file: string) => void;
  cardsColumns: number; // 4 (baseline) or 3 (smaller cards after prompt)
  loginCorrupted: boolean; // whether regression is present in login.html
  visualDiffDetected: boolean;
  diagnoseRounds: number;
}

export const CenterStage: React.FC<CenterStageProps> = ({
  activeTab,
  onTabChange,
  tasks,
  evidenceFiles,
  selectedFile,
  cardsColumns,
  loginCorrupted,
  visualDiffDetected,
  diagnoseRounds,
}) => {
  // Preview route state: '/dashboard' or '/login'
  const [previewRoute, setPreviewRoute] = useState<'/dashboard' | '/login'>('/dashboard');
  const [previewMode, setPreviewMode] = useState<'current' | 'baseline' | 'regression' | 'split'>('current');
  const [splitPos, setSplitPos] = useState<number>(50);
  const [selectedEvidenceName, setSelectedEvidenceName] = useState('failing-layers.txt');

  // Test Runner State
  const [testRunnerState, setTestRunnerState] = useState<'idle' | 'running' | 'done'>('done');
  const [activeRunningTestIdx, setActiveRunningTestIdx] = useState<number>(TEST_SUITE_DETAILS.length);

  const selectedEvidence = evidenceFiles.find((e) => e.name === selectedEvidenceName) || evidenceFiles[0];

  // Resolve code for the selected file
  const currentFileContent =
    PLANTWATCH_FILES[selectedFile] ||
    FORGE_SOURCE_FILES[selectedFile] || {
      desc: 'Selected file view',
      lang: 'text',
      code: `// ${selectedFile}\n// Content loaded from workspace`,
    };

  const isCorruptedState =
    previewMode === 'regression' || (previewMode === 'current' && loginCorrupted);

  const runAllTestsAnimated = () => {
    setTestRunnerState('running');
    setActiveRunningTestIdx(0);

    let currentIdx = 0;
    const interval = setInterval(() => {
      currentIdx += 1;
      setActiveRunningTestIdx(currentIdx);
      if (currentIdx >= TEST_SUITE_DETAILS.length) {
        clearInterval(interval);
        setTestRunnerState('done');
      }
    }, 120);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden select-none">
      {/* Tab Navigation Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTabChange('dag')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition-colors ${
              activeTab === 'dag'
                ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-sky-400" />
            <span>Task DAG & Worktrees</span>
          </button>

          <button
            onClick={() => onTabChange('preview')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition-colors ${
              activeTab === 'preview'
                ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>Live App Preview (PlantWatch)</span>
            {visualDiffDetected && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => onTabChange('evidence')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition-colors ${
              activeTab === 'evidence'
                ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Evidence Bundle Explorer</span>
            {diagnoseRounds > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Active
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('code')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 font-medium transition-colors ${
              activeTab === 'code'
                ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Code & Tests (8/8 Passed)</span>
          </button>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 text-xs">
          {visualDiffDetected && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[11px]">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Regression Caught (L4)</span>
            </div>
          )}
          <span className="font-mono text-[11px] text-slate-400">
            Worktrees: <span className="text-emerald-400 font-semibold">3 active</span>
          </span>
        </div>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* VIEW 1: Task DAG & Parallel Worktrees */}
        {activeTab === 'dag' && (
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Parallel Execution Lanes (Isolated Git Worktrees)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tasks run concurrently across independent worktrees. Merges are permitted only behind a verified green contract gate.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Merge Gate:</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-xs border border-slate-700">
                  main branch
                </span>
              </div>
            </div>

            {/* Visual Lanes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Lane Alpha */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span className="font-mono font-bold text-xs text-blue-400">Lane Alpha</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    .forge/wt/alpha
                  </span>
                </div>

                <div className="space-y-2">
                  {tasks
                    .filter((t) => t.lane === 'alpha')
                    .map((t) => (
                      <div
                        key={t.id}
                        className={`p-2.5 rounded border text-xs transition-all ${
                          t.status === 'done'
                            ? 'bg-slate-950 border-emerald-800/40 text-slate-200'
                            : t.status === 'running'
                            ? 'bg-blue-950/40 border-blue-600/60 text-blue-200 animate-pulse'
                            : t.status === 'diagnosing'
                            ? 'bg-amber-950/40 border-amber-600/60 text-amber-200 animate-pulse'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-bold text-blue-400">{t.id}</span>
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                              t.status === 'done'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                : t.status === 'running'
                                ? 'bg-blue-900/60 text-blue-200'
                                : t.status === 'diagnosing'
                                ? 'bg-amber-900/60 text-amber-200'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div className="font-medium text-slate-100 text-xs mb-1.5">{t.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <FileCode className="w-3 h-3 text-slate-400" />
                          <span>index.html (3-col cards)</span>
                        </div>
                        {visualDiffDetected && (
                          <div className="mt-2 text-[10px] bg-rose-950/40 text-rose-300 border border-rose-800/40 p-1.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>Scope Leak: login.html collided with sidebar styles</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Lane Beta */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="font-mono font-bold text-xs text-emerald-400">Lane Beta</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    .forge/wt/beta
                  </span>
                </div>

                <div className="space-y-2">
                  {tasks
                    .filter((t) => t.lane === 'beta')
                    .map((t) => (
                      <div
                        key={t.id}
                        className={`p-2.5 rounded border text-xs transition-all ${
                          t.status === 'done'
                            ? 'bg-slate-950 border-emerald-800/40 text-slate-200'
                            : t.status === 'running'
                            ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200 animate-pulse'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-bold text-emerald-400">{t.id}</span>
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                              t.status === 'done'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div className="font-medium text-slate-100 text-xs mb-1.5">{t.title}</div>
                        {t.deps.length > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono mb-1">
                            deps: <span className="text-emerald-400">{t.deps.join(', ')}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {t.files?.join(', ')}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Lane Gamma */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span className="font-mono font-bold text-xs text-purple-400">Lane Gamma</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    .forge/wt/gamma
                  </span>
                </div>

                <div className="space-y-2">
                  {tasks
                    .filter((t) => t.lane === 'gamma')
                    .map((t) => (
                      <div
                        key={t.id}
                        className={`p-2.5 rounded border text-xs transition-all ${
                          t.status === 'done'
                            ? 'bg-slate-950 border-emerald-800/40 text-slate-200'
                            : t.status === 'running'
                            ? 'bg-purple-950/40 border-purple-600/60 text-purple-200 animate-pulse'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-bold text-purple-400">{t.id}</span>
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                              t.status === 'done'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div className="font-medium text-slate-100 text-xs mb-1.5">{t.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {t.files?.join(', ')}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Merge Gate Banner */}
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">Deterministic Merge Gate</h4>
                  <p className="text-xs text-slate-400">
                    Lanes merge via <code className="font-mono text-slate-300">git merge --no-ff --no-commit</code>, then run the full 6-layer contract stack before committing to main.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
                  Gate: L0-L5 All Green
                </span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Live App Preview (PlantWatch) */}
        {activeTab === 'preview' && (
          <div className="space-y-3 flex flex-col h-full">
            {/* Window Chrome / Browser Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full">
              <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] ml-2">
                    http://127.0.0.1:5173{previewRoute}
                  </span>
                </div>

                {/* Route Switcher */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
                  <button
                    onClick={() => setPreviewRoute('/dashboard')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      previewRoute === '/dashboard'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    /dashboard
                  </button>
                  <button
                    onClick={() => setPreviewRoute('/login')}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      previewRoute === '/login'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>/login</span>
                    {visualDiffDetected && (
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
                    )}
                  </button>
                </div>

                {/* Mode Switcher for visual diff checking */}
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  <button
                    onClick={() => setPreviewMode('current')}
                    className={`px-2 py-0.5 rounded ${
                      previewMode === 'current'
                        ? 'bg-slate-800 text-slate-100 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Current
                  </button>
                  <button
                    onClick={() => setPreviewMode('baseline')}
                    className={`px-2 py-0.5 rounded ${
                      previewMode === 'baseline'
                        ? 'bg-slate-800 text-slate-100 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Baseline v13
                  </button>
                  <button
                    onClick={() => setPreviewMode('regression')}
                    className={`px-2 py-0.5 rounded ${
                      previewMode === 'regression'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Regression
                  </button>
                  <button
                    onClick={() => setPreviewMode('split')}
                    className={`px-2 py-0.5 rounded ${
                      previewMode === 'split'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Diff Split
                  </button>
                </div>
              </div>

              {/* Visual Diff Alert Banner if regression is active on /login */}
              {previewRoute === '/login' && isCorruptedState && (
                <div className="bg-rose-950/70 border-b border-rose-800/60 px-4 py-2 flex items-center justify-between text-xs text-rose-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                    <span>
                      <strong className="font-semibold">L4 Visual Regression Caught:</strong> 87% match · Un-scoped CSS grid leaked from dashboard into <code className="font-mono bg-rose-900/60 px-1 py-0.2 rounded">.login-card.cards</code>!
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-rose-900/60 px-2 py-0.5 rounded border border-rose-700">
                    STATUS: REJECTED AT GATE
                  </span>
                </div>
              )}

              {/* Preview Window Canvas */}
              <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
                {previewRoute === '/dashboard' ? (
                  /* PlantWatch Dashboard Preview */
                  <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header bar */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                          <span>PlantWatch Industrial Monitor</span>
                          <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            LIVE TELEMETRY
                          </span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          Facility North Sector · Continuous vibration and pressure telemetry
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono text-slate-400">Layout Grid:</span>
                        <span className="ml-1.5 text-xs font-mono font-bold text-sky-400 bg-sky-950/60 px-2 py-1 rounded border border-sky-800/50">
                          {cardsColumns === 3 ? '3 Columns (Smaller Cards - Goal)' : '4 Columns (Baseline)'}
                        </span>
                      </div>
                    </div>

                    {/* Dashboard Metric Cards */}
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${cardsColumns}, minmax(0, 1fr))`,
                      }}
                    >
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-sm">
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Uptime</span>
                        <b className="text-2xl font-bold text-sky-400 font-mono block mt-1">98.2%</b>
                        <span className="text-[10px] text-emerald-400 mt-2 block">+0.4% from last 30d baseline</span>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-sm">
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Open Work Orders</span>
                        <b className="text-2xl font-bold text-amber-400 font-mono block mt-1">23</b>
                        <span className="text-[10px] text-slate-400 mt-2 block">4 scheduled for shift handover</span>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-sm">
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Critical Alerts</span>
                        <b className="text-2xl font-bold text-rose-400 font-mono block mt-1">3</b>
                        <span className="text-[10px] text-rose-400 mt-2 block">M-014 vibration threshold high</span>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-sm">
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">MTTR</span>
                        <b className="text-2xl font-bold text-indigo-400 font-mono block mt-1">4.1h</b>
                        <span className="text-[10px] text-slate-400 mt-2 block">Mean time to repair</span>
                      </div>
                    </div>

                    {/* Telemetry Machine Status Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                          Monitored Machines (api/machines.py)
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400">3 units connected</span>
                      </div>
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-950/60 text-slate-400 font-mono">
                          <tr>
                            <th className="px-4 py-2 font-medium">Machine ID</th>
                            <th className="px-4 py-2 font-medium">Unit Name</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-sky-400">M-014</td>
                            <td className="px-4 py-2.5 text-slate-200">Main Compressor Unit 1</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px]">
                                vibration high
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">Triaged</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-sky-400">M-022</td>
                            <td className="px-4 py-2.5 text-slate-200">Conveyor Belt Assembly B</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
                                scheduled pm
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">Due in 2h</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-bold text-sky-400">M-031</td>
                            <td className="px-4 py-2.5 text-slate-200">Cooling Pump Station C</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                                normal
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">Telemetry OK</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : previewMode === 'split' ? (
                  /* Interactive Split Diff Comparison */
                  <div className="flex flex-col items-center justify-center min-h-[380px] p-4 max-w-2xl mx-auto">
                    <div className="w-full flex items-center justify-between text-xs font-mono mb-2 text-slate-400">
                      <span className="text-emerald-400">Baseline v13 (Left {splitPos}%)</span>
                      <span className="text-rose-400">Mutated Worktree (Right {100 - splitPos}%)</span>
                    </div>

                    <div className="relative w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                      {/* Interactive Slider Input */}
                      <input
                        type="range"
                        min="10"
                        max="90"
                        value={splitPos}
                        onChange={(e) => setSplitPos(Number(e.target.value))}
                        className="w-full mb-4 accent-indigo-500 cursor-pointer"
                      />

                      <div className="grid grid-cols-2 gap-4">
                        {/* Left Side: Baseline */}
                        <div className="border border-emerald-600/40 bg-slate-900 p-4 rounded shadow">
                          <div className="text-[10px] font-mono text-emerald-400 mb-2 font-bold flex items-center justify-between">
                            <span>BASELINE v13</span>
                            <span>SHA: a4f8e91d</span>
                          </div>
                          <h1 className="text-lg font-bold text-white mb-2">PlantWatch</h1>
                          <div className="space-y-2">
                            <input disabled placeholder="username" className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-400" />
                            <input disabled type="password" placeholder="password" className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-400" />
                            <button disabled className="w-full py-1.5 bg-blue-600 text-white text-xs font-semibold rounded opacity-80">Sign In</button>
                          </div>
                        </div>

                        {/* Right Side: Corrupted with leaked classes */}
                        <div className="border border-rose-600/60 bg-slate-900 p-4 rounded shadow relative">
                          <div className="text-[10px] font-mono text-rose-400 mb-2 font-bold flex items-center justify-between">
                            <span>CORRUPTED (WORKTREE ALPHA)</span>
                            <span>SHA: e93bc019</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 mb-2 p-1 bg-rose-950/40 border border-rose-800/40 rounded text-[9px] text-rose-300 font-mono">
                            <span>.sidebar</span>
                            <span>.cards</span>
                          </div>
                          <h1 className="text-lg font-bold text-white mb-2">PlantWatch Sign In</h1>
                          <div className="space-y-2">
                            <input disabled placeholder="username" className="w-full bg-slate-950 border border-rose-700/60 rounded px-2 py-1 text-xs text-slate-400" />
                            <input disabled type="password" placeholder="password" className="w-full bg-slate-950 border border-rose-700/60 rounded px-2 py-1 text-xs text-slate-400" />
                            <button disabled className="w-full py-1.5 bg-rose-700 text-white text-xs font-semibold rounded opacity-80">Sign In (Broken)</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* PlantWatch Login Screen (Subject of Visual Diff L4) */
                  <div className="flex items-center justify-center min-h-[380px] p-4">
                    {isCorruptedState ? (
                      /* Corrupted State (Regression) */
                      <div className="relative border-2 border-rose-500/70 p-6 rounded-lg bg-slate-900/90 w-full max-w-sm shadow-2xl">
                        <div className="absolute -top-3 left-4 bg-rose-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow">
                          REGRESSION: .cards CLASS COLLISION
                        </div>
                        {/* Leaked cards grid inside login */}
                        <div className="grid grid-cols-2 gap-2 mb-4 p-2 bg-rose-950/30 border border-rose-800/40 rounded">
                          <span className="text-[10px] text-rose-300 font-mono">grid-column leak</span>
                          <span className="text-[10px] text-rose-300 font-mono">broken padding</span>
                        </div>
                        <h1 className="text-xl font-bold text-white mb-3">PlantWatch Sign In</h1>
                        <div className="space-y-3">
                          <input
                            disabled
                            placeholder="username"
                            className="w-full bg-slate-950 border border-rose-600/50 rounded px-3 py-2 text-xs text-slate-200"
                          />
                          <input
                            disabled
                            type="password"
                            placeholder="password"
                            className="w-full bg-slate-950 border border-rose-600/50 rounded px-3 py-2 text-xs text-slate-200"
                          />
                          <button
                            disabled
                            className="w-full py-2 bg-rose-700 text-white text-xs font-bold rounded"
                          >
                            Sign In (Corrupted CSS)
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Good / Clean Baseline State */
                      <div className="border border-slate-800 p-6 rounded-lg bg-slate-900 w-full max-w-sm shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                          <h1 className="text-xl font-bold text-white">PlantWatch</h1>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                            Baseline v13 Validated
                          </span>
                        </div>
                        <div className="space-y-3">
                          <input
                            placeholder="username"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="password"
                            placeholder="password"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                          />
                          <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded transition-colors shadow">
                            Sign In
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: Evidence Bundle Explorer */}
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Evidence Artifacts (.forge/evidence/)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every diagnose or judge invocation consumes concrete, machine-generated artifacts instead of hallucinations.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                {evidenceFiles.length} Artifacts Collected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Artifact List */}
              <div className="md:col-span-1 space-y-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Artifact Files
                </span>
                {evidenceFiles.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedEvidenceName(file.name)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex flex-col gap-1 ${
                      selectedEvidenceName === file.name
                        ? 'bg-amber-950/30 border-amber-600/50 text-amber-200'
                        : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono font-semibold text-xs">
                      <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1">{file.description}</span>
                  </button>
                ))}
              </div>

              {/* Artifact Content Viewer */}
              <div className="md:col-span-3 bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-amber-400">
                      {selectedEvidence.path}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {selectedEvidence.type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{selectedEvidence.description}</span>
                </div>

                <pre className="flex-1 bg-slate-950 p-3 rounded font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800/80 whitespace-pre-wrap">
                  {selectedEvidence.content}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: Source Code & Test Suite Runner */}
        {activeTab === 'code' && (
          <div className="space-y-4">
            {/* Test Suite Banner */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Forge Test Suite: 8/8 Tests Passed (1.52s)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Verifying DAG topological order, coder model isolation from judge role, snapshot/restore, and autonomous e2e regression catch.
                    </p>
                  </div>
                </div>

                <button
                  onClick={runAllTestsAnimated}
                  disabled={testRunnerState === 'running'}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testRunnerState === 'running' ? 'animate-spin' : ''}`} />
                  <span>{testRunnerState === 'running' ? 'Executing Test Runner...' : 'Re-Run All 8 Tests'}</span>
                </button>
              </div>

              {/* Test List Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                {TEST_SUITE_DETAILS.map((test, idx) => {
                  const isDone = testRunnerState === 'done' || idx < activeRunningTestIdx;
                  const isCurrentRunning = testRunnerState === 'running' && idx === activeRunningTestIdx;

                  return (
                    <div
                      key={test.name}
                      className={`p-2 rounded border flex items-center justify-between transition-all ${
                        isCurrentRunning
                          ? 'bg-blue-950/40 border-blue-500 text-blue-200'
                          : isDone
                          ? 'bg-slate-950 border-slate-800/80 text-slate-200'
                          : 'bg-slate-950/40 border-slate-800/40 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isDone ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : isCurrentRunning ? (
                          <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0 inline-block"></span>
                        )}
                        <div className="truncate">
                          <span className="font-semibold">{test.name}</span>
                          <span className="text-[10px] text-slate-400 block truncate">{test.desc}</span>
                        </div>
                      </div>
                      <span className="text-emerald-400 text-[10px] ml-2 shrink-0">{test.timing}</span>
                    </div>
                  );
                })}
              </div>

              {/* Live stdout log drawer */}
              <div className="mt-3 p-2 bg-slate-950 rounded border border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3 h-3 text-slate-400" />
                  <span>python3 -m unittest discover -s tests -v · Ran 8 tests in 1.525s · OK</span>
                </div>
                <span className="text-emerald-400 font-bold">100% PASS</span>
              </div>
            </div>

            {/* Code Viewer */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  <span className="font-mono font-bold text-slate-200">{selectedFile}</span>
                  <span className="text-slate-400 text-xs hidden sm:inline">
                    — {currentFileContent.desc}
                  </span>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {currentFileContent.lang}
                </span>
              </div>

              <pre className="p-4 bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto max-h-[420px] whitespace-pre">
                {currentFileContent.code}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
