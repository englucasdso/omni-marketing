// frontend/src/utils/parameterSearchParser.ts
// Pure parsing and normalization utilities for code and parameter search

export type ParameterQueryKind =
  | 'parameter'
  | 'key_value'
  | 'code_fragment'
  | 'full_snippet';

export interface ParsedQueryParam {
  name: string;
  path?: string;
  value?: string;
  rawPair?: string;
}

export interface ParamSearchTerm {
  raw: string;
  name: string;
  value?: string;
  isKeyValue: boolean;
}

/**
 * Decodes common HTML entities often present in raw codes or snippets.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Normalizes basic text: lowercase, remove diacritics, trim.
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Normalizes code strictly for literal comparisons:
 * - Decodes HTML entities
 * - Line endings (\r\n -> \n)
 * - Tabs (\t -> ' ')
 * - Runs of spaces ([ \t]+ -> ' ')
 * - Trim
 */
export function cleanCodeLiteral(code: string): string {
  if (!code) return '';
  return decodeHtmlEntities(code)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Normalizes code whitespace:
 * - Decodes HTML entities
 * - Standardizes line breaks
 * - Removes tabs and collapses spaces
 * - Trims each line
 */
export function normalizeCodeWhitespace(code: string): string {
  if (!code) return '';
  return decodeHtmlEntities(code)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Normalizes code deeply for equivalent comparison:
 * - Strips comment lines
 * - Unifies single/double quotes and backticks
 * - Removes trailing commas and semicolons
 * - Removes spaces around punctuation: : = , { } ( ) [ ] ;
 * - Collapses remaining whitespace
 * - Preserves underscores and alphanumeric identifiers
 */
export function normalizeCodeForComparison(code: string): string {
  if (!code) return '';

  return decodeHtmlEntities(code)
    // Remove single-line comments // ...
    .replace(/\/\/[^\n]*/g, '')
    // Remove multi-line comments /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Normalize string quotes to double quotes
    .replace(/['"`]/g, '"')
    // Remove spaces around syntax operators and structural delimiters
    .replace(/\s*([:=,{}\(\)\[\];])\s*/g, '$1')
    // Remove trailing commas before closing braces/brackets/parens
    .replace(/,([}\]\)])/g, '$1')
    // Remove trailing semicolons before closing braces or end of line
    .replace(/;+/g, ';')
    .replace(/;([}\]\)])/g, '$1')
    .replace(/;$/g, '')
    // Collapse any remaining whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if the input has code structure (dataLayer.push, braces, multiple lines with code delimiters)
 */
