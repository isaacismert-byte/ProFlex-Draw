
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppNode, AppEdge, NodeType, PipeSize } from './types';
import { PIPE_SPECS, PIPE_ORDER, COLORS, DEFAULT_APPLIANCES } from './constants';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import { auditSystem } from './services/geminiService';

const TEMPLATE_KEY = 'proflex_draw_templates';
const RECENTS_KEY = 'proflex_draw_recents_index';

interface RecentProject {
  id: string;
  name: string;
  timestamp: number;
  nodeCount: number;
  pipeCount: number;
  data: {
    nodes: AppNode[];
    edges: AppEdge[];
    pressureDrop: number;
  };
}

const App: React.FC = () => {
  // Navigation & Responsiveness
  const [view, setView] = useState<'home' | 'designer'>('home');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Project Data State
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [edges, setEdges] = useState<AppEdge[]>([]);
  const [pressureDrop, setPressureDrop] = useState<number>(0.5); 
  const [projectName, setProjectName] = useState('New Project');

  // UI State
  const [selectedTool, setSelectedTool] = useState<'pipe' | 'select'>('select');
  const [selectedPipeSize, setSelectedPipeSize] = useState<PipeSize>(PipeSize.HALF);
  const [validation, setValidation] = useState<Record<string, { isValid: boolean; flow: number; capacity: number; error?: string }>>({});
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMobileEdit, setShowMobileEdit] = useState(false); 
  const [showSummary, setShowSummary] = useState(false);
  const [showAddMenuMobile, setShowAddMenuMobile] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  
  // Template & Recents States
  const [templates, setTemplates] = useState<(any | null)[]>(new Array(5).fill(null));
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = nodes.find(n => n.id === selectedId);
  const selectedEdge = edges.find(e => e.id === selectedId);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const storedTemplates = localStorage.getItem(TEMPLATE_KEY);
    if (storedTemplates) {
      try {
        const parsed = JSON.parse(storedTemplates);
        if (Array.isArray(parsed)) setTemplates(parsed);
      } catch (e) { console.error("Templates load failed", e); }
    }
    const storedRecents = localStorage.getItem(RECENTS_KEY);
    if (storedRecents) {
      try {
        const parsed = JSON.parse(storedRecents);
        if (Array.isArray(parsed)) setRecentProjects(parsed);
      } catch (e) { console.error("Recents load failed", e); }
    }
  }, []);

  const calculateCapacity = useCallback((size: PipeSize, length: number): number => {
    const spec = PIPE_SPECS[size];
    if (!spec || length <= 0) return 0;
    const cfh = Math.pow((pressureDrop / length) / spec.coeff, 1 / spec.exp);
    return Math.floor(cfh) * 1000;
  }, [pressureDrop]);

  const validateSystem = useCallback(() => {
    const results: Record<string, { isValid: boolean; flow: number; capacity: number; error?: string }> = {};
    const getFlow = (edgeId: string): number => {
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return 0;
      const targetNode = nodes.find(n => n.id === edge.to);
      if (!targetNode) return 0;
      let flow = 0;
      if (targetNode.type === NodeType.APPLIANCE) flow += targetNode.btu;
      edges.filter(e => e.from === targetNode.id).forEach(out => { flow += getFlow(out.id); });
      return flow;
    };
    edges.forEach(edge => {
      const flow = getFlow(edge.id);
      const capacity = calculateCapacity(edge.size, edge.length);
      let isValid = flow <= capacity;
      results[edge.id] = { isValid, flow, capacity };
    });
    setValidation(results);
  }, [nodes, edges, calculateCapacity]);

  useEffect(() => { validateSystem(); }, [nodes, edges, validateSystem]);

  const handleRunAudit = async () => {
    if (isAuditing) return;
    setIsAuditing(true);
    try {
      const report = await auditSystem(nodes, edges);
      setAiReport(report || "No audit report generated.");
    } catch (error) {
      setAiReport("Failed to generate AI audit report.");
    } finally {
      setIsAuditing(false);
    }
  };

  const getSummary = useCallback(() => {
    const pipeTotals: Record<string, number> = {};
    edges.forEach(edge => {
      pipeTotals[edge.size] = (pipeTotals[edge.size] || 0) + edge.length;
    });
    return { pipeTotals };
  }, [edges]);

  const saveToStorage = (id: string, name: string) => {
    const newRecent: RecentProject = {
      id, name, timestamp: Date.now(),
      nodeCount: nodes.length, pipeCount: edges.length,
      data: { nodes, edges, pressureDrop }
    };
    const updatedRecents = [newRecent, ...recentProjects.filter(p => p.id !== id)].slice(0, 15);
    setRecentProjects(updatedRecents);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updatedRecents));
  };

  const handleSave = () => {
    const id = currentProjectId || Math.random().toString(36).substr(2, 9);
    saveToStorage(id, projectName);
    if (!currentProjectId) setCurrentProjectId(id);
  };

  const handleSaveAs = (newName: string) => {
    if (!newName.trim()) return;
    const newId = Math.random().toString(36).substr(2, 9);
    setProjectName(newName);
    setCurrentProjectId(newId);
    saveToStorage(newId, newName);
    setShowSaveAsModal(false);
  };

  const handleAddNode = (type: NodeType, btu: number = 0, name?: string) => {
    const newNode: AppNode = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 500,
      y: 500,
      name: name || (type === NodeType.METER ? 'Gas Meter' : type === NodeType.JUNCTION ? 'T-Junction' : type === NodeType.MANIFOLD ? 'Manifold' : 'Appliance'),
      btu,
      gasType: type === NodeType.METER ? 'Natural' : undefined
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedId(newNode.id);
    if (isMobile) {
      setShowMobileEdit(true); 
    }
    setShowAddMenuMobile(false);
  };

  const updateNode = (id: string, updates: Partial<AppNode>) => setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  const updateEdge = (id: string, updates: Partial<AppEdge>) => setEdges(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  const handleDeleteNode = (id: string) => { setNodes(nodes.filter(n => n.id !== id)); setEdges(edges.filter(e => e.from !== id && e.to !== id)); setSelectedId(null); setShowMobileEdit(false); };

  const renderMobileHome = () => (
    <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center p-4 overflow-y-auto pb-20">
      <div className="w-full max-w-lg flex flex-col gap-8 mt-6">
        <header className="text-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-xl mx-auto mb-4">PF</div>
          <h1 className="text-3xl font-black text-slate-900">ProFlex Draw</h1>
          <p className="text-slate-500 font-medium text-sm">Gas Designer Mobile</p>
        </header>
        <div className="flex flex-col gap-3">
          <button onClick={() => { setNodes([]); setEdges([]); setProjectName('New Project'); setView('designer'); setCurrentProjectId(null); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-lg">New Project</button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-bold text-sm">Import .proflex</button>
        </div>
        <section>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Recent Projects</h3>
          <div className="space-y-3">
            {recentProjects.length === 0 ? (
              <p className="text-xs text-center text-slate-400 font-bold uppercase py-10 border-2 border-dashed border-slate-100 rounded-2xl">No Recent Projects</p>
            ) : (
              recentProjects.map(p => (
                <button key={p.id} onClick={() => { setNodes(p.data.nodes); setEdges(p.data.edges); setPressureDrop(p.data.pressureDrop); setProjectName(p.name); setCurrentProjectId(p.id); setView('designer'); }} className="w-full bg-white p-5 rounded-2xl border border-slate-200 text-left shadow-sm hover:border-indigo-300 transition-colors">
                  <h4 className="font-bold text-slate-800">{p.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(p.timestamp).toLocaleDateString()}</p>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const renderDesktopHome = () => (
    <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center p-8 overflow-y-auto">
      <div className="w-full max-w-6xl flex flex-col gap-12 mt-12 mb-20">
        <header className="flex justify-between items-end">
          <div>
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-xl shadow-indigo-200 mb-6">PF</div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">ProFlex Draw</h1>
            <p className="text-slate-500 font-medium text-lg mt-2">Professional Gas Piping Designer</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200 hover:border-slate-300 text-slate-600 px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2">Import Design</button>
            <button onClick={() => { setNodes([]); setEdges([]); setProjectName('New Project'); setView('designer'); setCurrentProjectId(null); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">New Project</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-12">
            <section>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Recent Projects</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentProjects.length === 0 ? (
                  <div className="col-span-2 bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center opacity-60">
                    <p className="text-sm font-bold text-slate-500">No recent projects found</p>
                  </div>
                ) : (
                  recentProjects.map(p => (
                    <button key={p.id} onClick={() => { setNodes(p.data.nodes); setEdges(p.data.edges); setPressureDrop(p.data.pressureDrop); setProjectName(p.name); setCurrentProjectId(p.id); setView('designer'); }} className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-400 hover:shadow-xl transition-all text-left group shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-4m3 2v-4m3 2v-6m0 10h.01M3 21h18a2 2 0 002-2V5a2 2 0 00-2-2H3a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{new Date(p.timestamp).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-800 mb-2 truncate">{p.name}</h4>
                      <div className="flex gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{p.nodeCount} Components</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{p.pipeCount} Pipes</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="bg-indigo-900 rounded-[2rem] p-8 text-white shadow-2xl">
              <h3 className="text-xl font-black mb-4 leading-tight">Safety Guidelines</h3>
              <p className="text-indigo-200 text-sm leading-relaxed mb-6">NFPA 54 compliant tools. Use the AI Audit for complex distribution networks.</p>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">1</div>
                  <p className="text-xs font-bold text-indigo-100">Maintain minimum clearance from electrical lines.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">2</div>
                  <p className="text-xs font-bold text-indigo-100">Scale runs for future load expansion.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <input type="file" ref={fileInputRef} onChange={(e) => {
          const file = e.target.files?.[0]; if (!file) return;
          const reader = new FileReader(); reader.onload = (ev) => {
            try {
              const d = JSON.parse(ev.target?.result as string);
              setNodes(d.nodes || []); setEdges(d.edges || []); setProjectName(d.projectName || 'Imported Design'); setView('designer');
            } catch(e) { console.error("Parse Error", e); }
          }; reader.readAsText(file);
      }} className="hidden" />
    </div>
  );

  if (view === 'home') return isMobile ? renderMobileHome() : renderDesktopHome();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 touch-none">
      <header className="bg-white border-b border-slate-200 px-3 md:px-6 py-2.5 flex justify-between items-center z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-2 md:gap-4 flex-1">
          <button onClick={() => setView('home')} className="w-9 h-9 md:w-10 md:h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold hover:bg-indigo-700 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </button>
          <div className="relative group max-w-[140px] md:max-w-[280px]">
            <input 
              type="text" 
              value={projectName} 
              onChange={(e) => setProjectName(e.target.value)} 
              placeholder="Project Name"
              className="text-xs md:text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 focus:bg-white focus:border-indigo-500 outline-none w-full truncate" 
            />
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-3">
          {!isMobile && (
            <>
              <button onClick={() => setShowSummary(true)} className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-xs uppercase tracking-tight hover:bg-indigo-100 transition-colors">Summary</button>
              <button onClick={handleRunAudit} className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-xs uppercase tracking-tight hover:bg-slate-200 transition-colors">Audit</button>
            </>
          )}
          <div className="flex shadow-sm rounded-lg overflow-hidden border border-slate-300">
            <button onClick={handleSave} className="bg-slate-900 text-white px-3 md:px-4 py-1.5 font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors">Save</button>
            <button onClick={() => { setSaveAsName(`${projectName} Copy`); setShowSaveAsModal(true); }} className="bg-white text-slate-900 px-2 md:px-3 py-1.5 font-bold text-[10px] md:text-xs uppercase tracking-tighter hover:bg-slate-50 border-l border-slate-300 transition-colors">As...</button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex overflow-hidden">
        {!isMobile && (
          <Toolbar 
            onAddNode={handleAddNode} selectedTool={selectedTool} setSelectedTool={setSelectedTool}
            selectedPipeSize={selectedPipeSize} setSelectedPipeSize={setSelectedPipeSize}
            templates={templates} onLoadTemplate={(t) => { setNodes(t.data.nodes); setEdges(t.data.edges); setPressureDrop(t.data.pressureDrop); setProjectName(t.name); setCurrentProjectId(null); }}
          />
        )}
        
        <Canvas 
          nodes={nodes} edges={edges} pressureDrop={pressureDrop} onUpdateNodes={setNodes}
          onAddEdge={(f, t) => { setEdges([...edges, { id: Math.random().toString(36).substr(2, 9), from: f, to: t, size: selectedPipeSize, length: 10 }]); }}
          onDeleteEdge={(id) => setEdges(edges.filter(e => e.id !== id))}
          onDeleteNode={handleDeleteNode} selectedTool={selectedTool} validation={validation}
          selectedId={selectedId} onSelect={setSelectedId}
          onEdit={(id) => { setSelectedId(id); if (isMobile) setShowMobileEdit(true); }}
          isMobile={isMobile}
        />

        {/* Desktop Sidebar Properties */}
        {!isMobile && selectedId && (selectedNode || selectedEdge) && (
          <div className="absolute top-4 right-4 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-40">
             <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-widest">Properties</h3>
                <button onClick={() => setSelectedId(null)} className="p-1 hover:bg-slate-700 rounded transition-colors text-lg leading-none">×</button>
             </div>
             <div className="p-5 space-y-5">
                {selectedNode && (
                  <>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Component Name</label>
                      <input type="text" value={selectedNode.name} onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 font-bold focus:bg-white focus:border-indigo-500 outline-none" />
                    </div>
                    {selectedNode.type === NodeType.APPLIANCE && (
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">BTU Rating</label>
                        <input type="number" step="1000" value={selectedNode.btu} onChange={(e) => updateNode(selectedNode.id, { btu: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 font-mono font-bold focus:bg-white focus:border-indigo-500 outline-none" />
                      </div>
                    )}
                  </>
                )}
                {selectedEdge && (
                  <>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Length (Feet)</label>
                      <input type="number" min="1" value={selectedEdge.length} onChange={(e) => updateEdge(selectedEdge.id, { length: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 font-mono font-bold focus:bg-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Pipe Diameter</label>
                      <select value={selectedEdge.size} onChange={(e) => updateEdge(selectedEdge.id, { size: e.target.value as PipeSize })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 font-bold focus:bg-white focus:border-indigo-500 outline-none">
                        {Object.values(PipeSize).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <button onClick={() => { selectedNode ? handleDeleteNode(selectedId) : setEdges(edges.filter(e => e.id !== selectedId)); setSelectedId(null); }} className="w-full py-2.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-colors">Delete Selected</button>
             </div>
          </div>
        )}

        {/* Mobile UI Overlay */}
        {isMobile && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t flex items-center justify-around z-30 shadow-lg px-2 shrink-0">
            <button onClick={() => setSelectedTool('select')} className={`flex flex-col items-center gap-1 ${selectedTool === 'select' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
              <span className="text-[10px] font-bold">Select</span>
            </button>
            <button onClick={() => setSelectedTool('pipe')} className={`flex flex-col items-center gap-1 ${selectedTool === 'pipe' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <span className="text-[10px] font-bold">Pipe</span>
            </button>
            <button onClick={() => setShowAddMenuMobile(true)} className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center -translate-y-4 shadow-xl active:scale-90 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
            <button onClick={() => setShowSummary(true)} className="flex flex-col items-center gap-1 text-slate-400">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-4m3 2v-6m0 10h.01M3 21h18a2 2 0 002-2V5a2 2 0 00-2-2H3a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
               <span className="text-[10px] font-bold">List</span>
            </button>
            <button onClick={handleRunAudit} className="flex flex-col items-center gap-1 text-slate-400">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               <span className="text-[10px] font-bold">Audit</span>
            </button>
          </div>
        )}

        {/* Mobile Edit Sheet */}
        {selectedId && (selectedNode || selectedEdge) && isMobile && showMobileEdit && (
          <div className="fixed inset-0 bg-black/40 z-[60] flex items-end animate-in fade-in" onClick={() => setShowMobileEdit(false)}>
            <div className="bg-white w-full rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
              <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-6">Edit {selectedNode ? 'Component' : 'Pipe'}</h3>
              <div className="space-y-6">
                {selectedNode && (
                  <>
                    <input type="text" value={selectedNode.name} onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                    {selectedNode.type === NodeType.APPLIANCE && (
                      <div className="flex flex-col gap-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase px-1">BTU Rating</label>
                         <input type="number" value={selectedNode.btu} onChange={(e) => updateNode(selectedNode.id, { btu: parseInt(e.target.value) || 0 })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-lg font-bold text-slate-900" />
                      </div>
                    )}
                  </>
                )}
                {selectedEdge && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Length (ft)</label>
                       <input type="number" value={selectedEdge.length} onChange={(e) => updateEdge(selectedEdge.id, { length: parseInt(e.target.value) || 1 })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold text-slate-900" />
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Size</label>
                       <select value={selectedEdge.size} onChange={(e) => updateEdge(selectedEdge.id, { size: e.target.value as PipeSize })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900">
                         {Object.values(PipeSize).map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowMobileEdit(false)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest">Done</button>
                  <button onClick={() => { selectedNode ? handleDeleteNode(selectedId) : setEdges(edges.filter(e => e.id !== selectedId)); setSelectedId(null); setShowMobileEdit(false); }} className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Save As Modal */}
      {showSaveAsModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[120] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowSaveAsModal(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-2 text-slate-900">Save As Copy</h3>
            <p className="text-slate-500 text-xs mb-6 font-medium">Clone this design to a new file.</p>
            <input 
              autoFocus
              type="text" 
              value={saveAsName} 
              onChange={(e) => setSaveAsName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none mb-6 focus:bg-white focus:border-indigo-500 transition-all"
              placeholder="Enter name..."
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveAsModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancel</button>
              <button onClick={() => handleSaveAs(saveAsName)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-700">Save Copy</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setShowSummary(false)}>
          <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] md:rounded-[2rem] p-8 animate-in slide-in-from-bottom md:zoom-in-95 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">Materials Summary</h2>
              <button onClick={() => setShowSummary(false)} className="text-slate-400 text-2xl p-2 leading-none">×</button>
            </div>
            <div className="space-y-4 mb-8 overflow-y-auto max-h-[50vh] no-scrollbar">
              {Object.entries(getSummary().pipeTotals).map(([s, l]) => (l as number) > 0 && (
                <div key={s} className="flex justify-between items-center bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <span className="text-slate-600 font-bold text-sm">{s} Pipe</span>
                  <span className="text-indigo-600 text-xl font-black">{l as number} ft</span>
                </div>
              ))}
              {Object.values(getSummary().pipeTotals).every(l => (l as number) === 0) && <p className="text-center text-slate-400 italic py-10 font-bold">No pipes added to design</p>}
            </div>
            <button onClick={() => setShowSummary(false)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-slate-800 transition-colors">Close List</button>
          </div>
        </div>
      )}

      {/* Mobile Add Menu */}
      {showAddMenuMobile && isMobile && (
        <div className="fixed inset-0 bg-slate-900/40 z-[110] animate-in fade-in" onClick={() => setShowAddMenuMobile(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-8 shrink-0"></div>
             <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-6 shrink-0 text-center">Add Element</h3>
             <div className="grid grid-cols-3 gap-3 mb-8 shrink-0">
               <button onClick={() => handleAddNode(NodeType.METER)} className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex flex-col items-center font-bold text-[10px] gap-2 active:scale-95 transition-all">
                 <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                 Meter
               </button>
               <button onClick={() => handleAddNode(NodeType.JUNCTION)} className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 flex flex-col items-center font-bold text-[10px] gap-2 active:scale-95 transition-all">
                 <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></div>
                 Junction
               </button>
               <button onClick={() => handleAddNode(NodeType.MANIFOLD)} className="p-3 bg-cyan-50 text-cyan-700 rounded-2xl border border-cyan-100 flex flex-col items-center font-bold text-[10px] gap-2 active:scale-95 transition-all">
                 <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white shadow-lg shadow-cyan-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg></div>
                 Manifold
               </button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar pb-6">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Appliances</div>
               {DEFAULT_APPLIANCES.map(app => (
                 <button key={app.name} onClick={() => handleAddNode(NodeType.APPLIANCE, app.btu, app.name)} className="w-full p-4 bg-slate-50 rounded-2xl flex justify-between items-center font-bold text-slate-800 text-sm border border-slate-100 active:bg-indigo-50 active:border-indigo-200 transition-colors">
                   <span>{app.name}</span>
                   <span className="text-indigo-600 font-mono text-[10px]">{(app.btu/1000).toFixed(0)}k BTU</span>
                 </button>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* AI Audit View */}
      {aiReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[130] flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setAiReport(null)}>
           <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] md:rounded-[2rem] shadow-2xl p-6 md:p-8 flex flex-col max-h-[85vh] animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-5">
                 <h3 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-600">AI Safety Audit</h3>
                 <button onClick={() => setAiReport(null)} className="text-slate-400 hover:text-slate-600 text-3xl leading-none">×</button>
              </div>
              <div className="overflow-y-auto text-sm text-slate-900 whitespace-pre-wrap font-medium leading-relaxed no-scrollbar md:px-2">{aiReport}</div>
              <button onClick={() => setAiReport(null)} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-colors shadow-xl shadow-indigo-100">Dismiss Analysis</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
