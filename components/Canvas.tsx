
import React, { useRef, useState } from 'react';
import { AppNode, AppEdge, NodeType, PipeSize } from '../types';
import { COLORS, PIPE_SPECS } from '../constants';

interface CanvasProps {
  nodes: AppNode[];
  edges: AppEdge[];
  onUpdateNodes: (nodes: AppNode[]) => void;
  onAddEdge: (from: string, to: string) => void;
  onDeleteEdge: (id: string) => void;
  onDeleteNode: (id: string) => void;
  selectedTool: 'pipe' | 'select';
  validation: Record<string, { isValid: boolean; flow: number; capacity: number; error?: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const Canvas: React.FC<CanvasProps> = ({ 
  nodes, 
  edges, 
  onUpdateNodes, 
  onAddEdge, 
  onDeleteEdge,
  onDeleteNode,
  selectedTool,
  validation,
  selectedId,
  onSelect
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [pipingFrom, setPipingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    onSelect(nodeId);
    if (selectedTool === 'select') {
      setDraggingNode(nodeId);
    } else if (selectedTool === 'pipe') {
      setPipingFrom(nodeId);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;
    const x = (e.clientX - CTM.e) / CTM.a;
    const y = (e.clientY - CTM.f) / CTM.d;

    setMousePos({ x, y });

    if (draggingNode) {
      const updatedNodes = nodes.map(n => 
        n.id === draggingNode ? { ...n, x, y } : n
      );
      onUpdateNodes(updatedNodes);
    }
  };

  const handleMouseUp = (e: React.MouseEvent, targetNodeId?: string) => {
    if (selectedTool === 'pipe' && pipingFrom && targetNodeId && pipingFrom !== targetNodeId) {
      onAddEdge(pipingFrom, targetNodeId);
    }
    setDraggingNode(null);
    setPipingFrom(null);
  };

  const renderPipe = (edge: AppEdge) => {
    const from = nodes.find(n => n.id === edge.from);
    const to = nodes.find(n => n.id === edge.to);
    if (!from || !to) return null;

    const val = validation[edge.id] || { isValid: true, flow: 0, capacity: 0 };
    const isSelected = selectedId === edge.id;
    const strokeColor = val.isValid ? (isSelected ? '#6366f1' : COLORS.PIPE) : COLORS.ERROR;
    const strokeWidth = 4 + (Object.values(PipeSize).indexOf(edge.size) * 2);

    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    return (
      <g 
        key={edge.id} 
        className="cursor-pointer group" 
        onMouseDown={(e) => { e.stopPropagation(); onSelect(edge.id); }}
        onClick={(e) => e.stopPropagation()}
      >
        <line 
          x1={from.x} y1={from.y} x2={to.x} y2={to.y}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={isSelected ? 'filter drop-shadow-md' : ''}
        />
        {isSelected && (
           <line 
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="#fff"
            strokeWidth={strokeWidth + 4}
            strokeOpacity="0.3"
            strokeLinecap="round"
          />
        )}
        
        {/* Distance / Size label */}
        <rect 
          x={midX - 25} y={midY - 10} 
          width="50" height="20" rx="10" fill="white" 
          stroke={strokeColor} strokeWidth="1"
          className="shadow-sm" 
        />
        <text 
          x={midX} y={midY + 4} 
          textAnchor="middle" fontSize="10" fontWeight="bold" fill={strokeColor}
          className="pointer-events-none select-none"
        >
          {edge.length}ft
        </text>

        {/* Hover info - Updated to show Max Capacity instead of Flow */}
        <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <rect x={midX - 60} y={midY - 35} width="120" height="20" rx="4" fill="#1e293b" />
          <text x={midX} y={midY - 22} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">
            {edge.size} • Max: {val.capacity.toLocaleString()} BTU
          </text>
        </g>
      </g>
    );
  };

  const renderNode = (node: AppNode) => {
    let color = COLORS.METER;
    let size = 24;
    const isSelected = selectedId === node.id;

    if (node.type === NodeType.JUNCTION) {
      color = COLORS.JUNCTION;
      size = 12;
    } else if (node.type === NodeType.MANIFOLD) {
      color = COLORS.MANIFOLD;
      size = 16;
    } else if (node.type === NodeType.APPLIANCE) {
      color = COLORS.APPLIANCE;
      size = 20;
    }

    // Calculate total supply for meters
    let totalSupplied = 0;
    if (node.type === NodeType.METER) {
      const outgoingEdges = edges.filter(e => e.from === node.id);
      totalSupplied = outgoingEdges.reduce((acc, e) => acc + (validation[e.id]?.flow || 0), 0);
    }

    return (
      <g 
        key={node.id} 
        transform={`translate(${node.x}, ${node.y})`}
        onMouseDown={(e) => handleMouseDown(e, node.id)}
        onMouseUp={(e) => handleMouseUp(e, node.id)}
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer group"
      >
        {node.type === NodeType.JUNCTION ? (
          <circle r={size} fill={color} stroke={isSelected ? "#6366f1" : "white"} strokeWidth={isSelected ? "4" : "2"} className="drop-shadow-sm group-hover:scale-110 transition-transform" />
        ) : node.type === NodeType.MANIFOLD ? (
          <rect x={-size * 1.5} y={-size * 0.75} width={size * 3} height={size * 1.5} rx="4" fill={color} stroke={isSelected ? "#6366f1" : "white"} strokeWidth={isSelected ? "4" : "2"} className="drop-shadow-sm group-hover:scale-105 transition-transform" />
        ) : (
          <rect x={-size} y={-size} width={size*2} height={size*2} rx="4" fill={color} stroke={isSelected ? "#6366f1" : "white"} strokeWidth={isSelected ? "4" : "2"} className="drop-shadow-sm group-hover:scale-105 transition-transform" />
        )}
        
        <text y={node.type === NodeType.MANIFOLD ? size + 10 : size + 15} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-slate-800 select-none no-select pointer-events-none">
          {node.name}
        </text>

        {node.type === NodeType.METER && (
          <>
            <text y={-size - 10} textAnchor="middle" fontSize="9" fontWeight="bold" className="fill-emerald-600 pointer-events-none uppercase tracking-tighter bg-emerald-50">
              {node.gasType} • {node.supplyPressure?.split(' ')[0]}
            </text>
            <text y={size + 26} textAnchor="middle" fontSize="9" className="fill-emerald-600 font-mono font-bold pointer-events-none">
              SUPPLY: {totalSupplied.toLocaleString()} BTU
            </text>
          </>
        )}

        {node.type === NodeType.APPLIANCE && (
          <text y={size + 26} textAnchor="middle" fontSize="9" className="fill-slate-500 font-mono font-bold pointer-events-none">
            {node.btu.toLocaleString()} BTU
          </text>
        )}

        {isSelected && (
          <circle 
            cx={node.type === NodeType.MANIFOLD ? size * 1.5 + 5 : size + 5} 
            cy={node.type === NodeType.MANIFOLD ? -size * 0.75 - 5 : -size - 5} 
            r="10" fill="#ef4444" 
            className="cursor-pointer shadow-sm hover:scale-110 transition-transform" 
            onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
          />
        )}
        {isSelected && <text x={node.type === NodeType.MANIFOLD ? size * 1.5 + 5 : size + 5} y={node.type === NodeType.MANIFOLD ? -size * 0.75 - 1 : -size - 1} textAnchor="middle" fontSize="12" fill="white" fontWeight="bold" className="pointer-events-none">×</text>}
      </g>
    );
  };

  return (
    <div 
      className="flex-1 h-full bg-slate-100 relative overflow-hidden" 
      onMouseMove={handleMouseMove} 
      onMouseUp={() => handleMouseUp(null as any)} 
      onClick={() => onSelect(null)}
    >
      <svg ref={svgRef} className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {edges.map(renderPipe)}
        
        {pipingFrom && (
          <line 
            x1={nodes.find(n => n.id === pipingFrom)?.x} 
            y1={nodes.find(n => n.id === pipingFrom)?.y} 
            x2={mousePos.x} 
            y2={mousePos.y} 
            stroke={COLORS.PIPE} 
            strokeWidth="3" 
            strokeDasharray="6 4" 
          />
        )}

        {nodes.map(renderNode)}
      </svg>
    </div>
  );
};

export default Canvas;
