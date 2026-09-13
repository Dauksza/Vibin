import React, { useState } from 'react';
import { FolderTree, FileCode, Search, Box, ChevronRight, ChevronDown, Check, Layers, AlertTriangle } from 'lucide-react';
import { KNOWLEDGE_SYMBOLS, PLANTWATCH_FILES, FORGE_SOURCE_FILES } from '../data/forgeData';

interface LeftSidebarProps {
  selectedFile: string;
  onSelectFile: (fileName: string) => void;
  visualDiffDetected: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  selectedFile,
  onSelectFile,
  visualDiffDetected,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'knowledge' | 'registry'>('files');
  const [searchQuery, setSearchQuery] = useState('where is auth handled');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    plantwatch: true,
    forge: true,
    api: true,
    db: true,
    tests: true,
  });

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter knowledge symbols based on query
  const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const scoredSymbols = KNOWLEDGE_SYMBOLS.map((sym) => {
    let score = 0;
    const combined = `${sym.name} ${sym.file} ${sym.description}`.toLowerCase();
    terms.forEach((t) => {
      if (sym.name.toLowerCase().includes(t)) score += 5;
      if (sym.file.toLowerCase().includes(t)) score += 3;
      if (sym.description.toLowerCase().includes(t)) score += 2;
    });
    return { ...sym, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col h-full shrink-0 select-none">
      {/* Sidebar Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs bg-slate-950/70 p-1">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 font-medium transition-colors ${
            activeTab === 'files'
              ? 'bg-slate-800 text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Files</span>
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 font-medium transition-colors ${
            activeTab === 'knowledge'
              ? 'bg-slate-800 text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Graph</span>
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 font-medium transition-colors ${
            activeTab === 'registry'
              ? 'bg-slate-800 text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Registry</span>
        </button>
      </div>

      {/* Tab 1: File Tree */}
      {activeTab === 'files' && (
        <div className="flex-1 overflow-y-auto p-2 text-xs font-mono">
          {/* PlantWatch Project Files */}
          <div className="mb-3">
            <div
              onClick={() => toggleFolder('plantwatch')}
              className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-slate-200 cursor-pointer font-sans font-semibold text-[11px] uppercase tracking-wider"
            >
              {expandedFolders.plantwatch ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Workspace: PlantWatch</span>
            </div>

            {expandedFolders.plantwatch && (
              <div className="ml-2 pl-2 border-l border-slate-800/80 space-y-0.5 mt-1">
                {/* index.html */}
                <button
                  onClick={() => onSelectFile('index.html')}
                  className={`w-full text-left px-2 py-1 rounded flex items-center justify-between group transition-colors ${
                    selectedFile === 'index.html'
                      ? 'bg-blue-600/20 text-blue-300 font-medium'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="truncate">index.html</span>
                  </div>
                  <span className="text-[10px] text-slate-400 opacity-60 group-hover:opacity-100">dashboard</span>
                </button>

                {/* login.html */}
                <button
                  onClick={() => onSelectFile('login.html')}
                  className={`w-full text-left px-2 py-1 rounded flex items-center justify-between group transition-colors ${
                    selectedFile === 'login.html'
                      ? 'bg-blue-600/20 text-blue-300 font-medium'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">login.html</span>
                  </div>
                  {visualDiffDetected ? (
                    <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      diff 87%
                    </span>
                  ) : (
                    <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">watch</span>
                  )}
                </button>

                {/* api/ folder */}
                <div>
                  <div
                    onClick={() => toggleFolder('api')}
                    className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-slate-300 cursor-pointer"
                  >
                    {expandedFolders.api ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="text-slate-400">api/</span>
                  </div>
                  {expandedFolders.api && (
                    <div className="ml-3 pl-2 border-l border-slate-800 space-y-0.5">
                      <button
                        onClick={() => onSelectFile('api/machines.py')}
                        className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 truncate transition-colors ${
                          selectedFile === 'api/machines.py'
                            ? 'bg-blue-600/20 text-blue-300 font-medium'
                            : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">machines.py</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* db/ folder */}
                <div>
                  <div
                    onClick={() => toggleFolder('db')}
                    className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-slate-300 cursor-pointer"
                  >
                    {expandedFolders.db ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="text-slate-400">db/</span>
                  </div>
                  {expandedFolders.db && (
                    <div className="ml-3 pl-2 border-l border-slate-800 space-y-0.5">
                      <button
                        onClick={() => onSelectFile('db/migration_003.sql')}
                        className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 truncate transition-colors ${
                          selectedFile === 'db/migration_003.sql'
                            ? 'bg-blue-600/20 text-blue-300 font-medium'
                            : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">migration_003.sql</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* tests/ folder */}
                <div>
                  <div
                    onClick={() => toggleFolder('tests')}
                    className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-slate-300 cursor-pointer"
                  >
                    {expandedFolders.tests ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="text-slate-400">tests/</span>
                  </div>
                  {expandedFolders.tests && (
                    <div className="ml-3 pl-2 border-l border-slate-800 space-y-0.5">
                      <button
                        onClick={() => onSelectFile('tests/test_api.py')}
                        className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 truncate transition-colors ${
                          selectedFile === 'tests/test_api.py'
                            ? 'bg-blue-600/20 text-blue-300 font-medium'
                            : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">test_api.py</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* forge.json manifest */}
                <button
                  onClick={() => onSelectFile('forge.json')}
                  className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 truncate transition-colors ${
                    selectedFile === 'forge.json'
                      ? 'bg-blue-600/20 text-blue-300 font-medium'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span className="truncate">forge.json</span>
                </button>
              </div>
            )}
          </div>

          {/* Forge Control Plane Core Files */}
          <div>
            <div
              onClick={() => toggleFolder('forge')}
              className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-slate-200 cursor-pointer font-sans font-semibold text-[11px] uppercase tracking-wider"
            >
              {expandedFolders.forge ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Forge Control Plane (Python)</span>
            </div>

            {expandedFolders.forge && (
              <div className="ml-2 pl-2 border-l border-slate-800/80 space-y-0.5 mt-1">
                {Object.keys(FORGE_SOURCE_FILES).map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => onSelectFile(fileName)}
                    className={`w-full text-left px-2 py-1 rounded flex items-center justify-between group transition-colors ${
                      selectedFile === fileName
                        ? 'bg-emerald-600/20 text-emerald-300 font-medium'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{fileName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 opacity-60">core</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Knowledge Graph Query */}
      {activeTab === 'knowledge' && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
              Knowledge Graph Query
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. where is auth handled"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Command: <code className="font-mono text-slate-300">forge ask &quot;{searchQuery}&quot;</code>
            </p>
          </div>

          <div className="flex-1 space-y-2">
            <span className="text-[11px] font-medium text-slate-400">Ranked Results ({scoredSymbols.length}):</span>
            {scoredSymbols.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-2">No symbols matching terms.</p>
            ) : (
              scoredSymbols.map((item) => (
                <div
                  key={item.name}
                  onClick={() => onSelectFile(item.file)}
                  className="p-2 rounded bg-slate-950 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-xs text-sky-400">{item.name}</span>
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                      score: {item.score}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mb-1">{item.description}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                    <FileCode className="w-3 h-3 text-slate-400" />
                    <span>{item.file}:{item.line}</span>
                    <span className="text-slate-400">({item.kind})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Component Registry & Token Contracts */}
      {activeTab === 'registry' && (
        <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
            <h4 className="font-medium text-slate-200 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Design Token Contracts</span>
            </h4>
            <p className="text-[11px] text-slate-400 mb-2">
              Enforced by L0 lint rules and L4 visual diff checks.
            </p>
            <div className="space-y-1 text-[11px] font-mono">
              <div className="flex justify-between py-0.5 border-b border-slate-900">
                <span className="text-slate-400">--cards-gap:</span>
                <span className="text-slate-200">16px</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-900">
                <span className="text-slate-400">--sidebar-width:</span>
                <span className="text-slate-200">220px</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-900">
                <span className="text-slate-400">--card-border-radius:</span>
                <span className="text-slate-200">8px</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">--primary-accent:</span>
                <span className="text-sky-400">#38bdf8</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded bg-amber-950/20 border border-amber-800/40 text-amber-200">
            <h4 className="font-medium text-amber-300 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Visual Regression Watchlist</span>
            </h4>
            <p className="text-[11px] text-slate-300 mb-2">
              Files in <code className="font-mono text-amber-200">manifest.visual.watch</code> must not exhibit un-scoped style mutations.
            </p>
            <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3 h-3" />
                <span>login.html (strict_equality)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
