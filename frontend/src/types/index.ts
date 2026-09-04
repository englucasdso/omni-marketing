export type ArtifactType = 'MAPA' | 'DOCUMENTACAO';
export type MeasurementClass = 'GA4' | 'GA3' | 'MISTO' | 'NAO_CLASSIFICADO';
export type ScreenStatus = 'NOVO' | 'VALIDADO' | 'CORREÇÃO' | 'CORRECAO' | 'EXCLUIR' | 'DESCONTINUAR';
export type ValueType = 'PLACEHOLDER' | 'HARDCODED' | 'JAVASCRIPT_REFERENCE' | 'BOOLEAN' | 'NUMBER' | 'NULL' | 'EMPTY' | 'UNKNOWN';

export interface HeaderField {
  value: string;
  raw_label: string;
  source: string;
}

export interface SemanticHeader {
  produto_servico?: HeaderField;
  numero_task?: HeaderField;
  figma_xd?: HeaderField;
  ga4_stream_id?: HeaderField;
  firebase?: HeaderField;
  gtm_id?: HeaderField;
  dominio?: HeaderField;
  status_homologacao?: HeaderField;
  [key: string]: HeaderField | undefined;
}

export interface ParameterItem {
  name: string;
  path: string;
  raw_value: string;
  normalized_value: string;
  value_type: ValueType;
  map_id?: string;
  screen_id?: string;
}

export interface SnippetItem {
  snippet_id: string;
  map_id: string;
  screen_id: string;
  raw_code: string;
  event_raw: string;
  event_normalized: string;
  base_key: string;
  detected_paths: string[];
  signature: string[];
  pattern_id: string;
  measurement_class: MeasurementClass;
  parameters: ParameterItem[];
}

export interface ScreenItem {
  map_id: string;
  screen_id: string;
  screen_index: number;
  status_raw: string;
  status: ScreenStatus;
  instruction: string;
  image_name?: string;
  additional_information?: string;
  evidence?: string;
  snippets: SnippetItem[];
}

export interface StatusSummary {
  VALIDADO: number;
  'CORREÇÃO': number;
  NOVO: number;
  EXCLUIR: number;
  DESCONTINUAR: number;
  CORRECAO?: number;
  [key: string]: number | undefined;
}

export interface ParameterSummaryItem {
  path: string;
  name: string;
  occurrences: number;
  screens_count: number;
  distinct_values_count: number;
  distinct_values: string[];
  value_types: Record<string, number>;
}

export interface PatternSummaryItem {
  pattern_id: string;
  event: string;
  signature: string[];
  measurement_class: string;
  count: number;
  screens_count: number;
}

export interface Artifact {
  id: string;
  titulo: string;
  link: string;
  ultima_atualizacao: string;
  responsavel: string;
  versao: number | string;
  nivel: string | number;
  depth?: number;
  taxonomy_depth?: number;
  pai: string;
  parent_id?: string | null;
  parent_title?: string | null;
  ancestor_ids?: string[];
  ancestor_titles?: string[];
  full_path?: string;
  has_children?: boolean;
  children_count?: number;
  is_leaf?: boolean;
  space?: string;
  produto: string;
  subproduto: string;
  artifact_type?: ArtifactType;
  measurement_class?: MeasurementClass;
  header?: SemanticHeader;
  screens?: ScreenItem[];
  status_summary?: StatusSummary;
  declared_status?: string | null;
  calculated_status?: string;
  homologado?: boolean;
  status_divergent?: boolean;
  parameter_summary?: ParameterSummaryItem[];
  pattern_summary?: PatternSummaryItem[];
  gtm_ids?: string[];
  structural_metadata?: any;
  signature_hash?: string;
  // Retrocompatibilidade
  tipo_mapa: string;
  produto_servico?: string;
  numero_da_task?: string;
  figma_xd?: string;
  propriedade_ga4_stream_id?: string;
  firebase?: string;
  gtm_id?: string;
  dominio_exclusivo_web?: string;
}

export interface Insights {
  total: number;
  totalMaps?: number;
  totalDocs?: number;
  totalScreens?: number;
  divergentCount?: number;
  statusCounts?: StatusSummary;
  measurementCounts?: {
    GA4: number;
    GA3: number;
    MISTO: number;
    NAO_CLASSIFICADO: number;
  };
  ga4?: number;
  universalAnalytics?: number;
  mapas?: number;
  documentos?: number;
  distribProduto?: { name: string; count: number; percent: string }[];
  distribSubproduto?: { name: string; count: number; percent: string }[];
  distribTipos?: { name: string; count: number; percent: string }[];
  porcentagens?: {
    ga4: string;
    universalAnalytics: string;
    documentos: string;
  };
  updates?: {
    last30Days: number;
    last60Days: number;
    last90Days: number;
    olderThan90Days: number;
    percentLast30Days: string;
    percentLast60Days: string;
    percentLast90Days: string;
    percentOlderThan90Days: string;
  };
  versioning?: {
    topUpdated: Artifact[];
    averageVersions: string;
  };
  searchTerm?: string;
  problemas?: {
    semResponsavel: number;
    semSubproduto: number;
    foraPadraoGA4: number;
    desatualizados: number;
    nivelRisco: 'baixo' | 'medio' | 'alto';
  };
  aderencia?: {
    score: number;
    interpretacao: string;
    status: 'excelente' | 'bom' | 'atencao';
  };
  resumoInteligente?: {
    principalProduto: string;
    principalSubproduto: string;
    textoCenario: string;
    recomendacoes: string[];
  };
}

export type UserRole =
  | "admin"
  | "gestor360"
  | "estrategico"
  | "artefatos"
  | "eventos";

export type UserStatus = "ativo" | "inativo" | "active";

export interface User {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
  lastAccess?: string;
}

export interface SearchResponse {
  total: number;
  resultados: Artifact[];
  insights: Insights;
}
