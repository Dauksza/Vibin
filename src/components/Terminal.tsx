import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Filter, Copy, Check, Trash2, ArrowDown } from 'lucide-react';
import { EventLog } from '../types';

interface TerminalProps {
  logs: EventLog[];
  onClearLogs: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<'all' | 'dag' | 'contract' | 'model' | 'diagnose'>('all');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'dag') return log.type.includes('dag') || log.type.includes('task');
    if (filter === 'contract') return log.type.includes('contract') || log.type.includes('verify') || log.type.includes('layer');
    if (filter === 'model') return log.type.includes('model') || log.type.includes('router');
    if (filter === 'diagnose') return log.type.includes('diagnose') || log.type.includes('fix') || log.type.includes('evidence');
    return true;
  });

  const copyLogs = () => {
    const text = logs.map((l) => `[${l.ts}] ${l.icon} ${l.msg}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-56 border-t border-slate-800 bg-slate-950 flex flex-col shrink-0 select-none">
      {/* Terminal Titlebar */}
      <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono font-semibold text-slate-200 text-xs">Forge Event Bus</span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
            {filteredLogs.length} events
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <span className="text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span className="hidden sm:inline">Filter:</span>
          </span>
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded ${
              filter === 'all'
                ? 'bg-slate-800 text-slate-100 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('dag')}
            className={`px-2 py-0.5 rounded ${
              filter === 'dag'
                ? 'bg-slate-800 text-slate-100 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DAG/Tasks
          </button>
          <button
            onClick={() => setFilter('contract')}
            className={`px-2 py-0.5 rounded ${
              filter === 'contract'
                ? 'bg-slate-800 text-slate-100 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Contracts
          </button>
          <button
            onClick={() => setFilter('model')}
            className={`px-2 py-0.5 rounded ${
              filter === 'model'
                ? 'bg-slate-800 text-slate-100 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Models
          </button>
          <button
            onClick={() => setFilter('diagnose')}
            className={`px-2 py-0.5 rounded ${
              filter === 'diagnose'
                ? 'bg-slate-800 text-slate-100 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Diagnose
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[11px] font-mono flex items-center gap-1 px-1.5 py-0.5 rounded ${
              autoScroll ? 'text-emerald-400 bg-emerald-950/40' : 'text-slate-400'
            }`}
            title="Toggle autoscroll"
          >
            <ArrowDown className="w-3 h-3" />
            <span className="hidden sm:inline">Auto</span>
          </button>

          <button
            onClick={copyLogs}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClearLogs}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Log Stream */}
      <div className="flex-1 p-2 font-mono text-xs overflow-y-auto space-y-1 bg-slate-950">
        {filteredLogs.map((log) => {
          let colorClass = 'text-slate-300';
          if (log.msg.includes('red') || log.msg.includes('fail') || log.icon === '⚠') {
            colorClass = 'text-rose-400 font-semibold';
          } else if (log.msg.includes('green') || log.msg.includes('pass') || log.icon === '✓' || log.icon === '●') {
            colorClass = 'text-emerald-300';
          } else if (log.icon === '⚕') {
            colorClass = 'text-amber-300';
          } else if (log.icon === '⇒') {
            colorClass = 'text-sky-300';
          } else if (log.icon === '⇄') {
            colorClass = 'text-purple-300';
          }

          return (
            <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/50 px-1 py-0.5 rounded">
              <span className="text-slate-500 text-[10px] shrink-0">{log.ts}</span>
              <span className="font-bold shrink-0">{log.icon}</span>
              <span className={`break-all ${colorClass}`}>{log.msg}</span>
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
