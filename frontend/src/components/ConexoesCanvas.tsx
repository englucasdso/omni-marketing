import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  MiniMap
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import * as d3 from 'd3';
import { Info } from 'lucide-react';
import { Artifact } from '../types';

const normalizar = (str: string) => str ? str.toLowerCase().trim() : '';

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#94a3b8', strokeWidth: 2, opacity: 0.5 }
};

// Custom Product Node
const ProdutoNode = React.memo(({ data }: any) => {
  return (
    <>
      <div className="p-8 glass-card rounded-[40px] border border-purple-500/20 bg-purple-50/50 dark:bg-purple-900/20 shadow-2xl dark:shadow-none min-w-[250px] relative backdrop-blur-xl transition-all hover:border-purple-400/50">
        <button 
          onClick={data.onToggle}
          className="absolute -top-4 -right-4 bg-white dark:bg-slate-900 border-2 border-purple-200 text-purple-600 text-xs font-black min-w-[40px] h-[40px] flex items-center justify-center rounded-2xl shadow-lg dark:shadow-none z-20 hover:scale-110 active:scale-95 cursor-pointer transition-transform"
          title={data.isCollapsed ? "Expandir" : "Recolher"}
        >
          {data.count}
        </button>
        <span className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] block mb-2">Produto</span>
        <h4 className="text-xl font-bold text-gray-900 dark:text-slate-50 tracking-tight leading-tight">{data.label}</h4>
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white dark:!border-slate-800" />
    </>
  );
});

// Custom Subproduct Node
const SubprodutoNode = React.memo(({ data }: any) => {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white dark:!border-slate-800" />
      <div className="p-7 glass-card rounded-[35px] border border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/20 shadow-xl dark:shadow-none min-w-[250px] relative backdrop-blur-xl transition-all hover:border-blue-400/50">
        <button 
          onClick={data.onToggle}
          className="absolute -top-4 -right-4 bg-white dark:bg-slate-900 border-2 border-blue-200 text-blue-600 text-xs font-black min-w-[40px] h-[40px] flex items-center justify-center rounded-2xl shadow-lg dark:shadow-none z-20 hover:scale-110 active:scale-95 cursor-pointer transition-transform"
          title={data.isCollapsed ? "Expandir" : "Recolher"}
        >
          {data.count}
        </button>
        <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] block mb-2">Subproduto</span>
        <h4 className="text-lg font-bold text-gray-900 dark:text-slate-50 tracking-tight">{data.label}</h4>
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white dark:!border-slate-800" />
    </>
  );
});

