// frontend/src/services/artifactSearchEngine.ts
// Pure in-memory deterministic search engine for tracking artifacts, screens, snippets, and parameters.
// Runs seamlessly in Web Workers, Node, or Browser main thread without DOM dependencies.

import { Artifact } from '../types';
import {
  cleanCodeLiteral,
  normalizeCodeWhitespace,
  normalizeCodeForComparison,
  detectQueryKind,
  extractQueryParams,
  normalizeText,
  decodeHtmlEntities,
  hasCodeStructure,
  parseParameterSearchTerms,
  ParamSearchTerm,
  ParameterQueryKind,
  ParsedQueryParam,
} from '../utils/parameterSearchParser';

export interface WorkerArtifactItem {
  id: string;
  titulo: string;
  artifact_type: string;
  produto?: string;
  subproduto?: string;
  full_path?: string;
  ancestor_titles?: string[];
  responsavel?: string;
  screens?: Array<{
    screen_id: string;
    screen_index?: number;
    instruction?: string;
    status?: string;
    snippets?: Array<{
      snippet_id?: string;
      raw_code?: string;
      event_normalized?: string;
      base_key?: string;
      parameters?: Array<{
        name?: string;
        path?: string;
        raw_value?: any;
        normalized_value?: any;
        value?: any;
        value_type?: string;
      }>;
    }>;
  }>;
}

export interface IndexedSnippetParameter {
  name: string;
  normName: string;
  path: string;
  normPath: string;
  raw_value: string;
  normalized_value: string;
  value: string;
  normValue: string;
}

export interface IndexedSnippet {
  snippet_id: string;
  snippet_index: number;
  event_normalized: string;
  normEvent: string;
  base_key: string;
  normBaseKey: string;
  raw_code: string;
  raw_code_clean: string;
  raw_code_normalized: string;
  normRawCode: string;
  parameters: IndexedSnippetParameter[];
  normParamNames: Set<string>;
  normParamPaths: Set<string>;
  normParamValues: Set<string>;
}

export interface IndexedScreen {
  screen_id: string;
  screen_index: number;
  instruction: string;
  normInstruction: string;
  status: string;
  snippets: IndexedSnippet[];
}

export interface IndexedArtifact {
  id: string;
  normId: string;
  titulo: string;
  normTitle: string;
  artifact_type: string;
  produto: string;
  normProduto: string;
  subproduto: string;
  normSubproduto: string;
  full_path: string;
  normFullPath: string;
  responsavel: string;
  screens: IndexedScreen[];
}

export interface ContentSearchResult {
  artifactId: string;
  score: number;
  matchedFields: string[];
  screenId?: string;
  screenIndex?: number;
  screenTitle?: string;
  snippetIndex?: number;
  codeExcerpt?: string;
  matchedValue?: string;
}

export interface ParameterCriterion {
  field: 'nome' | 'caminho' | 'valor' | 'qualquer';
  operator: 'existe' | 'igual' | 'contem' | 'comeca_com';
  value: string;
}

export interface ParameterSearchResult {
  artifactId: string;
  screenId: string;
  screenIndex: number;
  screenTitle?: string;
  snippetIndex: number;
  matchedCriteria: string[];
  matchedValues: string[];
  rawCodePreview?: string;
  event?: string;
  additionalMatchesCount: number;
}

export type ParameterMatchQuality =
  | 'identical_snippet'
  | 'literal_slice'
  | 'normalized_code'
  | 'all_params_snippet'
  | 'all_params_screen'
  | 'partial_match';

export interface ParameterOccurrence {
  screenId: string;
  screenIndex: number;
  screenTitle: string;
  snippetId: string;
  snippetIndex: number;
  event: string;
  quality: ParameterMatchQuality;
  qualityLabel: string;
  qualityScore: number;
  matchedCount: number;
  totalCount: number;
  rawCodePreview: string;
  rawCodeFull: string;
  matchedTerms: string[];
}

export interface ParameterArtifactGroup {
  artifactId: string;
  totalOccurrences: number;
  uniqueScreensCount: number;
  uniqueSnippetsCount: number;
  bestQuality: ParameterMatchQuality;
  bestQualityLabel: string;
  bestQualityScore: number;
  isPartial: boolean;
  occurrences: ParameterOccurrence[];
}

