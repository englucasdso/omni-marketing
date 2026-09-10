import React, { useState } from 'react';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  AlertTriangle,
  ArrowUpDown,
  FileText,
  User,
  Calendar,
  Layers,
  Landmark,
  Tag,
  Code2
} from 'lucide-react';
import { MultiSelect } from './MultiSelect';

export interface SidebarContextualAreaProps {
  currentRouteId: string;

  // Cards (results)
  cardSearch: string;
  onCardSearchChange: (val: string) => void;
  cardSort: 'recentes' | 'antigos' | 'az' | 'za';
  onCardSortChange: (val: 'recentes' | 'antigos' | 'az' | 'za') => void;
  cardArtifactType: 'todos' | 'mapas' | 'docs' | 'nos';
  onCardArtifactTypeChange: (val: 'todos' | 'mapas' | 'docs' | 'nos') => void;
  cardResponsible: string;
  onCardResponsibleChange: (val: string) => void;
  cardYear: string;
  onCardYearChange: (val: string) => void;
  availableResponsibles: string[];
  availableYears: string[];
  isCardFilterActive: boolean;
  onResetCardFilters: () => void;

  // Inventário (inventory_table)
  tableFilter: string;
  onTableFilterChange: (val: string) => void;
  inventoryFilters: {
    tipo_mapa: string[];
    measurement_class: string[];
    produto: string[];
    subproduto: string[];
    parametro: string[];
    ano: string[];
  };
  onInventoryFiltersChange: (newFilters: any) => void;
  filterOptions: {
    tipoArtefato: { v: string; l: string }[];
    classificacao: { v: string; l: string }[];
    produtos: { v: string; l: string }[];
    subprodutos: { v: string; l: string }[];
    parametros: { v: string; l: string }[];
    anos: { v: string; l: string }[];
  };
  onlyWithoutResponsible: boolean;
  onToggleOnlyWithoutResponsible: () => void;
  onlyWithoutSubproduct: boolean;
  onToggleOnlyWithoutSubproduct: () => void;
  onlyDivergent: boolean;
  onToggleOnlyDivergent: () => void;
  isInventoryFilterActive: boolean;
  onResetInventoryFilters: () => void;

  // Por Produto (produtos_analise)
  productSearch: string;
  onProductSearchChange: (val: string) => void;
  productSubprodutoFilter: string;
  onProductSubprodutoFilterChange: (val: string) => void;
  availableProductSubprodutos: string[];
  isProductFilterActive: boolean;
  onResetProductFilters: () => void;

  // Por Parâmetro (parametros_analise)
  paramSearch: string;
  onParamSearchChange: (val: string) => void;
  isParamFilterActive: boolean;
  onResetParamFilters: () => void;

  // Insights (insights) - Não possui busca!
  insightsProductFilter: string;
  onInsightsProductFilterChange: (val: string) => void;
  availableInsightsProducts: string[];
  insightsSubprodutoFilter: string;
  onInsightsSubprodutoFilterChange: (val: string) => void;
  availableInsightsSubprodutos: string[];
  insightsMeasurementFilter: string;
  onInsightsMeasurementFilterChange: (val: string) => void;
  isInsightsFilterActive: boolean;
  onResetInsightsFilters: () => void;
}

