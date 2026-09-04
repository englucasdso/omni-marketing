import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "backend/data/inventario.json");

export function normalizeInventoryItem(item: any) {
  if (!item) return null;
  const artifact_type = item.artifact_type || (item.tipo_mapa === 'Doc' ? 'DOCUMENTACAO' : 'MAPA');
  const measurement_class = item.measurement_class || (
    item.tipo_mapa === 'GA4' ? 'GA4' : 
    (item.tipo_mapa === 'Universal Analytics' || item.tipo_mapa === 'GA3' ? 'GA3' : 'NAO_CLASSIFICADO')
  );

  return {
    ...item,
    artifact_type,
    measurement_class,
    depth: item.depth !== undefined ? item.depth : (item.taxonomy_depth || item.nivel || 1),
    taxonomy_depth: item.depth !== undefined ? item.depth : (item.taxonomy_depth || item.nivel || 1),
    parent_id: item.parent_id !== undefined ? item.parent_id : null,
    parent_title: item.parent_title !== undefined ? item.parent_title : (item.pai || null),
    ancestor_ids: Array.isArray(item.ancestor_ids) ? item.ancestor_ids : [],
    ancestor_titles: Array.isArray(item.ancestor_titles) ? item.ancestor_titles : [],
    full_path: item.full_path || item.titulo || '',
    has_children: Boolean(item.has_children),
    children_count: Number(item.children_count || 0),
    is_leaf: Boolean(item.is_leaf !== undefined ? item.is_leaf : (!item.has_children)),
    space: item.space || '',
    gtm_ids: Array.isArray(item.gtm_ids) ? item.gtm_ids : (item.gtm_id ? [item.gtm_id] : []),
    structural_metadata: item.structural_metadata || null,
    header: item.header || {},
    screens: Array.isArray(item.screens) ? item.screens : [],
    status_summary: item.status_summary || {
      NOVO: 0,
      VALIDADO: 0,
      CORRECAO: 0,
      EXCLUIR: 0,
      DESCONTINUAR: 0,
      NAO_IDENTIFICADO: 0
    },
    declared_status: item.declared_status || null,
    calculated_status: item.calculated_status || 'NAO_IDENTIFICADO',
    status_divergent: Boolean(item.status_divergent),
    parameter_summary: Array.isArray(item.parameter_summary) ? item.parameter_summary : [],
    pattern_summary: Array.isArray(item.pattern_summary) ? item.pattern_summary : [],
    tipo_mapa: item.tipo_mapa || (artifact_type === 'DOCUMENTACAO' ? 'Doc' : (measurement_class === 'NAO_CLASSIFICADO' ? 'Não classificado' : measurement_class))
  };
}

export function getInventoryData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeInventoryItem).filter(Boolean);
  } catch (e) {
    console.error("[inventory.service] Erro ao ler inventario.json:", e);
    return [];
  }
}

export function calculateInsights(inventory: any[]) {
  const statusCounts = {
    VALIDADO: 0,
    'CORREÇÃO': 0,
    NOVO: 0,
    EXCLUIR: 0,
    DESCONTINUAR: 0,
    CORRECAO: 0
  };

  const measurementCounts = {
    GA4: 0,
    GA3: 0,
    MISTO: 0,
    NAO_CLASSIFICADO: 0
  };

  let totalScreens = 0;
  let totalArtifacts = inventory.length;
  let totalMaps = 0;
  let totalDocs = 0;
  let divergentCount = 0;

  for (const item of inventory) {
    if (item.artifact_type === 'DOCUMENTACAO') {
      totalDocs++;
    } else {
      totalMaps++;
      if (item.measurement_class && measurementCounts.hasOwnProperty(item.measurement_class)) {
        measurementCounts[item.measurement_class as keyof typeof measurementCounts]++;
      } else {
        measurementCounts.NAO_CLASSIFICADO++;
      }

      if (item.status_divergent) {
        divergentCount++;
      }

      const screens = item.screens || [];
      totalScreens += screens.length;

      // Contagem oficial por tela
      for (const sc of screens) {
        const raw = sc.status;
        if (typeof raw === 'string') {
          const clean = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
          if (clean === 'VALIDADO') {
            statusCounts.VALIDADO++;
          } else if (clean === 'CORREÇÃO' || clean === 'CORRECAO') {
            statusCounts['CORREÇÃO']++;
            statusCounts.CORRECAO++;
          } else if (clean === 'NOVO') {
            statusCounts.NOVO++;
          } else if (clean === 'EXCLUIR') {
            statusCounts.EXCLUIR++;
          } else if (clean === 'DESCONTINUAR') {
            statusCounts.DESCONTINUAR++;
          }
        }
      }
    }
  }

  const sumOfficial = statusCounts.VALIDADO + statusCounts['CORREÇÃO'] + statusCounts.NOVO + statusCounts.EXCLUIR + statusCounts.DESCONTINUAR;

  return {
    total: totalArtifacts,
    totalMaps,
    totalDocs,
    totalScreens,
    divergentCount,
    statusCounts,
    measurementCounts,
    integrity: {
      valid: totalScreens === sumOfficial,
      totalScreens,
      sum: sumOfficial,
      difference: totalScreens - sumOfficial
    },
    recent: totalArtifacts > 0 ? 1 : 0
  };
}

export function searchArtifacts(query: string) {
  const inventory = getInventoryData();
  if (!query) return inventory;
  const lowerQuery = query.toLowerCase().trim();

  return inventory.filter((item: any) => {
    if (item.titulo && item.titulo.toLowerCase().includes(lowerQuery)) return true;
    if (item.full_path && item.full_path.toLowerCase().includes(lowerQuery)) return true;
    if (item.responsavel && item.responsavel.toLowerCase().includes(lowerQuery)) return true;
    if (item.produto && item.produto.toLowerCase().includes(lowerQuery)) return true;
    if (item.subproduto && item.subproduto.toLowerCase().includes(lowerQuery)) return true;
    if (item.numero_da_task && item.numero_da_task.toLowerCase().includes(lowerQuery)) return true;
    if (item.propriedade_ga4_stream_id && item.propriedade_ga4_stream_id.toLowerCase().includes(lowerQuery)) return true;
    if (item.gtm_id && item.gtm_id.toLowerCase().includes(lowerQuery)) return true;
    if (item.gtm_ids && item.gtm_ids.some((g: string) => String(g).toLowerCase().includes(lowerQuery))) return true;
    if (item.artifact_type && item.artifact_type.toLowerCase().includes(lowerQuery)) return true;
    if (item.measurement_class && item.measurement_class.toLowerCase().includes(lowerQuery)) return true;

    // Busca dentro dos parâmetros
    if (item.parameter_summary) {
      for (const p of item.parameter_summary) {
        if (p.path && p.path.toLowerCase().includes(lowerQuery)) return true;
        if (p.distinct_values && p.distinct_values.some((v: string) => String(v).toLowerCase().includes(lowerQuery))) return true;
      }
    }

    return false;
  });
}
