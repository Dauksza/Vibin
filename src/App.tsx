import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterStage } from './components/CenterStage';
import { RightSidebar } from './components/RightSidebar';
import { Terminal } from './components/Terminal';
import { ControlBar } from './components/ControlBar';
import { Phase, Task, ContractResult, EventLog, Checkpoint, EvidenceFile } from './types';
import {
  INITIAL_TASKS,
  INITIAL_CONTRACTS,
  MODEL_REGISTRY,
  INITIAL_EVIDENCE,
} from './data/forgeData';

export default function App() {
  // Global State
  const [prompt, setPrompt] = useState('make the dashboard cards smaller');
  const [currentPhase, setCurrentPhase] = useState<Phase>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [injectRegression, setInjectRegression] = useState(true);

  // Center stage & navigation
  const [activeTab, setActiveTab] = useState<'dag' | 'preview' | 'evidence' | 'code'>('dag');
  const [selectedFile, setSelectedFile] = useState('forge/statemachine.py');

  // Application / PlantWatch state
  const [cardsColumns, setCardsColumns] = useState<number>(4); // 4 = baseline, 3 = target
  const [loginCorrupted, setLoginCorrupted] = useState<boolean>(false);
  const [visualDiffDetected, setVisualDiffDetected] = useState<boolean>(false);
  const [diagnoseRounds, setDiagnoseRounds] = useState<number>(0);
  const [tokensUsed, setTokensUsed] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Entities state
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [contracts, setContracts] = useState<ContractResult[]>(INITIAL_CONTRACTS);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>(INITIAL_EVIDENCE);

  // Git Checkpoints
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([
    {
      id: 1,
      label: 'pre-run (baseline)',
      timestamp: '06:55:00',
      gitTag: 'forge/ck-1',
      stateSnapshot: {
        cardsColumns: 4,
        loginCorrupted: false,
        activeLanes: [],
        contractVerdict: true,
      },
    },
  ]);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<number>(1);

  // Event bus streaming logs
  const [logs, setLogs] = useState<EventLog[]>([
    {
      id: 'log-0',
      ts: '06:55:01',
      type: 'system',
      icon: '▶',
      msg: 'Forge control plane initialized with root=/tmp/plantwatch',
    },
    {
      id: 'log-1',
      ts: '06:55:01',
      type: 'realm',
      icon: '⇄',
      msg: 'FileRealm snapshot created: checkpoint #1 (pre-run)',
    },
    {
      id: 'log-2',
      ts: '06:55:02',
      type: 'router',
      icon: '⇒',
      msg: 'Discovered 4 local models via Ollama: qwen3-coder:30b, deepseek-r1:14b, llama3.3:70b, phi4-mini:3.8b',
    },
  ]);

  const addLog = (icon: string, msg: string, type = 'general') => {
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random()}`,
        ts,
        type,
        icon,
        msg,
      },
    ]);
  };

  // Timer effect for elapsed seconds
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000 / speed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, speed]);

  // State machine step runner
  const stepRef = useRef<number>(0);

  const executeTransition = () => {
    const step = stepRef.current;

    // STEP 0: Plan phase
    if (step === 0) {
      setCurrentPhase('plan');
      addLog('◇', `plan requested for prompt: "${prompt}"`, 'plan');
      addLog('⇒', 'router selected deepseek-r1:14b for task decomposition (score: 96)', 'model');
      setTokensUsed((prev) => prev + 4100);
      stepRef.current = 1;
      return;
    }

    // STEP 1: Plan completion -> Build worktrees spawn
    if (step === 1) {
      setCurrentPhase('build');
      addLog('✓', 'plan validated: generated 4 tasks across 3 topological lanes', 'dag');
      addLog('⇄', 'spawning isolated worktrees: .forge/wt/alpha, .forge/wt/beta, .forge/wt/gamma', 'realm');

      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          status: 'running',
        }))
      );
      setTokensUsed((prev) => prev + 12800);
      stepRef.current = 2;
      return;
    }

    // STEP 2: Implementation complete across parallel lanes
    if (step === 2) {
      addLog('✓', 'Lane Alpha: restyle sidebar + 3-column cards committed (qwen3-coder:30b)', 'dag');
      addLog('✓', 'Lane Beta: migration_003.sql composite index created (qwen3-coder:30b)', 'dag');
      addLog('✓', 'Lane Beta: seed.py backfilled 50 maintenance events (qwen3-coder:30b)', 'dag');
      addLog('✓', 'Lane Gamma: api/machines.py + test_api.py committed (qwen3-coder:30b)', 'dag');

      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          status: 'done',
        }))
      );

      // Apply UI changes: cards to 3 columns
      setCardsColumns(3);

      if (injectRegression) {
        setLoginCorrupted(true);
        addLog('⚠', 'Worktree Alpha injected unexpected style cascade into login.html', 'build');
      }

      setTokensUsed((prev) => prev + 15400);
      stepRef.current = 3;
      return;
    }

    // STEP 3: Merge lane attempt & Contract Stack execution
    if (step === 3) {
      setCurrentPhase('verify');
      setActiveTab('preview');
      addLog('▸', 'Merging Lane Alpha into main branch (--no-ff --no-commit)...', 'merge');
      addLog('◆', 'Evaluating 6-layer verification contract stack...', 'contract');

      // L0, L1, L2, L3 pass
      setContracts((prev) =>
        prev.map((c) => {
          if (c.layer === 'L0' || c.layer === 'L1' || c.layer === 'L2' || c.layer === 'L3') {
            return { ...c, status: 'pass' };
          }
          return c;
        })
      );
      addLog('✓', 'L0 (build/typecheck) pass — python compileall ok', 'contract');
      addLog('✓', 'L1 (unit/property) pass — 8/8 tests pass', 'contract');
      addLog('✓', 'L2 (api contract) pass — machines schema validated', 'contract');
      addLog('✓', 'L3 (browser headless) pass — DOM nodes rendered', 'contract');

      if (injectRegression) {
        // L4 and L5 fail!
        setTimeout(() => {
          setContracts((prev) =>
            prev.map((c) => {
              if (c.layer === 'L4') {
                return {
                  ...c,
                  status: 'fail',
                  detail: 'unexpected change: login.html (hash mismatch: expected a4f8e91d, received e93bc019)',
                };
              }
              if (c.layer === 'L5') {
                return {
                  ...c,
                  status: 'fail',
                  detail: 'reject (judge saw failed layer L4: fail-closed evaluation)',
                };
              }
              return c;
            })
          );
          setVisualDiffDetected(true);
          addLog('⚠', 'L4 (visual diff) FAIL — unexpected change: login.html (87% match vs baseline)', 'contract');
          addLog('⚠', 'L5 (judge) REJECT — independent model deepseek-r1:14b rejected merge (fail-closed)', 'contract');
          addLog('■', 'Contract stack verdict: RED. Merge aborted immediately.', 'merge');
          stepRef.current = 4;
        }, 500 / speed);
      } else {
        // Clean run: L4 and L5 pass!
        setTimeout(() => {
          setContracts((prev) =>
            prev.map((c) => ({
              ...c,
              status: 'pass',
              detail: c.layer === 'L4' ? '100.0% scoped match (hash verified)' : 'accept (judge approved all layers)',
            }))
          );
          addLog('✓', 'L4 (visual diff) pass — 100.0% match against baseline', 'contract');
          addLog('✓', 'L5 (judge) pass — deepseek-r1:14b approved clean merge', 'contract');
          stepRef.current = 6; // jump to clean merge
        }, 500 / speed);
      }
      return;
    }

    // STEP 4: Autonomous Diagnosis Intervention
    if (step === 4) {
      setCurrentPhase('diagnose');
      setActiveTab('evidence');
      setDiagnoseRounds(1);
      addLog('⚕', 'Autonomous diagnostician triggered: round 1/3', 'diagnose');
      addLog('▣', 'Gathered evidence bundle: failing-layers.txt, diff-stat.txt, round-note.txt', 'evidence');
      addLog('⇒', 'Dispatched deepseek-r1:14b with evidence bundle (no coder model self-grading)', 'model');

      setTasks((prev) =>
        prev.map((t) => (t.id === 't_a1' ? { ...t, status: 'diagnosing' } : t))
      );

      setTokensUsed((prev) => prev + 5800);
      stepRef.current = 5;
      return;
    }

    // STEP 5: Fix Applied & Re-verification
    if (step === 5) {
      addLog('✓', 'Diagnostician applied surgical fix to worktree alpha: purged leaked .sidebar .cards classes from login.html', 'diagnose');
      addLog('⇄', 'Worktree alpha re-committed: "forge: diagnose round 1"', 'realm');
      addLog('▸', 'Re-attempting merge into main behind contract gate...', 'merge');

      // Purge regression
      setLoginCorrupted(false);
      setVisualDiffDetected(false);

      // Re-run contracts: all pass!
      setContracts((prev) =>
        prev.map((c) => ({
          ...c,
          status: 'pass',
          detail: c.layer === 'L4' ? '100.0% scoped match (baseline restored)' : c.layer === 'L5' ? 'accept (judge verified clean contract stack)' : c.detail,
        }))
      );

      addLog('✓', 'L4 (visual diff) pass — login.html restored to baseline SHA-256', 'contract');
      addLog('✓', 'L5 (judge) pass — fail-closed judge approved diagnosis resolution', 'contract');
      addLog('●', 'All 6 layers GREEN. Finishing merge commit on main branch...', 'merge');

      setTasks((prev) =>
        prev.map((t) => ({ ...t, status: 'done' }))
      );

      stepRef.current = 6;
      return;
    }

    // STEP 6: Merge Complete & Post-Run Snapshot
    if (step === 6) {
      setCurrentPhase('merge');
      addLog('●', 'Merged Lane Alpha, Lane Beta, and Lane Gamma cleanly into main', 'merge');
      addLog('⇄', 'Cleaning up temporary worktree directories: .forge/wt/*', 'realm');

      const nextCk = currentCheckpoint + 1;
      setCurrentCheckpoint(nextCk);
      setCheckpoints((prev) => [
        ...prev,
        {
          id: nextCk,
          label: 'post-run (verified green)',
          timestamp: '06:55:42',
          gitTag: `forge/ck-${nextCk}`,
          stateSnapshot: {
            cardsColumns: 3,
            loginCorrupted: false,
            activeLanes: ['alpha', 'beta', 'gamma'],
            contractVerdict: true,
          },
        },
      ]);

      addLog('⇄', `FileRealm snapshot created: checkpoint #${nextCk} (post-run)`, 'realm');
      stepRef.current = 7;
      return;
    }

    // STEP 7: Final state: Done
    if (step === 7) {
      setCurrentPhase('done');
      setIsRunning(false);
      addLog('■', 'Deterministic loop completed successfully. Verification gate: 100% GREEN.', 'system');
      stepRef.current = 8;
    }
  };

  // Run loop effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && currentPhase !== 'done' && currentPhase !== 'failed') {
      interval = setInterval(() => {
        executeTransition();
      }, 1400 / speed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, currentPhase, speed, injectRegression]);

  // User Action Handlers
  const handleRun = () => {
    if (currentPhase === 'idle' || currentPhase === 'done') {
      stepRef.current = 0;
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStep = () => {
    setIsRunning(false);
    executeTransition();
  };

  const handleReset = () => {
    setIsRunning(false);
    stepRef.current = 0;
    setCurrentPhase('idle');
    setCardsColumns(4);
    setLoginCorrupted(false);
    setVisualDiffDetected(false);
    setDiagnoseRounds(0);
    setTokensUsed(0);
    setElapsedSeconds(0);
    setTasks(INITIAL_TASKS);
    setContracts(INITIAL_CONTRACTS);
    setCurrentCheckpoint(1);
    addLog('⇄', 'Rewound to Checkpoint #1: git reset --hard forge/ck-1 && git clean -fd', 'realm');
  };

  const handleRewind = (checkpointId: number) => {
    const ck = checkpoints.find((c) => c.id === checkpointId);
    if (!ck) return;

    setIsRunning(false);
    setCurrentCheckpoint(checkpointId);
    setCardsColumns(ck.stateSnapshot.cardsColumns);
    setLoginCorrupted(ck.stateSnapshot.loginCorrupted);
    setVisualDiffDetected(ck.stateSnapshot.loginCorrupted);
    setCurrentPhase(checkpointId === 1 ? 'idle' : 'done');

    if (checkpointId === 1) {
      stepRef.current = 0;
      setContracts(INITIAL_CONTRACTS);
      setTasks(INITIAL_TASKS);
    }

    addLog('⇄', `Time-travel rewind to checkpoint #${checkpointId} (${ck.label}): git reset --hard ${ck.gitTag}`, 'realm');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. Header with Realms, Stepper & Telemetry */}
      <Header
        currentPhase={currentPhase}
        tokensUsed={tokensUsed}
        elapsedSeconds={elapsedSeconds}
        diagnoseRounds={diagnoseRounds}
        currentCheckpoint={currentCheckpoint}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: File Tree, Knowledge Graph & Component Registry */}
        <LeftSidebar
          selectedFile={selectedFile}
          onSelectFile={(f) => {
            setSelectedFile(f);
            setActiveTab('code');
          }}
          visualDiffDetected={visualDiffDetected}
        />

        {/* Center Stage: DAG, PlantWatch Preview, Evidence Explorer, Code Viewer */}
        <CenterStage
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tasks={tasks}
          evidenceFiles={evidenceFiles}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          cardsColumns={cardsColumns}
          loginCorrupted={loginCorrupted}
          visualDiffDetected={visualDiffDetected}
          diagnoseRounds={diagnoseRounds}
        />

        {/* Right Sidebar: 6-Layer Contract Stack, Model Router & Time-Travel Rewind */}
        <RightSidebar
          contracts={contracts}
          models={MODEL_REGISTRY}
          checkpoints={checkpoints}
          currentCheckpoint={currentCheckpoint}
          onRewind={handleRewind}
          onSelectContractEvidence={() => {
            setActiveTab('evidence');
          }}
        />
      </div>

      {/* 3. Event Bus Terminal */}
      <Terminal logs={logs} onClearLogs={() => setLogs([])} />

      {/* 4. Control Bar */}
      <ControlBar
        prompt={prompt}
        onPromptChange={setPrompt}
        onRun={handleRun}
        onPause={handlePause}
        onStep={handleStep}
        onReset={handleReset}
        isRunning={isRunning}
        currentPhase={currentPhase}
        injectRegression={injectRegression}
        onToggleRegression={setInjectRegression}
        speed={speed}
        onSpeedChange={setSpeed}
      />
    </div>
  );
}