export const SidebarContextualArea: React.FC<SidebarContextualAreaProps> = ({
  currentRouteId,

  // Cards
  cardSearch,
  onCardSearchChange,
  cardSort,
  onCardSortChange,
  cardArtifactType,
  onCardArtifactTypeChange,
  cardResponsible,
  onCardResponsibleChange,
  cardYear,
  onCardYearChange,
  availableResponsibles,
  availableYears,
  isCardFilterActive,
  onResetCardFilters,

  // Inventário
  tableFilter,
  onTableFilterChange,
  inventoryFilters,
  onInventoryFiltersChange,
  filterOptions,
  onlyWithoutResponsible,
  onToggleOnlyWithoutResponsible,
  onlyWithoutSubproduct,
  onToggleOnlyWithoutSubproduct,
  onlyDivergent,
  onToggleOnlyDivergent,
  isInventoryFilterActive,
  onResetInventoryFilters,

  // Por Produto
  productSearch,
  onProductSearchChange,
  productSubprodutoFilter,
  onProductSubprodutoFilterChange,
  availableProductSubprodutos,
  isProductFilterActive,
  onResetProductFilters,

  // Por Parâmetro
  paramSearch,
  onParamSearchChange,
  isParamFilterActive,
  onResetParamFilters,

  // Insights
  insightsProductFilter,
  onInsightsProductFilterChange,
  availableInsightsProducts,
  insightsSubprodutoFilter,
  onInsightsSubprodutoFilterChange,
  availableInsightsSubprodutos,
  insightsMeasurementFilter,
  onInsightsMeasurementFilterChange,
  isInsightsFilterActive,
  onResetInsightsFilters,
}) => {
  // Collapsible states for filters - initially collapsed
  const [isCardsFiltersOpen, setIsCardsFiltersOpen] = useState(false);
  const [isInventoryFiltersOpen, setIsInventoryFiltersOpen] = useState(false);
  const [isProductFiltersOpen, setIsProductFiltersOpen] = useState(false);
  const [isInsightsFiltersOpen, setIsInsightsFiltersOpen] = useState(false);

  // 1. CARDS (results)
  if (currentRouteId === 'results') {
    let activeFiltersCount = 0;
    if (cardSort !== 'recentes') activeFiltersCount++;
    if (cardArtifactType !== 'todos') activeFiltersCount++;
    if (cardResponsible !== 'todos') activeFiltersCount++;
    if (cardYear !== 'todas') activeFiltersCount++;

    return (
      <div className="flex flex-col gap-2 w-full min-w-0" id="sidebar-contextual-cards">
        {/* Campo de Busca */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="Buscar cards..."
            value={cardSearch}
            onChange={(e) => onCardSearchChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-gray-50/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-ui text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-bradesco-red focus:border-bradesco-red transition-all truncate"
          />
          {cardSearch && (
            <button
              onClick={() => onCardSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Botão de Filtros */}
        <button
          type="button"
          onClick={() => setIsCardsFiltersOpen(!isCardsFiltersOpen)}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-ui font-semibold transition-all border cursor-pointer ${
            isCardsFiltersOpen || activeFiltersCount > 0
              ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-bradesco-red'
              : 'bg-gray-50/80 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-bradesco-red text-white">
                {activeFiltersCount}
              </span>
            )}
          </div>
          {isCardsFiltersOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        {/* Filtros Expansíveis */}
        {isCardsFiltersOpen && (
          <div className="flex flex-col gap-2 pt-1">
            {/* Ordenação */}
            <div>
              <label className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Ordenação
              </label>
              <select
                value={cardSort}
                onChange={(e) => onCardSortChange(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-ui font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none cursor-pointer focus:border-bradesco-red truncate"
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
                <option value="az">Título de A a Z</option>
                <option value="za">Título de Z a A</option>
              </select>
            </div>

            {/* Artefato */}
            <div>
              <label className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Artefato
              </label>
              <select
                value={cardArtifactType}
                onChange={(e) => onCardArtifactTypeChange(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-ui font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none cursor-pointer focus:border-bradesco-red truncate"
              >
                <option value="todos">Todos os tipos</option>
                <option value="mapas">Mapas</option>
                <option value="docs">Documentações</option>
                <option value="nos">Nós</option>
              </select>
            </div>

            {/* Responsável */}
            <div>
              <label className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Responsável
              </label>
              <select
                value={cardResponsible}
                onChange={(e) => onCardResponsibleChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-ui font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none cursor-pointer focus:border-bradesco-red truncate"
              >
                <option value="todos">Todos os responsáveis</option>
                {availableResponsibles.map((resp) => (
                  <option key={resp} value={resp}>{resp}</option>
                ))}
              </select>
            </div>

            {/* Ano */}
            <div>
              <label className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Data (Ano)
              </label>
              <select
                value={cardYear}
                onChange={(e) => onCardYearChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-ui font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none cursor-pointer focus:border-bradesco-red truncate"
              >
                <option value="todas">Todos os anos</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Limpar filtros */}
            {isCardFilterActive && (
              <button
                type="button"
                onClick={onResetCardFilters}
                className="mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-ui font-medium text-gray-500 hover:text-bradesco-red dark:text-slate-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-bradesco-red" />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. INVENTÁRIO (inventory_table)
  if (currentRouteId === 'inventory_table') {
    const activeMultiCount = Object.values(inventoryFilters).filter(
      (arr) => arr && arr.length > 0 && !arr.includes('all')
    ).length;
    const togglesCount = (onlyWithoutResponsible ? 1 : 0) + (onlyWithoutSubproduct ? 1 : 0) + (onlyDivergent ? 1 : 0);
    const totalActiveCount = activeMultiCount + togglesCount;

    return (
      <div className="flex flex-col gap-2 w-full min-w-0" id="sidebar-contextual-inventory">
        {/* Campo de Busca */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="Buscar inventário..."
            value={tableFilter}
            onChange={(e) => onTableFilterChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-gray-50/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-ui text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-bradesco-red focus:border-bradesco-red transition-all truncate"
          />
          {tableFilter && (
            <button
              onClick={() => onTableFilterChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Botão de Filtros */}
        <button
          type="button"
          onClick={() => setIsInventoryFiltersOpen(!isInventoryFiltersOpen)}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-ui font-semibold transition-all border cursor-pointer ${
            isInventoryFiltersOpen || totalActiveCount > 0
              ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-bradesco-red'
              : 'bg-gray-50/80 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Filtros</span>
            {totalActiveCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-bradesco-red text-white">
                {totalActiveCount}
              </span>
            )}
          </div>
          {isInventoryFiltersOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        {/* Filtros Expansíveis */}
        {isInventoryFiltersOpen && (
          <div className="flex flex-col gap-2 pt-1">
            {/* MultiSelects compactos */}
            <div className="flex flex-col gap-2">
              <MultiSelect
                label="Artefato"
                icon={FileText}
                options={filterOptions.tipoArtefato}
                values={inventoryFilters.tipo_mapa || []}
                onChange={(vals) => onInventoryFiltersChange({ ...inventoryFilters, tipo_mapa: vals })}
              />

              <MultiSelect
                label="Classificação"
                icon={Layers}
                options={filterOptions.classificacao}
                values={inventoryFilters.measurement_class || []}
                onChange={(vals) => onInventoryFiltersChange({ ...inventoryFilters, measurement_class: vals })}
              />

              <MultiSelect
                label="Produto"
                icon={Landmark}
                options={filterOptions.produtos}
                values={inventoryFilters.produto || []}
                onChange={(vals) => onInventoryFiltersChange({ ...inventoryFilters, produto: vals })}
              />

              <MultiSelect
                label="Subproduto"
                icon={Tag}
                options={filterOptions.subprodutos}
                values={inventoryFilters.subproduto || []}
                onChange={(vals) => onInventoryFiltersChange({ ...inventoryFilters, subproduto: vals })}
              />

              <MultiSelect
                label="Parâmetro"
                icon={Code2}
                options={filterOptions.parametros}
                values={inventoryFilters.parametro || []}
                onChange={(vals) => onInventoryFiltersChange({ ...inventoryFilters, parametro: vals })}
              />

              <MultiSelect
                label="Ano"
                icon={Calendar}
                options={filterOptions.anos}
                values={inventoryFilters.ano || []}
                onChange={(vals) => onInventoryFiltersChange({ ...inventoryFilters, ano: vals })}
              />
            </div>

            {/* Toggles Rápidos */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100 dark:border-slate-800">
              <span className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Exceções e Status
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={onToggleOnlyWithoutResponsible}
                  className={`px-2 py-1 rounded-md text-[11px] font-ui font-medium border transition-colors cursor-pointer ${
                    onlyWithoutResponsible
                      ? 'bg-red-50 dark:bg-red-950/30 text-bradesco-red border-red-300 dark:border-red-900/60'
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                  }`}
                >
                  Sem responsável
                </button>
                <button
                  type="button"
                  onClick={onToggleOnlyWithoutSubproduct}
                  className={`px-2 py-1 rounded-md text-[11px] font-ui font-medium border transition-colors cursor-pointer ${
                    onlyWithoutSubproduct
                      ? 'bg-red-50 dark:bg-red-950/30 text-bradesco-red border-red-300 dark:border-red-900/60'
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                  }`}
                >
                  Sem subproduto
                </button>
                <button
                  type="button"
                  onClick={onToggleOnlyDivergent}
                  className={`px-2 py-1 rounded-md text-[11px] font-ui font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                    onlyDivergent
                      ? 'bg-red-50 dark:bg-red-950/30 text-bradesco-red border-red-300 dark:border-red-900/60'
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Divergentes
                </button>
              </div>
            </div>

            {/* Limpar filtros */}
            {isInventoryFilterActive && (
              <button
                type="button"
                onClick={onResetInventoryFilters}
                className="mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-ui font-medium text-gray-500 hover:text-bradesco-red dark:text-slate-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-bradesco-red" />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. POR PRODUTO (produtos_analise)
  if (currentRouteId === 'produtos_analise') {
    const isFiltered = productSubprodutoFilter !== 'TODOS';

    return (
      <div className="flex flex-col gap-2 w-full min-w-0" id="sidebar-contextual-product">
        {/* Campo de Busca */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="Filtrar produtos..."
            value={productSearch}
            onChange={(e) => onProductSearchChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-gray-50/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-ui text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-bradesco-red focus:border-bradesco-red transition-all truncate"
          />
          {productSearch && (
            <button
              onClick={() => onProductSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Botão de Filtros */}
        <button
          type="button"
          onClick={() => setIsProductFiltersOpen(!isProductFiltersOpen)}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-ui font-semibold transition-all border cursor-pointer ${
            isProductFiltersOpen || isFiltered
              ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-bradesco-red'
              : 'bg-gray-50/80 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Filtros</span>
            {isFiltered && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-bradesco-red text-white">
                1
              </span>
            )}
          </div>
          {isProductFiltersOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        {/* Filtros Expansíveis */}
        {isProductFiltersOpen && (
          <div className="flex flex-col gap-2 pt-1">
            <div>
              <label className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Subproduto
              </label>
              <select
                value={productSubprodutoFilter}
                onChange={(e) => onProductSubprodutoFilterChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-ui font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none cursor-pointer focus:border-bradesco-red truncate"
              >
                <option value="TODOS">Todos os subprodutos</option>
                {availableProductSubprodutos.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {isProductFilterActive && (
              <button
                type="button"
                onClick={onResetProductFilters}
                className="mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-ui font-medium text-gray-500 hover:text-bradesco-red dark:text-slate-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-bradesco-red" />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 4. POR PARÂMETRO (parametros_analise)
  if (currentRouteId === 'parametros_analise') {
    return (
      <div className="flex flex-col gap-2 w-full min-w-0" id="sidebar-contextual-param">
        {/* Campo de Busca */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="Buscar parâmetro/valor..."
            value={paramSearch}
            onChange={(e) => onParamSearchChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-gray-50/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-ui text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-bradesco-red focus:border-bradesco-red transition-all truncate"
          />
          {paramSearch && (
            <button
              onClick={() => onParamSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {isParamFilterActive && (
          <button
            type="button"
            onClick={onResetParamFilters}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-ui font-medium text-gray-500 hover:text-bradesco-red dark:text-slate-400 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-bradesco-red" />
            Limpar busca
          </button>
        )}
      </div>
    );
  }

  // 5. INSIGHTS (insights) - Não possui busca! Mostrar apenas filtros de produto, nível 2 e mensuração.
  if (currentRouteId === 'insights') {
    let activeInsightsCount = 0;
    if (insightsProductFilter !== 'all') activeInsightsCount++;
    if (insightsSubprodutoFilter !== 'all') activeInsightsCount++;
    if (insightsMeasurementFilter !== 'all') activeInsightsCount++;

    return (
      <div className="flex flex-col gap-2 w-full min-w-0" id="sidebar-contextual-insights">
        {/* Botão de Filtros */}
        <button
          type="button"
          onClick={() => setIsInsightsFiltersOpen(!isInsightsFiltersOpen)}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-ui font-semibold transition-all border cursor-pointer ${
            isInsightsFiltersOpen || activeInsightsCount > 0
              ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-bradesco-red'
              : 'bg-gray-50/80 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Filtros de Indicadores</span>
            {activeInsightsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-bradesco-red text-white">
                {activeInsightsCount}
              </span>
            )}
          </div>
          {isInsightsFiltersOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        {/* Filtros Expansíveis */}
        {isInsightsFiltersOpen && (
          <div className="flex flex-col gap-2 pt-1">
            {/* Produto */}
            <div>
              <label className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Produto
              </label>
              <select
                value={insightsProductFilter}
                onChange={(e) => onInsightsProductFilterChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-ui font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none cursor-pointer focus:border-bradesco-red truncate"
              >
                <option value="all">TODOS OS PRODUTOS</option>
                {availableInsightsProducts.map((p) => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Nível 2 / Subproduto */}
            <div>
              <label className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Nível 2 / Subproduto
              </label>
              <select
                value={insightsSubprodutoFilter}
                onChange={(e) => onInsightsSubprodutoFilterChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-ui font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none cursor-pointer focus:border-bradesco-red truncate"
              >
                <option value="all">TODOS OS SUBPRODUTOS</option>
                {availableInsightsSubprodutos.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Mensuração */}
            <div>
              <label className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Mensuração
              </label>
              <select
                value={insightsMeasurementFilter}
                onChange={(e) => onInsightsMeasurementFilterChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-ui font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none cursor-pointer focus:border-bradesco-red truncate"
              >
                <option value="all">QUALQUER MENSURAÇÃO</option>
                <option value="GA4">APENAS GA4</option>
                <option value="GA3">APENAS GA3 / UNIVERSAL</option>
                <option value="HIBRIDO">APENAS HÍBRIDO</option>
              </select>
            </div>

            {/* Limpar filtros */}
            {isInsightsFilterActive && (
              <button
                type="button"
                onClick={onResetInsightsFilters}
                className="mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-ui font-medium text-gray-500 hover:text-bradesco-red dark:text-slate-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-bradesco-red" />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Conexões (graph), Sincronização, Plugins e outros não possuem busca ou filtros
  return null;
};
