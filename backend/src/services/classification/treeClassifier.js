export function classifyTree(rows, rootPageId) {
  const rootStr = String(rootPageId);
  return rows.map(row => {
    const classified = { ...row };

    // 1. RAIZ
    if (String(classified.id) === rootStr) {
      classified.artifact_type = 'RAIZ';
      classified.produto = '';
      classified.subproduto = '';
      classified.categorias = [];
      classified.homologation_status = null;
      classified.homologation_percentage = null;
      classified.validated_screens = null;
      classified.total_screens = null;
      return classified;
    }

    // 2. Classificação Produto/Subproduto/Categorias
    const depth = classified.depth;
    let produto = '';
    let subproduto = '';
    let categorias = [];
    const titles = classified.ancestor_titles || [];

    if (depth === 1) {
      produto = classified.titulo;
    } else if (depth > 1) {
      produto = titles[1] || '';
      
      if (depth === 2) {
        if (classified.has_children) {
          subproduto = classified.titulo;
        }
      } else if (depth > 2) {
        subproduto = titles[2] || '';
        categorias = titles.slice(3);
        if (classified.has_children) {
          categorias.push(classified.titulo);
        }
      }
    }

    classified.produto = produto;
    classified.subproduto = subproduto;
    classified.categorias = categorias;

    // 3. Tipos de artefato
    if (classified.has_children) {
      classified.artifact_type = 'NO';
    } else {
      const hasScreens = classified.screens && classified.screens.length > 0;
      const hasSnippets = classified.parameter_summary && classified.parameter_summary.length > 0;
      
      let hasDocContent = false;
      if (classified.structural_metadata && classified.structural_metadata.signals) {
        hasDocContent = classified.structural_metadata.signals.has_documentation_signals;
      }
      const hasHeader = classified.header && Object.keys(classified.header).length > 0;

      if (hasScreens || hasSnippets) {
        classified.artifact_type = 'MAPA';
      } else if (hasDocContent || hasHeader) {
        classified.artifact_type = 'DOCUMENTACAO';
      } else {
        classified.artifact_type = 'NO';
      }
    }

    // 4. Status de homologação calculado pelas telas
    if (classified.artifact_type === 'MAPA') {
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
    } else {
      classified.homologation_status = null;
      classified.homologation_percentage = null;
      classified.validated_screens = null;
      classified.total_screens = null;
    }

    return classified;
  });
}
