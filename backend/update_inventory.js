import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), "backend/data/inventario.json");
const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

function extrairProdutoSubprodutoDaTrilha(ancestorTitles = [], depth = 0, nodeTitle = '', cabecalhoProduto = '') {
    let estruturalProduto = '';
    let estruturalSubproduto = '';

    if (ancestorTitles.length >= 2) {
      estruturalProduto = ancestorTitles[1];
    } else if (depth === 1) {
      estruturalProduto = nodeTitle;
    }
    
    if (depth >= 3 && ancestorTitles.length >= 3) {
      estruturalSubproduto = ancestorTitles[2];
    }

    const produtoFinal = estruturalProduto || cabecalhoProduto || '';
    const subprodutoFinal = estruturalSubproduto || '';

    return { 
      produto: produtoFinal, 
      subproduto: subprodutoFinal 
    };
}

const updated = raw.map(item => {
  const depth = item.depth;
  const ancestorTitles = item.ancestor_titles || [];
  
  let cabecalhoProduto = '';
  if (item.header && item.header.produto_servico) {
      cabecalhoProduto = item.header.produto_servico.value || '';
  } else if (item.produto_servico) {
      cabecalhoProduto = item.produto_servico;
  }
  
  const { produto, subproduto } = extrairProdutoSubprodutoDaTrilha(ancestorTitles, depth, item.titulo, cabecalhoProduto);
  item.produto = produto;
  item.subproduto = subproduto;
  
  let artifact_type = 'NAO_CLASSIFICADO';
  const hasContent = item.structural_metadata && item.structural_metadata.signals ? item.structural_metadata.signals.has_content : undefined;
  const hasTrackingScreens = item.screens && item.screens.length > 0;
  const totalSnippets = (item.screens || []).reduce((acc, s) => acc + (s.snippets ? s.snippets.length : 0), 0);
  
  if (depth === 0) {
    artifact_type = 'RAIZ';
  } else if (item.has_children) {
    artifact_type = 'NO';
  } else if (hasTrackingScreens || totalSnippets > 0) {
    artifact_type = 'MAPA';
  } else if (hasContent === false) {
    artifact_type = 'NO';
  } else {
    artifact_type = 'DOCUMENTACAO';
  }
  
  item.artifact_type = artifact_type;
  
  return item;
});

fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2));
console.log("Updated inventory.json.");
