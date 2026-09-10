import { Artifact, TaxonomyNodeReference, ResolvedArtifactTaxonomy } from '../types';

export type { TaxonomyNodeReference, ResolvedArtifactTaxonomy };

/**
 * Normaliza string para gerar ID estável em casos de fallback legado sem IDs.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve a taxonomia estrutural de um artefato com base nos ancestrais reais da árvore.
 *
 * Regras aplicadas:
 * 1. Raiz: nunca é produto (depth === 0 ou index === 0).
 * 2. Produto: primeiro nó estrutural abaixo da raiz (depth === 1).
 * 3. Subproduto: primeiro nó estrutural abaixo do produto (depth === 2).
 * 4. Categorias posteriores: preserva toda a descendência em descendantPath e displayPath (com ' › ').
 * 5. Mapa: artefato final; nunca pode virar produto ou subproduto.
 * 6. Documentação: nunca pode virar produto ou subproduto.
 * 7. Nó vazio: pode participar da taxonomia quando estiver na posição estrutural correta.
 * 8. Mapa diretamente abaixo do produto: classificado como subproduto null ('SEM_SUBPRODUTO').
 * 9. Mapa diretamente abaixo da raiz: classificado como produto null ('SEM_PRODUTO').
 * 10. Chaves estáveis baseadas em IDs para evitar misturar nós homônimos.
 */
export function resolveArtifactTaxonomy(
  artifact: Artifact,
  artifactsById: Map<string, Artifact>
): ResolvedArtifactTaxonomy {
  const mapIdStr = String(artifact.id);
  const mapTitle = String(artifact.titulo || '').trim().toLowerCase();

  // 1. Obter lista de IDs ancestrais
  let ancestorIds: string[] = [];
  if (Array.isArray(artifact.ancestor_ids) && artifact.ancestor_ids.length > 0) {
    ancestorIds = artifact.ancestor_ids.map(id => String(id));
  } else if (artifact.parent_id) {
    // Reconstrução ascendente por parent_id se ancestor_ids não estiver preenchido
    let curr = artifactsById.get(String(artifact.parent_id));
    const visited = new Set<string>();
    const chain: string[] = [];
    while (curr && !visited.has(String(curr.id))) {
      visited.add(String(curr.id));
      chain.unshift(String(curr.id));
      if (curr.parent_id) {
        curr = artifactsById.get(String(curr.parent_id));
      } else {
        break;
      }
    }
    ancestorIds = chain;
  }

  // Regra 5: Não incluir o próprio mapa
  ancestorIds = ancestorIds.filter(id => id !== mapIdStr);

  const ancestorTitles = Array.isArray(artifact.ancestor_titles) ? artifact.ancestor_titles : [];
  const structuralAncestors: TaxonomyNodeReference[] = [];

  if (ancestorIds.length > 0) {
    for (let i = 0; i < ancestorIds.length; i++) {
      const ancId = ancestorIds[i];
      const ancObj = artifactsById.get(ancId);

      const depth = ancObj?.depth !== undefined ? Number(ancObj.depth) : i;
      const type = ancObj?.artifact_type;

      // Regra 1 e 4: Remover a raiz
      if (i === 0 || depth === 0 || type === 'RAIZ') {
        continue;
      }

      // Regra 6: Considerar apenas nós estruturais na taxonomia.
      // Mapas e documentações não são nós estruturais.
      if (type === 'MAPA' || type === 'DOCUMENTACAO') {
        continue;
      }

      const rawName = ancObj?.titulo || (ancestorTitles[i] ? ancestorTitles[i] : ancId);
      const name = String(rawName || '').trim();

      // Regra: Nunca utilizar o título do próprio mapa como ancestral estrutural
      if (name.toLowerCase() === mapTitle) {
        continue;
      }

      structuralAncestors.push({
        id: ancId,
        name,
        depth: depth > 0 ? depth : structuralAncestors.length + 1
      });
    }
  } else if (ancestorTitles.length > 1) {
    // Fallback para datasets legados contendo apenas ancestor_titles (índice 0 é raiz)
    for (let i = 1; i < ancestorTitles.length; i++) {
      const raw = String(ancestorTitles[i] || '').trim();
      if (!raw || raw.toLowerCase() === mapTitle) continue;
      structuralAncestors.push({
        id: `anc-${i}-${slugify(raw)}`,
        name: raw,
        depth: i
      });
    }
  } else if (artifact.produto && artifact.produto.trim() !== '' && artifact.produto !== 'Sem Produto') {
    // Fallback retrocompatível para inventario.json que possui apenas os campos planos 'produto' / 'subproduto'
    const prodName = artifact.produto.trim();
    if (prodName.toLowerCase() !== mapTitle) {
      const prodId = artifact.produto_id || `prod-${slugify(prodName)}`;
      structuralAncestors.push({
        id: prodId,
        name: prodName,
        depth: 1
      });

      if (artifact.subproduto && artifact.subproduto.trim() !== '' && artifact.subproduto !== 'Sem subproduto') {
        const subName = artifact.subproduto.trim();
        if (subName.toLowerCase() !== mapTitle) {
          const subId = artifact.subproduto_id || `sub-${slugify(subName)}`;
          structuralAncestors.push({
            id: subId,
            name: subName,
            depth: 2
          });

          // Se houver subproduto_path persistido em categorias adicionais
          if (Array.isArray(artifact.categorias) && artifact.categorias.length > 0) {
            artifact.categorias.forEach((catName, cIdx) => {
              const cTrim = String(catName || '').trim();
              if (cTrim && cTrim.toLowerCase() !== mapTitle) {
                const cId = (artifact.categoria_ids && artifact.categoria_ids[cIdx]) || `cat-${cIdx + 3}-${slugify(cTrim)}`;
                structuralAncestors.push({
                  id: cId,
                  name: cTrim,
                  depth: cIdx + 3
                });
              }
            });
          }
        }
      }
    }
  }

  // Se nenhum ancestral estrutural foi identificado:
  if (structuralAncestors.length === 0) {
    return {
      product: null,
      subproduct: null,
      descendantPath: [],
      displayPath: '',
      productKey: 'SEM_PRODUTO',
      subproductKey: 'SEM_SUBPRODUTO'
    };
  }

  // 7. Identificar o produto no nível estrutural correto (primeiro nó estrutural abaixo da raiz)
  const product = structuralAncestors[0];

  // Garantia anti-título do próprio mapa como produto
  if (product.name.toLowerCase() === mapTitle) {
    return {
      product: null,
      subproduct: null,
      descendantPath: [],
      displayPath: '',
      productKey: 'SEM_PRODUTO',
      subproductKey: 'SEM_SUBPRODUTO'
    };
  }

  // 8. Identificar os nós estruturais descendentes abaixo do produto
  const descendants = structuralAncestors.slice(1);
  const subproduct = descendants.length > 0 ? descendants[0] : null;

  // 9. Preservar todos os descendentes restantes
  const descendantPath = descendants;
  const displayPath = descendants.map(node => node.name).join(' › ');

  return {
    product,
    subproduct,
    descendantPath,
    displayPath,
    productKey: product.id,
    subproductKey: subproduct ? subproduct.id : 'SEM_SUBPRODUTO'
  };
}
