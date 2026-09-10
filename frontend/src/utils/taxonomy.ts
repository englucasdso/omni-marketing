import { Artifact } from '../types';

/**
 * Utilitários para extração e resolução da taxonomia hierárquica (Nível 1 e Nível 2)
 * em conformidade com as propriedades do projeto: depth, parent_id, ancestor_ids, produto e subproduto.
 */

/**
 * Retorna os produtos válidos (Nível 1 da hierarquia), ordenados alfabeticamente.
 */
export function getProductOptions(artifacts: Artifact[]): string[] {
  const prodSet = new Set<string>();

  artifacts.forEach(a => {
    if (a.produto && typeof a.produto === 'string') {
      const p = a.produto.trim();
      if (p && p !== '-' && p.toLowerCase() !== 'sem produto' && p.toLowerCase() !== 'todos') {
        prodSet.add(p);
      }
    }
  });

  return Array.from(prodSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Retorna os itens de Nível 2 (subprodutos ou agrupamentos diretamente abaixo do produto).
 * O seletor é estritamente dependente do produto selecionado:
 * - Se selectedProduct === 'all', retorna todos os itens válidos de nível 2.
 * - Se selectedProduct estiver definido, retorna apenas os filhos diretos daquele produto.
 * - Não mistura produtos, páginas vazias, mapas, documentações ou nós de outros níveis.
 * - Utiliza os campos hierárquicos depth, parent_id e ancestor_ids sem inferência arbitrária de texto.
 */
export function getLevel2Options(artifacts: Artifact[], selectedProduct: string): string[] {
  const level2Set = new Set<string>();

  // Mapear por ID para inspeção de árvore
  const mapById = new Map<string, Artifact>();
  artifacts.forEach(a => mapById.set(a.id, a));

  // Identificar os nós de produto (Nível 1) caso existam como nós na árvore
  const productNodeIds = new Set<string>();
  artifacts.forEach(a => {
    const isLevel1 = a.depth === 1 || a.taxonomy_depth === 1 || (!a.parent_id && a.artifact_type === 'NO');
    const matchesProduct = selectedProduct === 'all' || a.produto === selectedProduct || a.titulo === selectedProduct;
    if (isLevel1 && matchesProduct) {
      productNodeIds.add(a.id);
    }
  });

  artifacts.forEach(a => {
    const belongsToProduct = selectedProduct === 'all' || 
      a.produto === selectedProduct || 
      (a.ancestor_ids && Array.from(productNodeIds).some(pid => a.ancestor_ids?.includes(pid)));

    if (!belongsToProduct) return;

    // 1. Extrai via propriedade subproduto explícita
    if (a.subproduto && typeof a.subproduto === 'string') {
      const sub = a.subproduto.trim();
      const prodName = (a.produto || selectedProduct || '').trim().toLowerCase();
      if (
        sub && 
        sub !== '-' && 
        sub.toLowerCase() !== 'sem subproduto' && 
        sub.toLowerCase() !== prodName
      ) {
        level2Set.add(sub);
      }
    }

    // 2. Extrai via árvore estrutural (filho direto do nó de produto ou depth === 2)
    const isDirectChild = a.parent_id && productNodeIds.has(a.parent_id);
    const isDepth2 = a.depth === 2 || a.taxonomy_depth === 2;

    if ((isDirectChild || isDepth2) && a.artifact_type !== 'MAPA' && a.artifact_type !== 'DOCUMENTACAO') {
      if (a.titulo && typeof a.titulo === 'string') {
        const title = a.titulo.trim();
        const prodName = (a.produto || selectedProduct || '').trim().toLowerCase();
        if (title && title !== '-' && title.toLowerCase() !== prodName) {
          level2Set.add(title);
        }
      }
    }
  });

  return Array.from(level2Set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Verifica se um artefato corresponde ao filtro de Nível 2 selecionado.
 */
export function matchesLevel2Filter(artifact: Artifact, selectedLevel2: string): boolean {
  if (selectedLevel2 === 'all') return true;

  const target = selectedLevel2.trim().toLowerCase();

  // Verifica subproduto
  if (artifact.subproduto && artifact.subproduto.trim().toLowerCase() === target) {
    return true;
  }

  // Verifica agrupamento pai
  if (artifact.parent_title && artifact.parent_title.trim().toLowerCase() === target) {
    return true;
  }

  // Se o próprio item for o nó de agrupamento
  if (artifact.titulo && artifact.titulo.trim().toLowerCase() === target) {
    return true;
  }

  return false;
}
