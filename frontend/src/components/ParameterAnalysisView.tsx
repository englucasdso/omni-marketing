import React, { useState, useMemo, useEffect } from 'react';
import { 
  Tag, Search, Filter, Code2, Layers, ChevronRight, 
  Sparkles, Database, FileText, Check
} from 'lucide-react';
import { Artifact, ParameterSummaryItem } from '../types';
import { PageHeader } from './PageHeader';

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
  const [selectedDistinctValue, setSelectedDistinctValue] = useState<string | null>(null);

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
      if (art.artifact_type !== 'MAPA') return;
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
      // Deduplicate associated maps
      const uniqueMaps = Array.from(new Map(p.associatedMaps.map(m => [m.id, m])).values());

      return {
        ...p,
        distinctValuesList: Array.from(p.distinctValues),
        productsList: Array.from(p.products),
        associatedMaps: uniqueMaps
      };
    }).sort((a, b) => b.occurrences - a.occurrences);
  }, [artifacts]);

  const filteredCatalog = useMemo(() => {
    let result = parametersCatalog;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.distinctValuesList.some(v => v.toLowerCase().includes(term))
      );
    }
    return result;
  }, [parametersCatalog, searchTerm]);

  const activeParam = selectedParamKey 
    ? parametersCatalog.find(p => p.name === selectedParamKey) 
    : filteredCatalog[0] || null;

  // Clear distinct value when param changes
  useEffect(() => {
    setSelectedDistinctValue(null);
  }, [activeParam?.name]);

  const handleSelectDistinctValue = (val: string) => {
    setSelectedDistinctValue(prev => prev === val ? null : val);
  };

  const activeParamFilteredMaps = useMemo(() => {
    if (!activeParam) return [];
    if (!selectedDistinctValue) return activeParam.associatedMaps;
    
    return activeParam.associatedMaps.filter(mapItem => {
      const paramSummaries = mapItem.parameter_summary || [];
      return paramSummaries.some(ps => 
        ps.name === activeParam.name && 
        (ps.distinct_values || []).includes(selectedDistinctValue)
      );
    });
  }, [activeParam, selectedDistinctValue]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="Análise por Parâmetro"
        subtitle="Frequência, mapeamento de tipos e valores distintos utilizados no disparo de eventos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left side: Parameter List */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar parâmetro ou valor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-bradesco-red/20 outline-none transition-all dark:text-slate-200 placeholder:text-gray-400"
              />
            </div>
          </div>

          {filteredCatalog.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flat-card rounded-2xl border border-gray-200 dark:border-slate-800 font-ui text-sm">
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
                      ? 'bg-red-50/50 dark:bg-slate-800/80 border-bradesco-red shadow-neu-raised ring-1 ring-inset ring-bradesco-red' 
                      : 'flat-card border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 shadow-neu-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-gray-900 dark:text-slate-100">
                        {param.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-ui font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-slate-700 tabular-nums">
                      {param.occurrences}x
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-ui text-gray-500 dark:text-slate-400">
                    <span className="tabular-nums">{param.screensCount} telas</span>
                    <span>•</span>
                    <span className="tabular-nums">{param.mapsCount} mapas</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right side: Parameter Details */}
        <div className="lg:col-span-7">
          {activeParam ? (
            <div className="flat-card rounded-2xl border border-gray-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-neu-card">
              <div className="pb-6 border-b border-gray-100 dark:border-slate-800">
                <span className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Detalhes do Parâmetro
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h3 className="text-2xl font-mono font-bold text-gray-900 dark:text-slate-50 tracking-tight">
                    {activeParam.name}
                  </h3>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 text-center font-ui">
                <div className="p-3 bg-gray-50/80 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] font-medium text-gray-400 uppercase block">Ocorrências</span>
                  <span className="text-xl font-heading font-bold text-gray-900 dark:text-slate-100 tabular-nums">{activeParam.occurrences}</span>
                </div>
                <div className="p-3 bg-gray-50/80 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] font-medium text-gray-400 uppercase block">Telas com Campo</span>
                  <span className="text-xl font-heading font-bold text-gray-900 dark:text-slate-100 tabular-nums">{activeParam.screensCount}</span>
                </div>
                <div className="p-3 bg-gray-50/80 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] font-medium text-gray-400 uppercase block">Mapas Vinculados</span>
                  <span className="text-xl font-heading font-bold text-gray-900 dark:text-slate-100 tabular-nums">{activeParam.mapsCount}</span>
                </div>
              </div>

              {/* Distinct Values Sample */}
              <div>
                <h4 className="text-xs font-ui font-semibold uppercase text-gray-500 dark:text-slate-400 tracking-wider mb-2">
                  Valores Distintos Identificados ({activeParam.distinctValuesList.length})
                </h4>
                <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50/80 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700">
                  {activeParam.distinctValuesList.map((val, idx) => {
                    const isSelected = selectedDistinctValue === val;
                    return (
                      <button 
                        key={idx}
                        onClick={() => handleSelectDistinctValue(val)}
                        className={`px-3 py-1.5 border rounded-lg text-xs font-mono transition-all outline-none focus:ring-2 focus:ring-bradesco-red/20 ${
                          isSelected 
                            ? 'bg-bradesco-red text-white border-bradesco-red shadow-md' 
                            : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-800 dark:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-600 cursor-pointer'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Associated Maps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-ui font-semibold uppercase text-gray-500 dark:text-slate-400 tracking-wider">
                    {selectedDistinctValue 
                      ? 'Mapas com o valor selecionado' 
                      : 'Mapas onde o parâmetro está presente'}
                  </h4>
                  {selectedDistinctValue && (
                    <span className="text-[10px] font-medium bg-red-100 text-bradesco-red dark:bg-red-900/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/50">
                      {activeParamFilteredMaps.length} encontrados
                    </span>
                  )}
                </div>
                
                {activeParamFilteredMaps.length === 0 ? (
                  <div className="p-6 text-center bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-slate-400">
                    Nenhum mapa encontrado com este valor.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeParamFilteredMaps.map(mapItem => (
                      <div 
                        key={mapItem.id}
                        onClick={() => onOpenMap(mapItem)}
                        className={`p-3 bg-gray-50/80 dark:bg-slate-800 hover:bg-red-50/50 dark:hover:bg-slate-750 rounded-xl border flex items-center justify-between cursor-pointer transition-colors group ${
                          selectedDistinctValue ? 'border-l-4 border-l-bradesco-red border-y-gray-200 border-r-gray-200 dark:border-y-slate-700 dark:border-r-slate-700' : 'border-gray-200 dark:border-slate-700'
                        }`}
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
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 flat-card border border-gray-200 dark:border-slate-800 rounded-2xl shadow-neu-card">
              Selecione um parâmetro para inspecionar seus detalhes e ocorrências.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
