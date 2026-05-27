"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Link2, Sparkles, RefreshCw, ZoomIn, Network } from "lucide-react";
import { Task, Note } from "@/types";
import { buildKnowledgeGraph, suggestLinksForNote, suggestLinksForTask, HybridSearchResult } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface KnowledgeGraphProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  notes: Note[];
  onOpenItem: (type: 'task' | 'note', id: string) => void;
  onLinkItems: (fromType: 'task' | 'note', fromId: string, toType: 'task' | 'note', toId: string) => void;
  initialFocusId?: string | null;
}

export function KnowledgeGraph({
  open,
  onClose,
  tasks,
  notes,
  onOpenItem,
  onLinkItems,
  initialFocusId,
}: KnowledgeGraphProps) {
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState<string | null>(initialFocusId || null);
  const [showOnlyLinked, setShowOnlyLinked] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'task' | 'note'>('all');

  const { nodes, edges } = useMemo(() => buildKnowledgeGraph(tasks, notes), [tasks, notes]);

  const filteredNodes = useMemo(() => {
    let res = nodes;
    if (query.trim()) {
      const q = query.toLowerCase();
      res = res.filter(n => n.title.toLowerCase().includes(q));
    }
    if (filterType !== 'all') res = res.filter(n => n.type === filterType);
    if (showOnlyLinked) res = res.filter(n => n.linkCount > 0);
    return res;
  }, [nodes, query, filterType, showOnlyLinked]);

  const focusNode = useMemo(() => nodes.find(n => n.id === focusId), [nodes, focusId]);
  const connectedIds = useMemo(() => {
    if (!focusId) return new Set<string>();
    const s = new Set<string>();
    edges.forEach(e => {
      if (e.source === focusId) s.add(e.target);
      if (e.target === focusId) s.add(e.source);
    });
    return s;
  }, [edges, focusId]);

  const suggestions = useMemo(() => {
    if (!focusNode) return [];
    if (focusNode.type === 'note') {
      const note = notes.find(n => n.id === focusNode.id);
      if (note) return suggestLinksForNote(note, tasks, 4);
    } else {
      const task = tasks.find(t => t.id === focusNode.id);
      if (task) return suggestLinksForTask(task, notes, 4);
    }
    return [];
  }, [focusNode, tasks, notes]);

  const handleNodeClick = (id: string) => {
    setFocusId(id === focusId ? null : id);
  };

  const handleSuggestLink = (targetId: string, targetType: 'task' | 'note') => {
    if (!focusNode) return;
    onLinkItems(focusNode.type, focusNode.id, targetType, targetId);
  };

  const handleRefresh = () => {
    setQuery("");
    setFocusId(null);
    setShowOnlyLinked(false);
    setFilterType('all');
  };

  // Simple delightful layout: 2-col grid for nodes, SVG lines for direct edges (computed positions)
  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const cols = 5;
    filteredNodes.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      pos[n.id] = { x: 60 + col * 130, y: 80 + row * 78 };
    });
    return pos;
  }, [filteredNodes]);

  const visibleEdges = useMemo(() => {
    return edges.filter(e => 
      filteredNodes.some(nn => nn.id === e.source) && 
      filteredNodes.some(nn => nn.id === e.target)
    );
  }, [edges, filteredNodes]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
          className="relative w-full max-w-[1080px] h-[82vh] glass-strong rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <Network className="h-5 w-5 text-[#c084fc]" />
              <div>
                <div className="font-semibold tracking-tight text-xl">Knowledge Graph</div>
                <div className="text-[11px] text-[#71717a] -mt-0.5">{nodes.length} nodes • {edges.length} direct links • Bidirectional magic</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Reset
              </button>
              <button onClick={onClose} className="btn btn-secondary p-2">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Visual Canvas */}
            <div className="flex-1 relative bg-[#0a0a0f] overflow-auto p-6" style={{ backgroundImage: 'radial-gradient(#222 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {visibleEdges.map((e, idx) => {
                  const p1 = nodePositions[e.source];
                  const p2 = nodePositions[e.target];
                  if (!p1 || !p2) return null;
                  const isFocus = focusId === e.source || focusId === e.target;
                  return (
                    <line 
                      key={idx} 
                      x1={p1.x + 48} y1={p1.y + 18} 
                      x2={p2.x + 48} y2={p2.y + 18} 
                      stroke={isFocus ? "#c084fc" : "#3f3f46"} 
                      strokeWidth={isFocus ? 2.5 : 1} 
                      strokeOpacity={isFocus ? 0.9 : 0.35}
                    />
                  );
                })}
              </svg>

              {/* Nodes */}
              {filteredNodes.map((node) => {
                const pos = nodePositions[node.id] || { x: 40, y: 40 };
                const isFocus = focusId === node.id;
                const isConnected = connectedIds.has(node.id);
                return (
                  <motion.div
                    key={node.id}
                    className={cn(
                      "absolute z-10 px-3 py-1.5 rounded-2xl border text-sm cursor-pointer select-none flex items-center gap-2 shadow-lg transition-all",
                      isFocus ? "bg-[#c084fc] text-black border-[#c084fc] scale-[1.03] shadow-[0_0_0_3px_rgba(192,132,252,0.3)]" :
                      isConnected ? "bg-[#111114] border-[#c084fc]/60 text-white" : 
                      "glass border-white/15 hover:border-[#c084fc]/50 text-[#e4e4e7]"
                    )}
                    style={{ left: pos.x, top: pos.y, minWidth: 110 }}
                    onClick={() => handleNodeClick(node.id)}
                    whileHover={{ scale: isFocus ? 1.02 : 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    title={`${node.type} • ${node.linkCount} links`}
                  >
                    <div className={cn("w-2 h-2 rounded-full shrink-0", node.type === 'task' ? "bg-[#c084fc]" : "bg-[#00ff9f]")} />
                    <div className="truncate font-medium max-w-[138px]">{node.title}</div>
                    <div className="text-[9px] font-mono opacity-70 tabular-nums ml-auto">{node.linkCount}</div>
                  </motion.div>
                );
              })}

              {filteredNodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-[#71717a] text-sm">No nodes match your filters.</div>
              )}
            </div>

            {/* Sidebar: Focus + Suggestions + Actions */}
            <div className="w-80 border-l border-white/10 bg-[#0a0a0f]/95 p-4 flex flex-col overflow-y-auto">
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-[#c084fc]" />
                  <input 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                    placeholder="Filter nodes..." 
                    className="input text-sm flex-1 py-1.5" 
                  />
                </div>
                <div className="flex gap-1 text-[10px]">
                  {(['all','task','note'] as const).map(t => (
                    <button key={t} onClick={() => setFilterType(t)} className={cn("px-2 py-0.5 rounded border", filterType === t ? "bg-white/10 border-[#c084fc]/50" : "border-white/10")}>{t}</button>
                  ))}
                  <button onClick={() => setShowOnlyLinked(!showOnlyLinked)} className={cn("px-2 py-0.5 rounded border ml-1", showOnlyLinked ? "bg-[#00ff9f]/10 border-[#00ff9f]/50" : "border-white/10")}>Linked only</button>
                </div>
              </div>

              {focusNode ? (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-widest text-[#71717a] mb-1">FOCUSED</div>
                  <div className="glass p-3 rounded-2xl border border-[#c084fc]/30">
                    <div className="font-semibold text-base leading-tight">{focusNode.title}</div>
                    <div className="text-xs text-[#a1a1aa] mt-0.5">{focusNode.type} • {focusNode.linkCount} connections</div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => onOpenItem(focusNode.type, focusNode.id)} className="btn btn-secondary text-xs flex-1">Open in App</button>
                      <button onClick={() => setFocusId(null)} className="btn btn-secondary text-xs flex-1">Clear</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#71717a] mb-4">Click any node to focus, see connections, and discover suggestions.</div>
              )}

              {/* Suggestions for linking (the magic) */}
              {focusNode && suggestions.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#00ff9f] mb-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> SUGGESTED LINKS (hybrid)
                  </div>
                  <div className="space-y-1.5">
                    {suggestions.map((sug, i) => {
                      const isNoteSug = 'note' in sug;
                      const target = isNoteSug ? (sug as any).note : (sug as any).task;
                      return (
                        <div key={i} className="glass p-2 rounded-xl text-xs flex justify-between items-center border border-white/10">
                          <div className="truncate pr-2">{target.title}</div>
                          <button 
                            onClick={() => handleSuggestLink(target.id, isNoteSug ? 'note' : 'task')}
                            className="px-2 py-0.5 bg-[#00ff9f]/10 hover:bg-[#00ff9f]/20 text-[#00ff9f] rounded text-[10px] font-mono flex items-center gap-1"
                          >
                            <Link2 className="h-3 w-3" /> Link
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[9px] text-[#71717a] mt-1">Scores from content overlap + links + semantics. One click adds bidirectional.</div>
                </div>
              )}

              <div className="mt-auto pt-4 border-t border-white/10 text-[10px] text-[#a1a1aa]">
                <div>Direct links only (task ↔ note). Graph grows as you use /link in editor or +LINK in notes.</div>
                <div className="mt-1">Tip: Use semantic search in main UI or palette to surface hidden knowledge, then graph it.</div>
              </div>
            </div>
          </div>

          <div className="px-5 py-2 text-[10px] border-t border-white/10 bg-black/30 text-[#71717a] flex items-center justify-between font-mono tracking-widest text-xs">
            <span>AGENT 32 • HYBRID SEMANTIC + VISUAL GRAPH</span>
            <span>Click nodes • Filter • Suggest & Link instantly</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
