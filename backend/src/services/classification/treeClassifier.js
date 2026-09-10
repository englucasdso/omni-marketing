export function classifyTree(rows, rootPageId) {
  const rootStr = String(rootPageId);

  // 1. Determinar o tipo de artefato para todas as linhas primeiro
  const classifiedRows = rows.map(row => {
    const classified = { ...row };

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

  // 2. Mapeamento por ID para resolução taxonômica estrutural
  const rowMap = new Map(classifiedRows.map(r => [String(r.id), r]));

  // 3. Resolução taxonômica por ancestrais
  return classifiedRows.map(classified => {
    const ancestorIds = Array.isArray(classified.ancestor_ids) ? classified.ancestor_ids : [];
    const ancestorTitles = Array.isArray(classified.ancestor_titles) ? classified.ancestor_titles : [];
    const mapIdStr = String(classified.id);
    const mapTitle = String(classified.titulo || '').trim().toLowerCase();

    // Coletar ancestrais estruturais
    const structuralAncestors = [];
    for (let i = 0; i < ancestorIds.length; i++) {
      const aId = String(ancestorIds[i]);
      if (aId === mapIdStr) continue; // Não incluir o próprio nó
      
      const anc = rowMap.get(aId);
      const depth = anc?.depth !== undefined ? Number(anc.depth) : i;
      const type = anc?.artifact_type;

      // Raiz nunca é produto
      if (i === 0 || depth === 0 || type === 'RAIZ' || aId === rootStr) continue;

      // Apenas nós estruturais (mapas e documentação não são nós estruturais)
      if (type === 'MAPA' || type === 'DOCUMENTACAO') continue;

      const title = String(anc?.titulo || ancestorTitles[i] || aId).trim();
      if (title.toLowerCase() === mapTitle) continue;

      structuralAncestors.push({
        id: aId,
        title,
        depth: depth > 0 ? depth : structuralAncestors.length + 1
      });
    }

    // Se ancestorIds não estava disponível, usar ancestorTitles como fallback
    if (structuralAncestors.length === 0 && ancestorTitles.length > 1) {
      for (let i = 1; i < ancestorTitles.length; i++) {
        const title = String(ancestorTitles[i] || '').trim();
        if (!title || title.toLowerCase() === mapTitle) continue;
        structuralAncestors.push({
          id: ancestorIds[i] ? String(ancestorIds[i]) : `anc-${i}`,
          title,
          depth: i
        });
      }
    }

    let produto = '';
    let produto_id = null;
    let subproduto = '';
    let subproduto_id = null;
    let categorias = [];
    let categoria_ids = [];
    let subproduto_path = [];
    let subproduto_path_ids = [];

    if (classified.artifact_type === 'RAIZ') {
      // Raiz não tem produto nem subproduto
    } else if (classified.artifact_type === 'NO') {
      if (classified.depth === 1) {
        // O nó de nível 1 é o próprio produto estrutural
        produto = classified.titulo;
        produto_id = String(classified.id);
      } else if (classified.depth === 2) {
        // O nó de nível 2 é o próprio subproduto estrutural
        produto = structuralAncestors[0]?.title || ancestorTitles[1] || '';
        produto_id = structuralAncestors[0]?.id || (ancestorIds[1] ? String(ancestorIds[1]) : null);
        subproduto = classified.titulo;
        subproduto_id = String(classified.id);
        subproduto_path = [classified.titulo];
        subproduto_path_ids = [String(classified.id)];
      } else if (classified.depth > 2) {
        produto = structuralAncestors[0]?.title || ancestorTitles[1] || '';
        produto_id = structuralAncestors[0]?.id || (ancestorIds[1] ? String(ancestorIds[1]) : null);
        subproduto = structuralAncestors[1]?.title || ancestorTitles[2] || '';
        subproduto_id = structuralAncestors[1]?.id || (ancestorIds[2] ? String(ancestorIds[2]) : null);
        categorias = [...structuralAncestors.slice(2).map(s => s.title), classified.titulo];
        categoria_ids = [...structuralAncestors.slice(2).map(s => s.id), String(classified.id)];
        subproduto_path = [...structuralAncestors.slice(1).map(s => s.title), classified.titulo];
        subproduto_path_ids = [...structuralAncestors.slice(1).map(s => s.id), String(classified.id)];
      }
    } else {
      // MAPA ou DOCUMENTACAO (artefatos finais)
      // O mapa nunca pode virar produto ou subproduto!
      if (structuralAncestors.length >= 1) {
        produto = structuralAncestors[0].title;
        produto_id = structuralAncestors[0].id;
      }
      if (structuralAncestors.length >= 2) {
        subproduto = structuralAncestors[1].title;
        subproduto_id = structuralAncestors[1].id;
        categorias = structuralAncestors.slice(2).map(s => s.title);
        categoria_ids = structuralAncestors.slice(2).map(s => s.id);
        subproduto_path = structuralAncestors.slice(1).map(s => s.title);
        subproduto_path_ids = structuralAncestors.slice(1).map(s => s.id);
      }
    }

    classified.produto = produto;
    classified.produto_id = produto_id;
    classified.subproduto = subproduto;
    classified.subproduto_id = subproduto_id;
    classified.categorias = categorias;
    classified.categoria_ids = categoria_ids;
    classified.subproduto_path = subproduto_path;
    classified.subproduto_path_ids = subproduto_path_ids;

    return classified;
  });
}
