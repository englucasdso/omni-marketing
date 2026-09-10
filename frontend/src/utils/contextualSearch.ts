/**
 * contextualSearch.ts
 * Utilitário centralizado de busca inteligente e ranqueamento por relevância
 * Sem bibliotecas externas, sem IA, com tolerância conservadora a erros de digitação,
 * suporte a sinônimos / equivalências contextuais, remoção de acentos e separadores.
 */

// Mapa centralizado de equivalências e sinônimos contextuais
const SYNONYM_GROUPS: string[][] = [
  ['doc', 'docs', 'documento', 'documentos', 'documentacao'],
  ['mapa', 'mapas', 'metrica', 'metricas', 'mensuracao'],
  ['tela', 'telas', 'screen', 'screens'],
  ['parametro', 'parametros', 'parameter', 'parameters'],
  ['responsavel', 'responsaveis', 'owner', 'owners'],
  ['produto', 'produtos', 'product', 'products'],
  ['subproduto', 'subprodutos', 'subproduct', 'subproducts', 'sub product', 'sub-product'],
  ['no', 'nos', 'node', 'nodes'],
];

// Stopwords comuns em português quando a busca tem mais de uma palavra
const STOPWORDS = new Set([
  'de', 'da', 'do', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas',
  'para', 'com', 'por',
  'e', 'ou',
  'o', 'a', 'os', 'as',
  'um', 'uma', 'uns', 'umas'
]);

/**
 * Normaliza um texto para busca:
 * 1. Converte para minúsculas
 * 2. Remove acentuação (NFD)
 * 3. Substitui pontuações, _, -, / e outros separadores por espaços
 * 4. Remove espaços duplicados
 */
export function normalizeSearchText(text: unknown): string {
  if (text == null) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_\-–—/\\.,;:?!()[\]{}'"`~@#$%^&*+=|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stemming conservador: reduz plurais comuns para comparar singular/plural
 */
function stemWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('oes')) return word.slice(0, -3) + 'ao';
  if (word.endsWith('ais') || word.endsWith('eis') || word.endsWith('ois')) return word.slice(0, -3) + 'al';
  if (word.endsWith('res') || word.endsWith('zes') || word.endsWith('nes')) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/**
 * Distância de Levenshtein simples e otimizada
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Se a diferença de tamanho for maior que 2, já excede o limite máximo permitido
  if (Math.abs(a.length - b.length) > 2) return 999;

  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);

  for (let i = 0; i <= b.length; i++) {
    v0[i] = i;
  }

  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;

    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }

    for (let j = 0; j <= b.length; j++) {
      v0[j] = v1[j];
    }
  }

  return v0[b.length];
}

/**
 * Verifica se duas palavras coincidem por exatidão, prefixo, stem, sinônimo ou tolerância de digitação
 * Regra de tolerância:
 * - <= 3 caracteres: somente correspondência exata
 * - 4-7 caracteres: tolerância máxima de 1 alteração
 * - >= 8 caracteres: tolerância máxima de 2 alterações
 */
