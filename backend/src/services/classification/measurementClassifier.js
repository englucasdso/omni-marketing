/**
 * MeasurementClassifier
 * Classifica artefatos em:
 * - artifact_type: MAPA | DOCUMENTACAO
 * - measurement_class: GA4 | GA3 | MISTO | NAO_CLASSIFICADO
 * Calcula distribuição dos 5 status reais:
 * NOVO, VALIDADO, CORRECAO, EXCLUIR, DESCONTINUAR (e NAO_IDENTIFICADO)
 */

export class MeasurementClassifier {
  /**
   * Determina a classificação de mensuração e sumários a partir das telas do mapa
   */
  classifyMap(screens = [], declaredStatus = '') {
    const statusSummary = {
      NOVO: 0,
      VALIDADO: 0,
      CORRECAO: 0,
      EXCLUIR: 0,
      DESCONTINUAR: 0,
      NAO_IDENTIFICADO: 0
    };

    let hasGa3 = false;
    let hasGa4 = false;
    let totalSnippets = 0;

    for (const screen of screens) {
      // Contagem de status da tela
      const normStatus = (screen.status || 'NAO_IDENTIFICADO').toUpperCase();
      if (statusSummary.hasOwnProperty(normStatus)) {
        statusSummary[normStatus]++;
      } else {
        statusSummary.NAO_IDENTIFICADO++;
      }

      // Avaliação de snippets
      const snippets = screen.snippets || [];
      totalSnippets += snippets.length;

      for (const snippet of snippets) {
        if (snippet.measurement_class === 'GA4') hasGa4 = true;
        else if (snippet.measurement_class === 'GA3') hasGa3 = true;
        else if (snippet.measurement_class === 'MISTO') {
          hasGa4 = true;
          hasGa3 = true;
        }
      }
    }

    // Tipo de artefato: MAPA se possui telas ou snippets de tagueamento; DOCUMENTACAO se solto
    const artifact_type = (screens.length > 0 || totalSnippets > 0) ? 'MAPA' : 'DOCUMENTACAO';

    // Classificação de mensuração
    let measurement_class = 'NAO_CLASSIFICADO';
    if (hasGa4 && hasGa3) {
      measurement_class = 'MISTO';
    } else if (hasGa4) {
      measurement_class = 'GA4';
    } else if (hasGa3) {
      measurement_class = 'GA3';
    }

    // Status calculado e homologação do mapa:
    // Um mapa será considerado homologado somente quando:
    // - possuir pelo menos uma tela detectada;
    // - todas as telas detectadas estiverem com status VALIDADO.
    // Nos demais casos, homologado deve ser false. Não utilizar saudável ou crítico.
    const totalScreens = screens.length;
    let calculated_status = 'NAO_IDENTIFICADO';
    let homologado = false;
    if (totalScreens > 0) {
      if (statusSummary.VALIDADO === totalScreens) {
        calculated_status = 'VALIDADO';
        homologado = true;
      } else {
        calculated_status = 'PARCIAL';
        homologado = false;
      }
    }

    const normDeclared = this.normalizeDeclaredStatus(declaredStatus);
    const status_divergent = Boolean(
      normDeclared && 
      calculated_status !== 'NAO_IDENTIFICADO' && 
      normDeclared !== calculated_status
    );

    return {
      artifact_type,
      measurement_class,
      status_summary: statusSummary,
      declared_status: normDeclared || null,
      calculated_status,
      homologado,
      status_divergent
    };
  }

  /**
   * Normaliza status declarado no header
   */
  normalizeDeclaredStatus(rawStatus) {
    if (!rawStatus) return null;
    const str = String(rawStatus).trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (str.includes('VALIDADO') || str.includes('HOMOLOGADO') || str.includes('APROVADO')) {
      return 'VALIDADO';
    }
    if (str.includes('CORRECAO') || str.includes('AJUSTE') || str.includes('BUG')) {
      return 'CORRECAO';
    }
    if (str.includes('NOVO')) {
      return 'NOVO';
    }
    if (str.includes('EXCLUIR') || str.includes('EXCLUSAO')) {
      return 'EXCLUIR';
    }
    if (str.includes('DESCONTINUAR') || str.includes('DESCONTINUADO')) {
      return 'DESCONTINUAR';
    }
    if (str.includes('PARCIAL')) {
      return 'PARCIAL';
    }
    return str || null;
  }

  // Compatibilidade com chamadas legadas
  classify(screens) {
    const result = this.classifyMap(screens);
    if (result.artifact_type === 'DOCUMENTACAO') return 'Doc';
    return result.measurement_class === 'NAO_CLASSIFICADO' ? 'Não classificado' : result.measurement_class;
  }
}
