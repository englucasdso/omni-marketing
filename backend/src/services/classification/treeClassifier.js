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
    const originalProduto = classified.produto;
    const originalProdutoId = classified.produto_id;
    const originalSubproduto = classified.subproduto;
    const originalSubprodutoId = classified.subproduto_id;
    const originalCategorias = classified.categorias;
    const originalCategoriaIds = classified.categoria_ids;
    const originalSubprodutoPath = classified.subproduto_path;
    const originalSubprodutoPathIds = classified.subproduto_path_ids;

    const mapTitle = String(classified.titulo || '').trim().toLowerCase();

    if (classified.artifact_type === 'RAIZ') {
      classified.produto = '';
      classified.produto_id = null;
      classified.subproduto = '';
      classified.subproduto_id = null;
      classified.categorias = [];
      classified.categoria_ids = [];
      classified.subproduto_path = [];
      classified.subproduto_path_ids = [];
      return classified;
    }

    const ancestorIds = Array.isArray(classified.ancestor_ids) ? classified.ancestor_ids : [];
    let ancestorTitles = Array.isArray(classified.ancestor_titles) ? classified.ancestor_titles : [];

    // Se ancestor_titles não estiver disponível, mas ancestor_ids estiver, tentar recuperar títulos dos ancestrais
    // sem transformar IDs de ancestrais em nomes visíveis
    if (ancestorTitles.length === 0 && ancestorIds.length > 0) {
      const recoveredTitles = [];
      let canRecover = true;
      for (const aId of ancestorIds) {
        const anc = rowMap.get(String(aId));
        if (anc && anc.titulo && typeof anc.titulo === 'string' && anc.titulo.trim() !== '') {
          recoveredTitles.push(anc.titulo.trim());
        } else {
          canRecover = false;
          break;
        }
      }
      if (canRecover && recoveredTitles.length > 0) {
        ancestorTitles = recoveredTitles;
      }
    }

    // Regra: o título do próprio mapa nunca pode virar produto, subproduto ou categoria.
    if (ancestorTitles.length > 0 && String(ancestorTitles[ancestorTitles.length - 1] || '').trim().toLowerCase() === mapTitle) {
      ancestorTitles = ancestorTitles.slice(0, -1);
    }

    // Verifica se possui cadeia estrutural válida e suficiente (pelo menos raiz [0] e produto [1])
    const hasValidStructuralChain = 
      ancestorTitles.length >= 2 && 
      typeof ancestorTitles[1] === 'string' && 
      ancestorTitles[1].trim() !== '' && 
      ancestorTitles[1].trim().toLowerCase() !== mapTitle;

    if (classified.artifact_type === 'NO') {
      if (classified.depth === 1) {
        classified.produto = classified.titulo;
        classified.produto_id = String(classified.id);
        classified.subproduto = '';
        classified.subproduto_id = null;
        classified.categorias = [];
        classified.categoria_ids = [];
        classified.subproduto_path = [];
        classified.subproduto_path_ids = [];
        return classified;
      } else if (classified.depth === 2) {
        classified.produto = hasValidStructuralChain ? ancestorTitles[1].trim() : (originalProduto || '');
        classified.produto_id = (hasValidStructuralChain && ancestorIds[1] !== undefined && ancestorIds[1] !== null) 
          ? String(ancestorIds[1]) 
          : (originalProdutoId || null);
        classified.subproduto = classified.titulo;
        classified.subproduto_id = String(classified.id);
        classified.categorias = [];
        classified.categoria_ids = [];
        classified.subproduto_path = [classified.titulo];
        classified.subproduto_path_ids = [String(classified.id)];
        return classified;
      } else if (classified.depth > 2) {
        classified.produto = hasValidStructuralChain ? ancestorTitles[1].trim() : (originalProduto || '');
        classified.produto_id = (hasValidStructuralChain && ancestorIds[1] !== undefined && ancestorIds[1] !== null) 
          ? String(ancestorIds[1]) 
          : (originalProdutoId || null);
        classified.subproduto = (ancestorTitles.length >= 3 && ancestorTitles[2]) ? ancestorTitles[2].trim() : (originalSubproduto || '');
        classified.subproduto_id = (ancestorIds[2] !== undefined && ancestorIds[2] !== null) ? String(ancestorIds[2]) : (originalSubprodutoId || null);
        classified.categorias = [...ancestorTitles.slice(3).map(t => String(t || '').trim()), classified.titulo].filter(Boolean);
        classified.categoria_ids = [...ancestorIds.slice(3).map(id => id !== undefined && id !== null ? String(id) : null), String(classified.id)];
        classified.subproduto_path = [classified.subproduto, ...classified.categorias].filter(Boolean);
        classified.subproduto_path_ids = [classified.subproduto_id, ...classified.categoria_ids].filter(Boolean);
        return classified;
      }
    }

    // Para MAPA ou DOCUMENTACAO (ou nós sem depth explícito):
    if (hasValidStructuralChain) {
      // 1. ancestor_titles[1] corresponde ao produto — nível 2 visual da árvore
      const prodTitle = ancestorTitles[1].trim();
      const prodId = (ancestorIds[1] !== undefined && ancestorIds[1] !== null) ? String(ancestorIds[1]) : (originalProdutoId || null);

      let subTitle = '';
      let subId = null;
      let cats = [];
      let catIds = [];

      // 2. ancestor_titles[2] corresponde ao subproduto
      if (ancestorTitles.length >= 3 && typeof ancestorTitles[2] === 'string' && ancestorTitles[2].trim() !== '') {
        const potentialSub = ancestorTitles[2].trim();
        if (potentialSub.toLowerCase() !== mapTitle) {
          subTitle = potentialSub;
          subId = (ancestorIds[2] !== undefined && ancestorIds[2] !== null) ? String(ancestorIds[2]) : (originalSubprodutoId || null);

          // 3. ancestor_titles.slice(3) corresponde aos níveis descendentes (categorias)
          if (ancestorTitles.length >= 4) {
            const rawCats = ancestorTitles.slice(3);
            const rawCatIds = ancestorIds.slice(3);
            for (let c = 0; c < rawCats.length; c++) {
              const cTitle = String(rawCats[c] || '').trim();
              if (cTitle && cTitle.toLowerCase() !== mapTitle) {
                cats.push(cTitle);
                catIds.push((rawCatIds[c] !== undefined && rawCatIds[c] !== null) ? String(rawCatIds[c]) : null);
              }
            }
          }
        }
      }

      classified.produto = prodTitle;
      classified.produto_id = prodId;
      classified.subproduto = subTitle;
      classified.subproduto_id = subId;
      classified.categorias = cats;
      classified.categoria_ids = catIds;
      classified.subproduto_path = subTitle ? [subTitle, ...cats] : [];
      classified.subproduto_path_ids = subTitle ? [subId, ...catIds].filter(Boolean) : [];

      return classified;
    }

    // Se não houver ancestor_titles ou a cadeia for incompleta:
    // Preservar valores existentes com fallback controlado:
    // 1. artifact.produto
    // 2. artifact.produto_servico
    // 3. artifact.header?.produto_servico?.value
    // Somente depois disso vazio (que vira "Sem Produto" na apresentação).
    let resolvedProduto = '';
    if (typeof originalProduto === 'string' && originalProduto.trim() !== '' && originalProduto.trim() !== 'Sem Produto' && originalProduto.trim().toLowerCase() !== mapTitle) {
      resolvedProduto = originalProduto.trim();
    } else if (typeof classified.produto_servico === 'string' && classified.produto_servico.trim() !== '' && classified.produto_servico.trim() !== 'Sem Produto' && classified.produto_servico.trim().toLowerCase() !== mapTitle) {
      resolvedProduto = classified.produto_servico.trim();
    } else if (typeof classified.header?.produto_servico?.value === 'string' && classified.header.produto_servico.value.trim() !== '' && classified.header.produto_servico.value.trim() !== 'Sem Produto' && classified.header.produto_servico.value.trim().toLowerCase() !== mapTitle) {
      resolvedProduto = classified.header.produto_servico.value.trim();
    }

    classified.produto = resolvedProduto;
    classified.produto_id = (originalProdutoId !== undefined && originalProdutoId !== null) ? originalProdutoId : null;

    let resolvedSubproduto = '';
    if (typeof originalSubproduto === 'string' && originalSubproduto.trim() !== '' && originalSubproduto.trim() !== 'Sem subproduto' && originalSubproduto.trim().toLowerCase() !== mapTitle) {
      resolvedSubproduto = originalSubproduto.trim();
    }
    classified.subproduto = resolvedSubproduto;
    classified.subproduto_id = (originalSubprodutoId !== undefined && originalSubprodutoId !== null) ? originalSubprodutoId : null;

    if (Array.isArray(originalCategorias) && originalCategorias.length > 0) {
      classified.categorias = originalCategorias.filter(c => typeof c === 'string' && c.trim() && c.trim().toLowerCase() !== mapTitle);
      classified.categoria_ids = Array.isArray(originalCategoriaIds) ? originalCategoriaIds : [];
    } else {
      classified.categorias = [];
      classified.categoria_ids = [];
    }

    if (Array.isArray(originalSubprodutoPath) && originalSubprodutoPath.length > 0) {
      classified.subproduto_path = originalSubprodutoPath.filter(p => typeof p === 'string' && p.trim() && p.trim().toLowerCase() !== mapTitle);
      classified.subproduto_path_ids = Array.isArray(originalSubprodutoPathIds) ? originalSubprodutoPathIds : [];
    } else if (classified.subproduto) {
      classified.subproduto_path = [classified.subproduto, ...classified.categorias];
      classified.subproduto_path_ids = [classified.subproduto_id, ...classified.categoria_ids].filter(Boolean);
    } else {
      classified.subproduto_path = [];
      classified.subproduto_path_ids = [];
    }

    return classified;
  });
}