export interface AdvancedParameterSearchResponse {
  completeGroups: ParameterArtifactGroup[];
  partialGroups: ParameterArtifactGroup[];
  allArtifactIds: string[];
  totalArtifactsCount: number;
  queryKind: ParameterQueryKind;
  extractedParams: ParsedQueryParam[];
  durationMs: number;
}

class ArtifactSearchEngine {
  private indexedArtifacts: IndexedArtifact[] = [];
  private isReady = false;
  private nameFrequency = new Map<string, { original: string; count: number }>();
  private pathFrequency = new Map<string, { original: string; count: number }>();
  private valueFrequency = new Map<string, { original: string; count: number }>();

  public get ready(): boolean {
    return this.isReady;
  }

  public buildIndex(artifacts: (Artifact | WorkerArtifactItem)[]): void {
    this.nameFrequency.clear();
    this.pathFrequency.clear();
    this.valueFrequency.clear();

    this.indexedArtifacts = artifacts.map((art) => {
      const screens: IndexedScreen[] = (art.screens || []).map((sc, scIdx) => {
        const snippets: IndexedSnippet[] = (sc.snippets || []).map((snip, snipIdx) => {
          const params: IndexedSnippetParameter[] = (snip.parameters || []).map((p) => {
            const rawName = String(p.name || '').trim();
            const rawPath = String(p.path || '').trim();

            // Prioridade: normalized_value, depois raw_value e somente depois value como compatibilidade legada
            const pNormValStr = p.normalized_value !== undefined && p.normalized_value !== null ? String(p.normalized_value).trim() : '';
            const pRawValStr = p.raw_value !== undefined && p.raw_value !== null ? String(p.raw_value).trim() : '';
            const pValStr = p.value !== undefined && p.value !== null ? String(p.value).trim() : '';

            const resolvedVal = pNormValStr || pRawValStr || pValStr;
            const actualRawVal = pRawValStr || resolvedVal;
            const actualNormVal = pNormValStr || resolvedVal;

            const nName = normalizeText(rawName);
            const nPath = normalizeText(rawPath);
            const nVal = normalizeText(resolvedVal);

            if (rawName && nName.length > 1) {
              const cur = this.nameFrequency.get(nName) || { original: rawName, count: 0 };
              cur.count++;
              this.nameFrequency.set(nName, cur);
            }
            if (rawPath && nPath.length > 1) {
              const cur = this.pathFrequency.get(nPath) || { original: rawPath, count: 0 };
              cur.count++;
              this.pathFrequency.set(nPath, cur);
            }
            if (resolvedVal && nVal.length > 1 && nVal.length < 50) {
              const cur = this.valueFrequency.get(nVal) || { original: resolvedVal, count: 0 };
              cur.count++;
              this.valueFrequency.set(nVal, cur);
            }

            return {
              name: rawName,
              normName: nName,
              path: rawPath,
              normPath: nPath,
              raw_value: actualRawVal,
              normalized_value: actualNormVal,
              value: resolvedVal,
              normValue: nVal,
            };
          });

          const rawEvent = String(snip.event_normalized || '').trim();
          const rawBaseKey = String(snip.base_key || '').trim();
          const rawCode = String(snip.raw_code || '').trim();

          const normParamNames = new Set<string>();
          const normParamPaths = new Set<string>();
          const normParamValues = new Set<string>();

          params.forEach((p) => {
            if (p.normName) normParamNames.add(p.normName);
            if (p.normPath) normParamPaths.add(p.normPath);
            if (p.normValue) normParamValues.add(p.normValue);
            if (p.raw_value) normParamValues.add(normalizeText(p.raw_value));
            if (p.normalized_value) normParamValues.add(normalizeText(p.normalized_value));
          });

          return {
            snippet_id: String(snip.snippet_id || `${sc.screen_id}_s${snipIdx + 1}`),
            snippet_index: snipIdx,
            event_normalized: rawEvent,
            normEvent: normalizeText(rawEvent),
            base_key: rawBaseKey,
            normBaseKey: normalizeText(rawBaseKey),
            raw_code: rawCode,
            raw_code_clean: cleanCodeLiteral(rawCode),
            raw_code_normalized: normalizeCodeForComparison(rawCode),
            normRawCode: normalizeText(rawCode),
            parameters: params,
            normParamNames,
            normParamPaths,
            normParamValues,
          };
        });

        const rawInst = String(sc.instruction || '').trim();
        return {
          screen_id: String(sc.screen_id || scIdx + 1),
          screen_index: sc.screen_index ?? scIdx + 1,
          instruction: rawInst,
          normInstruction: normalizeText(rawInst),
          status: String(sc.status || ''),
          snippets,
        };
      });

      const rawTitle = String(art.titulo || '');
      const rawProd = String(art.produto || '');
      const rawSub = String(art.subproduto || '');
      const rawPath = String(art.full_path || '');
      const rawId = String(art.id || '');

      return {
        id: rawId,
        normId: normalizeText(rawId),
        titulo: rawTitle,
        normTitle: normalizeText(rawTitle),
        artifact_type: art.artifact_type || 'MAPA',
        produto: rawProd,
        normProduto: normalizeText(rawProd),
        subproduto: rawSub,
        normSubproduto: normalizeText(rawSub),
        full_path: rawPath,
        normFullPath: normalizeText(rawPath),
        responsavel: String(art.responsavel || ''),
        screens,
      };
    });

    this.isReady = true;
  }

