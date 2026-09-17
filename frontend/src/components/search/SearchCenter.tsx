import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  Sparkles,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Activity,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Artifact, ActiveSearch } from '../../types';
import { searchWorkerClient } from '../../services/searchWorkerClient';
import type { ParameterCriterion } from '../../workers/artifactSearch.worker';

export interface SearchCenterProps {
  artifacts: Artifact[];
  activeSearch?: ActiveSearch | null;
  onApplyToCards?: (
    query: string,
    filteredIds: string[],
    meta?: {
      mode: 'conteudo' | 'parametros' | 'ia';
      parameterCriteria?: ParameterCriterion[];
      aiQuestion?: string;
      scope?: 'SNIPPET' | 'SCREEN';
      operator?: 'AND' | 'OR';
    }
  ) => void;
  onNavigateToOperationalInsights?: () => void;
  // Optional callbacks kept for API compatibility
  onOpenDetails?: (artifact: Artifact) => void;
  onOpenSnippet?: (artifact: Artifact, screenId?: string, snippetIndex?: number) => void;
  onViewInTree?: (artifactId: string) => void;
  onOpenJourney?: (mapId: string) => void;
}

export const SearchCenter: React.FC<SearchCenterProps> = ({
  artifacts,
  activeSearch,
  onApplyToCards,
  onNavigateToOperationalInsights,
}) => {
  // Current Mode: 'conteudo' | 'parametros' | 'ia'
  const [mode, setMode] = useState<'conteudo' | 'parametros' | 'ia'>('conteudo');

  // Input states per mode
  const [contentQuery, setContentQuery] = useState('');
  const [paramInput, setParamInput] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');

  // Parameter mode controls
  const [criteria, setCriteria] = useState<ParameterCriterion[]>([]);
  const [criteriaCombination, setCriteriaCombination] = useState<'AND' | 'OR'>('AND');
  const [criteriaScope, setCriteriaScope] = useState<'SNIPPET' | 'SCREEN'>('SNIPPET');

  // Parameter autocomplete
  const [paramSuggestions, setParamSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Status & Feedback states
  const [isSearching, setIsSearching] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync index with worker
  useEffect(() => {
    if (artifacts && artifacts.length > 0) {
      searchWorkerClient.initIndex(artifacts).catch((err) => {
        console.warn('[SearchCenter] Worker index init:', err);
      });
    }
  }, [artifacts]);

  // Sync state from activeSearch when present or restored
  useEffect(() => {
    if (activeSearch) {
      setMode(activeSearch.mode);
      if (activeSearch.mode === 'conteudo') {
        setContentQuery(activeSearch.query || '');
      } else if (activeSearch.mode === 'parametros') {
        setParamInput(activeSearch.query || '');
        if (activeSearch.parameterCriteria && activeSearch.parameterCriteria.length > 0) {
          setCriteria(activeSearch.parameterCriteria);
        }
        if (activeSearch.operator) {
          setCriteriaCombination(activeSearch.operator);
        }
        if (activeSearch.scope) {
          setCriteriaScope(activeSearch.scope);
        }
      } else if (activeSearch.mode === 'ia') {
        setAiQuestion(activeSearch.aiQuestion || activeSearch.query || '');
      }
    }
  }, [activeSearch]);

  // Click outside suggestions box
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch autocomplete suggestions for parameter mode
  const handleParamInputChange = (val: string) => {
    setParamInput(val);
    const lastToken = val.split(/[+,]/).pop()?.trim() || '';
    if (lastToken.length >= 2) {
      searchWorkerClient
        .getParameterSuggestions('qualquer', lastToken, 6)
        .then((suggs) => {
          setParamSuggestions(suggs);
          setShowSuggestions(suggs.length > 0);
        })
        .catch(() => {
          setParamSuggestions([]);
          setShowSuggestions(false);
        });
    } else {
      setParamSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Titles per mode
  const getModeTitle = () => {
    switch (mode) {
      case 'conteudo':
        return 'Qual artefato você quer encontrar?';
      case 'parametros':
        return 'Buscar por parâmetros de tagueamento';
      case 'ia':
        return 'O que você gostaria de perguntar à IA sobre os artefatos?';
    }
  };

  // Placeholders per mode
  const getModePlaceholder = () => {
    switch (mode) {
      case 'conteudo':
        return 'Busque por ID, nome do mapa ou qualquer termo relacionado';
      case 'parametros':
        return 'Digite o nome, caminho ou valor do parâmetro (ex: event, transaction_id, true)';
      case 'ia':
        return 'Ex: Onde é disparado o evento de confirmação de pagamento?';
    }
  };

  // Current input value based on mode
  const currentInputValue =
    mode === 'conteudo' ? contentQuery : mode === 'parametros' ? paramInput : aiQuestion;

  const handleInputChange = (val: string) => {
    if (mode === 'conteudo') {
      setContentQuery(val);
    } else if (mode === 'parametros') {
      handleParamInputChange(val);
    } else {
      setAiQuestion(val);
      if (aiError) setAiError(null);
    }
  };

  const handleClearInput = () => {
    if (mode === 'conteudo') {
      setContentQuery('');
    } else if (mode === 'parametros') {
      setParamInput('');
      setShowSuggestions(false);
    } else {
      setAiQuestion('');
      setAiError(null);
    }
    inputRef.current?.focus();
  };

  // Parse direct parameter typing (e.g. user_id + produto + fluxo or key=val)
  const parseParamInputToCriteria = (rawInput: string): ParameterCriterion[] => {
    const trimmed = rawInput.trim();
    if (!trimmed) return [];

    // Split by '+' or ',' for multiple parameters
    const tokens = trimmed
      .split(/[+,]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const parsed: ParameterCriterion[] = [];
    for (const tok of tokens) {
      if (tok.includes('=')) {
        const [k, ...rest] = tok.split('=');
        const v = rest.join('=').trim();
        const keyTrimmed = k.trim();
        if (keyTrimmed && v) {
          parsed.push({
            field: 'nome',
            operator: 'igual',
            value: keyTrimmed,
          });
          parsed.push({
            field: 'valor',
            operator: 'contem',
            value: v,
          });
        } else if (keyTrimmed) {
          parsed.push({
            field: 'nome',
            operator: 'contem',
            value: keyTrimmed,
          });
        }
      } else {
        parsed.push({
          field: 'qualquer',
          operator: 'contem',
          value: tok,
        });
      }
    }
    return parsed;
  };

  // Execute Search in Conteúdo Mode
  const executeContentSearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    setIsSearching(true);
    try {
      if (!q || q.toLowerCase() === 'inventario' || q.toLowerCase() === 'inventário') {
        const allIds = artifacts.map((a) => String(a.id));
        onApplyToCards?.(q, allIds, { mode: 'conteudo' });
        return;
      }

      const res = await searchWorkerClient.searchContent(q, 500);
      const filteredIds = Array.from(new Set(res.results.map((r) => String(r.artifactId))));
      onApplyToCards?.(q, filteredIds, { mode: 'conteudo' });
    } catch (err) {
      console.error('[SearchCenter] Content search error:', err);
      // Fallback: match in inventory
      const lower = q.toLowerCase();
      const fallbackIds = artifacts
        .filter(
          (a) =>
            a.id?.toLowerCase().includes(lower) ||
            a.titulo?.toLowerCase().includes(lower) ||
            a.produto?.toLowerCase().includes(lower) ||
            a.subproduto?.toLowerCase().includes(lower)
        )
        .map((a) => String(a.id));
      onApplyToCards?.(q, fallbackIds, { mode: 'conteudo' });
    } finally {
      setIsSearching(false);
    }
  };

  // Execute Search in Parâmetros Mode
  const executeParamSearch = async () => {
    setIsSearching(true);
    setShowSuggestions(false);
    try {
      const parsedDirectCriteria = parseParamInputToCriteria(paramInput);
      const combinedCriteria = [...parsedDirectCriteria, ...criteria];

      if (combinedCriteria.length === 0) {
        // If empty, return all artifacts
        const allIds = artifacts.map((a) => String(a.id));
        onApplyToCards?.('', allIds, {
          mode: 'parametros',
          parameterCriteria: [],
          scope: criteriaScope,
          operator: criteriaCombination,
        });
        return;
      }

      const res = await searchWorkerClient.searchParameters(
        combinedCriteria,
        criteriaCombination,
        criteriaScope,
        500
      );

      const filteredIds = Array.from(new Set(res.results.map((r) => String(r.artifactId))));

      onApplyToCards?.(paramInput, filteredIds, {
        mode: 'parametros',
        parameterCriteria: combinedCriteria,
        scope: criteriaScope,
        operator: criteriaCombination,
      });
    } catch (err) {
      console.error('[SearchCenter] Parameter search error:', err);
      onApplyToCards?.(paramInput, [], {
        mode: 'parametros',
        parameterCriteria: criteria,
        scope: criteriaScope,
        operator: criteriaCombination,
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Execute Search in Perguntar à IA Mode
  const executeAiSearch = async (questionToAsk?: string) => {
    const q = (questionToAsk !== undefined ? questionToAsk : aiQuestion).trim();
    if (!q) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: abortController.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.message || data.error || 'Serviço de IA temporariamente indisponível.'
        );
      }

      const rawResults = Array.isArray(data.results) ? data.results : [];
      const filteredIds: string[] = Array.from(
        new Set(
          rawResults
            .map((r: any) => String(r.artifactId || r.id || ''))
            .filter((id: string) => id.length > 0)
        )
      );

      onApplyToCards?.(q, filteredIds, {
        mode: 'ia',
        aiQuestion: q,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[SearchCenter] AI Search error:', err);
      setAiError(
        err.message ||
          'Não foi possível consultar a IA no momento. Verifique a conexão ou tente novamente.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Central submit handler
  const handleExecuteSearch = () => {
    if (mode === 'conteudo') {
      executeContentSearch(contentQuery);
    } else if (mode === 'parametros') {
      executeParamSearch();
    } else if (mode === 'ia') {
      executeAiSearch();
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteSearch();
    }
  };

  // Add explicit criterion in parameter mode
  const handleAddCriterion = () => {
    setCriteria((prev) => [...prev, { field: 'nome', operator: 'contem', value: '' }]);
  };

  const handleUpdateCriterion = (idx: number, updates: Partial<ParameterCriterion>) => {
    setCriteria((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const handleRemoveCriterion = (idx: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearCriteria = () => {
    setCriteria([]);
    setParamInput('');
    setShowSuggestions(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-start">
      {/* Dynamic Animated Title */}
      <div className="flex flex-col items-center text-center justify-center mb-6 w-full gap-2 min-h-[60px]">
        <AnimatePresence mode="wait">
          <motion.h2
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="text-3xl sm:text-4xl font-normal text-gray-900 dark:text-slate-50 tracking-tight leading-tight"
          >
            {getModeTitle()}
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* Mode Selector Segmented Control */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-gray-100/90 dark:bg-slate-800/90 border border-gray-200/80 dark:border-slate-700/80 shadow-inner mb-6">
        <button
          type="button"
          onClick={() => setMode('conteudo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
            mode === 'conteudo'
              ? 'bg-[#7B0209] text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Conteúdo</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('parametros')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
            mode === 'parametros'
              ? 'bg-[#7B0209] text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Parâmetros</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('ia')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
            mode === 'ia'
              ? 'bg-[#7B0209] text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Perguntar à IA</span>
        </button>
      </div>

      {/* Central Unified Search Bar */}
      <div className="w-full relative mb-4">
        <div className="animated-border">
          <div
            className={`inner-container glass-card py-3.5 px-5 flex items-center gap-3.5 transition-all duration-300 ${
              isFocused
                ? 'bg-white dark:bg-slate-900 border-[#7B0209]/40 shadow-md ring-2 ring-[#7B0209]/20'
                : 'border-gray-200 dark:border-slate-800'
            }`}
          >
            <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0" />

            <input
              ref={inputRef}
              type="text"
              value={currentInputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={getModePlaceholder()}
              className="w-full bg-transparent border-none outline-none text-base sm:text-lg text-gray-900 dark:text-slate-50 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0"
            />

            {/* Clear button */}
            {currentInputValue && !isSearching && !aiLoading && (
              <button
                type="button"
                onClick={handleClearInput}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
                title="Limpar campo"
                aria-label="Limpar campo"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Spinner indicator if searching */}
            {(isSearching || aiLoading) && (
              <Loader2 className="w-4 h-4 animate-spin text-[#7B0209] shrink-0" />
            )}

            {/* Submit Action Button */}
            <button
              type="button"
              onClick={handleExecuteSearch}
              disabled={isSearching || aiLoading}
              className="px-5 py-2.5 rounded-xl bg-[#7B0209] hover:bg-[#630207] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {mode === 'ia' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Perguntar</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Parameter Autocomplete Dropdown */}
        {mode === 'parametros' && showSuggestions && paramSuggestions.length > 0 && (
          <div
            ref={suggestionsBoxRef}
            className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden py-1"
          >
            <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800">
              Sugestões de parâmetros
            </div>
            {paramSuggestions.map((sugg, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => {
                  const parts = paramInput.split('+');
                  parts[parts.length - 1] = ' ' + sugg + ' ';
                  setParamInput(parts.join('+').trim());
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-mono text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
              >
                <span>{sugg}</span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500">adicionar</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode-Specific Sub-Controls & Assistance */}

      {/* Mode 1: Conteúdo Assistance */}
      {mode === 'conteudo' && (
        <div className="w-full flex flex-col items-start gap-3 mt-4 px-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setContentQuery('Abertura de Contas');
                executeContentSearch('Abertura de Contas');
              }}
              className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-[#7B0209] dark:hover:text-red-400 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 cursor-pointer"
            >
              <Search className="w-3 h-3 text-gray-400" />
              <span>Abertura de contas PF e PJ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContentQuery('Cartões');
                executeContentSearch('Cartões');
              }}
              className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-[#7B0209] dark:hover:text-red-400 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 cursor-pointer"
            >
              <Search className="w-3 h-3 text-gray-400" />
              <span>Cartões de crédito ou BIA</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContentQuery('inventario');
                executeContentSearch('inventario');
              }}
              className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-[#7B0209] dark:hover:text-red-400 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 cursor-pointer"
            >
              <Search className="w-3 h-3 text-gray-400" />
              <span>Digite "inventário" para ver toda a base</span>
            </button>

            {onNavigateToOperationalInsights && (
              <button
                type="button"
                onClick={onNavigateToOperationalInsights}
                className="text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-[#7B0209] transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/30 cursor-pointer ml-auto"
              >
                <Activity className="w-3.5 h-3.5 text-[#7B0209]" />
                <span>Ver insights</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Parâmetros Sub-Controls */}
      {mode === 'parametros' && (
        <div className="w-full flex flex-col gap-3.5 mt-2 px-1">
          {/* Discreet Controls Bar: Combination + Scope + Add Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* AND / OR Combination */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCriteriaCombination('AND')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    criteriaCombination === 'AND'
                      ? 'bg-[#7B0209] text-white'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  Todos — AND
                </button>
                <button
                  type="button"
                  onClick={() => setCriteriaCombination('OR')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    criteriaCombination === 'OR'
                      ? 'bg-[#7B0209] text-white'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  Qualquer — OR
                </button>
              </div>

              {/* Scope: Same Snippet vs Same Screen */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCriteriaScope('SNIPPET')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    criteriaScope === 'SNIPPET'
                      ? 'bg-[#7B0209] text-white'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  No mesmo snippet
                </button>
                <button
                  type="button"
                  onClick={() => setCriteriaScope('SCREEN')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    criteriaScope === 'SCREEN'
                      ? 'bg-[#7B0209] text-white'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  Na mesma tela
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(criteria.length > 0 || paramInput) && (
                <button
                  type="button"
                  onClick={handleClearCriteria}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Limpar critérios
                </button>
              )}

              <button
                type="button"
                onClick={handleAddCriterion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#7B0209] text-white hover:bg-[#600207] shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar parâmetro
              </button>
            </div>
          </div>

          {/* Criteria Rows (if any explicit criteria added) */}
          {criteria.length > 0 && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
              {criteria.map((crit, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-gray-50/80 dark:bg-slate-800/80 border border-gray-200/70 dark:border-slate-700/70"
                >
                  {/* Field Selector */}
                  <select
                    value={crit.field}
                    onChange={(e) =>
                      handleUpdateCriterion(idx, {
                        field: e.target.value as ParameterCriterion['field'],
                      })
                    }
                    className="px-2.5 py-1.5 rounded-md text-xs font-ui bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200"
                  >
                    <option value="nome">Nome</option>
                    <option value="caminho">Caminho</option>
                    <option value="valor">Valor</option>
                    <option value="qualquer">Qualquer campo</option>
                  </select>

                  {/* Operator Selector */}
                  <select
                    value={crit.operator}
                    onChange={(e) =>
                      handleUpdateCriterion(idx, {
                        operator: e.target.value as ParameterCriterion['operator'],
                      })
                    }
                    className="px-2.5 py-1.5 rounded-md text-xs font-ui bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200"
                  >
                    <option value="contem">contém</option>
                    <option value="igual">igual a</option>
                    <option value="comeca_com">começa com</option>
                    <option value="existe">existe</option>
                  </select>

                  {/* Value Input */}
                  <input
                    type="text"
                    value={crit.value}
                    onChange={(e) => handleUpdateCriterion(idx, { value: e.target.value })}
                    placeholder="Valor do critério..."
                    className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-xs font-mono bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 placeholder-gray-400"
                  />

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Remover critério"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Perguntar à IA Sub-Controls */}
      {mode === 'ia' && (
        <div className="w-full flex flex-col items-start gap-3 mt-3 px-2">
          {/* AI Loading indicator */}
          {aiLoading && (
            <div className="w-full p-3 rounded-xl bg-red-50/60 dark:bg-slate-800/60 border border-red-100 dark:border-slate-700 flex items-center gap-3 text-xs font-ui text-gray-700 dark:text-slate-200">
              <Loader2 className="w-4 h-4 animate-spin text-[#7B0209] shrink-0" />
              <span>Consultando inteligência artificial sobre os artefatos...</span>
            </div>
          )}

          {/* AI Error banner */}
          {aiError && (
            <div className="w-full p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center justify-between gap-3 text-xs font-ui text-red-800 dark:text-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>{aiError}</span>
              </div>
              <button
                type="button"
                onClick={() => executeAiSearch()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Tentar novamente</span>
              </button>
            </div>
          )}

          {/* Example AI questions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Exemplos:
            </span>
            <button
              type="button"
              onClick={() => {
                const q = 'Onde é disparado o evento de confirmação de pagamento?';
                setAiQuestion(q);
                executeAiSearch(q);
              }}
              className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-[#7B0209] dark:hover:text-red-400 transition-colors flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#7B0209]" />
              <span>Confirmação de pagamento</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const q = 'Quais mapas possuem fluxos de Pix ou Cartões?';
                setAiQuestion(q);
                executeAiSearch(q);
              }}
              className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-[#7B0209] dark:hover:text-red-400 transition-colors flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#7B0209]" />
              <span>Fluxos de Pix ou Cartões</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const q = 'Em qual tela é coletado o CPF do usuário?';
                setAiQuestion(q);
                executeAiSearch(q);
              }}
              className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-[#7B0209] dark:hover:text-red-400 transition-colors flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#7B0209]" />
              <span>Coleta de CPF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
