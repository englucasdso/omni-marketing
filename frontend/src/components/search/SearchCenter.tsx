import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  Sparkles,
  FileText,
  Loader2,
  ArrowRight,
  RotateCcw,
  Keyboard,
  Info,
} from 'lucide-react';
import { Artifact } from '../../types';
import { searchWorkerClient } from '../../services/searchWorkerClient';
import { SearchResultCard } from './SearchResultCard';
import { ParameterCriteriaBuilder } from './ParameterCriteriaBuilder';
import type {
  ContentSearchResult,
  ParameterCriterion,
  ParameterSearchResult,
} from '../../workers/artifactSearch.worker';

export interface SemanticSearchResultItem {
  artifactId: string;
  title: string;
  artifactType: string;
  produto: string;
  subproduto: string;
  screenId?: string;
  screenIndex?: number;
  screenTitle?: string;
  snippetIndex?: number;
  score: number;
  confidence: "ALTA" | "MEDIA" | "BAIXA";
  reason: string;
  evidence: string[];
  codeSnippet?: string;
  event?: string;
}

export interface SearchCenterProps {
  artifacts: Artifact[];
  onOpenDetails: (artifact: Artifact) => void;
  onOpenSnippet: (artifact: Artifact, screenId?: string, snippetIndex?: number) => void;
  onViewInTree: (artifactId: string) => void;
  onOpenJourney: (mapId: string) => void;
  onApplyToCards?: (query: string, filteredIds: string[]) => void;
}

