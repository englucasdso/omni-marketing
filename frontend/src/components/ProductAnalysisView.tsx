import React, { useState, useMemo } from 'react';
import { 
  Search, ChevronRight, ArrowUpRight, Filter, AlertTriangle
} from 'lucide-react';
import { Artifact } from '../types';
import { PageHeader } from './PageHeader';
import { normalizarStatus, OfficialStatus, STATUS_CONFIGS } from '../utils/statusUtils';

interface ProductAnalysisViewProps {
  artifacts: Artifact[];
  onSelectProduct: (produto: string) => void;
  onOpenMap: (map: Artifact) => void;
  onBack?: () => void;
}

export const ProductAnalysisView: React.FC<ProductAnalysisViewProps> = ({ 
  artifacts, 
  onSelectProduct,
  onOpenMap,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);
  const [selectedSubproduto, setSelectedSubproduto] = useState<string>('TODOS');

  // Consolidação por produto
  const productsSummary = useMemo(() => {
    const map = new Map<string, {
      produto: string;
      subprodutos: Set<string>;
      mapas: Artifact[];
      totalTelas: number;
      mapasComTelas: number;
      mapasHomologados: number;
      mapasSemTelas: number;
      screenStatusCounts: Record<OfficialStatus, number>;
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
          mapasComTelas: 0,
          mapasHomologados: 0,
          mapasSemTelas: 0,
          screenStatusCounts: {
            VALIDADO: 0,
            'CORREÇÃO': 0,
            NOVO: 0,
            EXCLUIR: 0,
            DESCONTINUAR: 0
          },
          measurementCounts: { GA4: 0, GA3: 0, MISTO: 0, NAO_CLASSIFICADO: 0 },
          parametersMap: new Map()
        });
      }

      const pEntry = map.get(prodName)!;
      pEntry.mapas.push(art);
      if (art.subproduto) pEntry.subprodutos.add(art.subproduto);

      const screens = art.screens || [];
      if (screens.length > 0) {
        pEntry.mapasComTelas++;
        let allValidado = true;
        screens.forEach(s => {
          const st = normalizarStatus(s.status);
          if (st) {
            pEntry.screenStatusCounts[st]++;
            pEntry.totalTelas++;
          }
          if (st !== 'VALIDADO') {
            allValidado = false;
          }
        });
        if (allValidado) {
          pEntry.mapasHomologados++;
        }
      } else {
        pEntry.mapasSemTelas++;
      }

      const mClass = art.measurement_class || (art.tipo_mapa?.toLowerCase().includes('ga4') ? 'GA4' : 'GA3');
      pEntry.measurementCounts[mClass] = (pEntry.measurementCounts[mClass] || 0) + 1;

      // Frequência de parâmetros
      (art.parameter_summary || []).forEach(param => {
        pEntry.parametersMap.set(param.name, (pEntry.parametersMap.get(param.name) || 0) + param.occurrences);
      });
    });

    return Array.from(map.values()).map(p => {
      const totalMaps = p.mapas.length;
      // Taxa de homologação: mapas com 100% das telas validadas / mapas com ao menos uma tela
      const taxaHomologacao = p.mapasComTelas > 0 
        ? Math.round((p.mapasHomologados / p.mapasComTelas) * 100) 
        : 0;

      const topParameters = Array.from(p.parametersMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        ...p,
        totalMaps,
        subprodutosList: Array.from(p.subprodutos).sort(),
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
    ? productsSummary.find(p => p.produto === selectedProductKey) || filteredProducts[0] || null
    : filteredProducts[0] || null;

  // Filtro por subproduto dentro do produto ativo
  const selectedMaps = useMemo(() => {
    if (!activeProduct) return [];
    if (selectedSubproduto === 'TODOS') return activeProduct.mapas;
    return activeProduct.mapas.filter(m => (m.subproduto || 'Sem subproduto') === selectedSubproduto);
  }, [activeProduct, selectedSubproduto]);

  // Métricas dinâmicas do produto / subproduto selecionado
  const selectedMetrics = useMemo(() => {
    let totalTelas = 0;
    let extractionErrorsCount = 0;
    const statusCounts: Record<OfficialStatus, number> = {
      VALIDADO: 0,
      'CORREÇÃO': 0,
      NOVO: 0,
      EXCLUIR: 0,
      DESCONTINUAR: 0
    };
    const measurementCounts: Record<string, number> = {
      GA4: 0,
      GA3: 0,
      MISTO: 0,
      NAO_CLASSIFICADO: 0
    };
    let mapasComTelas = 0;
    let mapasHomologados = 0;
    let mapasSemTelas = 0;

    selectedMaps.forEach(art => {
      const screens = art.screens || [];
      if (screens.length > 0) {
        mapasComTelas++;
        let allValidado = true;
        screens.forEach(s => {
          const st = normalizarStatus(s.status);
          if (st) {
            statusCounts[st]++;
            totalTelas++;
          } else {
            extractionErrorsCount++;
          }
          if (st !== 'VALIDADO') {
            allValidado = false;
          }
        });
        if (allValidado) {
          mapasHomologados++;
        }
      } else {
        mapasSemTelas++;
      }

      const mClass = art.measurement_class || (art.tipo_mapa?.toLowerCase().includes('ga4') ? 'GA4' : 'GA3');
      measurementCounts[mClass] = (measurementCounts[mClass] || 0) + 1;
    });

    const taxaHomologacao = mapasComTelas > 0 
      ? Math.round((mapasHomologados / mapasComTelas) * 100) 
      : 0;

    return {
      totalTelas,
      statusCounts,
      measurementCounts,
      mapasComTelas,
      mapasHomologados,
      mapasSemTelas,
      taxaHomologacao,
      extractionErrorsCount
    };
  }, [selectedMaps]);

  const handleSelectProduct = (prodName: string) => {
    setSelectedProductKey(prodName);
    setSelectedSubproduto('TODOS');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Análise por Produto e Subproduto"
        subtitle="Visão consolidada da esteira analítica dividida por canais, jornadas e serviços."
        showBack={!!onBack}
        onBack={onBack}
        actions={
          <div className="w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Filtrar por produto ou subproduto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="neu-input w-full pl-9 pr-4 py-2 rounded-xl text-xs font-ui font-medium text-gray-800 dark:text-slate-200 outline-none"
            />
          </div>
        }
      />

      {/* Main Grid: Left List + Right Product Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Product Cards List */}
        <div className="lg:col-span-5 space-y-3">
          {filteredProducts.map(prod => {
            const isSelected = activeProduct?.produto === prod.produto;
            return (
              <div 
                key={prod.produto}
                onClick={() => handleSelectProduct(prod.produto)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-white dark:bg-slate-800/90 border-bradesco-red shadow-neu-raised ring-1 ring-bradesco-red/20 -translate-y-0.5' 
                    : 'flat-card border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 shadow-neu-card'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-heading font-bold text-gray-900 dark:text-slate-100">
                    {prod.produto}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-ui font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 tabular-nums">
                    {prod.totalMaps} mapas
                  </span>
                </div>

                <p className="text-[11px] font-ui text-gray-500 dark:text-slate-400 mb-3 truncate">
                  {prod.subprodutosList.length > 0 
                    ? `${prod.subprodutosList.length} subprodutos: ${prod.subprodutosList.join(', ')}` 
                    : 'Sem subprodutos'}
                </p>

                <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-gray-100 dark:border-slate-800 text-[10px] font-ui">
                  <div>
                    <span className="text-gray-400 block font-medium">TELAS</span>
                    <span className="font-heading font-bold text-gray-800 dark:text-slate-200 tabular-nums">{prod.totalTelas}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-medium">HOMOLOGADOS</span>
                    <span className="font-heading font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{prod.taxaHomologacao}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-medium">GA4</span>
                    <span className="font-heading font-bold text-gray-800 dark:text-slate-200 tabular-nums">{prod.measurementCounts.GA4 || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Product Details Panel */}
        <div className="lg:col-span-7">
          {activeProduct ? (
            <div className="flat-card rounded-2xl border border-gray-200 dark:border-slate-800 p-6 md:p-8 space-y-6 sticky top-6 shadow-neu-card">
              <div className="flex items-start justify-between gap-4 pb-6 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    Detalhamento do Produto
                  </span>
                  <h3 className="text-2xl brand-title font-heading tracking-tight mt-1">
                    {activeProduct.produto}
                  </h3>
                </div>

                <button 
                  onClick={() => onSelectProduct(activeProduct.produto)}
                  className="btn-neu px-4 py-2 rounded-xl text-xs font-ui font-semibold text-bradesco-red hover:text-bradesco-red-hover flex items-center gap-1.5 cursor-pointer"
                >
                  Ver no Inventário <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Subproduto Selector (se houver subprodutos) */}
              {activeProduct.subprodutosList.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-ui font-semibold text-gray-600 dark:text-slate-400">
                      Filtrar por Subproduto:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSubproduto('TODOS')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-ui font-medium transition-all cursor-pointer ${
                        selectedSubproduto === 'TODOS'
                          ? 'bg-white dark:bg-slate-800 text-bradesco-red border border-bradesco-red/40 shadow-neu-raised'
                          : 'btn-neu text-gray-600 dark:text-slate-300 hover:text-gray-900'
                      }`}
                    >
                      Todos ({activeProduct.mapas.length})
                    </button>
                    {activeProduct.subprodutosList.map(sub => {
                      const countMaps = activeProduct.mapas.filter(m => m.subproduto === sub).length;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSelectedSubproduto(sub)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-ui font-medium transition-all cursor-pointer ${
                            selectedSubproduto === sub
                              ? 'bg-white dark:bg-slate-800 text-bradesco-red border border-bradesco-red/40 shadow-neu-raised'
                              : 'btn-neu text-gray-600 dark:text-slate-300 hover:text-gray-900'
                          }`}
                        >
                          {sub} ({countMaps})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Distribuição de status das telas (5 status oficiais) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-ui font-semibold uppercase text-gray-500 dark:text-slate-400 tracking-wider">
                    Distribuição de status das telas
                  </h4>
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                    Total: {selectedMetrics.totalTelas} telas
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {/* VALIDADO: verde */}
                  <div className="p-3 rounded-xl border text-center text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                    <span className="text-lg font-heading font-bold block tabular-nums">{selectedMetrics.statusCounts.VALIDADO}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider">Validado</span>
                  </div>
                  {/* CORREÇÃO: vermelho */}
                  <div className="p-3 rounded-xl border text-center text-rose-700 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800">
                    <span className="text-lg font-heading font-bold block tabular-nums">{selectedMetrics.statusCounts['CORREÇÃO']}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider">Correção</span>
                  </div>
                  {/* NOVO: amarelo */}
                  <div className="p-3 rounded-xl border text-center text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800">
                    <span className="text-lg font-heading font-bold block tabular-nums">{selectedMetrics.statusCounts.NOVO}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider">Novo</span>
                  </div>
                  {/* EXCLUIR: cinza */}
                  <div className="p-3 rounded-xl border text-center text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700">
                    <span className="text-lg font-heading font-bold block tabular-nums">{selectedMetrics.statusCounts.EXCLUIR}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider">Excluir</span>
                  </div>
                  {/* DESCONTINUAR: azul */}
                  <div className="p-3 rounded-xl border text-center text-blue-700 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800">
                    <span className="text-lg font-heading font-bold block tabular-nums">{selectedMetrics.statusCounts.DESCONTINUAR}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider">Descontinuar</span>
                  </div>
                </div>

                {/* Diagnóstico técnico exclusivo em caso de falha de extração na fonte */}
                {selectedMetrics.extractionErrorsCount > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{selectedMetrics.extractionErrorsCount} tela(s) com estrutura de status não reconhecida no Confluence.</span>
                    </div>
                    <span className="text-[11px] font-medium opacity-80">Falha de extração</span>
                  </div>
                )}
              </div>

              {/* Métrica de Homologação dos Mapas */}
              <div className="p-4 bg-gray-50/80 dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-ui font-semibold uppercase text-gray-500 dark:text-slate-400 tracking-wider">
                    Mapas Homologados
                  </span>
                  <span className="text-base font-heading font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedMetrics.taxaHomologacao}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${selectedMetrics.taxaHomologacao}%` }} 
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 pt-1 gap-2">
                  <span>
                    <strong className="text-gray-900 dark:text-slate-100 font-semibold">{selectedMetrics.mapasHomologados}</strong> de{' '}
                    <strong className="text-gray-900 dark:text-slate-100 font-semibold">{selectedMetrics.mapasComTelas}</strong> mapas com telas detectadas (100% validados)
                  </span>
                  {selectedMetrics.mapasSemTelas > 0 && (
                    <span className="text-gray-400 dark:text-slate-500">
                      {selectedMetrics.mapasSemTelas} sem telas (não computados)
                    </span>
                  )}
                </div>
              </div>

              {/* Measurement breakdown */}
              <div>
                <h4 className="text-xs font-ui font-semibold uppercase text-gray-500 dark:text-slate-400 tracking-wider mb-3">
                  Classificação de Mensuração
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-3 bg-gray-50/80 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block">GA4 Puro</span>
                    <span className="text-base font-heading font-bold text-gray-800 dark:text-slate-100">{selectedMetrics.measurementCounts.GA4 || 0}</span>
                  </div>
                  <div className="p-3 bg-gray-50/80 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block">Universal/GA3</span>
                    <span className="text-base font-heading font-bold text-gray-800 dark:text-slate-100">{selectedMetrics.measurementCounts.GA3 || 0}</span>
                  </div>
                  <div className="p-3 bg-gray-50/80 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block">Misto</span>
                    <span className="text-base font-heading font-bold text-gray-800 dark:text-slate-100">{selectedMetrics.measurementCounts.MISTO || 0}</span>
                  </div>
                  <div className="p-3 bg-gray-50/80 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block">Não Classif.</span>
                    <span className="text-base font-heading font-bold text-gray-800 dark:text-slate-100">{selectedMetrics.measurementCounts.NAO_CLASSIFICADO || 0}</span>
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
                  Mapas Vinculados ({selectedMaps.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {selectedMaps.map(mapItem => (
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
            <div className="p-12 text-center text-gray-400 flat-card border border-gray-200 dark:border-slate-800 rounded-2xl shadow-neu-card">
              Selecione um produto ao lado para ver a análise detalhada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