function matchToken(queryToken: string, targetToken: string): { matches: boolean; isExact: boolean; isTypo: boolean } {
  if (!queryToken || !targetToken) return { matches: false, isExact: false, isTypo: false };

  // 1. Exata
  if (queryToken === targetToken) {
    return { matches: true, isExact: true, isTypo: false };
  }

  // 2. Prefixo (se queryToken tem >= 3 caracteres)
  if (queryToken.length >= 3 && targetToken.startsWith(queryToken)) {
    return { matches: true, isExact: true, isTypo: false };
  }

  // 3. Stemming (singular/plural)
  const qStem = stemWord(queryToken);
  const tStem = stemWord(targetToken);
  if (qStem === tStem || (qStem.length >= 3 && tStem.startsWith(qStem))) {
    return { matches: true, isExact: true, isTypo: false };
  }

  // 4. Sinônimos / Equivalências
  for (const group of SYNONYM_GROUPS) {
    const hasQuery = group.some(item => normalizeSearchText(item) === queryToken || stemWord(normalizeSearchText(item)) === qStem);
    const hasTarget = group.some(item => normalizeSearchText(item) === targetToken || stemWord(normalizeSearchText(item)) === tStem);
    if (hasQuery && hasTarget) {
      return { matches: true, isExact: true, isTypo: false };
    }
  }

  // 5. Tolerância conservadora a erros de digitação (Levenshtein)
  const len = queryToken.length;
  if (len >= 4) {
    const maxDistance = len <= 7 ? 1 : 2;
    const dist = levenshteinDistance(queryToken, targetToken);
    if (dist <= maxDistance) {
      return { matches: true, isExact: false, isTypo: true };
    }
  }

  return { matches: false, isExact: false, isTypo: false };
}

/**
 * Tokeniza uma consulta de busca removendo stopwords se houver mais de uma palavra
 */
export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  if (rawTokens.length <= 1) {
    return rawTokens;
  }

  // Ignorar stopwords se a consulta tiver outras palavras
  const filtered = rawTokens.filter(t => !STOPWORDS.has(t));
  return filtered.length > 0 ? filtered : rawTokens;
}

export interface RecordSearchFields {
  id?: string;
  title?: string;
  product?: string;
  subproduct?: string;
  responsible?: string;
  artifactType?: string;
  classification?: string;
  parameters?: string[];
  values?: string[];
  extraText?: string;
}

export interface SearchMatchResult {
  matches: boolean;
  score: number;
}

/**
 * Avalia a correspondência de um registro com a consulta de busca e calcula o score de relevância
 */
