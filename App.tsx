
import React, { useState, useEffect, useCallback } from 'react';
import { AppNode, AppEdge, NodeType, PipeSize } from './types';
import { PIPE_SPECS, PIPE_ORDER, COLORS } from './constants';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import { auditSystem } from './services/geminiService';

const SAVE_KEY = 'proflex_draw_project_v2';

const App: React.FC = () => {
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [edges, setEdges] = useState<AppEdge[]>([]);
  const [selectedTool, setSelectedTool] = useState<'pipe' | 'select'>('select');
  const [selectedPipeSize, setSelectedPipeSize] = useState<PipeSize>(PipeSize.HALF);
  const [pressureDrop, setPressureDrop] = useState<number>(0.5); // L13 in user formula
  const [validation, setValidation] = useState<Record<string, { isValid: boolean; flow: number; capacity: number; error?: string }>>({});
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showViolationPanel, setShowViolationPanel] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const selectedNode = nodes.find(n => n.id === selectedId);
  const selectedEdge = edges.find(e => e.id === selectedId);

  // Dynamic Capacity Calculation Formula based on Excel formula:
  // INT((($L$13/E$17)/Constant1)^(1/Constant2))
  const calculateCapacity = useCallback((size: PipeSize, length: number): number => {
    const spec = PIPE_SPECS[size];
    if (!spec) return 0;
    
    // Formula calculation
    const cfh = Math.pow((pressureDrop / length) / spec.coeff, 1 / spec.exp);
    // Multiply by 1000 to convert CFH to BTU/hr
    return Math.floor(cfh) * 1000;
  }, [pressureDrop]);

  // Core Validation Logic
  const validateSystem = useCallback(() => {
    const results: Record<string, { isValid: boolean; flow: number; capacity: number; error?: string }> = {};
    
    const getFlow = (edgeId: string): number => {
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return 0;
      
      const targetNode = nodes.find(n => n.id === edge.to);
      if (!targetNode) return 0;

      let flow = 0;
      if (targetNode.type === NodeType.APPLIANCE) {
        flow += targetNode.btu;
      }
      
      const outboundEdges = edges.filter(e => e.from === targetNode.id);
      outboundEdges.forEach(out => {
        flow += getFlow(out.id);
      });

      return flow;
    };

    edges.forEach(edge => {
      const flow = getFlow(edge.id);
      const capacity = calculateCapacity(edge.size, edge.length);
      
      let isValid = true;
      let error = undefined;

      if (flow > capacity) {
        isValid = false;
        error = `Capacity Exceeded: ${flow.toLocaleString()} > ${capacity.toLocaleString()} BTU. Try shorter length or larger pipe.`;
      }

      const upstreamEdge = edges.find(e => e.to === edge.from);
      if (upstreamEdge) {
        const upIndex = PIPE_ORDER.indexOf(upstreamEdge.size);
        const currentIndex = PIPE_ORDER.indexOf(edge.size);
        if (currentIndex > upIndex) {
          isValid = false;
          error = error ? `${error} Sizing violation: Branch pipe (${edge.size}) cannot be larger than feeder (${upstreamEdge.size}).` : `Sizing violation: Branch pipe (${edge.size}) cannot be larger than feeder (${upstreamEdge.size}).`;
        }
      }

      results[edge.id] = { isValid, flow, capacity, error };
    });

    setValidation(results);
  }, [nodes, edges, calculateCapacity]);

  useEffect(() => {
    validateSystem();
  }, [nodes, edges, validateSystem]);

  // Handle saving to local storage
  const handleSave = () => {
    const data = JSON.stringify({ nodes, edges, pressureDrop });
    localStorage.setItem(SAVE_KEY, data);
    alert('Design saved successfully.');
  };

  // Handle loading from local storage
  const handleLoad = () => {
    const savedData = localStorage.getItem(SAVE_KEY);
    if (!savedData) {
      alert('No saved design found.');
      return;
    }
    try {
      const { nodes: savedNodes, edges: savedEdges, pressureDrop: savedPD } = JSON.parse(savedData);
      setNodes(savedNodes);
      setEdges(savedEdges);
      if (savedPD) setPressureDrop(savedPD);
      setSelectedId(null);
      alert('Design loaded successfully.');
    } catch (e) {
      console.error('Failed to parse saved data', e);
      alert('Failed to load saved design.');
    }
  };

  const handleAddNode = (type: NodeType, btu: number = 0, name?: string) => {
    const newNode: AppNode = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: window.innerWidth / 2 - 100 + Math.random() * 200,
      y: window.innerHeight / 2 - 100 + Math.random() * 200,
      name: name || (
        type === NodeType.METER ? 'Gas Meter' : 
        type === NodeType.JUNCTION ? 'T-Junction' : 
        type === NodeType.MANIFOLD ? 'Distribution Manifold' :
        'Appliance'
      ),
      btu,
      supplyPressure: type === NodeType.METER ? '0.5 PSI (Standard)' : undefined,
      gasType: type === NodeType.METER ? 'Natural' : undefined
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedId(newNode.id);
  };

  const handleAddEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromNode = nodes.find(n => n.id === fromId);
    if (!fromNode) return;

    if (edges.find(e => e.to === toId)) {
      alert("This point already has a gas supply line.");
      return;
    }

    if (fromNode.type === NodeType.JUNCTION) {
      if (edges.filter(e => e.from === fromId).length >= 2) {
        alert("T-Junctions are limited to 2 outgoing pipes. Use a Manifold for more.");
        return;
      }
    }

    if (fromNode.type === NodeType.APPLIANCE) {
      alert("Appliances cannot supply other nodes.");
      return;
    }

    const newEdge: AppEdge = {
      id: Math.random().toString(36).substr(2, 9),
      from: fromId,
      to: toId,
      size: selectedPipeSize,
      length: 10
    };
    setEdges(prev => [...prev, newEdge]);
    setSelectedId(newEdge.id);
  };

  const updateNode = (id: string, updates: Partial<AppNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const updateEdge = (id: string, updates: Partial<AppEdge>) => {
    setEdges(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const handleDeleteEdge = (id: string) => {
    setEdges(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDeleteNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    setAiReport(null);
    const result = await auditSystem(nodes, edges);
    setAiReport(result);
    setIsAuditing(false);
  };

  const getSummary = () => {
    const pipeTotals: Record<string, number> = {};
    Object.values(PipeSize).forEach(size => pipeTotals[size] = 0);
    edges.forEach(e => pipeTotals[e.size] += e.length);
    const categorizedJunctions: Record<string, number> = {};
    const categorizedManifolds: Record<string, number> = {};

    nodes.forEach(node => {
      if (node.type === NodeType.JUNCTION || node.type === NodeType.MANIFOLD) {
        const inletEdge = edges.find(e => e.to === node.id);
        const inletSize = inletEdge ? inletEdge.size : 'No Supply';
        if (node.type === NodeType.JUNCTION) {
          categorizedJunctions[inletSize] = (categorizedJunctions[inletSize] || 0) + 1;
        } else {
          categorizedManifolds[inletSize] = (categorizedManifolds[inletSize] || 0) + 1;
        }
      }
    });
    return { pipeTotals, categorizedJunctions, categorizedManifolds };
  };

  const violations = Object.entries(validation).filter(([_, v]) => !(v as any).isValid);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">PF</div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">ProFlex Draw</h1>
            <p className="text-xs text-slate-500 font-medium">Professional Gas Piping Designer</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end border-r border-slate-200 pr-4 mr-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Drop (in. w.c.)</span>
            <input 
              type="number" 
              step="0.1" 
              value={pressureDrop}
              onChange={(e) => setPressureDrop(parseFloat(e.target.value) || 0.1)}
              className="w-20 text-right font-mono font-bold text-indigo-600 bg-indigo-50 border-none rounded px-2 outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-bold text-xs transition-all shadow-sm">
              Save
            </button>
            <button onClick={handleLoad} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-bold text-xs transition-all shadow-sm">
              Load
            </button>
          </div>
          <button onClick={() => setShowSummary(true)} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm">
            Summary
          </button>
          <button onClick={handleRunAudit} disabled={isAuditing || nodes.length === 0} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-md">
            {isAuditing ? 'Auditing...' : 'AI Audit'}
          </button>
        </div>
      </header>

      <main className="flex-1 relative flex overflow-hidden">
        <Toolbar 
          onAddNode={handleAddNode}
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          selectedPipeSize={selectedPipeSize}
          setSelectedPipeSize={setSelectedPipeSize}
        />
        
        <Canvas 
          nodes={nodes}
          edges={edges}
          onUpdateNodes={setNodes}
          onAddEdge={handleAddEdge}
          onDeleteEdge={handleDeleteEdge}
          onDeleteNode={handleDeleteNode}
          selectedTool={selectedTool}
          validation={validation}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {/* Project Summary Modal */}
        {showSummary && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  <h2 className="text-xl font-black uppercase tracking-widest">Project Summary & Materials</h2>
                </div>
                <button onClick={() => setShowSummary(false)} className="hover:bg-slate-800 rounded-full p-2 transition-colors">×</button>
              </div>
              <div className="p-8 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Pipe Material Estimates</h3>
                    <div className="space-y-3">
                      {Object.entries(getSummary().pipeTotals).map(([size, len]) => (
                        <div key={size} className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-sm font-bold text-slate-600">{size} Diameter</span>
                          <span className="font-mono font-black text-indigo-600">{len} Feet</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Fitting Inventory</h3>
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-[10px] font-bold text-indigo-600 uppercase mb-2">T-Junctions</h4>
                        {Object.entries(getSummary().categorizedJunctions).map(([size, count]) => (
                          <div key={size} className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 mb-1">
                            <span className="text-xs font-bold text-indigo-800">{size} Inlet</span>
                            <span className="font-mono font-black text-indigo-900">Qty: {count}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-cyan-600 uppercase mb-2">Manifolds</h4>
                        {Object.entries(getSummary().categorizedManifolds).map(([size, count]) => (
                          <div key={size} className="flex justify-between items-center bg-cyan-50/50 p-2 rounded-lg border border-cyan-100 mb-1">
                            <span className="text-xs font-bold text-cyan-800">{size} Inlet</span>
                            <span className="font-mono font-black text-cyan-900">Qty: {count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button onClick={() => setShowSummary(false)} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Properties Panel */}
        {selectedId && (selectedNode || selectedEdge) && (
          <div className="absolute top-4 right-4 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-40 animate-in fade-in slide-in-from-right-4">
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest">{selectedNode ? 'Component' : 'Pipe'} Properties</h3>
              <button onClick={() => setSelectedId(null)} className="hover:bg-slate-700 rounded p-1 w-6 h-6 flex items-center justify-center">×</button>
            </div>
            <div className="p-5 space-y-5">
              {selectedNode && (
                <>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Name</label>
                    <input type="text" value={selectedNode.name} onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 outline-none" />
                  </div>
                  {selectedNode.type === NodeType.METER && (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Gas Type</label>
                        <select value={selectedNode.gasType} onChange={(e) => updateNode(selectedNode.id, { gasType: e.target.value as any })} className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 font-bold">
                          <option value="Natural">Natural Gas</option>
                          <option value="Propane">Propane (LPG)</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {selectedNode.type === NodeType.APPLIANCE && (
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">BTU Load</label>
                      <input type="number" value={selectedNode.btu} step="1000" onChange={(e) => updateNode(selectedNode.id, { btu: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 font-mono font-bold" />
                    </div>
                  )}
                </>
              )}
              {selectedEdge && (
                <>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Length (ft)</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="1" max="250" step="1" value={selectedEdge.length} onChange={(e) => updateEdge(selectedEdge.id, { length: parseInt(e.target.value) })} className="flex-1 accent-indigo-600" />
                      <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-14 text-center">{selectedEdge.length}'</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Diameter</label>
                    <select value={selectedEdge.size} onChange={(e) => updateEdge(selectedEdge.id, { size: e.target.value as PipeSize })} className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 font-bold">
                      {Object.values(PipeSize).map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500 font-medium">Demand:</span>
                      <span className="font-mono font-bold">{(validation[selectedEdge.id] as any)?.flow.toLocaleString()} BTU</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500 font-medium">Formula Capacity:</span>
                      <span className="font-mono font-bold">{(validation[selectedEdge.id] as any)?.capacity.toLocaleString()} BTU</span>
                    </div>
                    {(validation[selectedEdge.id] as any)?.error && (
                      <p className="text-[9px] text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100 mt-2">{(validation[selectedEdge.id] as any).error}</p>
                    )}
                  </div>
                  <button onClick={() => handleDeleteEdge(selectedEdge.id)} className="w-full py-2.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-black transition-all">Delete Connection</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* AI Sidebar */}
        {aiReport && (
          <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-right-4">
            <div className="p-4 bg-indigo-700 text-white flex justify-between items-center">
              <h3 className="font-black text-xs uppercase flex items-center gap-2">AI Audit</h3>
              <button onClick={() => setAiReport(null)} className="hover:bg-indigo-600 rounded p-1">×</button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap font-medium">{aiReport}</div>
          </div>
        )}

        {/* Floating Violation List */}
        {showViolationPanel && violations.length > 0 && (
          <div className="absolute bottom-24 right-6 w-80 bg-white rounded-3xl shadow-2xl border-2 border-red-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-bottom-4">
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest">Active Violations</h3>
              <button onClick={() => setShowViolationPanel(false)} className="hover:bg-red-500 rounded p-1">×</button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto space-y-3">
              {violations.map(([id, v]) => (
                <div key={id} className="p-3 bg-red-50 border border-red-100 rounded-2xl cursor-pointer" onClick={() => setSelectedId(id)}>
                  <p className="text-[10px] text-red-700 font-medium">{(v as any).error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="absolute bottom-6 right-6 z-30">
          {showInstructions ? (
            <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl shadow-2xl border border-slate-200 w-72">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User Manual</h4>
                <button onClick={() => setShowInstructions(false)} className="text-slate-400 hover:text-slate-600 transition-colors">×</button>
              </div>
              <ul className="text-[10px] text-slate-700 space-y-2 mb-5">
                <li>• Drag components from left to build your layout.</li>
                <li>• Use <strong>Pipe Tool</strong> to click-drag connections.</li>
                <li>• Sizing is calculated via power-law flow formula.</li>
              </ul>
              <button onClick={() => setShowInstructions(false)} className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800">Got it</button>
            </div>
          ) : (
            <button onClick={() => setShowInstructions(true)} className="w-12 h-12 bg-white hover:bg-indigo-50 border border-slate-200 rounded-2xl shadow-lg flex items-center justify-center text-indigo-600 transition-all hover:scale-110 active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </button>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center text-[10px] text-slate-500 font-bold tracking-tight z-20">
        <div className="flex gap-6 items-center">
          <span>NODES: {nodes.length}</span>
          <span>PIPES: {edges.length}</span>
          <button onClick={() => setShowViolationPanel(!showViolationPanel)} className={`px-3 py-1.5 rounded-full transition-all ${violations.length > 0 ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "text-slate-400 opacity-50"}`}>
            VIOLATIONS: {violations.length}
          </button>
        </div>
        <div className="flex gap-5 items-center">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            DESIGNER ACTIVE
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
