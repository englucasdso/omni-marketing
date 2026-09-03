import crypto from 'crypto';
import { ParameterParser } from './parameterParser.js';

export class MapReader {
  constructor(transport) {
    this.transport = transport;
    this.parameterParser = new ParameterParser();
  }

  /**
   * Limpa tags HTML mantendo texto puro e espaços normais
   */
  limpar(txt) {
    if (!txt) return '';
    return String(txt)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normaliza rótulo para comparação semântica
   */
  normalizarRotulo(txt) {
    return this.limpar(txt)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\s_\-/|()\\.]+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Extrai valor de uma célula HTML (respeitando links, painéis ou texto)
   */
  extrairValorDeCelula(cellHtml) {
    if (!cellHtml) return '';

    // Extrai href se contiver link relevante (ex: Figma)
    const hrefMatch = cellHtml.match(/<a[^>]+href=["']([^"']+)["']/i);
    const linkUrl = hrefMatch ? hrefMatch[1].trim() : '';

    // Painel Confluence macro
    const panelMatch = cellHtml.match(/<div[^>]+class=["'][^"']*panelContent[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const textContent = panelMatch ? this.limpar(panelMatch[1]) : this.limpar(cellHtml);

    // Se for link do figma ou http e o texto for genérico, prefere a url
    if (linkUrl && (linkUrl.includes('figma.com') || linkUrl.includes('xd.adobe') || !textContent)) {
      return linkUrl;
    }

    return textContent;
  }

  /**
   * Leitura Semântica do Header (Section 10)
   * Suporta tabelas tradicionais e macros/painéis com múltiplos aliases.
   * Evita falsos positivos com legendas ou caixas de instruções.
   */
  extrairCabecalho(html) {
    const canonicalAliases = {
      produto_servico: [
        'produto servico', 'produto / servico', 'produto/servico', 'produto e servico',
        'produto', 'servico', 'produto servicos'
      ],
      numero_task: [
        'no da task', 'numero da task', 'task', 'n da task', 'task jira', 'jira task',
        'no task', 'numero task'
      ],
      figma_xd: [
        'figma / xd', 'figma xd', 'figma/xd', 'figma', 'adobe xd', 'link figma',
        'prototipo', 'layout figma'
      ],
      ga4_stream_id: [
        'propriedade ga4/stream id', 'propriedade ga4 stream id', 'ga4 stream id',
        'stream id', 'propriedade ga4', 'id stream ga4', 'id ga4', 'stream id ga4',
        'propriedade ga4 stream'
      ],
      firebase: [
        'firebase', 'projeto firebase', 'app firebase', 'id firebase'
      ],
      gtm_id: [
        'gtm id', 'container gtm', 'gtm', 'id gtm', 'codigo gtm'
      ],
      dominio: [
        'dominio', 'dominio exclusivo web', 'dominio web', 'url dominio',
        'dominio exclusivo'
      ],
      status_homologacao: [
        'status da homologacao', 'status do mapa', 'status homologacao',
        'status de homologacao', 'status geral', 'status'
      ]
    };

    const header = {};
    const flatHeader = {};

    // Extrai todas as tabelas candidatas
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;

    let bestHeaderCandidate = null;
    let maxMatchedLabels = 0;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableContent = tableMatch[1];
      const pairs = [];

      // 1. Linhas TR tradicionais com TD ou TH
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;
      while ((trMatch = trRegex.exec(tableContent)) !== null) {
        const tdRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
        const cells = [];
        let tdMatch;
        while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
          cells.push(tdMatch[1]);
        }
        if (cells.length >= 2) {
          const rawLabel = this.limpar(cells[0]);
          const rawValue = this.extrairValorDeCelula(cells[1]);
          if (rawLabel) {
            pairs.push({ rawLabel, rawValue, source: 'header_table' });
          }
        }
      }

      // 2. Macro inputs / painéis (ex: input_1, input_2, etc.)
      const panelRegex = /<div[^>]+class=["'][^"']*panel[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
      let panelMatch;
      while ((panelMatch = panelRegex.exec(tableContent)) !== null) {
        const pText = panelMatch[1];
        // Procura por "Rótulo: Valor"
        const colonSplit = pText.split(':');
        if (colonSplit.length >= 2) {
          const rawLabel = this.limpar(colonSplit[0]);
          const rawValue = this.limpar(colonSplit.slice(1).join(':'));
          if (rawLabel && rawValue) {
            pairs.push({ rawLabel, rawValue, source: 'header_panel' });
          }
        }
      }

      // Conta quantos rótulos canônicos distintos casam com esta tabela
      let matchedCount = 0;
      const candidateHeader = {};
      const candidateFlat = {};

      for (const { rawLabel, rawValue, source } of pairs) {
        const norm = this.normalizarRotulo(rawLabel);
        // Não confundir com tabelas de legenda de status (ex: "Status: NOVO")
        if (norm === 'status' && (rawValue.toLowerCase().includes('legenda') || rawValue.includes('verde') || rawValue.includes('azul'))) {
          continue;
        }

        for (const [canonicalKey, aliases] of Object.entries(canonicalAliases)) {
          if (!candidateHeader[canonicalKey]) {
            const isMatch = aliases.some(alias => {
              const normAlias = this.normalizarRotulo(alias);
              return norm === normAlias || norm.startsWith(normAlias) || normAlias.startsWith(norm);
            });

            if (isMatch && rawValue) {
              candidateHeader[canonicalKey] = {
                value: rawValue,
                raw_label: rawLabel,
                source
              };
              candidateFlat[canonicalKey] = rawValue;
              matchedCount++;
              break;
            }
          }
        }
      }

      if (matchedCount > maxMatchedLabels) {
        maxMatchedLabels = matchedCount;
        bestHeaderCandidate = { header: candidateHeader, flat: candidateFlat };
      }
    }

    // Se encontrou tabela com pelo menos 2 rótulos característicos do header
    if (bestHeaderCandidate && maxMatchedLabels >= 2) {
      Object.assign(header, bestHeaderCandidate.header);
      Object.assign(flatHeader, bestHeaderCandidate.flat);
    }

    return { header, flatHeader };
  }

  /**
   * Normalização dos 5 status reais:
   * NOVO, VALIDADO, CORRECAO, EXCLUIR, DESCONTINUAR (ou NAO_IDENTIFICADO)
   */
  normalizarStatusTela(rawStatus) {
    if (!rawStatus) return { status: 'NAO_IDENTIFICADO', status_raw: '' };
    const raw = String(rawStatus).trim();
    const clean = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    if (clean.includes('VALIDADO') || clean.includes('HOMOLOGADO') || clean.includes('APROVADO')) {
      return { status: 'VALIDADO', status_raw: raw };
    }
    if (clean.includes('CORRECAO') || clean.includes('CORREÇAO') || clean.includes('AJUSTE') || clean.includes('BUG')) {
      return { status: 'CORRECAO', status_raw: raw };
    }
    if (clean.includes('NOVO') || clean.includes('NOVA')) {
      return { status: 'NOVO', status_raw: raw };
    }
    if (clean.includes('EXCLUIR') || clean.includes('EXCLUSAO') || clean.includes('EXCLUIDO')) {
      return { status: 'EXCLUIR', status_raw: raw };
    }
    if (clean.includes('DESCONTINUAR') || clean.includes('DESCONTINUADO')) {
      return { status: 'DESCONTINUAR', status_raw: raw };
    }

    return { status: 'NAO_IDENTIFICADO', status_raw: raw };
  }

  /**
   * Extração e reconstrução linha a linha de snippets (.syntaxhighlighter, pre, code)
   */
  extrairSnippetsDeHtml(containerHtml) {
    if (!containerHtml) return [];
    const snippets = [];

    // 1. Estrutura Confluence SyntaxHighlighter com .line
    const shRegex = /<div[^>]*class=["'][^"']*syntaxhighlighter[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
    let shMatch;
    while ((shMatch = shRegex.exec(containerHtml)) !== null) {
      const shContent = shMatch[1];
      const lineRegex = /<div[^>]*class=["'][^"']*line[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
      const lines = [];
      let lineMatch;
      while ((lineMatch = lineRegex.exec(shContent)) !== null) {
        const text = this.limpar(lineMatch[1]);
        lines.push(text);
      }
      if (lines.length > 0) {
        const codeText = lines.join('\n').trim();
        if (codeText.length > 10 && (codeText.includes('dataLayer') || codeText.includes('event'))) {
          snippets.push(codeText);
        }
      }
    }

    // 2. Fallbacks: <pre>, <code>, .codeContent
    if (snippets.length === 0) {
      const codeRegex = /<pre[^>]*>([\s\S]*?)<\/pre>|<code[^>]*>([\s\S]*?)<\/code>|<div[^>]*class=["'][^"']*codeContent[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      while ((match = codeRegex.exec(containerHtml)) !== null) {
        const rawBlock = match[1] || match[2] || match[3] || '';
        // Converte quebras de linha HTML <br> ou <p> antes de limpar tags
        const withNewlines = rawBlock
          .replace(/<br\s*[\/]?>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/p>/gi, '\n');
        const codeText = this.parameterParser.decodeHtml(
          withNewlines.replace(/<[^>]+>/g, '')
        ).trim();

        if (codeText.length > 10 && (codeText.includes('dataLayer') || codeText.includes('event'))) {
          snippets.push(codeText);
        }
      }
    }

    return snippets;
  }

  /**
   * Identificação de Telas (Section 11, 12, 14, 15)
   * Encontra blocos funcionais e extrai telas com snippets e parâmetros
   */
  extrairTelas(html, mapId, produto, fluxo) {
    const screens = [];
    const screenLabelPatterns = {
      status: ['status', 'situacao', 'estado'],
      instruction: ['instrucao', 'instrucoes', 'descricao da acao', 'acao'],
      screenName: ['tela', 'nome da tela', 'screen name', 'screen'],
      triggerCode: ['codigo de disparo', 'codigo de disparo dl', 'codigo dl', 'datalayer', 'codigo disparo'],
      additionalInfo: ['informacoes adicionais', 'informacao adicional', 'observacoes', 'obs'],
      evidence: ['evidencia', 'evidencia da homologacao', 'qa', 'print', 'evidencias']
    };

    // Identifica blocos de tabelas candidatos a tela
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;
    let screenIndex = 0;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableContent = tableMatch[1];
      const normTable = this.normalizarRotulo(tableContent);

      // Verifica se a tabela contém rótulos característicos de tela
      const hasStatus = screenLabelPatterns.status.some(p => normTable.includes(p));
      const hasInstruction = screenLabelPatterns.instruction.some(p => normTable.includes(p));
      const hasScreenName = screenLabelPatterns.screenName.some(p => normTable.includes(p));
      const hasTriggerCode = screenLabelPatterns.triggerCode.some(p => normTable.includes(p));
      const hasEvidence = screenLabelPatterns.evidence.some(p => normTable.includes(p));

      const matchScore = [hasStatus, hasInstruction, hasScreenName, hasTriggerCode, hasEvidence].filter(Boolean).length;

      // Se contém ao menos 2 indicadores de tela
      if (matchScore >= 2) {
        let statusRaw = '';
        let instruction = '';
        let screenName = '';
        let additionalInfo = '';
        let evidence = '';
        let imageName = '';

        // Varre as linhas da tabela da tela
        const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let trMatch;
        while ((trMatch = trRegex.exec(tableContent)) !== null) {
          const rowContent = trMatch[1];
          const tdRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
          const cells = [];
          let tdMatch;
          while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
            cells.push(tdMatch[1]);
          }

          if (cells.length >= 2) {
            const labelNorm = this.normalizarRotulo(cells[0]);
            const val = cells[1];

            if (screenLabelPatterns.status.some(p => labelNorm === p || labelNorm.startsWith(p))) {
              if (!statusRaw) statusRaw = this.limpar(val);
            } else if (screenLabelPatterns.instruction.some(p => labelNorm === p || labelNorm.startsWith(p))) {
              if (!instruction) instruction = this.limpar(val);
            } else if (screenLabelPatterns.screenName.some(p => labelNorm === p || labelNorm.startsWith(p))) {
              if (!screenName) screenName = this.limpar(val);
            } else if (screenLabelPatterns.additionalInfo.some(p => labelNorm === p || labelNorm.startsWith(p))) {
              if (!additionalInfo) additionalInfo = this.limpar(val);
            } else if (screenLabelPatterns.evidence.some(p => labelNorm === p || labelNorm.startsWith(p))) {
              if (!evidence) evidence = this.limpar(val);
              const imgMatch = val.match(/<img[^>]+src=["']([^"']+)["']/i);
              if (imgMatch) imageName = imgMatch[1];
            }
          }
        }

        // Extrai snippets dentro desta tabela da tela
        const rawSnippets = this.extrairSnippetsDeHtml(tableContent);
        const { status, status_raw } = this.normalizarStatusTela(statusRaw);

        // ID estável da tela
        const screenId = crypto.createHash('sha256')
          .update(`${mapId}-${produto}-${fluxo}-${screenIndex}`)
          .digest('hex')
          .slice(0, 16);

        const parsedSnippets = rawSnippets.map((rawCode, snipIdx) =>
          this.parameterParser.parseSnippet(rawCode, mapId, screenId, snipIdx)
        );

        screens.push({
          map_id: mapId,
          screen_id: screenId,
          screen_index: screenIndex,
          status_raw: status_raw || 'Não informado',
          status,
          instruction: instruction || screenName || 'Instrução de disparo',
          image_name: imageName || '',
          additional_information: additionalInfo || '',
          evidence: evidence || '',
          snippets: parsedSnippets
        });

        screenIndex++;
      }
    }

    // Fallback: se nenhuma tabela estruturada de tela foi identificada,
    // mas a página possui blocos de código dataLayer soltos
    if (screens.length === 0) {
      const standaloneSnippets = this.extrairSnippetsDeHtml(html);
      standaloneSnippets.forEach((rawCode, idx) => {
        const screenId = crypto.createHash('sha256')
          .update(`${mapId}-${produto}-${fluxo}-fallback-${idx}`)
          .digest('hex')
          .slice(0, 16);

        const parsedSnippet = this.parameterParser.parseSnippet(rawCode, mapId, screenId, 0);

        screens.push({
          map_id: mapId,
          screen_id: screenId,
          screen_index: idx,
          status_raw: 'Não informado',
          status: 'NAO_IDENTIFICADO',
          instruction: `Disparo ${idx + 1}`,
          image_name: '',
          additional_information: '',
          evidence: '',
          snippets: [parsedSnippet]
        });
      });
    }

    return screens;
  }

  /**
   * Gera sumário de parâmetros e padrões do mapa
   */
  gerarSumarios(screens) {
    const parameterSummary = {};
    const patternSummary = {};

    for (const screen of screens) {
      for (const snip of screen.snippets || []) {
        // Padrões
        if (snip.pattern_id) {
          if (!patternSummary[snip.pattern_id]) {
            patternSummary[snip.pattern_id] = {
              pattern_id: snip.pattern_id,
              event: snip.event_raw,
              signature: snip.signature,
              measurement_class: snip.measurement_class,
              count: 0,
              screens: new Set()
            };
          }
          patternSummary[snip.pattern_id].count++;
          patternSummary[snip.pattern_id].screens.add(screen.screen_id);
        }

        // Parâmetros
        for (const p of snip.parameters || []) {
          if (!parameterSummary[p.path]) {
            parameterSummary[p.path] = {
              path: p.path,
              name: p.name,
              occurrences: 0,
              value_types: {},
              distinct_values: new Set(),
              screens: new Set()
            };
          }
          const item = parameterSummary[p.path];
          item.occurrences++;
          item.value_types[p.value_type] = (item.value_types[p.value_type] || 0) + 1;
          if (p.normalized_value) item.distinct_values.add(p.normalized_value);
          item.screens.add(screen.screen_id);
        }
      }
    }

    // Formata sets para arrays
    const formattedParams = Object.values(parameterSummary).map(p => ({
      path: p.path,
      name: p.name,
      occurrences: p.occurrences,
      screens_count: p.screens.size,
      distinct_values_count: p.distinct_values.size,
      distinct_values: Array.from(p.distinct_values).slice(0, 15),
      value_types: p.value_types
    }));

    const formattedPatterns = Object.values(patternSummary).map(pt => ({
      pattern_id: pt.pattern_id,
      event: pt.event,
      signature: pt.signature,
      measurement_class: pt.measurement_class,
      count: pt.count,
      screens_count: pt.screens.size
    }));

    return {
      parameter_summary: formattedParams,
      pattern_summary: formattedPatterns
    };
  }

  /**
   * Lê detalhes completos do mapa a partir do Confluence
   */
  async readMapDetails(pageId, produto, fluxo) {
    const html = await this.transport.fetchApi(`/pages/viewpage.action?pageId=${pageId}`);
    const { header, flatHeader } = this.extrairCabecalho(html);
    const telas = this.extrairTelas(html, String(pageId), produto, fluxo);
    const { parameter_summary, pattern_summary } = this.gerarSumarios(telas);

    return {
      cabecalho: flatHeader,
      header,
      telas,
      parameter_summary,
      pattern_summary
    };
  }
}
