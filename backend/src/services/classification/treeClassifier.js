export function classifyTree(rows, rootPageId) {
  const rootStr = String(rootPageId);
  return rows.map(row => {
    const classified = { ...row };

    // Hierarchy identification
    const depth = classified.depth;
    let produto = '';
    let subproduto = '';
    let categorias = [];
    const titles = classified.ancestor_titles || [];

    if (depth === 1) {
      produto = classified.titulo;
    } else if (depth === 2) {
      produto = titles[1] || '';
      subproduto = classified.titulo;
    } else if (depth > 2) {
      produto = titles[1] || '';
      subproduto = titles[2] || '';
      categorias = titles.slice(3);
    }
    
    classified.produto = produto;
    classified.subproduto = subproduto;
    classified.categorias = categorias;

    // 1. RAIZ
    if (String(classified.id) === rootStr) {
      classified.artifact_type = 'RAIZ';
      classified.homologation_status = null;
      classified.homologation_percentage = null;
      classified.validated_screens = null;
      classified.total_screens = null;
      classified.measurement_class = 'NAO_CLASSIFICADO';
      return classified;
    }

    // Signals
    const hasChildren = classified.has_children === true || classified.children_count > 0 || classified.is_leaf === false;
    let hasTrackingSnippets = false;
    let hasDocumentationSignals = false;
    let isEmptyPage = false;
    
    if (classified.structural_metadata && classified.structural_metadata.signals) {
      const sigs = classified.structural_metadata.signals;
      hasTrackingSnippets = sigs.has_tracking_snippets === true;
      hasDocumentationSignals = sigs.has_documentation_signals === true;
      isEmptyPage = sigs.is_empty_page === true;
    }

    // Check parameter summary or pattern summary if tracking snippets is false (safety net)
    if (!hasTrackingSnippets) {
      const hasParamSum = classified.parameter_summary && classified.parameter_summary.length > 0;
      const hasPatternSum = classified.pattern_summary && classified.pattern_summary.length > 0;
      if (hasParamSum || hasPatternSum) {
        hasTrackingSnippets = true;
      }
    }

    // Classification Logic
    if (hasChildren) {
      // 2. Página com filhos
      classified.artifact_type = 'NO';
    } else if (hasTrackingSnippets) {
      // 3. Página folha com snippet real
      classified.artifact_type = 'MAPA';
    } else if (hasDocumentationSignals) {
      // 4. Página folha com conteúdo útil
      classified.artifact_type = 'DOCUMENTACAO';
    } else {
      // 5. Página folha vazia
      classified.artifact_type = 'NO';
    }

    // Normalization
    if (classified.artifact_type === 'NO') {
      classified.tipo_mapa = 'Nó';
      classified.measurement_class = 'NAO_CLASSIFICADO';
      classified.homologation_status = null;
      classified.homologation_percentage = null;
      classified.validated_screens = null;
      classified.total_screens = null;
    } else if (classified.artifact_type === 'DOCUMENTACAO') {
      classified.tipo_mapa = 'Doc';
      classified.measurement_class = 'NAO_CLASSIFICADO';
      classified.homologation_status = null;
      classified.homologation_percentage = null;
      classified.validated_screens = null;
      classified.total_screens = null;
    } else if (classified.artifact_type === 'MAPA') {
      const screens = classified.screens || [];
      const total = screens.length;
      const validated = screens.filter((s) => {
         const st = String(s.status || '').toUpperCase().trim();
         return st === 'VALIDADO' || st.includes('VALIDADO');
      }).length;
      
      classified.total_screens = total;
      classified.validated_screens = validated;
      
      if (total === 0) {
        classified.homologation_status = 'NAO_HOMOLOGADO';
        classified.homologation_percentage = 0;
      } else {
        classified.homologation_percentage = Math.round((validated / total) * 100);
        if (validated === total) {
          classified.homologation_status = 'HOMOLOGADO';
        } else if (validated > 0) {
          classified.homologation_status = 'PARCIAL';
        } else {
          classified.homologation_status = 'NAO_HOMOLOGADO';
        }
      }
    }

    return classified;
  });
}
