import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Artifact } from '../types';
import { Loader2, Search, BrainCircuit, Info } from 'lucide-react';

export function useDebouncedSearch(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- CUSTOM NODES ---

const ScreenNode = React.memo(({ data, selected }: any) => {
  const isAmbiguous = data.confidence === 'AMBIGUO';
  const mainEvent = data.screen?.snippets?.[0]?.event_normalized 
    || data.screen?.snippets?.[0]?.base_key 
    || "Sem snippet identificado";
  
  const rawCode = data.screen?.snippets?.[0]?.raw_code || "";
  const snippetCount = data.screen?.snippets?.length || 0;
  
  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white dark:!border-slate-800" />
      <div 
        className={`p-4 rounded-xl border-2 bg-white dark:bg-slate-850 shadow-neu-card w-[280px] transition-all cursor-pointer flex flex-col ${
          selected ? 'border-[#7B0209] shadow-md scale-[1.02]' : 'border-gray-200 dark:border-slate-700 hover:border-[#7B0209]/50'
        }`}
        onClick={data.onClick}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2 py-1 rounded-md">
            Etapa {data.screen?.screen_index ?? "?"}
          </span>
          <span className={`text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${isAmbiguous ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {data.confidence}
          </span>
        </div>
        
        <h4 className="text-sm font-bold text-gray-900 dark:text-slate-50 leading-tight mb-2 line-clamp-2">
          {data.summary}
        </h4>
        
        <div className="bg-gray-50 dark:bg-slate-900 rounded p-2 mb-2">
          <span className="block text-[10px] text-gray-500 font-semibold mb-1 uppercase">Evento Principal</span>
          <span className="block text-xs font-mono text-[#7B0209] dark:text-red-400 truncate">{mainEvent}</span>
        </div>
        
        {rawCode && (
          <div className="bg-slate-900 rounded p-2 mb-2 overflow-hidden">
             <pre className="text-[9px] text-emerald-400 font-mono leading-tight line-clamp-2 whitespace-pre-wrap break-all">
               {rawCode}
             </pre>
          </div>
        )}
        
        <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-slate-400 font-semibold">
          <span>{snippetCount} snippet{snippetCount !== 1 ? 's' : ''}</span>
          <span className="truncate max-w-[120px] text-right" title={data.rationale}>{data.rationale}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[#7B0209] !border-2 !border-white dark:!border-slate-800" />
    </>
  );
});

const DecisionNode = React.memo(({ data, selected }: any) => {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-400 !border-0 opacity-0" />
      <div 
        className="w-8 h-8 relative group cursor-pointer flex items-center justify-center"
        onClick={data.onClick}
      >
        <div className={`absolute inset-0 rotate-45 border-2 bg-white dark:bg-slate-850 transition-all ${
          selected ? 'border-[#7B0209] scale-110 shadow-md' : 'border-amber-400 border-dashed hover:border-[#7B0209]'
        }`} />
        <div className="relative z-10 flex flex-col items-center justify-center -rotate-0">
           <Info className={`w-4 h-4 ${selected ? 'text-[#7B0209]' : 'text-amber-500'}`} />
        </div>
        
        {/* Tooltip on hover */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          <p className="font-bold mb-1 text-amber-300">Bifurcação Ambígua</p>
          <p className="line-clamp-3">{data.condition}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-[#7B0209] !border-0 opacity-0" />
    </>
  );
});

const nodeTypes = {
  screen: ScreenNode,
  decision: DecisionNode
};

// --- DAGRE LAYOUT ---

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 280;
  const nodeHeight = 180;
  const decisionSize = 60;
  
  dagreGraph.setGraph({ rankdir: direction, ranksep: 80, nodesep: 60 });
  
  nodes.forEach((node) => {
    const isDecision = node.type === 'decision';
    dagreGraph.setNode(node.id, { 
      width: isDecision ? decisionSize : nodeWidth, 
      height: isDecision ? decisionSize : nodeHeight 
    });
  });
  
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  
  dagre.layout(dagreGraph);
  
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const isDecision = node.type === 'decision';
    const w = isDecision ? decisionSize : nodeWidth;
    const h = isDecision ? decisionSize : nodeHeight;
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - w / 2,
        y: nodeWithPosition.y - h / 2,
      },
    };
  });
  
  return { nodes: layoutedNodes, edges };
};

// --- CACHE (Memory) ---

const journeyCache = new Map<string, any>();

// --- INNER COMPONENT ---

const JourneysCanvasInner = ({ artifacts, selectedMapId, onSelectScreen }: any) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedSearch(searchQuery, 300);
  
  const { fitView, setCenter } = useReactFlow();

  const selectedMap = useMemo(() => {
    return artifacts.find((a: any) => String(a.id) === selectedMapId);
  }, [artifacts, selectedMapId]);

  const screens = useMemo(() => {
    if (!selectedMap || !Array.isArray(selectedMap.screens)) return [];
    return [...selectedMap.screens].sort((a: any, b: any) => {
      const idxA = a.screen_index ?? 9999;
      const idxB = b.screen_index ?? 9999;
      if (idxA !== idxB) return idxA - idxB;
      return String(a.screen_id || "").localeCompare(String(b.screen_id || ""));
    });
  }, [selectedMap]);

  // Load deterministic sequence initially or cache
  useEffect(() => {
    if (!selectedMap) {
      setNodes([]);
      setEdges([]);
      setError(null);
      return;
    }
    
    if (screens.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    
    const cacheKey = `${selectedMap.id}-${selectedMap.version || "1.0"}-${selectedMap.signature_hash || ""}`;
    const cached = journeyCache.get(cacheKey);
    
    if (cached) {
      renderAnalysis(cached);
      return;
    }
    
    // Render deterministic sequence immediately
    renderDeterministic();
  }, [selectedMap, screens]);

  const renderDeterministic = useCallback(() => {
    if (!selectedMap) return;
    const newNodes: any[] = [];
    const newEdges: any[] = [];
    
    screens.forEach((screen, i) => {
      const id = `journey-screen-${selectedMap.id}-${screen.screen_id || i}`;
      newNodes.push({
        id,
        type: 'screen',
        data: {
          screen,
          summary: screen.instruction || "Sem instrução",
          confidence: 'DOCUMENTAL',
          rationale: 'Ordem original',
          onClick: () => {
             const actualScreen = selectedMap.screens.find((s:any) => s.screen_id === screen.screen_id) || screen;
             onSelectScreen({ ...actualScreen, belongsToMap: selectedMap });
          }
        }
      });
      
      if (i > 0) {
        const prevScreen = screens[i - 1];
        const prevId = `journey-screen-${selectedMap.id}-${prevScreen.screen_id || (i - 1)}`;
        newEdges.push({
          id: `journey-edge-${prevId}-${id}-seq`,
          source: prevId,
          target: id,
          type: 'smoothstep',
          animated: false,
          style: { strokeWidth: 2, stroke: '#94a3b8' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' }
        });
      }
    });
    
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'LR');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 800 });
    }, 100);
  }, [selectedMap, screens, setNodes, setEdges, fitView, onSelectScreen]);

  const renderAnalysis = useCallback((analysis: any) => {
    if (!selectedMap) return;
    
    const newNodes = analysis.nodes.map((n: any) => {
      const isDecision = n.kind === 'decision';
      const screenObj = isDecision ? null : screens.find(s => String(s.screen_id) === String(n.screenId)) || screens[0];
      
      return {
        id: n.id,
        type: n.kind,
        data: {
          ...n,
          screen: screenObj,
          onClick: () => {
             if (!isDecision && screenObj) {
               const actualScreen = selectedMap.screens.find((s:any) => s.screen_id === screenObj.screen_id) || screenObj;
               onSelectScreen({ ...actualScreen, belongsToMap: selectedMap });
             } else {
               // Modal genérico para decisão, se necessário
               alert(`Condição: ${n.condition}\nJustificativa: ${n.rationale}`);
             }
          }
        }
      };
    });
    
    const newEdges = analysis.edges.map((e: any) => {
      const isAmbiguous = e.confidence === 'AMBIGUO';
      return {
        ...e,
        type: 'smoothstep',
        animated: isAmbiguous,
        style: { 
          strokeWidth: 2, 
          stroke: isAmbiguous ? '#fbbf24' : '#7B0209',
          strokeDasharray: isAmbiguous ? '5,5' : 'none'
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          color: isAmbiguous ? '#fbbf24' : '#7B0209' 
        }
      };
    });
    
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'LR');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 800 });
    }, 100);
  }, [selectedMap, screens, setNodes, setEdges, fitView, onSelectScreen]);

  const handleAnalyze = async () => {
    if (!selectedMap) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/journeys/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifact: selectedMap })
      });
      if (!res.ok) throw new Error("A análise por IA está indisponível.");
      const data = await res.json();
      
      const cacheKey = `${selectedMap.id}-${selectedMap.version || "1.0"}-${selectedMap.signature_hash || ""}`;
      journeyCache.set(cacheKey, data);
      
      renderAnalysis(data);
    } catch (e: any) {
      console.error(e);
      setError("A análise por IA está indisponível. Exibindo a sequência documental das telas.");
      renderDeterministic();
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Search logic
  useEffect(() => {
    if (!debouncedSearch) {
      setNodes(nds => nds.map(n => ({ ...n, selected: false })));
      return;
    }
    
    const term = debouncedSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    let foundNode: any = null;
    
    setNodes(nds => nds.map(n => {
      let isMatch = false;
      const d = n.data;
      if (d.summary && d.summary.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)) isMatch = true;
      if (d.rationale && d.rationale.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)) isMatch = true;
      if (d.screen) {
        if (d.screen.screen_id && d.screen.screen_id.toLowerCase().includes(term)) isMatch = true;
        const snippets = d.screen.snippets || [];
        for (const s of snippets) {
          if (s.event_normalized && s.event_normalized.toLowerCase().includes(term)) isMatch = true;
          if (s.base_key && s.base_key.toLowerCase().includes(term)) isMatch = true;
          if (s.raw_code && s.raw_code.toLowerCase().includes(term)) isMatch = true;
        }
      }
      
      if (isMatch && !foundNode) foundNode = n;
      return { ...n, selected: isMatch };
    }));
    
    if (foundNode) {
      setCenter(foundNode.position.x + 140, foundNode.position.y + 90, { duration: 800, zoom: 1.2 });
    }
  }, [debouncedSearch, setNodes, setCenter]);

  if (!selectedMapId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50">
        <p className="text-gray-500 dark:text-slate-400">Selecione um mapa para visualizar sua jornada.</p>
      </div>
    );
  }

  if (screens.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50">
        <p className="text-gray-500 dark:text-slate-400">Nenhuma tela estruturada foi encontrada neste mapa.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative bg-gray-50/30 dark:bg-slate-950">
      
      {/* Header controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar tela, evento ou código..."
            className="pl-9 pr-4 py-2 w-[300px] h-10 rounded-full border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#7B0209] transition-all shadow-sm dark:text-slate-200"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="h-10 px-4 rounded-full bg-[#7B0209] hover:bg-[#630005] text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
          {journeyCache.has(`${selectedMap.id}-${selectedMap.version || "1.0"}-${selectedMap.signature_hash || ""}`) ? 'Analisar novamente' : 'Gerar jornada'}
        </button>
      </div>
      
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2">
          <Info className="w-4 h-4" />
          {error}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#ccc" gap={16} />
        <Controls />
        <MiniMap 
          nodeColor={(n: any) => {
            if (n.type === 'decision') return '#fbbf24';
            return n.selected ? '#7B0209' : '#e2e8f0';
          }}
          maskColor="rgba(0,0,0,0.1)"
          className="dark:bg-slate-800"
        />
      </ReactFlow>
    </div>
  );
};

export const JourneysCanvas = (props: any) => (
  <ReactFlowProvider>
    <JourneysCanvasInner {...props} />
  </ReactFlowProvider>
);
