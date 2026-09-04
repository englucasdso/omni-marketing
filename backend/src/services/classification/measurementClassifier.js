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
  classifyMap(screens = [], declaredStatus = '', context = {}) {
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

    // Tipo de artefato:
    // - MAPA: possui telas estruturadas ou snippets de tagueamento analítico
    // - DOCUMENTACAO: possui conteúdo textual ou painéis de documentação sem snippets analíticos
    // - NAO_CLASSIFICADO: quando não há evidência suficiente nem de mapa nem de documentação
    let artifact_type = 'NAO_CLASSIFICADO';
    if (screens.length > 0 || totalSnippets > 0 || context.hasTrackingScreens) {
      artifact_type = 'MAPA';
    } else if (context.isAmbiguous) {
      artifact_type = 'NAO_CLASSIFICADO';
    } else if (context.hasDocContent || context.isDoc || (context.htmlLength && context.htmlLength > 200)) {
      artifact_type = 'DOCUMENTACAO';
    } else if (context.hasContent === false && !declaredStatus) {
      artifact_type = 'NAO_CLASSIFICADO';
    } else {
      artifact_type = declaredStatus ? 'DOCUMENTACAO' : 'NAO_CLASSIFICADO';
    }

    // Classificação de mensuração:
    // Quando não houver evidência suficiente de GA4 ou GA3, manter NAO_CLASSIFICADO
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
  classify(screens, declaredStatus, context) {
    const result = this.classifyMap(screens, declaredStatus, context);
    if (result.artifact_type === 'DOCUMENTACAO') return 'Doc';
    if (result.artifact_type === 'NAO_CLASSIFICADO') return 'Não classificado';
    return result.measurement_class === 'NAO_CLASSIFICADO' ? 'Não classificado' : result.measurement_class;
  }
}
