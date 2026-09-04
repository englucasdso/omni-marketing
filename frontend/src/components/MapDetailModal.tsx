import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ExternalLink, FileText, CheckCircle2, AlertTriangle, AlertCircle, 
  Sparkles, Info, Layers, Tag, Code2, Copy, Check, ChevronDown, ChevronUp,
  Image as ImageIcon, HelpCircle
} from 'lucide-react';
import { Artifact, ScreenItem, SnippetItem, ParameterItem } from '../types';

interface MapDetailModalProps {
  item: Artifact | null;
  onClose: () => void;
}

export const MapDetailModal: React.FC<MapDetailModalProps> = ({ item, onClose }) => {
  const [activeTab, setActiveTab] = useState<'telas' | 'parametros' | 'cabecalho' | 'padroes'>('telas');
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [expandedScreens, setExpandedScreens] = useState<Record<string, boolean>>({});

  if (!item) return null;

  const screens = item.screens || [];
  const parameters = item.parameter_summary || [];
  const patterns = item.pattern_summary || [];
  const header = item.header || {};

  const realStatus = item.calculated_status || item.declared_status || 'NAO_IDENTIFICADO';
  const isDoc = item.artifact_type === 'DOCUMENTACAO';

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const toggleScreen = (screenId: string) => {
    setExpandedScreens(prev => ({
      ...prev,
      [screenId]: !prev[screenId]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'VALIDADO':
        return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', label: 'Validado' };
      case 'CORRECAO':
        return { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', label: 'Correção' };
      case 'NOVO':
        return { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', label: 'Novo' };
      case 'EXCLUIR':
        return { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', label: 'Excluir' };
      case 'DESCONTINUAR':
        return { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-600 dark:text-slate-400', border: 'border-gray-200 dark:border-slate-700', label: 'Descontinuar' };
      case 'PARCIAL':
        return { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', label: 'Parcial' };
      default:
        return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', label: status || 'Não Identificado' };
    }
  };

  const getValueTypeBadge = (type: string) => {
    switch (type) {
      case 'PLACEHOLDER':
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Placeholder' };
      case 'HARDCODED':
        return { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Hardcoded' };
      case 'JAVASCRIPT_REFERENCE':
        return { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'JS Ref' };
      case 'BOOLEAN':
      case 'NUMBER':
        return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: type };
      default:
        return { bg: 'bg-gray-50 text-gray-600 border-gray-200', label: type || 'String' };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="flat-card w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-neu-card border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header Modal */}
        <div className="p-6 sm:p-8 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-red-50 dark:bg-red-950/40 text-bradesco-red text-[10px] font-ui font-semibold uppercase tracking-wider rounded-full border border-red-100 dark:border-red-900/50">
                {isDoc ? 'DOCUMENTAÇÃO' : (item.measurement_class || item.tipo_mapa || 'MAPA')}
              </span>
              <span className={`px-3 py-1 text-[10px] font-ui font-semibold uppercase tracking-wider rounded-full border ${getStatusBadge(realStatus).bg} ${getStatusBadge(realStatus).text} ${getStatusBadge(realStatus).border}`}>
                {getStatusBadge(realStatus).label}
              </span>
              {item.status_divergent && (
                <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-ui font-semibold uppercase tracking-wider rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Status Divergente
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {item.link && (
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn-neu px-3 py-1.5 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-ui font-semibold transition-all flex items-center gap-1.5 cursor-pointer hover:text-bradesco-red"
                  title="Abrir no Confluence"
                >
                  Confluence <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button 
                onClick={onClose}
                className="btn-neu p-2 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl brand-title font-heading tracking-tight mb-2">
            {item.titulo}
          </h2>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-ui text-gray-500 dark:text-slate-400">
            <span><strong className="text-gray-700 dark:text-slate-300">ID:</strong> {item.id}</span>
            <span><strong className="text-gray-700 dark:text-slate-300">Produto:</strong> {item.produto || 'N/A'}</span>
            <span><strong className="text-gray-700 dark:text-slate-300">Subproduto:</strong> {item.subproduto || 'N/A'}</span>
            <span><strong className="text-gray-700 dark:text-slate-300">Responsável:</strong> {item.responsavel || 'N/A'}</span>
            <span><strong className="text-gray-700 dark:text-slate-300">Versão:</strong> {item.versao || 1}</span>
          </div>

          {/* Divergence Warning Banner */}
          {item.status_divergent && (
            <div className="mt-4 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-3 shadow-neu-card">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs font-ui text-amber-800 dark:text-amber-200">
                <strong>Atenção à governança:</strong> O status declarado no cabeçalho do mapa ({item.declared_status || 'Nenhum'}) difere do status apurado a partir das telas ({item.calculated_status}). Verifique as telas pendentes de correção ou validação abaixo.
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex-wrap">
            {[
              { id: 'telas', label: `Telas (${screens.length})`, icon: Layers },
              { id: 'parametros', label: `Parâmetros (${parameters.length})`, icon: Tag },
              { id: 'padroes', label: `Padrões (${patterns.length})`, icon: Code2 },
              { id: 'cabecalho', label: 'Cabeçalho Semântico', icon: FileText }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-ui font-semibold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-red-50 text-bradesco-red border border-red-200 dark:bg-red-950/40 dark:border-red-800 shadow-neu-raised' 
                      : 'btn-neu text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* TAB: TELAS */}
          {activeTab === 'telas' && (
            <div className="space-y-4">
              {screens.length === 0 ? (
                <div className="p-12 text-center text-gray-400 dark:text-slate-500">
                  <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-bold">Nenhuma tela estruturada encontrada neste artefato.</p>
                  <p className="text-xs">Pode se tratar de uma documentação geral ou mapa sem tabela de telas padronizada.</p>
                </div>
              ) : (
                screens.map((screen, sIdx) => {
                  const sBadge = getStatusBadge(screen.status);
                  const isExpanded = expandedScreens[screen.screen_id] !== false; // default expanded

                  return (
                    <div 
                      key={screen.screen_id || sIdx}
                      className="border border-gray-100 dark:border-slate-800 rounded-2xl p-5 bg-gray-50/40 dark:bg-slate-800/40 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-black flex items-center justify-center">
                            #{screen.screen_index || (sIdx + 1)}
                          </span>
                          <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border ${sBadge.bg} ${sBadge.text} ${sBadge.border}`}>
                            {sBadge.label}
                          </span>
                          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                            {screen.instruction || 'Tela sem instrução especificada'}
                          </span>
                        </div>

                        <button 
                          onClick={() => toggleScreen(screen.screen_id)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                          {screen.image_name && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700">
                              <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                              <span>Evidência visual: <strong>{screen.image_name}</strong></span>
                            </div>
                          )}

                          {screen.snippets && screen.snippets.length > 0 ? (
                            <div className="space-y-3">
                              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                                Snippets dataLayer ({screen.snippets.length})
                              </p>
                              {screen.snippets.map((snip, snIdx) => {
                                const isCopied = copiedSnippetId === snip.snippet_id;
                                return (
                                  <div 
                                    key={snip.snippet_id || snIdx}
                                    className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto relative group border border-slate-800"
                                  >
                                    <div className="flex items-center justify-between mb-2 text-[10px] text-slate-400 border-b border-slate-800 pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                                          {snip.event_normalized || snip.event_raw || 'evento'}
                                        </span>
                                        <span className="text-slate-400">
                                          Padrão: {snip.pattern_id || 'custom'}
                                        </span>
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] ${snip.measurement_class === 'GA4' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                                          {snip.measurement_class}
                                        </span>
                                      </div>
                                      <button 
                                        onClick={() => copyCode(snip.raw_code, snip.snippet_id)}
                                        className="flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition-colors"
                                      >
                                        {isCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                        {isCopied ? 'Copiado' : 'Copiar'}
                                      </button>
                                    </div>

                                    <pre className="text-slate-200 custom-scrollbar overflow-x-auto py-1 whitespace-pre-wrap">
                                      {snip.raw_code}
                                    </pre>

                                    {/* Parameters list for this snippet */}
                                    {snip.parameters && snip.parameters.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                        {snip.parameters.map((param, pIdx) => {
                                          const badge = getValueTypeBadge(param.value_type);
                                          return (
                                            <div key={pIdx} className="flex items-center justify-between p-1.5 bg-slate-800/50 rounded border border-slate-800">
                                              <span className="text-slate-300 font-semibold">{param.name}</span>
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-slate-400 truncate max-w-[120px]">{param.normalized_value || param.raw_value}</span>
                                                <span className={`px-1 rounded text-[9px] ${badge.bg} ${badge.label}`}>
                                                  {badge.label}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Sem snippets dataLayer catalogados nesta tela.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB: PARAMETROS */}
          {activeTab === 'parametros' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                  Total de {parameters.length} parâmetros distintos mapeados neste artefato.
                </p>
              </div>

              {parameters.length === 0 ? (
                <div className="p-12 text-center text-gray-400 dark:text-slate-500">
                  <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-bold">Nenhum parâmetro extraído deste mapa.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {parameters.map((param, pIdx) => (
                    <div 
                      key={pIdx}
                      className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-gray-900 dark:text-slate-100">
                          {param.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                          {param.occurrences}x ocorrências
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">
                        Presente em <strong>{param.screens_count}</strong> tela(s)
                      </p>
                      {param.distinct_values && param.distinct_values.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {param.distinct_values.slice(0, 5).map((val, vIdx) => (
                            <span 
                              key={vIdx} 
                              className="px-2 py-0.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-[10px] rounded border border-gray-200 dark:border-slate-600 font-mono"
                            >
                              {val}
                            </span>
                          ))}
                          {param.distinct_values.length > 5 && (
                            <span className="text-[10px] text-gray-400 self-center">
                              +{param.distinct_values.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PADROES */}
          {activeTab === 'padroes' && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
                Padrões canônicos de eventos e dataLayer reconhecidos ({patterns.length}).
              </p>

              {patterns.length === 0 ? (
                <div className="p-12 text-center text-gray-400 dark:text-slate-500">
                  <Code2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-bold">Nenhum padrão estruturado reconhecido.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patterns.map((pat, ptIdx) => (
                    <div 
                      key={ptIdx}
                      className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-900 dark:text-slate-100">
                            {pat.event}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900">
                            {pat.pattern_id}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-gray-500">
                          {pat.count}x em {pat.screens_count} telas
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-slate-400">
                        <strong>Assinatura de campos:</strong>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pat.signature && pat.signature.map((sig, sIdx) => (
                            <span key={sIdx} className="px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 rounded font-mono text-[10px]">
                              {sig}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: CABECALHO SEMANTICO */}
          {activeTab === 'cabecalho' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Produto / Serviço', field: header.produto_servico, fallback: item.produto_servico },
                  { label: 'Número da Task', field: header.numero_task, fallback: item.numero_da_task },
                  { label: 'Figma / XD', field: header.figma_xd, fallback: item.figma_xd, isLink: true },
                  { label: 'Propriedade GA4 Stream ID', field: header.ga4_stream_id, fallback: item.propriedade_ga4_stream_id },
                  { label: 'Firebase', field: header.firebase, fallback: item.firebase },
                  { label: 'GTM ID', field: header.gtm_id, fallback: item.gtm_id },
                  { label: 'Domínio Exclusivo Web', field: header.dominio, fallback: item.dominio_exclusivo_web },
                  { label: 'Status Homologação Declarado', field: header.status_homologacao, fallback: item.declared_status }
                ].map((itemDef, idx) => {
                  const val = itemDef.field?.value || itemDef.fallback || '-';
                  const rawLabel = itemDef.field?.raw_label;
                  const source = itemDef.field?.source;

                  return (
                    <div 
                      key={idx}
                      className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30"
                    >
                      <p className="text-[10px] font-black uppercase text-gray-400 dark:text-slate-500 tracking-wider mb-1">
                        {itemDef.label}
                      </p>
                      {itemDef.isLink && val !== '-' ? (
                        <a href={val} target="_blank" rel="noreferrer" className="text-xs font-bold text-red-600 hover:underline break-all inline-flex items-center gap-1">
                          {val} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100 break-all">
                          {val}
                        </p>
                      )}
                      {rawLabel && (
                        <p className="text-[9px] text-gray-400 mt-2">
                          Rótulo original no mapa: <em>"{rawLabel}"</em> ({source || 'tabela'})
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="text-xs font-ui text-gray-400 dark:text-slate-500">
            Última sincronização no Confluence: {item.ultima_atualizacao || 'N/A'}
          </div>
          <button 
            onClick={onClose}
            className="btn-neu px-6 py-2 text-gray-800 dark:text-slate-100 rounded-xl font-ui font-semibold text-xs hover:text-bradesco-red transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};
