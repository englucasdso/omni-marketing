import React, { useMemo } from 'react';
import { Artifact } from '../types';

interface Props {
  artifacts: Artifact[];
  selectedProduct: string;
  onSelectProduct: (val: string) => void;
  selectedSubproduct: string;
  onSelectSubproduct: (val: string) => void;
  selectedMapId: string;
  onSelectMapId: (val: string) => void;
}

export const JourneysSidebarFilters: React.FC<Props> = ({
  artifacts,
  selectedProduct,
  onSelectProduct,
  selectedSubproduct,
  onSelectSubproduct,
  selectedMapId,
  onSelectMapId
}) => {
  const eligibleMaps = useMemo(() => {
    return artifacts.filter(a => a.artifact_type === 'MAPA' && Array.isArray(a.screens) && a.screens.length > 0);
  }, [artifacts]);

  const products = useMemo(() => {
    const set = new Set<string>();
    eligibleMaps.forEach(a => {
      const p = Array.isArray(a.ancestor_titles) ? a.ancestor_titles[1] : '';
      if (p) set.add(String(p).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [eligibleMaps]);

  const subproducts = useMemo(() => {
    if (!selectedProduct) return [];
    const set = new Set<string>();
    eligibleMaps.forEach(a => {
      const p = Array.isArray(a.ancestor_titles) ? String(a.ancestor_titles[1] || '').trim() : '';
      if (p === selectedProduct) {
        const sub = Array.isArray(a.ancestor_titles) ? a.ancestor_titles[2] : '';
        if (sub) set.add(String(sub).trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [eligibleMaps, selectedProduct]);

  const maps = useMemo(() => {
    if (!selectedProduct || !selectedSubproduct) return [];
    const list: {id: string, name: string}[] = [];
    const seen = new Set<string>();
    eligibleMaps.forEach(a => {
      const p = Array.isArray(a.ancestor_titles) ? String(a.ancestor_titles[1] || '').trim() : '';
      const sub = Array.isArray(a.ancestor_titles) ? String(a.ancestor_titles[2] || '').trim() : '';
      if (p === selectedProduct && sub === selectedSubproduct) {
        const title = String(a.titulo || a.id).trim();
        const idStr = String(a.id);
        if (!seen.has(idStr)) {
          seen.add(idStr);
          list.push({ id: idStr, name: title });
        }
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [eligibleMaps, selectedProduct, selectedSubproduct]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Produto</label>
        <select
          className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-2 focus:ring-2 focus:ring-omni-brand-accent focus:border-omni-brand-accent transition-all dark:text-slate-200"
          value={selectedProduct}
          onChange={(e) => {
            onSelectProduct(e.target.value);
            onSelectSubproduct('');
            onSelectMapId('');
          }}
        >
          <option value="">Selecione...</option>
          {products.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Subproduto</label>
        <select
          className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-2 focus:ring-2 focus:ring-omni-brand-accent focus:border-omni-brand-accent transition-all dark:text-slate-200"
          value={selectedSubproduct}
          onChange={(e) => {
            onSelectSubproduct(e.target.value);
            onSelectMapId('');
          }}
          disabled={!selectedProduct}
        >
          <option value="">Selecione...</option>
          {subproducts.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Mapa</label>
        <select
          className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-2 focus:ring-2 focus:ring-omni-brand-accent focus:border-omni-brand-accent transition-all dark:text-slate-200"
          value={selectedMapId}
          onChange={(e) => onSelectMapId(e.target.value)}
          disabled={!selectedSubproduct}
        >
          <option value="">Selecione...</option>
          {maps.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