export const SearchCenter: React.FC<SearchCenterProps> = ({
  artifacts,
  onOpenDetails,
  onOpenSnippet,
  onViewInTree,
  onOpenJourney,
  onApplyToCards,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'conteudo' | 'parametros' | 'ia'>('conteudo');

  // Input states
  const [contentQuery, setContentQuery] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [criteria, setCriteria] = useState<ParameterCriterion[]>([]);
  const [criteriaCombination, setCriteriaCombination] = useState<'AND' | 'OR'>('AND');
  const [criteriaScope, setCriteriaScope] = useState<'SNIPPET' | 'SCREEN'>('SNIPPET');

  // Status & loading
  const [isIndexBuilding, setIsIndexBuilding] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Results
  const [contentResults, setContentResults] = useState<ContentSearchResult[]>([]);
  const [parameterResults, setParameterResults] = useState<ParameterSearchResult[]>([]);
  const [aiResults, setAiResults] = useState<SemanticSearchResultItem[]>([]);

  // Keyboard navigation & abort controller
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build Worker Index when artifacts change
  useEffect(() => {
    if (artifacts.length > 0) {
      setIsIndexBuilding(true);
      searchWorkerClient
        .initIndex(artifacts)
        .then(() => setIsIndexBuilding(false))
        .catch((err) => {
          console.error('[SearchCenter] Failed to build worker index:', err);
          setIsIndexBuilding(false);
        });
    }
  }, [artifacts]);

  // Fast map by ID for rendering full artifact data in result cards
  const artifactMap = useMemo(() => {
    const map = new Map<string, Artifact>();
    artifacts.forEach((a) => map.set(String(a.id), a));
    return map;
  }, [artifacts]);

  // Intelligent Mode Suggestions
  const suggestion = useMemo(() => {
    if (mode !== 'conteudo') return null;
    const trimmed = contentQuery.trim();
    if (!trimmed) return null;

    if (trimmed.includes('=')) {
      return {
        type: 'parametros' as const,
        text: 'Parece uma busca por parâmetros.',
        actionText: 'Trocar para Parâmetros',
      };
    }

    const lower = trimmed.toLowerCase();
    const isQuestion =
      trimmed.endsWith('?') ||
      lower.startsWith('como') ||
      lower.startsWith('qual') ||
      lower.startsWith('quais') ||
      lower.startsWith('onde') ||
      lower.startsWith('tenho') ||
      lower.startsWith('existe') ||
      lower.startsWith('por que');

    if (isQuestion) {
      return {
        type: 'ia' as const,
        text: 'Deseja pesquisar com IA?',
        actionText: 'Trocar para Perguntar à IA',
      };
    }

    return null;
  }, [contentQuery, mode]);

  // Handle Mode Suggestion Switch
  const handleApplySuggestion = (targetMode: 'parametros' | 'ia') => {
    if (targetMode === 'parametros') {
      const parts = contentQuery.split('=');
      const namePart = parts[0]?.trim() || '';
      const valPart = parts[1]?.trim() || '';
      setCriteria([
        {
          field: 'nome',
          operator: valPart ? 'igual' : 'existe',
          value: valPart || namePart,
        },
      ]);
      setMode('parametros');
    } else if (targetMode === 'ia') {
      setAiQuestion(contentQuery);
      setMode('ia');
    }
  };

  // Debounced Content Search
  useEffect(() => {
    if (mode !== 'conteudo') return;

    const trimmed = contentQuery.trim();
    if (!trimmed) {
      setContentResults([]);
      setSearchDurationMs(null);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(() => {
      searchWorkerClient
        .searchContent(trimmed, 60)
        .then((res) => {
          setContentResults(res.results);
          setSearchDurationMs(res.durationMs);
        })
        .catch((e) => console.error(e))
        .finally(() => setIsSearching(false));
    }, 150);

    return () => clearTimeout(timeout);
  }, [contentQuery, mode]);

  // Parameter Search
  const executeParameterSearch = useCallback(() => {
    if (criteria.length === 0) {
      setParameterResults([]);
      setSearchDurationMs(null);
      return;
    }

    setIsSearching(true);
    searchWorkerClient
      .searchParameters(criteria, criteriaCombination, criteriaScope, 60)
      .then((res) => {
        setParameterResults(res.results);
        setSearchDurationMs(res.durationMs);
      })
      .catch((e) => console.error(e))
      .finally(() => setIsSearching(false));
  }, [criteria, criteriaCombination, criteriaScope]);

  // Trigger Parameter search whenever criteria or options change
  useEffect(() => {
    if (mode === 'parametros') {
      executeParameterSearch();
    }
  }, [mode, criteria, criteriaCombination, criteriaScope, executeParameterSearch]);

  // Semantic AI Search Execution
  const executeAiSearch = async () => {
    const trimmed = aiQuestion.trim();
    if (!trimmed || aiLoading) return;

    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;

    setAiLoading(true);
    setAiError(null);
    setAiMessage(null);

    const startTime = Date.now();
    try {
      const response = await fetch('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
        signal: abortController.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Não foi possível concluir a busca por IA.');
      }

      setAiResults(data.results || []);
      setAiMessage(data.message || null);
      setSearchDurationMs(Date.now() - startTime);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[SearchCenter] AI Search cancelled by user.');
        return;
      }
      console.error('[SearchCenter] AI Search error:', err);
      setAiError(err.message || 'Não foi possível concluir a busca por IA.');
      setAiResults([]);
    } finally {
      setAiLoading(false);
      aiAbortControllerRef.current = null;
    }
  };

  const handleCancelAiSearch = () => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
      setAiLoading(false);
    }
  };

  // Keyboard navigation & Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const activeResultsCount =
    mode === 'conteudo'
      ? contentResults.length
      : mode === 'parametros'
      ? parameterResults.length
      : aiResults.length;

  return (
    <div className="relative w-full z-30">
      {/* 1. Integrated Search Bar on Cards Screen */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-850 p-3 shadow-sm hover:border-[#7B0209] transition-all cursor-pointer flex items-center justify-between gap-3 group focus:outline-none focus:ring-2 focus:ring-[#7B0209]/40"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 group-hover:text-[#7B0209] group-hover:bg-red-50 dark:group-hover:bg-red-950/40 transition-colors">
            <Search className="w-4 h-4" />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-heading font-semibold text-gray-800 dark:text-slate-200 truncate">
              {contentQuery || aiQuestion
                ? `${contentQuery || aiQuestion}`
                : 'Buscar artefatos, parâmetros de tagueamento ou perguntar à IA...'}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-slate-500">
              {isIndexBuilding
                ? 'Preparando busca...'
                : `Modo ativo: ${
                    mode === 'conteudo'
                      ? 'Conteúdo'
                      : mode === 'parametros'
                      ? `Parâmetros (${criteria.length} critério${criteria.length !== 1 ? 's' : ''})`
                      : 'Perguntar à IA'
                  }`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-[10px] font-mono">
            Pressione para abrir
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#7B0209] text-white text-xs font-semibold shadow-sm">
            Buscar
          </span>
        </div>
      </div>

      {/* 2. Expanded Search Surface Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Wide Popover / Surface connected to Search Bar */}
          <div
            ref={surfaceRef}
            className="absolute top-0 left-0 right-0 z-50 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all"
          >
            {/* Surface Header: Segmented Control + Close Button */}
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-900/50">
              {/* Segmented Control */}
              <div className="flex items-center p-1 rounded-xl bg-gray-200/70 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMode('conteudo')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'conteudo'
                      ? 'bg-[#7B0209] text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Conteúdo
                </button>

                <button
                  type="button"
                  onClick={() => setMode('parametros')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'parametros'
                      ? 'bg-[#7B0209] text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Parâmetros
                  {criteria.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                      {criteria.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMode('ia')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'ia'
                      ? 'bg-[#7B0209] text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Perguntar à IA
                </button>
              </div>

              {/* Status and Actions */}
              <div className="flex items-center gap-2 text-xs">
                {isIndexBuilding && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Preparando busca...
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mode Suggestion Pill (Non-intrusive) */}
            {suggestion && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-2 text-xs">
                <span className="text-amber-800 dark:text-amber-300 font-medium">
                  {suggestion.text}
                </span>
                <button
                  type="button"
                  onClick={() => handleApplySuggestion(suggestion.type)}
                  className="px-2.5 py-1 rounded bg-[#7B0209] text-white font-semibold text-[11px] hover:bg-[#600207] transition-colors cursor-pointer flex items-center gap-1"
                >
                  {suggestion.actionText}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Mode-Specific Input Areas */}
            <div className="p-4 border-b border-gray-100 dark:border-slate-800">
              {mode === 'conteudo' && (
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={contentQuery}
                    onChange={(e) => setContentQuery(e.target.value)}
                    placeholder="Buscar por título, ID, produto, evento, parâmetro, código ou status..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:border-[#7B0209]"
                  />
                  {contentQuery && (
                    <button
                      type="button"
                      onClick={() => setContentQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {mode === 'parametros' && (
                <ParameterCriteriaBuilder
                  criteria={criteria}
                  onChangeCriteria={setCriteria}
                  combination={criteriaCombination}
                  onChangeCombination={setCriteriaCombination}
                  scope={criteriaScope}
                  onChangeScope={setCriteriaScope}
                  onSearch={executeParameterSearch}
                />
              )}

              {mode === 'ia' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          executeAiSearch();
                        }
                      }}
                      placeholder="Faça uma pergunta sobre os artefatos disponíveis..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:border-[#7B0209]"
                    />

                    <div className="flex items-center gap-2">
                      {aiLoading ? (
                        <button
                          type="button"
                          onClick={handleCancelAiSearch}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-300 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={executeAiSearch}
                          disabled={!aiQuestion.trim()}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#7B0209] text-white hover:bg-[#600207] disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Buscar com IA
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Suggestion Prompts */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <span className="text-gray-400">Sugestões:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAiQuestion('Quais jornadas envolvem contratação de cartão ou benefício INSS?');
                      }}
                      className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 hover:text-[#7B0209] transition-colors cursor-pointer text-[11px]"
                    >
                      Jornadas de cartão / INSS
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAiQuestion('Existe algum evento de portabilidade de crédito configurado?');
                      }}
                      className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 hover:text-[#7B0209] transition-colors cursor-pointer text-[11px]"
                    >
                      Portabilidade de crédito
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAiQuestion('Quais mapas possuem telas com status de correção ou validação pendente?');
                      }}
                      className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 hover:text-[#7B0209] transition-colors cursor-pointer text-[11px]"
                    >
                      Telas com correção pendente
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Results Header Info Bar */}
            <div className="px-4 py-2 bg-gray-50/80 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <div>
                {isSearching || aiLoading ? (
                  <span className="flex items-center gap-1.5 text-[#7B0209] dark:text-red-400 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {aiLoading ? 'Analisando o inventário...' : 'Pesquisando...'}
                  </span>
                ) : (
                  <span>
                    {activeResultsCount > 0 ? (
                      <>
                        <strong className="text-gray-900 dark:text-slate-100 font-bold">
                          {activeResultsCount}
                        </strong>{' '}
                        resultado{activeResultsCount !== 1 ? 's' : ''} encontrado{activeResultsCount !== 1 ? 's' : ''}
                        {searchDurationMs !== null && ` em ${searchDurationMs}ms`}
                      </>
                    ) : (
                      <span>Nenhum resultado para exibir</span>
                    )}
                  </span>
                )}
              </div>

              {activeResultsCount > 0 && onApplyToCards && (
                <button
                  type="button"
                  onClick={() => {
                    const ids =
                      mode === 'conteudo'
                        ? contentResults.map((r) => r.artifactId)
                        : mode === 'parametros'
                        ? parameterResults.map((r) => r.artifactId)
                        : aiResults.map((r) => r.artifactId);
                    onApplyToCards(contentQuery || aiQuestion, ids);
                    setIsOpen(false);
                  }}
                  className="text-xs font-semibold text-[#7B0209] dark:text-red-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  Filtrar Cards com estes resultados
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Results List Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
              {/* AI Loading State */}
              {aiLoading && (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#7B0209] animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    Analisando o inventário...
                  </p>
                  <p className="text-xs text-gray-400">
                    Consultando modelo com base nos artefatos e evidências reais.
                  </p>
                </div>
              )}

              {/* AI Error State */}
              {!aiLoading && aiError && (
                <div className="py-8 px-4 text-center space-y-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl">
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">
                    Não foi possível concluir a busca por IA.
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300">{aiError}</p>
                  <button
                    type="button"
                    onClick={executeAiSearch}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#7B0209] text-white hover:bg-[#600207] cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Mode Conteúdo Results & Empty States */}
              {mode === 'conteudo' && !isSearching && (
                <>
                  {contentQuery.trim() === '' ? (
                    <div className="py-12 text-center text-xs text-gray-400">
                      Digite termos para pesquisar em títulos, IDs, caminhos, telas, eventos e códigos.
                    </div>
                  ) : contentResults.length === 0 ? (
                    <div className="py-12 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
                      Nenhum artefato corresponde aos termos pesquisados.
                    </div>
                  ) : (
                    contentResults.map((res) => {
                      const art = artifactMap.get(res.artifactId);
                      if (!art) return null;
                      return (
                        <SearchResultCard
                          key={res.artifactId}
                          artifact={art}
                          mode="conteudo"
                          score={res.score}
                          matchedFields={res.matchedFields}
                          screenId={res.screenId}
                          screenIndex={res.screenIndex}
                          screenTitle={res.screenTitle}
                          snippetIndex={res.snippetIndex}
                          codeExcerpt={res.codeExcerpt}
                          matchedValue={res.matchedValue}
                          onOpenDetails={(item) => {
                            setIsOpen(false);
                            onOpenDetails(item);
                          }}
                          onOpenSnippet={(item, scId, snipIdx) => {
                            setIsOpen(false);
                            onOpenSnippet(item, scId, snipIdx);
                          }}
                          onViewInTree={(id) => {
                            setIsOpen(false);
                            onViewInTree(id);
                          }}
                          onOpenJourney={(id) => {
                            setIsOpen(false);
                            onOpenJourney(id);
                          }}
                        />
                      );
                    })
                  )}
                </>
              )}

              {/* Mode Parâmetros Results & Empty States */}
              {mode === 'parametros' && !isSearching && (
                <>
                  {criteria.length === 0 ? null : parameterResults.length === 0 ? (
                    <div className="py-12 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
                      Nenhum snippet possui essa combinação de parâmetros.
                    </div>
                  ) : (
                    parameterResults.map((res, rIdx) => {
                      const art = artifactMap.get(res.artifactId);
                      if (!art) return null;
                      return (
                        <SearchResultCard
                          key={`${res.artifactId}-${res.screenId}-${res.snippetIndex}-${rIdx}`}
                          artifact={art}
                          mode="parametros"
                          screenId={res.screenId}
                          screenIndex={res.screenIndex}
                          screenTitle={res.screenTitle}
                          snippetIndex={res.snippetIndex}
                          matchedCriteria={res.matchedCriteria}
                          matchedValues={res.matchedValues}
                          codeExcerpt={res.rawCodePreview}
                          additionalMatchesCount={res.additionalMatchesCount}
                          onOpenDetails={(item) => {
                            setIsOpen(false);
                            onOpenDetails(item);
                          }}
                          onOpenSnippet={(item, scId, snipIdx) => {
                            setIsOpen(false);
                            onOpenSnippet(item, scId, snipIdx);
                          }}
                          onViewInTree={(id) => {
                            setIsOpen(false);
                            onViewInTree(id);
                          }}
                          onOpenJourney={(id) => {
                            setIsOpen(false);
                            onOpenJourney(id);
                          }}
                        />
                      );
                    })
                  )}
                </>
              )}

              {/* Mode IA Results & Empty States */}
              {mode === 'ia' && !aiLoading && !aiError && (
                <>
                  {!aiQuestion.trim() && aiResults.length === 0 ? (
                    <div className="py-12 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
                      Faça uma pergunta sobre os artefatos disponíveis.
                    </div>
                  ) : aiResults.length === 0 && aiMessage ? (
                    <div className="py-12 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
                      {aiMessage}
                    </div>
                  ) : (
                    <>
                      {aiMessage && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 text-xs font-semibold text-[#7B0209] dark:text-red-300">
                          {aiMessage}
                        </div>
                      )}
                      {aiResults.map((res) => {
                        const art = artifactMap.get(res.artifactId);
                        if (!art) return null;
                        return (
                          <SearchResultCard
                            key={res.artifactId}
                            artifact={art}
                            mode="ia"
                            score={res.score}
                            screenId={res.screenId}
                            screenIndex={res.screenIndex}
                            screenTitle={res.screenTitle}
                            snippetIndex={res.snippetIndex}
                            codeExcerpt={res.codeSnippet}
                            aiConfidence={res.confidence}
                            aiReason={res.reason}
                            aiEvidences={res.evidence}
                            onOpenDetails={(item) => {
                              setIsOpen(false);
                              onOpenDetails(item);
                            }}
                            onOpenSnippet={(item, scId, snipIdx) => {
                              setIsOpen(false);
                              onOpenSnippet(item, scId, snipIdx);
                            }}
                            onViewInTree={(id) => {
                              setIsOpen(false);
                              onViewInTree(id);
                            }}
                            onOpenJourney={(id) => {
                              setIsOpen(false);
                              onOpenJourney(id);
                            }}
                          />
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Surface Footer */}
            <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <Keyboard className="w-3.5 h-3.5" />
                <span>Pressione Esc para fechar a qualquer momento</span>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Fechar busca
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
