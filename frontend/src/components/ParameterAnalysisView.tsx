import React, { useState, useMemo } from 'react';
import { 
  Tag, Search, Filter, Code2, Layers, ChevronRight, 
  Sparkles, Database, FileText, Check
} from 'lucide-react';
import { Artifact, ParameterSummaryItem } from '../types';

interface ParameterAnalysisViewProps {
  artifacts: Artifact[];
  onOpenMap: (map: Artifact) => void;
}

export const ParameterAnalysisView: React.FC<ParameterAnalysisViewProps> = ({ 
  artifacts,
  onOpenMap 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParamKey, setSelectedParamKey] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Consolidated parameter dictionary
  const parametersCatalog = useMemo(() => {
    const map = new Map<string, {
      name: string;
      occurrences: number;
      screensCount: number;
      mapsCount: number;
      distinctValues: Set<string>;
      valueTypes: Record<string, number>;
      associatedMaps: Artifact[];
      products: Set<string>;
    }>();

    artifacts.forEach(art => {
      const artParams = art.parameter_summary || [];
      const prodName = art.produto || 'Sem Produto';

      artParams.forEach(param => {
        if (!map.has(param.name)) {
          map.set(param.name, {
            name: param.name,
            occurrences: 0,
            screensCount: 0,
            mapsCount: 0,
            distinctValues: new Set(),
            valueTypes: {},
            associatedMaps: [],
            products: new Set()
          });
        }

        const entry = map.get(param.name)!;
        entry.occurrences += param.occurrences;
        entry.screensCount += param.screens_count;
        entry.mapsCount += 1;
        entry.associatedMaps.push(art);
        if (prodName) entry.products.add(prodName);

        (param.distinct_values || []).forEach(v => entry.distinctValues.add(v));
        
        Object.entries(param.value_types || {}).forEach(([vType, count]) => {
          entry.valueTypes[vType] = (entry.valueTypes[vType] || 0) + count;
        });
      });
    });

    return Array.from(map.values()).map(p => {
      // Determine predominant value type
      const predominantType = Object.entries(p.valueTypes)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'STRING';

      return {
        ...p,
        distinctValuesList: Array.from(p.distinctValues),
        productsList: Array.from(p.products),
        predominantType
      };
    }).sort((a, b) => b.occurrences - a.occurrences);
  }, [artifacts]);

  const filteredCatalog = useMemo(() => {
    let result = parametersCatalog;

    if (filterType !== 'all') {
      result = result.filter(p => p.predominantType === filterType);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.distinctValuesList.some(v => v.toLowerCase().includes(term)) ||
        p.productsList.some(pr => pr.toLowerCase().includes(term))
      );
    }

    return result;
  }, [parametersCatalog, searchTerm, filterType]);

  const activeParam = selectedParamKey 
    ? parametersCatalog.find(p => p.name === selectedParamKey) 
    : filteredCatalog[0] || null;

  const getValueBadge = (type: string) => {
    switch (type) {
      case 'PLACEHOLDER':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'HARDCODED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'JAVASCRIPT_REFERENCE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header and Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 flat-card p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-neu-card">
        <div>
          <h2 className="text-2xl brand-title font-heading tracking-tight">
            Catálogo e Dicionário de Parâmetros
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 font-ui">
            Total de {parametersCatalog.length} parâmetros mapeados em todos os snippets dataLayer catalogados.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Quick filter by predominant value type */}
          <div className="flex bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-ui font-semibold">
            {['all', 'PLACEHOLDER', 'HARDCODED', 'JAVASCRIPT_REFERENCE'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterType === t 
                    ? 'bg-white dark:bg-slate-900 text-bradesco-red shadow-neu-raised font-bold border border-gray-200 dark:border-slate-700' 
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'PLACEHOLDER' ? 'Placeholder' : t === 'HARDCODED' ? 'Hardcoded' : 'JS Ref'}
              </button>
            ))}
          </div>

          <div className="w-full md:w-64 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Buscar parâmetro ou valor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="neu-input w-full pl-10 pr-4 py-2 rounded-xl text-xs font-ui font-medium text-gray-800 dark:text-slate-200 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Parameters list + Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left side: Parameter list */}
        <div className="lg:col-span-6 space-y-2.5 max-h-[750px] overflow-y-auto custom-scrollbar pr-2">
          {filteredCatalog.length === 0 ? (
            <div className="p-12 text-center text-gray-400 flat-card rounded-2xl border border-gray-200 dark:border-slate-800 font-ui text-sm">
              Nenhum parâmetro encontrado com os filtros atuais.
            </div>
          ) : (
            filteredCatalog.map(param => {
              const isSelected = activeParam?.name === param.name;
              return (
                <div 
                  key={param.name}
                  onClick={() => setSelectedParamKey(param.name)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-white dark:bg-slate-800/90 border-bradesco-red shadow-neu-raised ring-1 ring-bradesco-red/20 -translate-x-0.5' 
                      : 'flat-card border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 shadow-neu-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900 dark:text-slate-100">
                        {param.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-ui font-semibold border ${getValueBadge(param.predominantType)}`}>
                        {param.predominantType}
                      </span>
                    </div>

                    <span className="text-[11px] font-heading font-bold text-bradesco-red bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-100 dark:border-red-900 tabular-nums">
                      {param.occurrences}x
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-ui text-gray-500 dark:text-slate-400">
                    <span className="tabular-nums">{param.screensCount} telas</span>
                    <span>•</span>
                    <span className="tabular-nums">{param.mapsCount} mapas</span>
                    <span>•</span>
                    <span className="tabular-nums">{param.productsList.length} produtos</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right side: Parameter Details */}
        <div className="lg:col-span-6">
          {activeParam ? (
            <div className="flat-card rounded-2xl border border-gray-200 dark:border-slate-800 p-6 md:p-8 space-y-6 sticky top-6 shadow-neu-card">
              <div className="pb-6 border-b border-gray-100 dark:border-slate-800">
                <span className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Detalhes do Parâmetro
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h3 className="text-2xl font-mono font-bold text-gray-900 dark:text-slate-50 tracking-tight">
                    {activeParam.name}
                  </h3>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-ui font-semibold border ${getValueBadge(activeParam.predominantType)}`}>
                    Predominante: {activeParam.predominantType}
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 text-center font-ui">
                <div className="p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Ocorrências</span>
                  <span className="text-xl font-heading font-bold text-gray-900 dark:text-slate-100 tabular-nums">{activeParam.occurrences}</span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Telas com Campo</span>
                  <span className="text-xl font-heading font-bold text-gray-900 dark:text-slate-100 tabular-nums">{activeParam.screensCount}</span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Mapas Vinculados</span>
                  <span className="text-xl font-heading font-bold text-gray-900 dark:text-slate-100 tabular-nums">{activeParam.mapsCount}</span>
                </div>
              </div>

              {/* Distinct Values Sample */}
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-2">
                  Valores Distintos Identificados ({activeParam.distinctValuesList.length})
                </h4>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-2 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
                  {activeParam.distinctValuesList.map((val, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-mono text-gray-800 dark:text-slate-200"
                    >
                      {val}
                    </span>
                  ))}
                </div>
              </div>

              {/* Products utilizing this parameter */}
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-2">
                  Produtos e Jornadas que Utilizam ({activeParam.productsList.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {activeParam.productsList.map(prod => (
                    <span 
                      key={prod}
                      className="px-3 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300"
                    >
                      {prod}
                    </span>
                  ))}
                </div>
              </div>

              {/* Associated Maps */}
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-2">
                  Mapas onde o Parâmetro Está Presente
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {activeParam.associatedMaps.map(mapItem => (
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
                          {mapItem.produto} • {mapItem.subproduto || 'Geral'}
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
              Selecione um parâmetro para inspecionar seus detalhes e ocorrências.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