// Custom Mapa Node
const MapaNode = React.memo(({ data }: any) => {
  const isSelected = data.selectedItemId === data.item.id;
  const t = normalizar(data.item.tipo_mapa);
  
  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white dark:!border-slate-800" />
      <div className={`w-[350px] p-6 glass-card rounded-[32px] border transition-all flex items-center justify-between bg-white/80 dark:bg-slate-800/90 backdrop-blur-2xl
        ${isSelected ? 'border-bradesco-red shadow-[0_8px_30px_rgba(204,9,47,0.2)] ring-2 ring-red-500/20 scale-105 z-50' : 'border-gray-200/50 dark:border-slate-700/50 hover:border-red-200 shadow-lg dark:shadow-none hover:shadow-xl'}
      `}>
        <div className="flex-1 min-w-0 pr-4">
          <h5 
            onClick={(e) => { e.stopPropagation(); data.item.link && window.open(data.item.link, '_blank'); }}
            className="text-[15px] font-bold text-gray-800 dark:text-slate-200 line-clamp-1 hover:text-bradesco-red transition-colors cursor-pointer mb-2"
          >
            {data.item.titulo}
          </h5>
          <div className="flex items-center gap-2">
             <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider
                ${t === 'ga4' ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:border-green-800/50' 
                : t === 'universal analytics' ? 'bg-red-50 text-bradesco-red border border-red-100 dark:bg-red-900/30 dark:border-red-800/50'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600'}
              `}>
                {data.item.tipo_mapa || 'Doc'}
             </div>
             <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 font-mono">#{data.item.id}</span>
          </div>
        </div>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            data.onSelect(data.item.id);
          }}
          className={`p-3 rounded-2xl transition-all shadow-sm dark:shadow-none pointer-events-auto
            ${isSelected 
              ? 'bg-gradient-to-r from-[#7d046d] to-[#cc092f] text-white shadow-red-200' 
              : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:text-bradesco-red hover:border-red-200 hover:bg-gray-50 dark:hover:bg-slate-800'}
          `}
          title="Ver detalhes"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
    </>
  );
});

const nodeTypes = {
  produto: ProdutoNode,
  subproduto: SubprodutoNode,
  mapa: MapaNode,
};

export const ConexoesCanvas = ({ 
  data, 
  selectedItemId, 
  onSelectItem 
}: { 
  data: Artifact[], 
  selectedItemId: string | null,
  onSelectItem: (id: string | null) => void 
}) => {
  const [expandedProducts, setExpandedProducts] = React.useState<Set<string>>(new Set());
  const [expandedSubproducts, setExpandedSubproducts] = React.useState<Set<string>>(new Set());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

  const toggleProduct = useCallback((p: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const toggleSubproduct = useCallback((s: string) => {
    setExpandedSubproducts(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  // Structural generation and physics layout
  useEffect(() => {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    const products = Array.from(new Set(data.map(i => i.produto || "Sem Produto"))).filter(Boolean);

    products.forEach((product, pIdx) => {
      const prodId = `prod-${product}`;
      const productSubpros = Array.from(new Set(data.filter(i => i.produto === product).map(i => i.subproduto || "Sem Subproduto"))).filter(Boolean);
      const isProdExpanded = expandedProducts.has(product);

      initialNodes.push({
        id: prodId,
        type: 'produto',
        position: { x: 0, y: pIdx * 250 }, // stack vertically by index
        data: { 
          label: product, 
          count: data.filter(i => i.produto === product).length,
          isCollapsed: !isProdExpanded,
          onToggle: () => toggleProduct(product),
          level: 0,
          pIdx
        }
      });

      if (isProdExpanded) {
        productSubpros.forEach((sub, sIdx) => {
          const subId = `sub-${product}-${sub}`;
          const subMapas = data.filter(i => i.produto === product && i.subproduto === sub);
          const isSubExpanded = expandedSubproducts.has(subId);

          initialNodes.push({
            id: subId,
            type: 'subproduto',
            position: { x: 0, y: Math.random() * 500 },
            data: { 
              label: sub, 
              count: subMapas.length,
              isCollapsed: !isSubExpanded,
              onToggle: () => toggleSubproduct(subId),
              level: 1
            }
          });

          initialEdges.push({
            id: `e-${prodId}-${subId}`,
            source: prodId,
            target: subId,
            ...defaultEdgeOptions
          });

          if (isSubExpanded) {
            subMapas.forEach((mapa, mIdx) => {
              const mapaId = `map-${mapa.id}`;
              
              initialNodes.push({
                id: mapaId,
                type: 'mapa',
                position: { x: 0, y: Math.random() * 500 },
                data: { 
                  item: mapa, 
                  selectedItemId,
                  onSelect: onSelectItem,
                  level: 2
                }
              });

              initialEdges.push({
                id: `e-${subId}-${mapaId}`,
                source: subId,
                target: mapaId,
                type: 'smoothstep',
                animated: false,
                style: { 
                  stroke: '#cbd5e1', 
                  strokeWidth: 2,
                  opacity: 0.5
                }
              });
            });
          }
        });
      }
    });

    // Start Physics Simulation
    if (simulationRef.current) {
        simulationRef.current.stop();
    }

    const simNodes = initialNodes.map(n => ({ 
        id: n.id, 
        x: n.position.x, 
        y: n.position.y, 
        type: n.type,
        level: n.data.level,
        pIdx: n.data.pIdx
    }));
    
    // We only pass valid object references to d3.forceLink
    const simEdges = initialEdges.map(e => ({ source: e.source, target: e.target, id: e.id }));

    // Define dimensions for correct centering in nodes
    const getW = (type: string) => type === 'mapa' ? 350 : 250;
    const getH = () => 120;

    let animationFrameId: number = 0;

    const sim = d3.forceSimulation(simNodes as any)
        .force('charge', d3.forceManyBody().strength((d: any) => d.type === 'mapa' ? -2000 : -3500).distanceMax(2000))
        .force('collide', d3.forceCollide().radius((d: any) => d.type === 'mapa' ? 180 : 140).iterations(3))
        // Stratified X positioning for lineage
        .force('x', d3.forceX((d: any) => {
            if (d.level === 0) return 0;
            if (d.level === 1) return 450;
            return 950;
        }).strength(0.8))
        // Gentle Y centering to pull everything into view, while products get stacked
        .force('y', d3.forceY((d: any) => {
            if (d.level === 0) return d.pIdx * 250;
            return 0; // Others gently float around 0, guided by links and collisions
        }).strength((d: any) => d.level === 0 ? 0.3 : 0.02))
        .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance((d: any) => {
             return d.target.type === 'mapa' ? 150 : 250;
        }).strength(0.5))
        .alphaDecay(0.02);

    // Fast-forward simulation to avoid initial layout calculation spam
    sim.tick(300);
    
    // Apply initial layout
    initialNodes.forEach((n) => {
       const sn = simNodes.find((s: any) => s.id === n.id) as any;
       if (sn) {
           n.position = { x: sn.x - getW(n.type)/2, y: sn.y - getH()/2 };
       }
    });

    let lastUpdate = Date.now();
    sim.on('tick', () => {
        const now = Date.now();
        // Throttle to ~30fps to avoid React overloading
        if (now - lastUpdate < 30) return;
        lastUpdate = now;

        if (animationFrameId) return;
        animationFrameId = requestAnimationFrame(() => {
            setNodes((current) => {
                let hasChanges = false;
                const nextNodes = current.map((n) => {
                    const sn = simNodes.find((s: any) => s.id === n.id) as any;
                    // Only update if not dragged and moved significantly
                    if (sn && !n.dragging) {
                        const nextX = sn.x - getW(n.type)/2;
                        const nextY = sn.y - getH()/2;
                        if (Math.abs(n.position.x - nextX) > 1 || Math.abs(n.position.y - nextY) > 1) {
                            hasChanges = true;
                            return { ...n, position: { x: nextX, y: nextY } };
                        }
                    }
                    return n;
                });
                return hasChanges ? nextNodes : current;
            });
            animationFrameId = 0;
        });
    });

    simulationRef.current = sim;
    setNodes(initialNodes);
    setEdges(initialEdges);

    return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        sim.stop();
    };
  }, [data, expandedProducts, expandedSubproducts]);

  // Handle Updates for Select Node (Highlighting)
  useEffect(() => {
    setNodes((nds) => 
      nds.map(node => {
        if (node.type === 'mapa') {
          return { ...node, data: { ...node.data, selectedItemId } };
        }
        return node;
      })
    );
    
    setEdges((eds) =>
      eds.map(edge => {
        if (edge.id.startsWith('e-sub-')) {
          const mapaId = edge.target.replace('map-', '');
          const isSelected = selectedItemId === mapaId;
          return {
            ...edge,
            animated: isSelected, // animate edge naturally flowing to the node
            style: {
              ...edge.style,
              stroke: isSelected ? '#cc092f' : '#cbd5e1',
              strokeWidth: isSelected ? 3 : 2,
              opacity: isSelected ? 1 : 0.5,
              filter: isSelected ? 'drop-shadow(0 0 4px rgba(204,9,47,0.3))' : 'none'
            }
          };
        }
        return edge;
      })
    );
  }, [selectedItemId]);

  // Feed React Flow Drag Events back into D3 Force Simulation
  const getSimNode = (id: string) => {
     if (!simulationRef.current) return null;
     return simulationRef.current.nodes().find((n: any) => n.id === id) as any;
  }

  const onNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    const sn = getSimNode(node.id);
    if (sn && simulationRef.current) {
        sn.fx = sn.x;
        sn.fy = sn.y;
        simulationRef.current.alphaTarget(0.3).restart();
    }
  }, []);

  const onNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    const sn = getSimNode(node.id);
    if (sn) {
        // translate back from top-left (react flow) to center point (d3)
        const w = node.type === 'mapa' ? 350 : 250;
        const h = 120;
        sn.fx = node.position.x + w/2;
        sn.fy = node.position.y + h/2;
    }
  }, []);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    const sn = getSimNode(node.id);
    if (sn && simulationRef.current) {
        sn.fx = null;
        sn.fy = null;
        simulationRef.current.alphaTarget(0); // cool down
    }
  }, []);

  return (
    <div className="w-full h-full relative flex-1" style={{ width: '100%', height: '100%', minHeight: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={2}
        panOnDrag={true}
        className="bg-gray-50/30 dark:bg-[#0B0F19]/50 rounded-[40px] pointer-events-auto"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={32} size={2} color="rgba(148, 163, 184, 0.2)" />
        <Controls 
          className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50 shadow-2xl fill-gray-600 dark:fill-slate-300 rounded-2xl overflow-hidden p-1 gap-1" 
          showInteractive={false}
        />
        <MiniMap 
          className="bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-gray-100 dark:border-slate-700/50 shadow-2xl rounded-2xl overflow-hidden" 
          nodeColor={(n) => {
            if (n.type === 'produto') return '#c084fc';
            if (n.type === 'subproduto') return '#60a5fa';
            return '#f87171'; // red maps
          }}
          maskColor="rgba(0, 0, 0, 0.2)"
        />
      </ReactFlow>
    </div>
  );
};

