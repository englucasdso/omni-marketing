// frontend/src/workers/artifactSearch.worker.ts
// Native Vite Web Worker for indexing and querying artifacts

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
        value?: any;
      }>;
    }>;
  }>;
}

interface IndexedSnippet {
  snippet_index: number;
  event_normalized: string;
  normEvent: string;
  base_key: string;
  normBaseKey: string;
  raw_code: string;
  normRawCode: string;
  parameters: Array<{
    name: string;
    normName: string;
    path: string;
    normPath: string;
    value: string;
    normValue: string;
  }>;
}

interface IndexedScreen {
  screen_id: string;
  screen_index: number;
  instruction: string;
  normInstruction: string;
  status: string;
  snippets: IndexedSnippet[];
}

interface IndexedArtifact {
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

let indexedArtifacts: IndexedArtifact[] = [];
let isReady = false;

// Suggestions frequency maps
const nameFrequency = new Map<string, { original: string; count: number }>();
const pathFrequency = new Map<string, { original: string; count: number }>();
const valueFrequency = new Map<string, { original: string; count: number }>();

function normalize(str: string): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buildIndex(artifacts: WorkerArtifactItem[]) {
  const start = Date.now();
  nameFrequency.clear();
  pathFrequency.clear();
  valueFrequency.clear();

  indexedArtifacts = artifacts.map((art) => {
    const screens: IndexedScreen[] = (art.screens || []).map((sc, scIdx) => {
      const snippets: IndexedSnippet[] = (sc.snippets || []).map((snip, snipIdx) => {
        const params = (snip.parameters || []).map((p) => {
          const rawName = String(p.name || '').trim();
          const rawPath = String(p.path || '').trim();
          const rawVal = p.value !== undefined && p.value !== null ? String(p.value).trim() : '';

          const nName = normalize(rawName);
          const nPath = normalize(rawPath);
          const nVal = normalize(rawVal);

          if (rawName && nName.length > 1) {
            const cur = nameFrequency.get(nName) || { original: rawName, count: 0 };
            cur.count++;
            nameFrequency.set(nName, cur);
          }
          if (rawPath && nPath.length > 1) {
            const cur = pathFrequency.get(nPath) || { original: rawPath, count: 0 };
            cur.count++;
            pathFrequency.set(nPath, cur);
          }
          if (rawVal && nVal.length > 1 && nVal.length < 50) {
            const cur = valueFrequency.get(nVal) || { original: rawVal, count: 0 };
            cur.count++;
            valueFrequency.set(nVal, cur);
          }

          return {
            name: rawName,
            normName: nName,
            path: rawPath,
            normPath: nPath,
            value: rawVal,
            normValue: nVal,
          };
        });

        const rawEvent = String(snip.event_normalized || '').trim();
        const rawBaseKey = String(snip.base_key || '').trim();
        const rawCode = String(snip.raw_code || '').trim();

        return {
          snippet_index: snipIdx,
          event_normalized: rawEvent,
          normEvent: normalize(rawEvent),
          base_key: rawBaseKey,
          normBaseKey: normalize(rawBaseKey),
          raw_code: rawCode,
          normRawCode: normalize(rawCode),
          parameters: params,
        };
      });

      const rawInst = String(sc.instruction || '').trim();
      return {
        screen_id: String(sc.screen_id || scIdx + 1),
        screen_index: sc.screen_index ?? scIdx + 1,
        instruction: rawInst,
        normInstruction: normalize(rawInst),
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
      normId: normalize(rawId),
      titulo: rawTitle,
      normTitle: normalize(rawTitle),
      artifact_type: art.artifact_type || 'MAPA',
      produto: rawProd,
      normProduto: normalize(rawProd),
      subproduto: rawSub,
      normSubproduto: normalize(rawSub),
      full_path: rawPath,
      normFullPath: normalize(rawPath),
      responsavel: String(art.responsavel || ''),
      screens,
    };
  });

  isReady = true;
  console.log(`[Worker] Índice construído para ${indexedArtifacts.length} artefatos em ${Date.now() - start}ms.`);
}

function searchContent(query: string, limit = 50): ContentSearchResult[] {
  const normQuery = normalize(query);
  if (!normQuery) return [];

  const tokens = normQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const results: ContentSearchResult[] = [];

  for (const art of indexedArtifacts) {
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

    // Must match at least one token across the artifact
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

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function evaluateCriterionOnSnippet(
  criterion: ParameterCriterion,
  snippet: IndexedSnippet
): { matched: boolean; label?: string; val?: string } {
  const op = criterion.operator;
  const f = criterion.field;
  const targetNorm = normalize(criterion.value);

  // If operator is 'existe', we check presence
  if (op === 'existe') {
    if (!targetNorm) {
      // Empty criterion value for exists means: any parameter exists
      return { matched: snippet.parameters.length > 0, label: 'Parâmetro existe' };
    }
    const found = snippet.parameters.find(
      (p) =>
        (f === 'nome' && (p.normName === targetNorm || p.normName.includes(targetNorm))) ||
        (f === 'caminho' && (p.normPath === targetNorm || p.normPath.includes(targetNorm))) ||
        (f === 'valor' && (p.normValue === targetNorm || p.normValue.includes(targetNorm))) ||
        (f === 'qualquer' && (p.normName.includes(targetNorm) || p.normPath.includes(targetNorm) || p.normValue.includes(targetNorm)))
    );
    if (found) {
      return { matched: true, label: `${found.name} existe`, val: found.value };
    }
    // Also check event_normalized / base_key
    if ((f === 'qualquer' || f === 'nome') && (snippet.normEvent.includes(targetNorm) || snippet.normBaseKey.includes(targetNorm))) {
      return { matched: true, label: `Evento ${snippet.event_normalized} existe`, val: snippet.event_normalized };
    }
    return { matched: false };
  }

  if (!targetNorm) return { matched: false };

  // Match against parameters
  for (const p of snippet.parameters) {
    let matchesField = false;
    let valMatched = '';

    if (f === 'nome') {
      if (op === 'igual') matchesField = p.normName === targetNorm;
      else if (op === 'contem') matchesField = p.normName.includes(targetNorm);
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
      // qualquer
      if (op === 'igual') {
        matchesField = p.normName === targetNorm || p.normValue === targetNorm || p.normPath === targetNorm;
      } else if (op === 'contem') {
        matchesField = p.normName.includes(targetNorm) || p.normValue.includes(targetNorm) || p.normPath.includes(targetNorm);
      } else if (op === 'comeca_com') {
        matchesField = p.normName.startsWith(targetNorm) || p.normValue.startsWith(targetNorm);
      }
      valMatched = `${p.name} = ${p.value}`;
    }

    if (matchesField) {
      return { matched: true, label: `${p.name} (${op})`, val: valMatched };
    }
  }

  // Check event as fallback for 'nome' or 'qualquer'
  if (f === 'nome' || f === 'qualquer') {
    let evMatch = false;
    if (op === 'igual') evMatch = snippet.normEvent === targetNorm || snippet.normBaseKey === targetNorm;
    else if (op === 'contem') evMatch = snippet.normEvent.includes(targetNorm) || snippet.normBaseKey.includes(targetNorm);
    else if (op === 'comeca_com') evMatch = snippet.normEvent.startsWith(targetNorm) || snippet.normBaseKey.startsWith(targetNorm);

    if (evMatch) {
      return { matched: true, label: `Evento ${snippet.event_normalized}`, val: snippet.event_normalized };
    }
  }

  return { matched: false };
}

function searchParameters(
  criteria: ParameterCriterion[],
  combination: 'AND' | 'OR',
  scope: 'SNIPPET' | 'SCREEN',
  limit = 50
): ParameterSearchResult[] {
  if (!criteria || criteria.length === 0) return [];

  const results: ParameterSearchResult[] = [];

  for (const art of indexedArtifacts) {
    let artifactMatchesCount = 0;
    const artifactResults: ParameterSearchResult[] = [];

    for (const sc of art.screens) {
      if (scope === 'SNIPPET') {
        // Evaluate per snippet
        for (const snip of sc.snippets) {
          const matchedCriteriaList: string[] = [];
          const matchedValuesList: string[] = [];

          let allMatched = true;
          let anyMatched = false;

          for (const crit of criteria) {
            const evalRes = evaluateCriterionOnSnippet(crit, snip);
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
      } else {
        // Evaluate per screen
        const screenCriteriaMatched = new Map<number, { label: string; val: string; snippetIdx: number }>();

        criteria.forEach((crit, critIdx) => {
          for (const snip of sc.snippets) {
            const evalRes = evaluateCriterionOnSnippet(crit, snip);
            if (evalRes.matched) {
              screenCriteriaMatched.set(critIdx, {
                label: evalRes.label || 'Parâmetro',
                val: evalRes.val || '',
                snippetIdx: snip.snippet_index,
              });
              break;
            }
          }
        });

        const isMatch =
          combination === 'AND'
            ? screenCriteriaMatched.size === criteria.length
            : screenCriteriaMatched.size > 0;

        if (isMatch) {
          artifactMatchesCount++;
          const firstSnippetIdx = screenCriteriaMatched.values().next().value?.snippetIdx ?? 0;
          const snip = sc.snippets[firstSnippetIdx] || sc.snippets[0];

          artifactResults.push({
            artifactId: art.id,
            screenId: sc.screen_id,
            screenIndex: sc.screen_index,
            screenTitle: sc.instruction,
            snippetIndex: firstSnippetIdx,
            matchedCriteria: Array.from(screenCriteriaMatched.values()).map((v) => v.label),
            matchedValues: Array.from(screenCriteriaMatched.values()).map((v) => v.val),
            rawCodePreview: snip?.raw_code ? snip.raw_code.slice(0, 160) : undefined,
            event: snip?.event_normalized,
            additionalMatchesCount: 0,
          });
        }
      }
    }

    if (artifactResults.length > 0) {
      // Set additional matches count on the first item
      artifactResults[0].additionalMatchesCount = Math.max(0, artifactMatchesCount - 1);
      results.push(...artifactResults);
    }
  }

  return results.slice(0, limit);
}

function getSuggestions(field: string, input: string, limit = 10): string[] {
  const normInput = normalize(input);
  let mapToSearch = nameFrequency;
  if (field === 'caminho') mapToSearch = pathFrequency;
  else if (field === 'valor') mapToSearch = valueFrequency;

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

  // 1. match (starts with first), 2. frequency, 3. alphabetical
  candidates.sort((a, b) => {
    if (a.starts && !b.starts) return -1;
    if (!a.starts && b.starts) return 1;
    if (b.count !== a.count) return b.count - a.count;
    return a.original.localeCompare(b.original);
  });

  return candidates.slice(0, limit).map((c) => c.original);
}

// =============================================================================
// Message Listener
// =============================================================================
self.addEventListener('message', (event: MessageEvent) => {
  const { type, queryId, payload } = event.data || {};

  try {
    if (type === 'INIT_INDEX') {
      buildIndex(payload?.artifacts || []);
      self.postMessage({ type: 'INDEX_READY', ready: true });
    } else if (type === 'SEARCH_CONTENT') {
      const startTime = Date.now();
      const results = searchContent(payload?.query || '', payload?.limit || 50);
      self.postMessage({
        type: 'SEARCH_CONTENT_RESULT',
        queryId,
        results,
        total: results.length,
        durationMs: Date.now() - startTime,
      });
    } else if (type === 'SEARCH_PARAMETERS') {
      const startTime = Date.now();
      const results = searchParameters(
        payload?.criteria || [],
        payload?.combination || 'AND',
        payload?.scope || 'SNIPPET',
        payload?.limit || 50
      );
      self.postMessage({
        type: 'SEARCH_PARAMETERS_RESULT',
        queryId,
        results,
        total: results.length,
        durationMs: Date.now() - startTime,
      });
    } else if (type === 'GET_PARAMETER_SUGGESTIONS') {
      const suggestions = getSuggestions(payload?.field || 'nome', payload?.input || '', payload?.limit || 10);
      self.postMessage({
        type: 'PARAMETER_SUGGESTIONS_RESULT',
        queryId,
        suggestions,
      });
    }
  } catch (err: any) {
    console.error('[Worker] Erro no processamento:', err);
    self.postMessage({
      type: 'WORKER_ERROR',
      queryId,
      error: err.message || 'Erro interno no worker',
    });
  }
});
