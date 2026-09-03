import React, { useState, useMemo } from 'react';
import { 
  Layers, Search, CheckCircle2, AlertTriangle, AlertCircle, 
  ChevronRight, BarChart3, Tag, FileText, ArrowUpRight
} from 'lucide-react';
import { Artifact } from '../types';

interface ProductAnalysisViewProps {
  artifacts: Artifact[];
  onSelectProduct: (produto: string) => void;
  onOpenMap: (map: Artifact) => void;
}

export const ProductAnalysisView: React.FC<ProductAnalysisViewProps> = ({ 
  artifacts, 
  onSelectProduct,
  onOpenMap 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);

  // Aggregation per product
  const productsSummary = useMemo(() => {
    const map = new Map<string, {
      produto: string;
      subprodutos: Set<string>;
      mapas: Artifact[];
      totalTelas: number;
      statusCounts: Record<string, number>;
      measurementCounts: Record<string, number>;
      parametersMap: Map<string, number>;
    }>();

    artifacts.forEach(art => {
      const prodName = art.produto || 'Sem Produto';
      if (!map.has(prodName)) {
        map.set(prodName, {
          produto: prodName,
          subprodutos: new Set(),
          mapas: [],
          totalTelas: 0,
          statusCounts: { VALIDADO: 0, CORRECAO: 0, NOVO: 0, EXCLUIR: 0, DESCONTINUAR: 0, NAO_IDENTIFICADO: 0 },
          measurementCounts: { GA4: 0, GA3: 0, MISTO: 0, NAO_CLASSIFICADO: 0 },
          parametersMap: new Map()
        });
      }

      const pEntry = map.get(prodName)!;
      pEntry.mapas.push(art);
      if (art.subproduto) pEntry.subprodutos.add(art.subproduto);

      const screens = art.screens || [];
      pEntry.totalTelas += screens.length;

      const calcStatus = art.calculated_status || art.declared_status || 'NAO_IDENTIFICADO';
      pEntry.statusCounts[calcStatus] = (pEntry.statusCounts[calcStatus] || 0) + 1;

      const mClass = art.measurement_class || (art.tipo_mapa?.toLowerCase().includes('ga4') ? 'GA4' : 'GA3');
      pEntry.measurementCounts[mClass] = (pEntry.measurementCounts[mClass] || 0) + 1;

      // Extract parameter frequency
      (art.parameter_summary || []).forEach(param => {
        pEntry.parametersMap.set(param.name, (pEntry.parametersMap.get(param.name) || 0) + param.occurrences);
      });
    });

    return Array.from(map.values()).map(p => {
      const totalMaps = p.mapas.length;
      const validados = p.statusCounts.VALIDADO || 0;
      const taxaHomologacao = totalMaps > 0 ? Math.round((validados / totalMaps) * 100) : 0;

      const topParameters = Array.from(p.parametersMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        ...p,
        totalMaps,
        subprodutosList: Array.from(p.subprodutos),
        taxaHomologacao,
        topParameters
      };
    }).sort((a, b) => b.totalMaps - a.totalMaps);
  }, [artifacts]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return productsSummary;
    const term = searchTerm.toLowerCase();
    return productsSummary.filter(p => 
      p.produto.toLowerCase().includes(term) ||
      p.subprodutosList.some(s => s.toLowerCase().includes(term))
    );
  }, [productsSummary, searchTerm]);

  const activeProduct = selectedProductKey 
    ? productsSummary.find(p => p.produto === selectedProductKey) 
    : filteredProducts[0] || null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Search and Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-6 rounded-[28px] border border-gray-100 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-slate-50 tracking-tight">
            Análise por Produto e Subproduto
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Visão consolidada da esteira analítica dividida por canais, jornadas e serviços.
          </p>
        </div>

        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Filtrar por produto ou subproduto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs outline-none focus:border-red-500 transition-colors"
          />
        </div>
      </div>

      {/* Main Grid: Left List + Right Product Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Product Cards List */}
        <div className="lg:col-span-5 space-y-3">
          {filteredProducts.map(prod => {
            const isSelected = activeProduct?.produto === prod.produto;
            return (
              <div 
                key={prod.produto}
                onClick={() => setSelectedProductKey(prod.produto)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-white dark:bg-slate-800 border-red-200 dark:border-red-900/60 shadow-lg dark:shadow-none shadow-red-500/5 -translate-y-0.5' 
                    : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-black text-gray-900 dark:text-slate-100">
                    {prod.produto}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-50 dark:bg-red-950/40 text-bradesco-red border border-red-100 dark:border-red-900">
                    {prod.totalMaps} mapas
                  </span>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-3 truncate">
                  {prod.subprodutosList.length > 0 
                    ? `${prod.subprodutosList.length} subprodutos: ${prod.subprodutosList.join(', ')}` 
                    : 'Sem subprodutos'}
                </p>

                <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-gray-100 dark:border-slate-800 text-[10px]">
                  <div>
                    <span className="text-gray-400 block font-bold">TELAS</span>
                    <span className="font-black text-gray-800 dark:text-slate-200">{prod.totalTelas}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-bold">HOMOLOGADOS</span>
                    <span className="font-black text-emerald-600">{prod.taxaHomologacao}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-bold">GA4</span>
                    <span className="font-black text-blue-600">{prod.measurementCounts.GA4 || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Product Details Panel */}
        <div className="lg:col-span-7">
          {activeProduct ? (
            <div className="glass-card rounded-[32px] border border-gray-100 dark:border-slate-800 p-8 space-y-6 sticky top-6">
              <div className="flex items-start justify-between gap-4 pb-6 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                    Detalhamento do Produto
                  </span>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-slate-50 tracking-tight mt-1">
                    {activeProduct.produto}
                  </h3>
                </div>

                <button 
                  onClick={() => onSelectProduct(activeProduct.produto)}
                  className="px-4 py-2 bg-bradesco-red text-white text-xs font-bold rounded-xl hover:opacity-95 transition-opacity flex items-center gap-1.5"
                >
                  Ver no Inventário <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status breakdown */}
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3">
                  Distribuição de Status dos Mapas
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: 'Validado', count: activeProduct.statusCounts.VALIDADO || 0, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                    { label: 'Correção', count: activeProduct.statusCounts.CORRECAO || 0, color: 'text-orange-700 bg-orange-50 border-orange-200' },
                    { label: 'Novo', count: activeProduct.statusCounts.NOVO || 0, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                    { label: 'Excluir', count: activeProduct.statusCounts.EXCLUIR || 0, color: 'text-rose-700 bg-rose-50 border-rose-200' },
                    { label: 'Descontinuar', count: activeProduct.statusCounts.DESCONTINUAR || 0, color: 'text-gray-700 bg-gray-100 border-gray-200' },
                  ].map(st => (
                    <div key={st.label} className={`p-3 rounded-xl border text-center ${st.color}`}>
                      <span className="text-lg font-black block">{st.count}</span>
                      <span className="text-[10px] font-bold uppercase">{st.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Measurement breakdown */}
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3">
                  Classificação de Mensuração
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-center">
                    <span className="text-xs font-bold text-gray-400 block">GA4 Puro</span>
                    <span className="text-base font-black text-emerald-600">{activeProduct.measurementCounts.GA4 || 0}</span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-center">
                    <span className="text-xs font-bold text-gray-400 block">Universal/GA3</span>
                    <span className="text-base font-black text-rose-600">{activeProduct.measurementCounts.GA3 || 0}</span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-center">
                    <span className="text-xs font-bold text-gray-400 block">Misto</span>
                    <span className="text-base font-black text-amber-600">{activeProduct.measurementCounts.MISTO || 0}</span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-center">
                    <span className="text-xs font-bold text-gray-400 block">Não Classif.</span>
                    <span className="text-base font-black text-gray-600">{activeProduct.measurementCounts.NAO_CLASSIFICADO || 0}</span>
                  </div>
                </div>
              </div>

              {/* Most used parameters in this product */}
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3">
                  Parâmetros Mais Recorrentes neste Produto
                </h4>
                {activeProduct.topParameters.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhum parâmetro detectado nos mapas deste produto.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeProduct.topParameters.map(param => (
                      <span 
                        key={param.name}
                        className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono text-gray-800 dark:text-slate-200 flex items-center gap-2"
                      >
                        <strong>{param.name}</strong>
                        <span className="text-[10px] text-gray-400">({param.count}x)</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Map items list */}
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3">
                  Mapas Vinculados ({activeProduct.mapas.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {activeProduct.mapas.map(mapItem => (
                    <div 
                      key={mapItem.id}
                      onClick={() => onOpenMap(mapItem)}
                      className="p-3 bg-gray-50 dark:bg-slate-800 hover:bg-red-50/50 dark:hover:bg-slate-750 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-between cursor-pointer transition-colors group"
                    >
                      <div className="overflow-hidden pr-2">
                        <p className="text-xs font-bold text-gray-900 dark:text-slate-100 group-hover:text-bradesco-red transition-colors truncate">
                          {mapItem.titulo}
                        </p>
                        <span className="text-[10px] text-gray-400">
                          {mapItem.subproduto || 'Geral'} • {mapItem.screens?.length || 0} telas
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-bradesco-red shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 glass-card rounded-[32px]">
              Selecione um produto ao lado para ver a análise detalhada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
