
import React from 'react';
import { NodeType, PipeSize } from '../types';
import { DEFAULT_APPLIANCES, PIPE_SPECS } from '../constants';

interface ToolbarProps {
  onAddNode: (type: NodeType, btu?: number, name?: string) => void;
  selectedTool: 'pipe' | 'select';
  setSelectedTool: (tool: 'pipe' | 'select') => void;
  selectedPipeSize: PipeSize;
  setSelectedPipeSize: (size: PipeSize) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onAddNode, 
  selectedTool, 
  setSelectedTool,
  selectedPipeSize,
  setSelectedPipeSize
}) => {
  return (
    <div className="absolute top-4 left-4 bottom-4 flex flex-col gap-3 z-10 w-64 overflow-y-auto pr-2 no-scrollbar pb-12">
      <div className="bg-white rounded-xl shadow-lg p-3 border border-slate-200">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tools</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => setSelectedTool('select')}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${selectedTool === 'select' ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-500' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
            <span className="text-[10px] font-bold">Select / Edit</span>
          </button>
          <button 
            onClick={() => setSelectedTool('pipe')}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${selectedTool === 'pipe' ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-500' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            <span className="text-[10px] font-bold">Pipe tool</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-3 border border-slate-200">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Components</h3>
        <div className="flex flex-col gap-1.5">
          <button 
            onClick={() => onAddNode(NodeType.METER)}
            className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold rounded-lg border border-emerald-200 text-left flex items-center gap-2"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            Add Gas Meter
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onAddNode(NodeType.JUNCTION)}
              className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-semibold rounded-lg border border-indigo-200 flex flex-col items-center gap-1"
            >
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              T-Junction
            </button>
            <button 
              onClick={() => onAddNode(NodeType.MANIFOLD)}
              className="py-2 px-3 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-[10px] font-semibold rounded-lg border border-cyan-200 flex flex-col items-center gap-1"
            >
              <div className="w-4 h-2 rounded-sm bg-cyan-500"></div>
              Manifold
            </button>
          </div>
          <div className="mt-1 grid grid-cols-1 gap-1 border-t border-slate-100 pt-2">
            {DEFAULT_APPLIANCES.map((app) => (
              <button
                key={app.name}
                onClick={() => onAddNode(NodeType.APPLIANCE, app.btu, app.name)}
                className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] rounded-md border border-slate-200 text-left flex justify-between items-center"
              >
                <span>{app.name}</span>
                <span className="text-[9px] text-slate-400 font-mono">{(app.btu / 1000).toFixed(0)}k</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-3 border border-slate-200 mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Pipe Tool Size</h3>
        <div className="grid grid-cols-1 gap-1">
          {Object.values(PipeSize).map((size) => (
            <button
              key={size}
              onClick={() => setSelectedPipeSize(size)}
              className={`w-full py-1 px-3 text-[10px] rounded-md border transition-all flex justify-between items-center ${selectedPipeSize === size ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              <span className="font-bold">{size}</span>
              <span className={`text-[8px] font-mono ${selectedPipeSize === size ? 'text-indigo-200' : 'text-slate-400'}`}>
                {PIPE_SPECS[size].capacity.toLocaleString()} BTU
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
