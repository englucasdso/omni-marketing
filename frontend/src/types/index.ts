export interface Artifact {
  id: string;
  titulo: string;
  link: string;
  ultima_atualizacao: string;
  tipo_mapa: string;
  produto: string;
  subproduto: string;
  responsavel: string;
  versao: number;
  nivel: string;
  pai: string;
  produto_servico: string;
  numero_da_task: string;
  figma_xd: string;
  propriedade_ga4_stream_id: string;
  firebase: string;
  gtm_id: string;
  dominio_exclusivo_web: string;
}

export interface Insights {
  total: number;
  ga4: number;
  universalAnalytics: number;
  mapas: number;
  documentos: number;
  distribProduto: { name: string; count: number; percent: string }[];
  distribSubproduto: { name: string; count: number; percent: string }[];
  distribTipos: { name: string; count: number; percent: string }[];
  porcentagens: {
    ga4: string;
    universalAnalytics: string;
    documentos: string;
  };
  updates: {
    last30Days: number;
    last60Days: number;
    last90Days: number;
    olderThan90Days: number;
    percentLast30Days: string;
    percentLast60Days: string;
    percentLast90Days: string;
    percentOlderThan90Days: string;
  };
  versioning: {
    topUpdated: Artifact[];
    averageVersions: string;
  };
  searchTerm?: string;
  problemas: {
    semResponsavel: number;
    semSubproduto: number;
    foraPadraoGA4: number;
    desatualizados: number;
    nivelRisco: 'baixo' | 'medio' | 'alto';
  };
  aderencia: {
    score: number;
    interpretacao: string;
    status: 'excelente' | 'bom' | 'critico';
  };
  resumoInteligente: {
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