  public searchContent(query: string, limit = 50): ContentSearchResult[] {
    const normQuery = normalizeText(query);
    if (!normQuery) return [];

    const tokens = normQuery.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const results: ContentSearchResult[] = [];

    for (const art of this.indexedArtifacts) {
      let score = 0;
      const matchedFields = new Set<string>();
      let bestScreenId: string | undefined;
      let bestScreenIndex: number | undefined;
      let bestScreenTitle: string | undefined;
      let bestSnippetIndex: number | undefined;
      let codeExcerpt: string | undefined;
      let matchedValue: string | undefined;

      // Check exact title or ID match
      if (art.normId === normQuery || art.normTitle === normQuery) {
        score += 150;
        matchedFields.add('Título/ID exato');
      } else if (art.normTitle.startsWith(normQuery) || art.normId.startsWith(normQuery)) {
        score += 100;
        matchedFields.add('Início do Título');
      }

      // Check tokens in title
      const titleTokenHits = tokens.filter((t) => art.normTitle.includes(t) || art.normId.includes(t)).length;
      if (titleTokenHits > 0) {
        score += titleTokenHits * 35;
        matchedFields.add('Título');
      }

      // Check Produto / Subproduto
      const prodHits = tokens.filter((t) => art.normProduto.includes(t) || art.normSubproduto.includes(t)).length;
      if (prodHits > 0) {
        score += prodHits * 25;
        matchedFields.add('Produto/Subproduto');
      }

      // Check Full Path
      const pathHits = tokens.filter((t) => art.normFullPath.includes(t)).length;
      if (pathHits > 0) {
        score += pathHits * 10;
        matchedFields.add('Caminho');
      }

      // Search inside screens and snippets
      let foundInSnippet = false;
      for (const sc of art.screens) {
        const instHits = tokens.filter((t) => sc.normInstruction.includes(t)).length;
        if (instHits > 0) {
          score += instHits * 20;
          matchedFields.add('Instrução da Tela');
          if (!bestScreenId) {
            bestScreenId = sc.screen_id;
            bestScreenIndex = sc.screen_index;
            bestScreenTitle = sc.instruction;
          }
        }

        for (const snip of sc.snippets) {
          let snippetScore = 0;
          const evHits = tokens.filter((t) => snip.normEvent.includes(t) || snip.normBaseKey.includes(t)).length;
          if (evHits > 0) {
            snippetScore += evHits * 30;
            matchedFields.add('Evento');
            matchedValue = snip.event_normalized || snip.base_key;
          }

          let paramHitCount = 0;
          for (const p of snip.parameters) {
            const matchParam = tokens.filter((t) => p.normName.includes(t) || p.normPath.includes(t) || p.normValue.includes(t)).length;
            if (matchParam > 0) {
              paramHitCount += matchParam;
              if (!matchedValue) matchedValue = `${p.name}: ${p.value}`;
            }
          }
          if (paramHitCount > 0) {
            snippetScore += paramHitCount * 18;
            matchedFields.add('Parâmetro');
          }

          const codeHits = tokens.filter((t) => snip.normRawCode.includes(t)).length;
          if (codeHits > 0) {
            snippetScore += codeHits * 12;
            matchedFields.add('Código');
          }

          if (snippetScore > 0 && !foundInSnippet) {
            foundInSnippet = true;
            bestScreenId = sc.screen_id;
            bestScreenIndex = sc.screen_index;
            bestScreenTitle = sc.instruction;
            bestSnippetIndex = snip.snippet_index;
            codeExcerpt = snip.raw_code ? snip.raw_code.slice(0, 140) : undefined;
          }

          score += snippetScore;
        }
      }

      if (score > 0) {
        results.push({
          artifactId: art.id,
          score,
          matchedFields: Array.from(matchedFields),
          screenId: bestScreenId,
          screenIndex: bestScreenIndex,
          screenTitle: bestScreenTitle,
          snippetIndex: bestSnippetIndex,
          codeExcerpt,
          matchedValue,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private evaluateCriterionOnSnippet(
    criterion: ParameterCriterion,
    snippet: IndexedSnippet
  ): { matched: boolean; label?: string; val?: string } {
    const op = criterion.operator;
    const f = criterion.field;
    const targetNorm = normalizeText(criterion.value);

    if (op === 'existe') {
      if (!targetNorm) {
        return { matched: snippet.parameters.length > 0, label: 'Parâmetro existe' };
      }
      const found = snippet.parameters.find((p) => {
        const segs = p.normPath.split('.');
        const lastSeg = segs[segs.length - 1];
        const nameExact = p.normName === targetNorm || p.normPath === targetNorm || lastSeg === targetNorm;
        return (
          (f === 'nome' && nameExact) ||
          (f === 'caminho' && p.normPath === targetNorm) ||
          (f === 'valor' && p.normValue === targetNorm) ||
          (f === 'qualquer' && (nameExact || p.normValue === targetNorm))
        );
      });
      if (found) {
        return { matched: true, label: `${found.name} existe`, val: found.value };
      }
      if (
        (f === 'qualquer' || f === 'nome') &&
        (snippet.normEvent === targetNorm || snippet.normBaseKey === targetNorm)
      ) {
        return { matched: true, label: `Evento ${snippet.event_normalized} existe`, val: snippet.event_normalized };
      }
      return { matched: false };
    }

    if (!targetNorm) return { matched: false };

    for (const p of snippet.parameters) {
      let matchesField = false;
      let valMatched = '';
      const segs = p.normPath.split('.');
      const lastSeg = segs[segs.length - 1];

      if (f === 'nome') {
        if (op === 'igual') matchesField = p.normName === targetNorm || p.normPath === targetNorm || lastSeg === targetNorm;
        else if (op === 'contem') matchesField = p.normName === targetNorm || p.normPath === targetNorm || lastSeg === targetNorm;
        else if (op === 'comeca_com') matchesField = p.normName.startsWith(targetNorm);
        valMatched = `${p.name}: ${p.value}`;
      } else if (f === 'caminho') {
        if (op === 'igual') matchesField = p.normPath === targetNorm;
        else if (op === 'contem') matchesField = p.normPath.includes(targetNorm);
        else if (op === 'comeca_com') matchesField = p.normPath.startsWith(targetNorm);
        valMatched = `${p.path} = ${p.value}`;
      } else if (f === 'valor') {
        if (op === 'igual') matchesField = p.normValue === targetNorm;
        else if (op === 'contem') matchesField = p.normValue.includes(targetNorm);
        else if (op === 'comeca_com') matchesField = p.normValue.startsWith(targetNorm);
        valMatched = `${p.name} = "${p.value}"`;
      } else {
        const nameExact = p.normName === targetNorm || p.normPath === targetNorm || lastSeg === targetNorm;
        if (op === 'igual') {
          matchesField = nameExact || p.normValue === targetNorm;
        } else if (op === 'contem') {
          matchesField = nameExact || p.normValue.includes(targetNorm);
        } else if (op === 'comeca_com') {
          matchesField = p.normName.startsWith(targetNorm) || p.normValue.startsWith(targetNorm);
        }
        valMatched = `${p.name} = ${p.value}`;
      }

      if (matchesField) {
        return { matched: true, label: `${p.name} (${op})`, val: valMatched };
      }
    }

    if (f === 'nome' || f === 'qualquer') {
      let evMatch = false;
      if (op === 'igual') evMatch = snippet.normEvent === targetNorm || snippet.normBaseKey === targetNorm;
      else if (op === 'contem') evMatch = snippet.normEvent === targetNorm || snippet.normBaseKey === targetNorm;
      else if (op === 'comeca_com') evMatch = snippet.normEvent.startsWith(targetNorm) || snippet.normBaseKey.startsWith(targetNorm);

      if (evMatch) {
        return { matched: true, label: `Evento ${snippet.event_normalized}`, val: snippet.event_normalized };
      }
    }

    return { matched: false };
  }

  public searchParameters(
    criteria: ParameterCriterion[],
    combination: 'AND' | 'OR',
    _scope: 'SNIPPET' | 'SCREEN',
    limit = 500
  ): ParameterSearchResult[] {
    if (!criteria || criteria.length === 0) return [];

    const canonicalCriteria = [...criteria].sort((a, b) => {
      const keyA = `${a.field || ''}:${a.operator || ''}:${a.value || ''}`;
      const keyB = `${b.field || ''}:${b.operator || ''}:${b.value || ''}`;
      return keyA.localeCompare(keyB);
    });

    interface ArtifactMatchGroup {
      artifactId: string;
      totalMatches: number;
      results: ParameterSearchResult[];
    }

    const matchedGroups: ArtifactMatchGroup[] = [];

    for (const art of this.indexedArtifacts) {
      let artifactMatchesCount = 0;
      const artifactResults: ParameterSearchResult[] = [];

      for (const sc of art.screens) {
        // Enforce same snippet constraint strictly
        for (const snip of sc.snippets) {
          const matchedCriteriaList: string[] = [];
          const matchedValuesList: string[] = [];

          let allMatched = true;
          let anyMatched = false;

          for (const crit of canonicalCriteria) {
            const evalRes = this.evaluateCriterionOnSnippet(crit, snip);
            if (evalRes.matched) {
              anyMatched = true;
              if (evalRes.label) matchedCriteriaList.push(evalRes.label);
              if (evalRes.val) matchedValuesList.push(evalRes.val);
            } else {
              allMatched = false;
            }
          }

          const isMatch = combination === 'AND' ? allMatched : anyMatched;
          if (isMatch) {
            artifactMatchesCount++;
            artifactResults.push({
              artifactId: art.id,
              screenId: sc.screen_id,
              screenIndex: sc.screen_index,
              screenTitle: sc.instruction,
              snippetIndex: snip.snippet_index,
              matchedCriteria: matchedCriteriaList,
              matchedValues: matchedValuesList,
              rawCodePreview: snip.raw_code ? snip.raw_code.slice(0, 160) : undefined,
              event: snip.event_normalized,
              additionalMatchesCount: 0,
            });
          }
        }
      }

      if (artifactResults.length > 0) {
        artifactResults[0].additionalMatchesCount = Math.max(0, artifactMatchesCount - 1);
        matchedGroups.push({
          artifactId: art.id,
          totalMatches: artifactMatchesCount,
          results: artifactResults,
        });
      }
    }

    matchedGroups.sort((a, b) => {
      if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
      return a.artifactId.localeCompare(b.artifactId);
    });

    const finalResults: ParameterSearchResult[] = [];
    for (const group of matchedGroups) {
      finalResults.push(...group.results);
      if (finalResults.length >= limit) break;
    }

    return finalResults.slice(0, limit);
  }

  public getSuggestions(field: string, input: string, limit = 10): string[] {
    const normInput = normalizeText(input);
    let mapToSearch = this.nameFrequency;
    if (field === 'caminho') mapToSearch = this.pathFrequency;
    else if (field === 'valor') mapToSearch = this.valueFrequency;

    const candidates: Array<{ original: string; count: number; starts: boolean }> = [];

    for (const [normKey, entry] of mapToSearch.entries()) {
      if (!normInput || normKey.includes(normInput)) {
        candidates.push({
          original: entry.original,
          count: entry.count,
          starts: normKey.startsWith(normInput),
        });
      }
    }

    candidates.sort((a, b) => {
      if (a.starts && !b.starts) return -1;
      if (!a.starts && b.starts) return 1;
      if (b.count !== a.count) return b.count - a.count;
      return a.original.localeCompare(b.original);
    });

    return candidates.slice(0, limit).map((c) => c.original);
  }

  private matchesParamTermInSnippet(snip: IndexedSnippet, term: ParamSearchTerm): boolean {
    const targetKey = term.name.toLowerCase().trim();
    const targetVal = term.value !== undefined ? term.value.toLowerCase().trim() : undefined;

    // 1. Check snippet.parameters
    for (const p of snip.parameters) {
      const pName = p.name.toLowerCase().trim();
      const pPath = p.path.toLowerCase().trim();
      const segments = pPath.split('.');
      const lastSegment = segments[segments.length - 1].trim();

      const nameMatches = pName === targetKey || pPath === targetKey || lastSegment === targetKey;

      if (nameMatches) {
        if (term.isKeyValue && targetVal !== undefined) {
          const pVal = String(p.value || '').toLowerCase().trim();
          const pRaw = String(p.raw_value || '').toLowerCase().trim();
          const pNorm = String(p.normalized_value || '').toLowerCase().trim();
          const normTargetVal = normalizeText(targetVal);

          if (
            pVal === targetVal ||
            pRaw === targetVal ||
            pNorm === targetVal ||
            (normTargetVal && p.normValue === normTargetVal) ||
            (normTargetVal && normalizeText(pRaw) === normTargetVal) ||
            (normTargetVal && normalizeText(pNorm) === normTargetVal)
          ) {
            return true;
          }
        } else {
          return true;
        }
      }
    }

    // 2. Exact identifier boundary match in snippet.raw_code
    // Note: event_normalized and base_key are derived metadata and must NOT satisfy an exact key search for 'event'.
    if (snip.raw_code) {
      const code = decodeHtmlEntities(snip.raw_code);
      const escapedKey = targetKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      if (term.isKeyValue && targetVal !== undefined) {
        const escapedVal = targetVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Matches key: "value" or key: 'value' or key: value with exact identifier boundary
        const kvRegex = new RegExp(
          `(?:^|[^a-zA-Z0-9_$])["']?${escapedKey}["']?\\s*:\\s*["']?${escapedVal}["']?(?=[,\\s}\\]\\);]|$)`,
          'i'
        );
        if (kvRegex.test(code)) {
          return true;
        }
      } else {
        // Matches key: or "key": or 'key': with exact identifier boundary
        const keyRegex = new RegExp(
          `(?:^|[^a-zA-Z0-9_$])["']?${escapedKey}["']?\\s*:`,
          'i'
        );
        if (keyRegex.test(code)) {
          return true;
        }
      }
    }

    return false;
  }

  public searchCodeAndParameters(
    rawQuery: string,
    options?: {
      matchType?: 'auto' | 'literal' | 'normalized' | 'params';
      scope?: 'SNIPPET' | 'SCREEN';
      condition?: 'AND' | 'OR';
      limit?: number;
    }
  ): AdvancedParameterSearchResponse {
    const startTime = Date.now();
    const trimmed = (rawQuery || '').trim();

    // Protection 1: Empty or query with only '+' or whitespace returns empty response immediately
    const cleanTokens = trimmed.replace(/\+/g, '').trim();
    if (!trimmed || !cleanTokens) {
      return {
        completeGroups: [],
        partialGroups: [],
        allArtifactIds: [],
        totalArtifactsCount: 0,
        queryKind: 'parameter',
        extractedParams: [],
        durationMs: 0,
      };
    }

    const isCode = hasCodeStructure(trimmed);
    const cleanedQuery = cleanCodeLiteral(trimmed);
    const normalizedWhitespaceQuery = normalizeCodeWhitespace(trimmed);
    const normalizedQuery = normalizeCodeForComparison(trimmed);
    const queryKind = detectQueryKind(trimmed);
    const terms = parseParameterSearchTerms(trimmed);
    const extractedParams = extractQueryParams(trimmed);

    // Protection 2: If no terms and no code structure, return empty
    if (!isCode && terms.length === 0) {
      return {
        completeGroups: [],
        partialGroups: [],
        allArtifactIds: [],
        totalArtifactsCount: 0,
        queryKind,
        extractedParams: [],
        durationMs: 0,
      };
    }

    // Explicit scope and condition handling:
    // For queries with '+', the condition MUST be 'AND', regardless of heuristics.
    const hasPlus = trimmed.includes('+');
    const condition: 'AND' | 'OR' = hasPlus ? 'AND' : (options?.condition || 'AND');
    const scope: 'SNIPPET' | 'SCREEN' = options?.scope || 'SNIPPET';

    const rawArtifactGroups: ParameterArtifactGroup[] = [];

    for (const art of this.indexedArtifacts) {
      const occurrencesMap = new Map<string, ParameterOccurrence>();

      for (const sc of art.screens) {
        let screenHadCompleteSnippetMatch = false;

        // 1. Evaluate individual snippets
        for (const snip of sc.snippets) {
          let bestQuality: ParameterMatchQuality | null = null;
          let qualityLabel = '';
          let qualityScore = 0;
          let matchedTerms: string[] = [];

          // Tier 1: Snippet idêntico
          const snipClean = snip.raw_code_clean;
          const snipNormWS = normalizeCodeWhitespace(snip.raw_code);
          const snipNormComp = snip.raw_code_normalized;

          if (
            snipClean.length > 0 &&
            (snipClean === cleanedQuery ||
              snipNormWS === normalizedWhitespaceQuery ||
              snipNormComp === normalizedQuery)
          ) {
            bestQuality = 'identical_snippet';
            qualityLabel = 'Snippet idêntico';
            qualityScore = 1000;
            matchedTerms = terms.length > 0 ? terms.map((t) => (t.isKeyValue ? `${t.name}: ${t.value}` : t.name)) : [cleanedQuery];
          }
          // Tier 2: Fragmento de código idêntico após normalização de espaços
          else if (
            isCode &&
            normalizedWhitespaceQuery.length >= 5 &&
            (snipNormWS.includes(normalizedWhitespaceQuery) || snipNormComp.includes(normalizedQuery))
          ) {
            bestQuality = 'literal_slice';
            qualityLabel = 'Fragmento de código idêntico';
            qualityScore = 800;
            matchedTerms = terms.length > 0 ? terms.map((t) => (t.isKeyValue ? `${t.name}: ${t.value}` : t.name)) : [cleanedQuery];
          }
          // Tier 3: Parâmetros no MESMO snippet
          else if (terms.length > 0) {
            if (condition === 'AND') {
              const allMatched = terms.every((t) => this.matchesParamTermInSnippet(snip, t));
              if (allMatched) {
                bestQuality = 'all_params_snippet';
                qualityLabel = 'Todos os parâmetros encontrados';
                qualityScore = 600;
                matchedTerms = terms.map((t) => (t.isKeyValue ? `${t.name}: ${t.value}` : t.name));
              }
            } else {
              // OR condition
              const matchedTermsList = terms.filter((t) => this.matchesParamTermInSnippet(snip, t));
              if (matchedTermsList.length > 0) {
                const isAll = matchedTermsList.length === terms.length;
                bestQuality = isAll ? 'all_params_snippet' : 'partial_match';
                qualityLabel = isAll ? 'Todos os parâmetros encontrados' : `${matchedTermsList.length} de ${terms.length} parâmetros encontrados`;
                qualityScore = isAll ? 600 : 300 + (matchedTermsList.length * 50);
                matchedTerms = matchedTermsList.map((t) => (t.isKeyValue ? `${t.name}: ${t.value}` : t.name));
              }
            }
          }

          // If this snippet matched Tier 1, Tier 2, or Tier 3:
          if (bestQuality) {
            if (qualityScore >= 600) {
              screenHadCompleteSnippetMatch = true;
            }
            const occKey = `${sc.screen_id}#${snip.snippet_index}`;
            const existing = occurrencesMap.get(occKey);
            if (!existing || existing.qualityScore < qualityScore) {
              occurrencesMap.set(occKey, {
                screenId: sc.screen_id,
                screenIndex: sc.screen_index,
                screenTitle: sc.instruction || `Tela #${sc.screen_index}`,
                snippetId: snip.snippet_id || `${sc.screen_id}_s${snip.snippet_index + 1}`,
                snippetIndex: snip.snippet_index,
                event: snip.event_normalized || snip.base_key || 'Snippet',
                quality: bestQuality,
                qualityLabel,
                qualityScore,
                matchedCount: matchedTerms.length,
                totalCount: terms.length,
                rawCodePreview: snip.raw_code ? snip.raw_code.slice(0, 320) : '',
                rawCodeFull: snip.raw_code || '',
                matchedTerms,
              });
            }
          }
        } // end snippet loop

        // 2. Se scope === 'SCREEN' e a tela como um todo satisfaz a condição
        if (scope === 'SCREEN' && terms.length > 0 && !screenHadCompleteSnippetMatch) {
          if (condition === 'AND') {
            const allTermsOnScreen = terms.every((t) =>
              sc.snippets.some((snip) => this.matchesParamTermInSnippet(snip, t))
            );
            if (allTermsOnScreen && sc.snippets.length > 0) {
              const repSnip = sc.snippets.find((snip) =>
                terms.some((t) => this.matchesParamTermInSnippet(snip, t))
              ) || sc.snippets[0];

              const occKey = `${sc.screen_id}#screen`;
              occurrencesMap.set(occKey, {
                screenId: sc.screen_id,
                screenIndex: sc.screen_index,
                screenTitle: sc.instruction || `Tela #${sc.screen_index}`,
                snippetId: repSnip.snippet_id || `${sc.screen_id}_s${repSnip.snippet_index + 1}`,
                snippetIndex: repSnip.snippet_index,
                event: repSnip.event_normalized || repSnip.base_key || 'Tela',
                quality: 'all_params_screen',
                qualityLabel: 'Todos os parâmetros na mesma tela',
                qualityScore: 450,
                matchedCount: terms.length,
                totalCount: terms.length,
                rawCodePreview: repSnip.raw_code ? repSnip.raw_code.slice(0, 320) : '',
                rawCodeFull: repSnip.raw_code || '',
                matchedTerms: terms.map((t) => (t.isKeyValue ? `${t.name}: ${t.value}` : t.name)),
              });
            }
          } else {
            // OR condition no escopo SCREEN
            const matchedTermsOnScreen = terms.filter((t) =>
              sc.snippets.some((snip) => this.matchesParamTermInSnippet(snip, t))
            );
            if (matchedTermsOnScreen.length > 0 && sc.snippets.length > 0) {
              const repSnip = sc.snippets.find((snip) =>
                terms.some((t) => this.matchesParamTermInSnippet(snip, t))
              ) || sc.snippets[0];

              const occKey = `${sc.screen_id}#screen`;
              occurrencesMap.set(occKey, {
                screenId: sc.screen_id,
                screenIndex: sc.screen_index,
                screenTitle: sc.instruction || `Tela #${sc.screen_index}`,
                snippetId: repSnip.snippet_id || `${sc.screen_id}_s${repSnip.snippet_index + 1}`,
                snippetIndex: repSnip.snippet_index,
                event: repSnip.event_normalized || repSnip.base_key || 'Tela',
                quality: matchedTermsOnScreen.length === terms.length ? 'all_params_screen' : 'partial_match',
                qualityLabel: matchedTermsOnScreen.length === terms.length
                  ? 'Todos os parâmetros na mesma tela'
                  : `${matchedTermsOnScreen.length} de ${terms.length} parâmetros encontrados`,
                qualityScore: 350 + (matchedTermsOnScreen.length * 20),
                matchedCount: matchedTermsOnScreen.length,
                totalCount: terms.length,
                rawCodePreview: repSnip.raw_code ? repSnip.raw_code.slice(0, 320) : '',
                rawCodeFull: repSnip.raw_code || '',
                matchedTerms: matchedTermsOnScreen.map((t) => (t.isKeyValue ? `${t.name}: ${t.value}` : t.name)),
              });
            }
          }
        }
      } // end screen loop

      const occurrences = Array.from(occurrencesMap.values());
      if (occurrences.length > 0) {
        occurrences.sort((a, b) => {
          if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
          return a.snippetIndex - b.snippetIndex;
        });
        const best = occurrences[0];

        const uniqueScreens = new Set(occurrences.map((o) => o.screenId)).size;
        const uniqueSnippets = new Set(occurrences.map((o) => `${o.screenId}-${o.snippetIndex}`)).size;

        rawArtifactGroups.push({
          artifactId: art.id,
          totalOccurrences: occurrences.length,
          uniqueScreensCount: uniqueScreens,
          uniqueSnippetsCount: uniqueSnippets,
          bestQuality: best.quality,
          bestQualityLabel: best.qualityLabel,
          bestQualityScore: best.qualityScore,
          isPartial: false,
          occurrences,
        });
      }
    } // end artifact loop

    const groupSorter = (a: ParameterArtifactGroup, b: ParameterArtifactGroup) => {
      if (b.bestQualityScore !== a.bestQualityScore) return b.bestQualityScore - a.bestQualityScore;
      if (b.totalOccurrences !== a.totalOccurrences) return b.totalOccurrences - a.totalOccurrences;
      return a.artifactId.localeCompare(b.artifactId);
    };

    rawArtifactGroups.sort(groupSorter);

    const completeGroups = rawArtifactGroups;
    const partialGroups: ParameterArtifactGroup[] = [];
    const allArtifactIds: string[] = completeGroups.map((g) => g.artifactId);

    return {
      completeGroups,
      partialGroups,
      allArtifactIds,
      totalArtifactsCount: allArtifactIds.length,
      queryKind,
      extractedParams,
      durationMs: Date.now() - startTime,
    };
  }
}

export const artifactSearchEngine = new ArtifactSearchEngine();
