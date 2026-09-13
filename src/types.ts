export type TaskKind = 'architect' | 'code' | 'migrate' | 'debug' | 'judge' | 'fast';

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'diagnosing';

export interface Task {
  id: string;
  title: string;
  lane: 'alpha' | 'beta' | 'gamma';
  kind: TaskKind;
  deps: string[];
  status: TaskStatus;
  note?: string;
  files?: string[];
  assignedModel?: string;
  worktreePath?: string;
}

export type ContractLayer = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type ContractStatus = 'pending' | 'pass' | 'fail' | 'skip';

export interface ContractResult {
  layer: ContractLayer;
  name: string;
  status: ContractStatus;
  detail: string;
  command?: string;
  evidence?: string;
}

export interface Checkpoint {
  id: number;
  label: string;
  timestamp: string;
  gitTag: string;
  stateSnapshot: {
    cardsColumns: number;
    loginCorrupted: boolean;
    activeLanes: string[];
    contractVerdict: boolean;
  };
}

export interface EventLog {
  id: string;
  ts: string;
  type: string;
  icon: string;
  msg: string;
  lane?: string;
  layer?: string;
  model?: string;
  data?: Record<string, unknown>;
}

export interface ModelInfo {
  name: string;
  params: number;
  sizeMB: number;
  primaryClass: string;
  capabilities: {
    architect: number;
    code: number;
    migrate: number;
    debug: number;
    judge: number;
    fast: number;
  };
  isCoder: boolean;
  activeTask?: string;
}

export interface EvidenceFile {
  name: string;
  path: string;
  description: string;
  content: string;
  type: 'text' | 'diff' | 'json';
}

export type Phase = 'idle' | 'plan' | 'build' | 'verify' | 'diagnose' | 'merge' | 'done' | 'failed';

export interface KnowledgeSymbol {
  name: string;
  kind: 'function' | 'class' | 'table' | 'route' | 'style';
  file: string;
  line: number;
  description: string;
}
