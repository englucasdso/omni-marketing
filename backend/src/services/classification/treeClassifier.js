/**
 * treeClassifier.js
 * Classificação canônica estrutural e taxonômica do Hub de Artefatos.
 * 
 * Regra canônica: A taxonomia segue exclusivamente a posição real da página
 * na árvore iniciada pela página raiz:
 * - Nível humano 1 = depth 0 (Raiz)
 * - Nível humano 2 = depth 1 (Produto)
 * - Nível humano 3 = depth 2 (Subproduto)
 * - Nível humano 4+ = descendant_path
 * 
 * Separação de conceitos: Nível taxonômico é estritamente desacoplado do tipo de artefato (MAPA/DOC/NO).
 */

export function resolveCanonicalTaxonomy(row, rowMap = new Map(), rootPageId = '') {
  const rootStr = String(rootPageId || '');
  const rowIdStr = String(row.id);
  const depth = row.depth !== undefined ? Number(row.depth) : (row.taxonomy_depth || row.nivel || 0);

  const ancestorIds = Array.isArray(row.ancestor_ids) ? row.ancestor_ids.map(String) : [];
  const ancestorTitles = Array.isArray(row.ancestor_titles) ? row.ancestor_titles.map(t => String(t || '').trim()) : [];

  let produto = '';
  let produto_id = null;
  let subproduto = '';
  let subproduto_id = null;
  let descendant_path_ids = [];
  let descendant_path_titles = [];

  const getTitle = (id, fallbackTitle) => {
    if (id && rowMap.has(String(id))) {
      const found = rowMap.get(String(id));
      const t = found?.titulo || found?.title;
      if (t) return String(t).trim();
    }
    return String(fallbackTitle || '').trim();
  };

  // 1. Raiz (depth 0)
  if (depth === 0 || (rootStr && rowIdStr === rootStr) || row.artifact_type === 'RAIZ') {
    return {
      produto: '',
      produto_id: null,
      subproduto: '',
      subproduto_id: null,
      descendant_path_ids: [],
      descendant_path_titles: []
    };
  }

  // 2. Com ancestrais da árvore (novo crawl ou dados com hierarquia preservada)
  if (ancestorIds.length > 0) {
    if (depth === 1) {
      // Nível humano 2 (depth 1) = Produto
      produto_id = rowIdStr;
      produto = String(row.titulo || row.title || '').trim();
    } else if (depth === 2) {
      // Nível humano 3 (depth 2) = Subproduto
      produto_id = ancestorIds[1] || (row.parent_id ? String(row.parent_id) : null);
      produto = getTitle(produto_id, ancestorTitles[1] || row.produto);

      if (row.artifact_type === 'NO') {
        subproduto_id = rowIdStr;
        subproduto = String(row.titulo || row.title || '').trim();
      } else {
        // Artefato folha colocado diretamente no produto não tem subproduto
        subproduto_id = null;
        subproduto = '';
      }
    } else if (depth === 3) {
      // Nível humano 4 (depth 3) = Filho direto de Subproduto
      produto_id = ancestorIds[1] || null;
      produto = getTitle(produto_id, ancestorTitles[1] || row.produto);
      subproduto_id = ancestorIds[2] || (row.parent_id ? String(row.parent_id) : null);
      subproduto = getTitle(subproduto_id, ancestorTitles[2] || row.subproduto);

      if (row.artifact_type === 'NO') {
        descendant_path_ids = [rowIdStr];
        descendant_path_titles = [String(row.titulo || row.title || '').trim()];
      }
    } else {
      // Nível humano 5+ (depth >= 4) = Descendentes profundos
      produto_id = ancestorIds[1] || null;
      produto = getTitle(produto_id, ancestorTitles[1] || row.produto);
      subproduto_id = ancestorIds[2] || null;
      subproduto = getTitle(subproduto_id, ancestorTitles[2] || row.subproduto);

      const dIds = [];
      const dTitles = [];
      for (let i = 3; i < ancestorIds.length; i++) {
        const aId = String(ancestorIds[i]);
        dIds.push(aId);
        dTitles.push(getTitle(aId, ancestorTitles[i]));
      }
      if (row.artifact_type === 'NO') {
        dIds.push(rowIdStr);
        dTitles.push(String(row.titulo || row.title || '').trim());
      }
      descendant_path_ids = dIds;
      descendant_path_titles = dTitles;
    }
  } else {
    // 3. Fallback determinístico para registros legados sem ancestor_ids
    produto = String(row.produto || '').trim();
    produto_id = row.produto_id ? String(row.produto_id) : (produto ? produto : null);
    subproduto = String(row.subproduto || '').trim();
    subproduto_id = row.subproduto_id ? String(row.subproduto_id) : (subproduto ? subproduto : null);
    descendant_path_ids = Array.isArray(row.descendant_path_ids) ? row.descendant_path_ids.map(String) : [];
    descendant_path_titles = Array.isArray(row.descendant_path_titles) ? row.descendant_path_titles.map(String) : [];
  }

  return {
    produto,
    produto_id,
    subproduto,
    subproduto_id,
    descendant_path_ids,
    descendant_path_titles
  };
}

export function classifyTree(rows, rootPageId) {
  const rootStr = String(rootPageId || '');

  // 1. Determinar o tipo de artefato para todas as linhas primeiro
  const classifiedRows = rows.map(row => {
    const classified = { ...row };

    // 1. RAIZ
    if (String(classified.id) === rootStr || classified.depth === 0) {
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
      classified.artifact_type = 'NO';
    } else if (hasTrackingSnippets) {
      classified.artifact_type = 'MAPA';
    } else if (hasDocumentationSignals) {
      classified.artifact_type = 'DOCUMENTACAO';
    } else {
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

  // 2. Mapeamento por ID para resolução taxonômica estrutural canônica
  const rowMap = new Map(classifiedRows.map(r => [String(r.id), r]));

  // 3. Resolução taxonômica canônica por profundidade real na árvore
  return classifiedRows.map(classified => {
    const tax = resolveCanonicalTaxonomy(classified, rowMap, rootPageId);

    classified.produto = tax.produto;
    classified.produto_id = tax.produto_id;
    classified.subproduto = tax.subproduto;
    classified.subproduto_id = tax.subproduto_id;
    classified.descendant_path_ids = tax.descendant_path_ids;
    classified.descendant_path_titles = tax.descendant_path_titles;

    // Campos de compatibilidade para legados
    classified.categorias = tax.descendant_path_titles;
    classified.categoria_ids = tax.descendant_path_ids;
    classified.subproduto_path = tax.subproduto ? [tax.subproduto, ...tax.descendant_path_titles] : [...tax.descendant_path_titles];
    classified.subproduto_path_ids = tax.subproduto_id ? [tax.subproduto_id, ...tax.descendant_path_ids] : [...tax.descendant_path_ids];

    return classified;
  });
}