export function evaluateRecordMatch(
  query: string,
  fields: RecordSearchFields
): SearchMatchResult {
  const normQuery = normalizeSearchText(query);
  if (!normQuery) {
    return { matches: true, score: 0 };
  }

  const queryTokens = tokenizeQuery(query);
  if (queryTokens.length === 0) {
    return { matches: true, score: 0 };
  }

  // Normalização prévia dos campos
  const normId = normalizeSearchText(fields.id);
  const normTitle = normalizeSearchText(fields.title);
  const normProduct = normalizeSearchText(fields.product);
  const normSubproduct = normalizeSearchText(fields.subproduct);
  const normResponsible = normalizeSearchText(fields.responsible);
  const normArtifactType = normalizeSearchText(fields.artifactType);
  const normClassification = normalizeSearchText(fields.classification);
  const normParameters = (fields.parameters || []).map(p => normalizeSearchText(p)).filter(Boolean);
  const normValues = (fields.values || []).map(v => normalizeSearchText(v)).filter(Boolean);
  const normExtra = normalizeSearchText(fields.extraText);

  // Score inicial
  let score = 0;

  // 1. ID exato: Prioridade máxima (+1000)
  if (normId && normId === normQuery) {
    return { matches: true, score: 1000 };
  }
  if (normId && normId.includes(normQuery)) {
    score += 400;
  }

  // 2. Título exato: Prioridade muito alta (+500)
  if (normTitle && normTitle === normQuery) {
    score += 500;
  } else if (normTitle && normTitle.startsWith(normQuery)) {
    // Título começando pela consulta (+300)
    score += 300;
  } else if (normTitle && normTitle.includes(normQuery)) {
    score += 250;
  }

  // Coleta todas as palavras do registro separadas por categoria para match dos tokens
  const titleTokens = normTitle.split(/\s+/).filter(Boolean);
  const prodTokens = normProduct.split(/\s+/).filter(Boolean);
  const subprodTokens = normSubproduct.split(/\s+/).filter(Boolean);
  const respTokens = normResponsible.split(/\s+/).filter(Boolean);
  const artifactTokens = normArtifactType.split(/\s+/).filter(Boolean);
  const classTokens = normClassification.split(/\s+/).filter(Boolean);
  const paramTokens = normParameters.flatMap(p => p.split(/\s+/).filter(Boolean));
  const valTokens = normValues.flatMap(v => v.split(/\s+/).filter(Boolean));
  const extraTokens = normExtra.split(/\s+/).filter(Boolean);

  // Cada palavra da busca DEVE ser encontrada em algum campo do registro
  let allTokensFound = true;
  let titleMatchesCount = 0;
  let hasTypoMatch = false;

  for (const qToken of queryTokens) {
    let tokenFound = false;

    // Checa ID
    if (normId.includes(qToken)) {
      tokenFound = true;
      score += 150;
    }

    // Checa Título
    if (!tokenFound) {
      for (const tToken of titleTokens) {
        const res = matchToken(qToken, tToken);
        if (res.matches) {
          tokenFound = true;
          titleMatchesCount++;
          if (res.isExact) {
            score += 120;
          } else {
            score += 40;
            hasTypoMatch = true;
          }
          break;
        }
      }
    }

    // Checa Produto / Subproduto
    if (!tokenFound) {
      for (const pToken of prodTokens) {
        const res = matchToken(qToken, pToken);
        if (res.matches) {
          tokenFound = true;
          score += res.isExact ? 80 : 30;
          if (res.isTypo) hasTypoMatch = true;
          break;
        }
      }
    }

    if (!tokenFound) {
      for (const spToken of subprodTokens) {
        const res = matchToken(qToken, spToken);
        if (res.matches) {
          tokenFound = true;
          score += res.isExact ? 80 : 30;
          if (res.isTypo) hasTypoMatch = true;
          break;
        }
      }
    }

    // Checa Tipo de Artefato / Classificação
    if (!tokenFound) {
      for (const aToken of [...artifactTokens, ...classTokens]) {
        const res = matchToken(qToken, aToken);
        if (res.matches) {
          tokenFound = true;
          score += res.isExact ? 60 : 25;
          if (res.isTypo) hasTypoMatch = true;
          break;
        }
      }
    }

    // Checa Responsável
    if (!tokenFound) {
      for (const rToken of respTokens) {
        const res = matchToken(qToken, rToken);
        if (res.matches) {
          tokenFound = true;
          score += res.isExact ? 50 : 20;
          if (res.isTypo) hasTypoMatch = true;
          break;
        }
      }
    }

    // Checa Parâmetros e Valores
    if (!tokenFound) {
      for (const pmToken of paramTokens) {
        const res = matchToken(qToken, pmToken);
        if (res.matches) {
          tokenFound = true;
          score += res.isExact ? 45 : 15;
          if (res.isTypo) hasTypoMatch = true;
          break;
        }
      }
    }

    if (!tokenFound) {
      for (const vToken of valTokens) {
        const res = matchToken(qToken, vToken);
        if (res.matches) {
          tokenFound = true;
          score += res.isExact ? 40 : 15;
          if (res.isTypo) hasTypoMatch = true;
          break;
        }
      }
    }

    // Checa Texto Extra (telas, descrições, termos)
    if (!tokenFound) {
      for (const eToken of extraTokens) {
        const res = matchToken(qToken, eToken);
        if (res.matches) {
          tokenFound = true;
          score += res.isExact ? 30 : 10;
          if (res.isTypo) hasTypoMatch = true;
          break;
        }
      }
    }

    if (!tokenFound) {
      allTokensFound = false;
      break;
    }
  }

  if (!allTokensFound) {
    return { matches: false, score: 0 };
  }

  // Bônus se todas as palavras foram encontradas no título (+200)
  if (queryTokens.length > 0 && titleMatchesCount === queryTokens.length) {
    score += 200;
  }

  // Penalidade leve se houve erro de digitação
  if (hasTypoMatch) {
    score = Math.max(10, score - 30);
  }

  return { matches: true, score };
}