export function hasCodeStructure(rawQuery: string): boolean {
  const trimmed = (rawQuery || '').trim();
  if (!trimmed) return false;

  // dataLayer.push, gtag(, window.
  if (/datalayer\.push|gtag\(|window\.|function\s*\(/i.test(trimmed)) {
    return true;
  }
  // Explicit braces { ... }
  if (trimmed.includes('{') && trimmed.includes('}')) {
    return true;
  }
  // Multiple lines with typical code syntax
  if (trimmed.includes('\n')) {
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && (trimmed.includes(':') || trimmed.includes('{') || trimmed.includes(','))) {
      return true;
    }
  }
  return false;
}

/**
 * Deterministically detects the format/kind of the query without AI
 */
export function detectQueryKind(rawQuery: string): ParameterQueryKind {
  const trimmed = rawQuery.trim();
  if (!trimmed) return 'parameter';

  if (hasCodeStructure(trimmed)) {
    const hasCall = /datalayer\.push|gtag\(|window\.|function\s*\(/i.test(trimmed);
    const startsWithBrace = trimmed.startsWith('{') && (trimmed.endsWith('}') || trimmed.endsWith('};'));
    if (hasCall || startsWithBrace) {
      return 'full_snippet';
    }
    return 'code_fragment';
  }

  // Count key-value occurrences: key: val or key = val
  const pairMatches = trimmed.match(/[a-zA-Z0-9_$.-]+\s*[:=]\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[a-zA-Z0-9_$.-]+)/g) || [];
  if (pairMatches.length > 1) {
    return 'code_fragment';
  }
  if (pairMatches.length === 1) {
    return 'key_value';
  }

  return 'parameter';
}

function parseSingleParamTerm(str: string): ParamSearchTerm | null {
  const t = str.trim();
  if (!t) return null;

  // Match key: value or key = value
  const kvMatch = t.match(/^["']?([a-zA-Z0-9_$.-]+)["']?\s*[:=]\s*(.*)$/);
  if (kvMatch) {
    const key = kvMatch[1].trim();
    let val = kvMatch[2].trim();
    // Remove trailing comma/semicolon
    val = val.replace(/[,;]+$/, '').trim();
    // Remove enclosing quotes
    val = val.replace(/^["'`]|["'`]$/g, '').trim();

    if (key) {
      return {
        raw: t,
        name: key,
        value: val,
        isKeyValue: true,
      };
    }
  }

  // Standalone identifier (e.g. "produto", "event", "tipo_pessoa")
  // Strictly preserve underscores, do not remove _
  const cleanName = t.replace(/^["'`]|["'`]$/g, '').replace(/[{}\(\)]/g, '').trim();
  if (!cleanName) return null;

  return {
    raw: t,
    name: cleanName,
    isKeyValue: false,
  };
}

function extractPairsFromCode(code: string): ParamSearchTerm[] {
  const results: ParamSearchTerm[] = [];
  const seenKeys = new Set<string>();

  const pairRegex = /(?:^|[^a-zA-Z0-9_$])["']?([a-zA-Z0-9_$.-]+)["']?\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([a-zA-Z0-9_$.-]+))/g;
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(code)) !== null) {
    const rawKey = match[1]?.trim();
    const rawVal = (match[2] ?? match[3] ?? match[4] ?? match[5] ?? '').trim();
    if (rawKey && !seenKeys.has(rawKey.toLowerCase())) {
      seenKeys.add(rawKey.toLowerCase());
      results.push({
        raw: match[0].trim(),
        name: rawKey,
        value: rawVal,
        isKeyValue: true,
      });
    }
  }

  return results;
}

/**
 * Parses query terms strictly:
 * - If query contains '+', strictly splits by '+' and trims external spaces
 * - Preserves underscores and casing/exact names
 * - Parses "name: value" pairs
 * - Ignores empty terms (e.g. "+ +")
 * - If query is empty or only '+', returns []
 */
export function parseParameterSearchTerms(rawQuery: string): ParamSearchTerm[] {
  const trimmed = (rawQuery || '').trim();
  if (!trimmed) return [];

  // If query contains the '+' operator, strictly split by '+'
  if (trimmed.includes('+')) {
    const segments = trimmed.split('+');
    const terms: ParamSearchTerm[] = [];

    for (const seg of segments) {
      const segTrimmed = seg.trim();
      if (!segTrimmed) continue; // Ignore empty terms

      const parsed = parseSingleParamTerm(segTrimmed);
      if (parsed) {
        terms.push(parsed);
      }
    }
    return terms;
  }

  // If query has full code structure (dataLayer.push, { ... }, multiple lines)
  if (hasCodeStructure(trimmed)) {
    const codePairs = extractPairsFromCode(trimmed);
    return codePairs;
  }

  // If comma separated and no code structure
  if (trimmed.includes(',')) {
    const segments = trimmed.split(',');
    const terms: ParamSearchTerm[] = [];
    for (const seg of segments) {
      const segTrimmed = seg.trim();
      if (!segTrimmed) continue;
      const parsed = parseSingleParamTerm(segTrimmed);
      if (parsed) terms.push(parsed);
    }
    return terms;
  }

  // Single term (e.g. "tipo_pessoa: PF" or "produto")
  const single = parseSingleParamTerm(trimmed);
  return single ? [single] : [];
}

/**
 * Extracts structured pairs { name, path, value } from the query string.
 */
export function extractQueryParams(rawQuery: string): ParsedQueryParam[] {
  const terms = parseParameterSearchTerms(rawQuery);
  return terms.map((t) => {
    const isPath = t.name.includes('.');
    return {
      name: isPath ? t.name.split('.').pop()! : t.name,
      path: isPath ? t.name : undefined,
      value: t.value,
      rawPair: t.isKeyValue ? `${t.name}: ${t.value}` : t.name,
    };
  });
}

/**
 * Splits code into highlighted and non-highlighted segments given search terms.
 */
export function highlightCodeSegments(
  code: string,
  terms: string[]
): Array<{ text: string; highlight: boolean }> {
  if (!code) return [];
  const validTerms = terms
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (validTerms.length === 0) {
    return [{ text: code, highlight: false }];
  }

  try {
    const regex = new RegExp(`(${validTerms.join('|')})`, 'gi');
    const parts = code.split(regex);
    return parts.map((part) => ({
      text: part,
      highlight: regex.test(part),
    }));
  } catch {
    return [{ text: code, highlight: false }];
  }
}
