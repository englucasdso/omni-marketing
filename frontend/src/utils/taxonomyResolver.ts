import type { Artifact, TaxonomyNodeReference, ResolvedArtifactTaxonomy } from '../types/index.ts';

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
 * Resolve a taxonomia estrutural de um artefato com base na hierarquia real da árvore.
 *
 * Regras oficiais:
 * 1. Raiz: depth = 0, artifact_type = 'RAIZ'. A raiz NUNCA pode ser produto, subproduto ou categoria.
 * 2. Produto: nó estrutural com depth === 1.
 * 3. Subproduto: nó estrutural com depth === 2.
 * 4. Níveis descendentes: nós estruturais com depth >= 2 (preservados em descendantPath e displayPath).
 * 5. MAPA e DOCUMENTACAO: artefatos finais, nunca nós de produto ou subproduto.
 * 6. Fallback estrutural: ancestor_ids / ancestor_titles paralelos (índice 0 = raiz descartada).
 * 7. Fallback legado: aceita artifact.produto / subproduto apenas se passar nas validações anti-raiz e anti-mapa.
 */
export function resolveArtifactTaxonomy(
  artifact: Artifact,
  artifactsById: Map<string, Artifact>
): ResolvedArtifactTaxonomy {
  const mapId = String(artifact.id);
  const mapTitle = String(artifact.titulo || '').trim().toLowerCase();

  // Coleta referências de raízes conhecidas
  const rootIds = new Set<string>();
  const rootTitles = new Set<string>(['hub de artefatos', 'home', 'raiz', 'root']);

  // Indexar nós raiz conhecidos a partir de artifactsById
  for (const art of artifactsById.values()) {
    if (art.depth === 0 || String(art.artifact_type).toUpperCase() === 'RAIZ') {
      rootIds.add(String(art.id));
      if (art.titulo) {
        rootTitles.add(String(art.titulo).trim().toLowerCase());
      }
    }
  }

  // Se ancestor_ids/ancestor_titles contiverem o nó raiz no índice 0
  if (Array.isArray(artifact.ancestor_ids) && artifact.ancestor_ids.length > 0) {
    rootIds.add(String(artifact.ancestor_ids[0]));
  }
  if (Array.isArray(artifact.ancestor_titles) && artifact.ancestor_titles.length > 0) {
    rootTitles.add(String(artifact.ancestor_titles[0]).trim().toLowerCase());
  }

  // Helper para identificar nós raiz
  const isRoot = (id: string, title: string, type?: string, depth?: number | null) => {
    if (depth === 0) return true;
    if (type && type.toUpperCase() === 'RAIZ') return true;
    if (rootIds.has(id)) return true;
    if (title && rootTitles.has(title.trim().toLowerCase())) return true;
    return false;
  };

  // Helper para identificar artefatos finais (não estruturais)
  const isFinalArtifact = (type?: string) => {
    if (!type) return false;
    const t = type.toUpperCase();
    return t === 'MAPA' || t === 'DOCUMENTACAO';
  };

  // -------------------------------------------------------------
  // ESTRATÉGIA 1: Reconstrução ascendente por parent_id
  // -------------------------------------------------------------
  let parentChainReconstructed = false;
  const structuralFromParent: TaxonomyNodeReference[] = [];

  if (artifact.parent_id) {
    const visited = new Set<string>([mapId]);
    const chainFromParent: Artifact[] = [];
    let currId: string | null = String(artifact.parent_id);

    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const parentNode = artifactsById.get(currId);
      if (!parentNode) {
        break;
      }
      chainFromParent.push(parentNode);

      // Se encontrou a raiz, encerra a subida
      if (isRoot(String(parentNode.id), String(parentNode.titulo || ''), parentNode.artifact_type, parentNode.depth)) {
        break;
      }

      currId = parentNode.parent_id ? String(parentNode.parent_id) : null;
    }

    if (chainFromParent.length > 0) {
      parentChainReconstructed = true;
      // Inverter a cadeia para obter: raiz → produto → subproduto → descendentes
      const invertedChain = [...chainFromParent].reverse();

      const hasExplicitRoot = isRoot(
        String(invertedChain[0].id),
        String(invertedChain[0].titulo || ''),
        invertedChain[0].artifact_type,
        invertedChain[0].depth
      );

      for (let k = 0; k < invertedChain.length; k++) {
        const node = invertedChain[k];
        const nId = String(node.id);
        const nTitle = String(node.titulo || '').trim();
        const nType = node.artifact_type;

        // Excluir o próprio mapa
        if (nId === mapId || nTitle.toLowerCase() === mapTitle) continue;
        // Excluir a raiz
        if (isRoot(nId, nTitle, nType, node.depth)) continue;
        // Excluir qualquer artefato MAPA ou DOCUMENTACAO
        if (isFinalArtifact(nType)) continue;

        let d: number;
        if (node.depth !== undefined && node.depth !== null) {
          d = Number(node.depth);
        } else if (hasExplicitRoot) {
          d = k;
        } else {
          d = structuralFromParent.length + 1;
        }

        structuralFromParent.push({
          id: nId,
          name: nTitle || nId,
          depth: d
        });
      }
    }
  }

  if (parentChainReconstructed) {
    const product = structuralFromParent.find(n => n.depth === 1) || null;
    const subproduct = product ? (structuralFromParent.find(n => n.depth === 2) || null) : null;
    const descendantPath = product ? structuralFromParent.filter(n => n.depth >= 2) : [];
    const displayPath = descendantPath.map(n => n.name).join(' › ');

    if (product || structuralFromParent.length === 0) {
      return {
        product,
        subproduct,
        descendantPath,
        displayPath,
        productKey: product ? product.id : 'SEM_PRODUTO',
        subproductKey: subproduct ? subproduct.id : 'SEM_SUBPRODUTO'
      };
    }
  }

  // -------------------------------------------------------------
  // ESTRATÉGIA 2: Fallback estrutural por ancestor_ids / ancestor_titles
  // -------------------------------------------------------------
  const ancIds = Array.isArray(artifact.ancestor_ids) ? artifact.ancestor_ids : [];
  const ancTitles = Array.isArray(artifact.ancestor_titles) ? artifact.ancestor_titles : [];
  const maxAncLen = Math.max(ancIds.length, ancTitles.length);

  if (maxAncLen > 1) {
    const structuralFromAncestors: TaxonomyNodeReference[] = [];

    // O índice 0 é sempre descartado (é a raiz). Nunca usar ancestorTitles[0] como produto.
    for (let i = 1; i < maxAncLen; i++) {
      const rawId = ancIds[i] ? String(ancIds[i]) : `anc-${i}`;
      const ancObj = artifactsById.get(rawId);
      const rawTitle = ancTitles[i]
        ? String(ancTitles[i]).trim()
        : (ancObj?.titulo ? String(ancObj.titulo).trim() : rawId);
      const ancType = ancObj?.artifact_type;
      const explicitDepth = (ancObj?.depth !== undefined && ancObj.depth !== null)
        ? Number(ancObj.depth)
        : i;

      // Excluir o próprio mapa
      if (rawId === mapId || rawTitle.toLowerCase() === mapTitle) continue;
      // Excluir a raiz
      if (isRoot(rawId, rawTitle, ancType, explicitDepth)) continue;
      // Excluir MAPA e DOCUMENTACAO
      if (isFinalArtifact(ancType)) continue;

      structuralFromAncestors.push({
        id: rawId,
        name: rawTitle || rawId,
        depth: explicitDepth
      });
    }

    const product = structuralFromAncestors.find(n => n.depth === 1) || null;
    const subproduct = product ? (structuralFromAncestors.find(n => n.depth === 2) || null) : null;
    const descendantPath = product ? structuralFromAncestors.filter(n => n.depth >= 2) : [];
    const displayPath = descendantPath.map(n => n.name).join(' › ');

    if (product || structuralFromAncestors.length === 0) {
      return {
        product,
        subproduct,
        descendantPath,
        displayPath,
        productKey: product ? product.id : 'SEM_PRODUTO',
        subproductKey: subproduct ? subproduct.id : 'SEM_SUBPRODUTO'
      };
    }
  }

  // -------------------------------------------------------------
  // ESTRATÉGIA 3: Fallback legado (campos planos)
  // -------------------------------------------------------------
  const rawProduto = typeof artifact.produto === 'string' ? artifact.produto.trim() : '';

  // Validações obrigatórias:
  // - Não vazio
  // - Não igual ao título do mapa
  // - Não igual ao título da raiz
  // - Não pertence a um artefato RAIZ
  const isInvalidProduto =
    !rawProduto ||
    rawProduto.toLowerCase() === 'sem produto' ||
    rawProduto.toLowerCase() === 'sem_produto' ||
    rawProduto.toLowerCase() === mapTitle ||
    rootTitles.has(rawProduto.toLowerCase()) ||
    (artifact.produto_id && rootIds.has(String(artifact.produto_id))) ||
    String(artifact.artifact_type).toUpperCase() === 'RAIZ' ||
    artifact.depth === 0;

  if (isInvalidProduto) {
    return {
      product: null,
      subproduct: null,
      descendantPath: [],
      displayPath: '',
      productKey: 'SEM_PRODUTO',
      subproductKey: 'SEM_SUBPRODUTO'
    };
  }

  // Derivar chave normalizada quando produto_id não existir
  const prodId = artifact.produto_id ? String(artifact.produto_id) : `prod-${slugify(rawProduto)}`;
  const product: TaxonomyNodeReference = {
    id: prodId,
    name: rawProduto,
    depth: 1
  };

  const descendantPath: TaxonomyNodeReference[] = [];

  // Caminho descendente legado (subproduto_path)
  if (Array.isArray(artifact.subproduto_path) && artifact.subproduto_path.length > 0) {
    artifact.subproduto_path.forEach((pName, idx) => {
      const pTrim = String(pName || '').trim();
      if (!pTrim || pTrim.toLowerCase() === mapTitle || rootTitles.has(pTrim.toLowerCase())) return;
      const pId = (Array.isArray(artifact.subproduto_path_ids) && artifact.subproduto_path_ids[idx])
        ? String(artifact.subproduto_path_ids[idx])
        : `sub-${idx + 2}-${slugify(pTrim)}`;
      descendantPath.push({
        id: pId,
        name: pTrim,
        depth: idx + 2
      });
    });
  }

  // Subproduto plano direto
  if (descendantPath.length === 0 && typeof artifact.subproduto === 'string') {
    const subTrim = artifact.subproduto.trim();
    if (
      subTrim !== '' &&
      subTrim.toLowerCase() !== 'sem subproduto' &&
      subTrim.toLowerCase() !== 'sem_subproduto' &&
      subTrim.toLowerCase() !== mapTitle &&
      !rootTitles.has(subTrim.toLowerCase())
    ) {
      const subId = artifact.subproduto_id ? String(artifact.subproduto_id) : `sub-${slugify(subTrim)}`;
      descendantPath.push({
        id: subId,
        name: subTrim,
        depth: 2
      });
    }
  }

  // Categorias adicionais
  if (Array.isArray(artifact.categorias) && artifact.categorias.length > 0) {
    artifact.categorias.forEach((cName, cIdx) => {
      const cTrim = String(cName || '').trim();
      if (!cTrim || cTrim.toLowerCase() === mapTitle || rootTitles.has(cTrim.toLowerCase())) return;
      if (descendantPath.some(d => d.name.toLowerCase() === cTrim.toLowerCase())) return;
      const cDepth = descendantPath.length + 2;
      const cId = (Array.isArray(artifact.categoria_ids) && artifact.categoria_ids[cIdx])
        ? String(artifact.categoria_ids[cIdx])
        : `cat-${cDepth}-${slugify(cTrim)}`;
      descendantPath.push({
        id: cId,
        name: cTrim,
        depth: cDepth
      });
    });
  }

  const subproduct = descendantPath.find(n => n.depth === 2) || (descendantPath.length > 0 ? descendantPath[0] : null);
  const displayPath = descendantPath.map(n => n.name).join(' › ');

  return {
    product,
    subproduct,
    descendantPath,
    displayPath,
    productKey: product.id,
    subproductKey: subproduct ? subproduct.id : 'SEM_SUBPRODUTO'
  };
}
