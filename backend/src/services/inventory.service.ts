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
    taxonomy_depth: item.taxonomy_depth || item.nivel || 1,
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
    tipo_mapa: item.tipo_mapa || (artifact_type === 'DOCUMENTACAO' ? 'Doc' : measurement_class)
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
    NOVO: 0,
    VALIDADO: 0,
    CORRECAO: 0,
    EXCLUIR: 0,
    DESCONTINUAR: 0,
    NAO_IDENTIFICADO: 0
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

      if (item.status_summary) {
        for (const [key, val] of Object.entries(item.status_summary)) {
          if (statusCounts.hasOwnProperty(key)) {
            statusCounts[key as keyof typeof statusCounts] += Number(val) || 0;
          }
        }
      }
    }
  }

  return {
    total: totalArtifacts,
    totalMaps,
    totalDocs,
    totalScreens,
    divergentCount,
    statusCounts,
    measurementCounts,
    recent: totalArtifacts > 0 ? 1 : 0
  };
}

export function searchArtifacts(query: string) {
  const inventory = getInventoryData();
  if (!query) return inventory;
  const lowerQuery = query.toLowerCase().trim();

  return inventory.filter((item: any) => {
    if (item.titulo && item.titulo.toLowerCase().includes(lowerQuery)) return true;
    if (item.responsavel && item.responsavel.toLowerCase().includes(lowerQuery)) return true;
    if (item.produto && item.produto.toLowerCase().includes(lowerQuery)) return true;
    if (item.subproduto && item.subproduto.toLowerCase().includes(lowerQuery)) return true;
    if (item.numero_da_task && item.numero_da_task.toLowerCase().includes(lowerQuery)) return true;
    if (item.propriedade_ga4_stream_id && item.propriedade_ga4_stream_id.toLowerCase().includes(lowerQuery)) return true;
    if (item.gtm_id && item.gtm_id.toLowerCase().includes(lowerQuery)) return true;
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
