import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

export interface SidebarContextualToolbarProps {
  /** Indica se deve exibir o campo de busca (apenas abas com busca) */
  hasSearch?: boolean;
  /** Valor digitado no campo de busca */
  searchValue?: string;
  /** Callback ao alterar o texto da busca */
  onSearchChange?: (value: string) => void;
  /** Texto de placeholder do campo de busca */
  searchPlaceholder?: string;

  /** Conteúdo dos filtros (dropdowns, selects, pills) */
  filters?: React.ReactNode;
  /** Título da seção de filtros (padrão: "Filtros") */
  filtersTitle?: string;
  /** Quantidade de filtros atualmente ativos para o badge numérico */
  activeFiltersCount?: number;
  /** Permite recolher/expandir a seção de filtros */
  defaultExpanded?: boolean;

  /** Indica se há filtros ou busca ativos que possam ser limpos */
  hasActiveFilters?: boolean;
  /** Callback para resetar filtros */
  onClearFilters?: () => void;
  /** Label do botão de reset (padrão: "Limpar filtros") */
  clearLabel?: string;
}

export const SidebarContextualToolbar: React.FC<SidebarContextualToolbarProps> = ({
  hasSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  filters,
  filtersTitle = 'Filtros',
  activeFiltersCount = 0,
  defaultExpanded = true,
  hasActiveFilters = false,
  onClearFilters,
  clearLabel = 'Limpar filtros',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="w-full min-w-0 max-w-full space-y-3">
      {/* Campo de busca contextual (renderizado somente se hasSearch for true) */}
      {hasSearch && (
        <div className="relative w-full min-w-0 max-w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="w-full h-9 pl-8.5 pr-7 rounded-xl text-xs font-ui font-medium text-gray-800 dark:text-slate-100 bg-gray-50/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#7B0209] focus:ring-1 focus:ring-[#7B0209]/20 transition-all truncate"
            title={searchValue || searchPlaceholder}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange && onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
              title="Limpar texto da busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Seção expansível de filtros */}
      {filters && (
        <div className="w-full min-w-0 max-w-full space-y-2">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-ui font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#7B0209] shrink-0" />
              <span className="truncate">{filtersTitle}</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#7B0209]/10 text-[#7B0209] dark:bg-red-950/40 dark:text-red-400 tabular-nums shrink-0">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            )}
          </button>

          {isExpanded && (
            <div className="space-y-2.5 pt-0.5 min-w-0 max-w-full">
              {filters}
            </div>
          )}
        </div>
      )}

      {/* Ação Limpar Filtros */}
      {hasActiveFilters && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-ui font-semibold text-gray-500 dark:text-slate-400 hover:text-[#7B0209] dark:hover:text-red-400 bg-gray-100/70 dark:bg-slate-800/60 hover:bg-red-50 dark:hover:bg-red-950/20 border border-gray-200/80 dark:border-slate-700/80 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#7B0209]" />
          <span>{clearLabel}</span>
        </button>
      )}
    </div>
  );
};

/**
 * Componente de campo para a sidebar contextual com label, ícone opcional e controle filho.
 */
export const SidebarFilterField: React.FC<{
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}> = ({ label, icon: Icon, children }) => (
  <div className="flex flex-col gap-1 min-w-0 max-w-full">
    <label className="text-[10px] font-ui font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1 text-left truncate">
      {Icon && <Icon className="w-3 h-3 text-[#7B0209] shrink-0" />}
      <span className="truncate">{label}</span>
    </label>
    {children}
  </div>
);

/**
 * Select padronizado para a sidebar contextual com suporte a truncamento e fuso visual de foco.
 */
export const SidebarSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className="relative w-full min-w-0 max-w-full">
    <select
      className={`w-full h-8.5 px-2.5 pr-7 rounded-xl text-xs font-ui font-medium text-gray-800 dark:text-slate-200 bg-gray-50/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 outline-none cursor-pointer focus:border-[#7B0209] focus:ring-1 focus:ring-[#7B0209]/20 truncate appearance-none transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
  </div>
);
