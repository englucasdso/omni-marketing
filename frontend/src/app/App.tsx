/**
 * Arquivo: frontend/src/App.tsx
 * Propósito: Componente principal ("A casca" e o "coração" da tela).
 * É aqui que a mágica visual acontece:
 * 1. Controla qual "visão" entregar ao usuário (Buscador, Cards, Inventário, Insights ou Mapa de Conexões).
 * 2. Gerencia os "Estados" - Toda vez que o estado muda (ex: setAppState("insights")),
 *    o React redesenha a tela instantaneamente usando essas novas informações.
 * 3. Componentiza Modal de Exportar Tabela, Sidebar de Usuário e Admin de Usuários.
 * 
 * Importante: Lógicas pesadas de conta e busca (exclusões e levenshtein) 
 * devem morar no Backend. O frontend repassa ordens (api.ts) e obedece
 * os dados JSON que voltam da porta 3000.
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation, Routes, Route } from "react-router-dom";
import { X, AlertTriangle, Target, Network, Filter, CheckCircle2, AlertCircle, Clock, User, Info, Shield, LogOut, Trash2, Plus, Settings, Landmark, LayoutList, RefreshCw, Check, Loader2, KeyRound, Activity, ArrowRight, Search, ChevronDown, ChevronUp, ChevronLeft, ExternalLink, Download, Sparkles, FileText, Layers, Tag, Code2, Eye } from "lucide-react";
import { ConexoesCanvas } from "../components/ConexoesCanvas";
import { getOperationalInsights } from "../utils/inventoryHelpers";
import { fetchInventory, searchContent, fetchUsers, createUser, updateUser, deleteUser } from "../services/api";
import { Artifact, Insights, SearchResponse, User as UserType, UserRole, UserStatus } from "../types";
import { normalizar, formatDataBR, getFilteredInsights } from "../utils/helpers";
import { MultiSelect } from "../components/MultiSelect";
import { TypewriterText } from "../components/TypewriterText";
import { MapDetailModal } from "../components/MapDetailModal";
import { ProductAnalysisView } from "../components/ProductAnalysisView";
import { ParameterAnalysisView } from "../components/ParameterAnalysisView";
import { CanonicalInsightsDashboard } from "../components/CanonicalInsightsDashboard";

// Espaçamento lateral global reutilizado no cabeçalho e rodapé para alinhamento no mesmo eixo vertical
const GLOBAL_SCREEN_PADDING = "px-6 sm:px-8";

const INITIAL_USERS: UserType[] = [
  {
    id: '1',
    name: 'Lucas Admin',
    email: 'lucas.doliveira@bradesco.com.br',
    role: 'admin',
    status: 'ativo',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Usuário Teste',
    email: 'teste@bradesco.com.br',
    role: 'gestor360',
    status: 'ativo',
    createdAt: new Date().toISOString()
  }
];

const GraphView = ({ data, isEmbedded = false, onClose }: { data: Artifact[], isEmbedded?: boolean, onClose?: () => void }) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = data.find(i => i.id === selectedItemId);

  const content = (
    <>
      <div className="flex-1 rounded-[40px] overflow-hidden border border-gray-100 dark:border-slate-700/50 shadow-sm relative w-full h-[calc(100vh-250px)] min-h-[600px] flex">
        <ConexoesCanvas data={data} selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} />
      </div>

      {/* Details side panel remains same or slightly adjusted */}
      <AnimatePresence>
        {selectedItemId && selectedItem && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={`fixed top-0 right-0 h-full w-[500px] bg-white dark:bg-slate-900 dark:border-slate-800 border-l border-gray-100 dark:border-slate-700 shadow-2xl dark:shadow-none p-10 flex flex-col custom-scrollbar overflow-auto transition-all ${isEmbedded ? 'z-[90]' : 'z-[70]'}`}
          >
            <div className="flex justify-between items-center mb-10">
              <div className="px-5 py-2 bg-red-50 text-bradesco-red rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                Detalhamento do Mapa
              </div>
              <button onClick={() => setSelectedItemId(null)} className="p-3 hover:bg-gray-100 dark:bg-slate-700 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400 dark:text-slate-500" />
              </button>
            </div>

            <h3 className="text-3xl font-black text-gray-900 dark:text-slate-50 leading-tight mb-8 tracking-tight">
              {selectedItem.titulo}
            </h3>

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-gray-50 dark:bg-slate-800 rounded-[32px] border border-gray-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">ID do Mapa</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{selectedItem.id}</p>
                </div>
                <div className="p-6 bg-gray-50 dark:bg-slate-800 rounded-[32px] border border-gray-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Nível de Taxonomia</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{selectedItem.taxonomy_depth || selectedItem.nivel || "1"}</p>
                </div>
              </div>

              <div className="p-8 glass-card rounded-[40px] border border-gray-100 dark:border-slate-700">
                 <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                       <Landmark className="w-6 h-6" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Produto / Subproduto</p>
                       <p className="text-base font-bold text-gray-800 dark:text-slate-200">{selectedItem.produto} → {selectedItem.subproduto}</p>
                    </div>
                 </div>

                 <div className="pt-8 border-t border-gray-100 dark:border-slate-700 grid grid-cols-2 gap-8">
                    <div>
                       <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">GTM ID</p>
                       <p className="text-[13px] font-mono font-bold text-[#cc092f] bg-red-50 px-3 py-1.5 rounded-xl inline-block border border-red-100">{selectedItem.gtm_id || "-"}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Responsável Técnica</p>
                       <p className="text-[13px] font-bold text-gray-800 dark:text-slate-200">{selectedItem.responsavel || "N/A"}</p>
                    </div>
                    
                    <div className="col-span-2 pt-6 border-t border-gray-50 dark:border-slate-800 grid grid-cols-2 gap-8">
                      <div>
                         <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">GA4 Stream ID</p>
                         <p className="text-[13px] font-mono font-bold text-gray-800 dark:text-slate-200">{selectedItem.propriedade_ga4_stream_id || "-"}</p>
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Firebase</p>
                         <p className="text-[13px] font-mono font-bold text-gray-800 dark:text-slate-200">{selectedItem.firebase || "-"}</p>
                      </div>
                    </div>
                    
                    <div className="col-span-2 pt-6 border-t border-gray-50 dark:border-slate-800 flex flex-col gap-4">
                      <div>
                         <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Nº Task</p>
                         <p className="text-[13px] font-bold text-gray-800 dark:text-slate-200">{selectedItem.numero_da_task || "-"}</p>
                      </div>
                      {selectedItem.figma_xd && selectedItem.figma_xd !== "-" && (
                        <div>
                           <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Figma / UI</p>
                           <a href={selectedItem.figma_xd} target="_blank" rel="noreferrer" className="text-[13px] font-black text-purple-600 hover:text-purple-800 hover:underline">
                             Abrir Protótipo Visual
                           </a>
                        </div>
                      )}
                    </div>
                 </div>
              </div>

              {selectedItem.link && (
                <button 
                  onClick={() => window.open(selectedItem.link, '_blank')}
                  className="w-full py-6 bg-bradesco-gradient text-white rounded-[32px] font-black text-xs uppercase tracking-widest shadow-xl dark:shadow-none shadow-red-200 hover:opacity-95 transition-all flex items-center justify-center gap-2"
                >
                  Abrir Documentação GA <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="mt-auto pt-10 text-center">
              <p className="text-[10px] font-black text-gray-200 uppercase tracking-[0.3em]">Hub de Artefatos</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
  if (isEmbedded) {
    return <div className="flex flex-col h-[800px] min-h-[800px]">{content}</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-white dark:bg-slate-900 dark:border-slate-800 backdrop-blur-3xl p-12 flex flex-col"
    >
      <div className="flex justify-between items-center mb-12 px-4 max-w-7xl mx-auto w-full">
         <div className="flex items-center gap-4">
            <h1 className="brand-text text-2xl font-black tracking-tight text-gray-900 dark:text-slate-50 transition-colors">
              Hub de Artefatos
            </h1>
         </div>
         <button onClick={() => { if (onClose) onClose(); }} className="p-4 hover:bg-gray-100 dark:bg-slate-700 rounded-full transition-all hover:rotate-90">
            <X className="w-6 h-6 text-gray-400 dark:text-slate-500" />
         </button>
      </div>
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {content}
      </div>
    </motion.div>
  );
};

const AdminUsers = ({ users, onAddUser, onUpdateUser, onDeleteUser, onClose }: { 
  users: UserType[], 
  onAddUser: (u: Omit<UserType, 'id' | 'createdAt'>) => void,
  onUpdateUser: (u: UserType) => void,
  onDeleteUser: (id: string) => void,
  onClose: () => void 
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [formData, setFormData] = useState({ name: '', nickname: '', email: '', role: 'gestor360' as UserRole, status: 'ativo' as UserStatus });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate corporate email if needed, but not strictly asked, just "if applicable". Simple check could be `@bradesco.com.br` but we can leave without it or add a quick logic
    if (editingUser) {
      onUpdateUser({ ...editingUser, ...formData });
      setEditingUser(null);
    } else {
      onAddUser(formData);
      setShowAddForm(false);
    }
    setFormData({ name: '', nickname: '', email: '', role: 'gestor360', status: 'ativo' });
  };

  const startEdit = (user: UserType) => {
    setEditingUser(user);
    setFormData({ name: user.name, nickname: user.nickname || '', email: user.email, role: user.role, status: user.status || 'ativo' });
    setShowAddForm(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-white dark:bg-slate-900 dark:border-slate-800 backdrop-blur-xl p-8 flex flex-col"
    >
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-medium tracking-tight text-gray-900 dark:text-slate-50">Gestão de Usuários</h2>
            <p className="text-gray-500 dark:text-slate-400">Controle de acesso e permissões da plataforma</p>
          </div>
          <div className="flex items-center gap-4">
             {!showAddForm && (
                <button 
                  onClick={() => { setShowAddForm(true); setEditingUser(null); setFormData({ name: '', nickname: '', email: '', role: 'gestor360', status: 'ativo' }); }}
                  className="flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl dark:shadow-none shadow-red-200"
                   style={{ background: 'linear-gradient(90deg, #7D046D 0%, #cc092f 100%)' }}
                >
                  <Plus className="w-4 h-4" /> Novo Usuário
                </button>
             )}
            <button onClick={onClose} className="p-4 hover:bg-gray-100 dark:bg-slate-700 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {showAddForm ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-10 rounded-[40px] max-w-lg mx-auto">
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-50 mb-6">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-4">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:bg-slate-900 dark:border-slate-800 focus:border-bradesco-red transition-all font-medium text-gray-800 dark:text-slate-200"
                  placeholder="Nome do colaborador"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-4">Apelido (Opcional)</label>
                <input 
                  type="text" 
                  value={formData.nickname}
                  onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:bg-slate-900 dark:border-slate-800 focus:border-bradesco-red transition-all font-medium text-gray-800 dark:text-slate-200"
                  placeholder="Apelido/Nome de exibição"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-4">E-mail Corporativo</label>
                <input 
                  required
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:bg-slate-900 dark:border-slate-800 focus:border-bradesco-red transition-all font-medium text-gray-800 dark:text-slate-200"
                  placeholder="email@bradesco.com.br"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-4">Perfil de Acesso</label>
                <select 
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:bg-slate-900 dark:border-slate-800 focus:border-bradesco-red transition-all font-medium text-gray-800 dark:text-slate-200 appearance-none"
                >
                  <option value="gestor360">GESTOR 360 (Acesso Completo)</option>
                  <option value="estrategico">ESTRATÉGICO (Visão Estratégica)</option>
                  <option value="artefatos">ARTEFATOS (Hub de Artefatos)</option>
                  <option value="eventos">EVENTOS (Hub de Eventos)</option>
                  <option value="admin">ADMIN (Gestão Total)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-4">Status</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as UserStatus })}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:bg-slate-900 dark:border-slate-800 focus:border-bradesco-red transition-all font-medium text-gray-800 dark:text-slate-200 appearance-none"
                >
                  <option value="ativo">ATIVO</option>
                  <option value="inativo">INATIVO</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-8 py-4 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 dark:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-8 py-4 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl dark:shadow-none shadow-red-200"
                  style={{ background: 'linear-gradient(90deg, #7D046D 0%, #cc092f 100%)' }}
                >
                  {editingUser ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <div className="glass-card overflow-hidden rounded-[40px] border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 dark:border-slate-800">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                  <th className="p-6 text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest">NOME / APELIDO</th>
                  <th className="p-6 text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest">E-MAIL</th>
                  <th className="p-6 text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest">PERFIL</th>
                  <th className="p-6 text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest">STATUS</th>
                  <th className="p-6 text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:bg-slate-800/50 transition-colors">
                    <td className="p-6">
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-50">{u.name}</p>
                      {u.nickname && <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">({u.nickname})</p>}
                    </td>
                    <td className="p-6 text-sm text-gray-500 dark:text-slate-400">{u.email}</td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-slate-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'ativo' || u.status === 'active' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        {u.status === 'ativo' || u.status === 'active' ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td className="p-6 text-right space-x-2">
                       <button onClick={() => startEdit(u)} className="p-2 text-gray-400 dark:text-slate-500 hover:text-bradesco-red transition-colors">Editar</button>
                       {users.length > 1 && (
                         <button onClick={() => onDeleteUser(u.id)} className="p-2 text-gray-400 dark:text-slate-500 hover:text-bradesco-red transition-colors"><Trash2 className="w-4 h-4" /></button>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const AuthScreen = ({ onLogin, onCancel }: { onLogin: (u: string, p: string) => void, onCancel: () => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("Por favor, preencha usuário e senha.");
      return;
    }
    onLogin(username, password);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900 dark:bg-slate-50/60 backdrop-blur-md"
    >
      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-[40px] p-12 max-w-md w-full shadow-2xl dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-bradesco-gradient" />
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mb-6 text-bradesco-red shadow-sm dark:shadow-none">
             <KeyRound className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-slate-50 tracking-tight mb-2">
            Autenticação Confluence
          </h2>
          <p className="text-gray-500 dark:text-slate-400 font-medium mb-8 text-sm">
            Faça login para permitir a sincronização
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4 mb-2 text-left">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Usuário</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-bradesco-red focus:border-bradesco-red outline-none transition-all placeholder:text-gray-400 dark:text-slate-500"
                placeholder="Ex: i462211"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Senha</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-bradesco-red focus:border-bradesco-red outline-none transition-all placeholder:text-gray-400 dark:text-slate-500"
                placeholder="Sua senha corporativa"
              />
            </div>
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl font-medium border border-red-100 text-center">
                {errorMsg}
              </div>
            )}
            <div className="pt-4 flex flex-col gap-3">
              <button 
                type="submit"
                className="px-8 py-3 rounded-full font-bold transition-colors text-sm uppercase tracking-wider bg-bradesco-red text-white hover:bg-black w-full"
              >
                Continuar
              </button>
              <button 
                type="button"
                onClick={onCancel}
                className="px-8 py-3 rounded-full font-bold transition-colors text-sm uppercase tracking-wider bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:bg-slate-700 w-full"
              >
                Voltar para busca
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

const SyncWidget = ({ job, onCancel }: { job: any, onCancel: () => void }) => {
  if (!job.active) return null;
  
  const stepsText = [
    "Conectando ao ambiente de documentação...",
    "Mapeando estrutura de produtos...",
    "Organizando artefatos e métricas...",
    "Atualizando base de conhecimento local...",
    "Concluído"
  ];
  
  const percentage = Math.min(100, Math.round(((job.step + 1) / 5) * 100));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }} 
      animate={{ opacity: 1, y: 0, scale: 1 }} 
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className="fixed bottom-6 right-6 z-[100] bg-white dark:bg-slate-900 dark:border-slate-800 rounded-2xl shadow-2xl dark:shadow-none border border-gray-100 dark:border-slate-700 p-4 w-80 flex flex-col gap-3 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 dark:bg-slate-700">
        <div 
          className={`h-full transition-all duration-500 ease-out ${job.status === 'error' ? 'bg-red-500' : job.status === 'success' ? 'bg-green-500' : 'bg-bradesco-red'}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex items-start justify-between mt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
             {job.status === "running" && <Loader2 className="w-5 h-5 text-bradesco-red animate-spin" />}
             {job.status === "success" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
             {job.status === "error" && <AlertTriangle className="w-5 h-5 text-red-500" />}
          </div>
          <div className="flex flex-col flex-1">
            <span className="font-bold text-gray-900 dark:text-slate-50 text-sm">
              {job.status === "running" ? "Sincronizando..." : job.status === "success" ? "Concluído" : "Falha na Sincronização"}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
              {job.status === "error" ? "Não foi possível concluir" : stepsText[job.step] || `${percentage}% concluído`}
            </span>
          </div>
        </div>
      </div>
      
      {job.status === "error" && (
        <div className="text-[10px] text-red-600 font-medium bg-red-50 p-2 rounded-lg mt-1">
          {job.errorMsg}
        </div>
      )}
      
      {job.status === "running" && (
        <button 
          onClick={onCancel}
          className="text-[10px] font-bold text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors w-full text-left flex items-center gap-1.5 px-1 py-1 mt-1 uppercase tracking-wider"
        >
          <X className="w-3 h-3" /> Cancelar processo
        </button>
      )}
    </motion.div>
  );
};

const AIReveal = ({ isLoading, children }: { isLoading: boolean, children: React.ReactNode }) => {
  return (
    <div className="relative w-full">
      {children}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-40 pointer-events-none bg-white dark:bg-slate-900 dark:border-slate-800/40 backdrop-blur-[1px]"
          >
             <div className="absolute top-0 left-0 w-full h-[2px] overflow-hidden">
               <div className="w-full h-full bg-gradient-to-r from-transparent via-purple-500/50 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('omni_dark_mode');
    localStorage.removeItem('cortex_current_user');
  }, []);

  const [query, setQuery] = useState("");
  const [usersDb, setUsersDb] = useState<UserType[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [results, setResults] = useState<Artifact[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [rawAppState, setRawAppState] = useState<"home" | "catalog" | "initial" | "results" | "decision" | "insights" | "empty" | "inventory_table" | "graph" | "auth" | "syncing" | "events_capture" | "operational_insights" | "copilot" | "produtos_analise" | "parametros_analise">("initial");
  const appState = rawAppState;

  const [insightsActiveTab, setRawInsightsActiveTab] = useState<"indicadores" | "resumo_executivo">("indicadores");
  const [detailModalItem, setDetailModalItem] = useState<Artifact | null>(null);

  const setAppState = (newState: typeof rawAppState, updateUrl = true) => {
    setRawAppState(newState);
    if (!updateUrl) return;
    
    if (newState === 'initial' || newState === 'home') navigate('/hub-de-artefatos');
    else if (newState === 'results') navigate('/hub-de-artefatos/cards');
    else if (newState === 'inventory_table') navigate('/hub-de-artefatos/inventario');
    else if (newState === 'produtos_analise') navigate('/hub-de-artefatos/por-produto');
    else if (newState === 'parametros_analise') navigate('/hub-de-artefatos/por-parametro');
    else if (newState === 'insights' && insightsActiveTab === 'indicadores') navigate('/hub-de-artefatos/insights');
    else if (newState === 'insights' && insightsActiveTab === 'resumo_executivo') navigate('/hub-de-artefatos/insights/resumo-executivo');
    else if (newState === 'operational_insights') navigate('/hub-de-artefatos/insights-operacionais');
    else if (newState === 'graph') navigate('/hub-de-artefatos/conexoes');
    else if (newState === 'empty' || newState === 'decision') navigate('/hub-de-artefatos');
  };

  const setInsightsActiveTab = (tab: "indicadores" | "resumo_executivo", updateUrl = true) => {
    setRawInsightsActiveTab(tab);
    if (!updateUrl) return;
    if (tab === 'indicadores' && appState === 'insights') navigate('/hub-de-artefatos/insights');
    else if (tab === 'resumo_executivo' && appState === 'insights') navigate('/hub-de-artefatos/insights/resumo-executivo');
  };

  // Sync state from URL
  useEffect(() => {
    const p = location.pathname;
    if (p === '/' || p === '/home') {
      setRawAppState('initial');
      navigate('/hub-de-artefatos', { replace: true });
      if (p === '/home') setShowAdmin(false);
    } else if (p === '/home/gestao-de-usuarios') {
      setRawAppState('initial');
      setShowAdmin(true);
    } else if (p === '/overview' || p === '/hub-de-eventos') {
      setRawAppState('initial');
      navigate('/hub-de-artefatos', { replace: true });
    } else if (p === '/hub-de-artefatos') {
      if (!['initial', 'empty', 'decision', 'results', 'home'].includes(appState)) {
        setRawAppState('initial');
      }
    } else if (p === '/hub-de-artefatos/cards') {
      setRawAppState('results');
    } else if (p === '/hub-de-artefatos/inventario') {
      setRawAppState('inventory_table');
    } else if (p === '/hub-de-artefatos/por-produto') {
      setRawAppState('produtos_analise');
    } else if (p === '/hub-de-artefatos/por-parametro') {
      setRawAppState('parametros_analise');
    } else if (p === '/hub-de-artefatos/insights') {
      setRawAppState('insights');
      setRawInsightsActiveTab('indicadores');
    } else if (p === '/hub-de-artefatos/insights/resumo-executivo') {
      setRawAppState('insights');
      setRawInsightsActiveTab('resumo_executivo');
    } else if (p === '/hub-de-artefatos/insights-operacionais') {
      setRawAppState('operational_insights');
    } else if (p === '/hub-de-artefatos/conexoes') {
      setRawAppState('graph');
    } else {
      // Not found handling / default
      if (p !== '/hub-de-artefatos' && p !== '/') {
        navigate('/hub-de-artefatos', { replace: true });
      }
    }
  }, [location.pathname]);

  const [showSummary, setShowSummary] = useState(false);
  const [capturePlatform, setCapturePlatform] = useState<string | null>(null);
  const [syncCredentials, setSyncCredentials] = useState({ username: "", password: "" });
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('last_sync'));
  const [showExportModal, setShowExportModal] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showExecutiveModal, setShowExecutiveModal] = useState(false);

  const [executiveSummaryParams, setExecutiveSummaryParams] = useState<any>(null);
  const [executiveSummaryResult, setExecutiveSummaryResult] = useState<any>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const [fullInventory, setFullInventory] = useState<Artifact[]>([]);

  useEffect(() => {
    if ((appState === "operational_insights" || appState === "home") && fullInventory.length === 0) {
      setLoading(true);
      fetchInventory()
        .then((res) => {
          setFullInventory(res.resultados);
        })
        .catch((e) => console.error(e))
        .finally(() => setLoading(false));
    }
  }, [appState, fullInventory.length]);

  useEffect(() => {
    if (appState === "inventory_table" && results.length === 0 && !loading && !isSearchingRef.current && (query === "" || query === "inventario")) {
      executeSearch("inventario");
    }
  }, [appState, results.length, loading]);


  const { recentActivities, chartData } = useMemo(() => getOperationalInsights(fullInventory), [fullInventory]);

  const handleBarClick = (items: Artifact[]) => {
    if(items.length === 0) return;
    setResults(items);
    setAppState("results");
  };

  const handleActivityClick = (item: Artifact) => {
    setResults([item]);
    setAppState("results");
  };
  


  const [insightFilters, setInsightFilters] = useState({ ga: 'all', produto: 'all', subproduto: 'all' });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const [inventoryViewMode, setInventoryViewMode] = useState<'table' | 'panel'>('table');
  
  const [syncJob, setSyncJob] = useState<{
    active: boolean;
    step: number; 
    status: "running" | "success" | "error";
    errorMsg: string;
  }>({ active: false, step: 0, status: "running", errorMsg: "" });

  const startBackgroundSync = async (u: string, p: string) => {
    setSyncJob({ active: true, step: 0, status: "running", errorMsg: "" });

    const timer1 = setTimeout(() => setSyncJob(s => s.status === 'running' ? {...s, step: 1} : s), 1500); 
    const timer2 = setTimeout(() => setSyncJob(s => s.status === 'running' ? {...s, step: 2} : s), 12000); 
    const timer3 = setTimeout(() => setSyncJob(s => s.status === 'running' ? {...s, step: 3} : s), 35000); 

    try {
      const res = await fetch("/api/update-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootId: "1542391004", maxRows: null, username: u, password: p })
      });
      
      const data = await res.json();
      
      clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3);
      
      if (!res.ok) {
         throw new Error(data.error || "Falha na sincronização");
      }
      
      setSyncJob(s => ({ ...s, step: 4, status: "success" }));
      const now = new Date().toLocaleString('pt-BR');
      localStorage.setItem('last_sync', now);
      setLastSync(now);
      
      setTimeout(() => {
        setSyncJob(s => ({ ...s, active: false }));
      }, 10000);
    } catch (err: any) {
      clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3);
      setSyncJob(s => ({ ...s, status: "error", errorMsg: err.message || "Erro desconhecido" }));
      setTimeout(() => {
        setSyncJob(s => ({ ...s, active: false }));
      }, 10000);
    }
  };

  const cancelSyncJob = async () => {
    try {
      await fetch("/api/cancel-inventory", { method: "POST" });
    } catch(e) {}
    setSyncJob({ active: false, step: 0, status: "running", errorMsg: "" });
  };

  
  // Advanced Inventory State
  const [inventoryFilters, setInventoryFilters] = useState<Record<string, string[]>>({
    tipo_mapa: [],
    produto: [],
    subproduto: [],
    responsavel: [],
    measurement_class: [],
    parametro: [],
    ano: []
  });
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [onlyWithoutResponsible, setOnlyWithoutResponsible] = useState(false);
  const [onlyWithoutSubproduct, setOnlyWithoutSubproduct] = useState(false);
  const [inventorySort, setInventorySort] = useState<{
    field: keyof Artifact | string;
    direction: 'asc' | 'desc';
  }>({ field: 'null', direction: 'desc' });

  // Quick Chips logic
  const [activeChip, setActiveChip] = useState('Todos');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleBack = () => {
    switch (appState) {
      case 'events_capture':
        if (capturePlatform) {
          setCapturePlatform(null);
        } else {
          setAppState('initial');
        }
        break;
      case 'inventory_table':
      case 'results':
      case 'graph':
      case 'insights':
      case 'decision':
      case 'empty':
      case 'operational_insights':
      case 'produtos_analise':
      case 'parametros_analise':
        setAppState('initial');
        break;
      case 'initial':
      case 'home':
      case 'catalog':
      default:
        setAppState('initial');
    }
  };

  useEffect(() => {
    // Connect to Users API
    fetchUsers().then(users => {
      setUsersDb(users);
    }).catch(err => {
      console.error("Failed to load users:", err);
    });
  }, []);

  const handleAddUser = async (userData: Omit<UserType, 'id' | 'createdAt'>) => {
    try {
      const newUser = await createUser(userData);
      const updatedUsers = await fetchUsers();
      setUsersDb(updatedUsers);
    } catch (err: any) {
      alert(err.message || "Erro ao adicionar usuário.");
    }
  };

  const handleUpdateUser = async (updated: UserType) => {
    try {
      await updateUser(updated.id, updated);
      const updatedUsers = await fetchUsers();
      setUsersDb(updatedUsers);
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar usuário.");
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id);
      const updatedUsers = await fetchUsers();
      setUsersDb(updatedUsers);
    } catch (err: any) {
      alert(err.message || "Erro ao deletar usuário.");
    }
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [query]);

  const toggleDetails = (id: string) => {
    const next = new Set(expandedCards);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCards(next);
  };

  /**
   * Realiza a busca quando o usuário clica em Enter ou no ícone da Lupa.
   * Ele usa as rotas da API que definimos no backend.
   * Se o usuário digitar "Tudo" (ou a variação base), ele busca os insights completos.
   * Caso contrário, ele busca com base em palavras exatas.
   * @param overrideQuery - Se passado, sobrepõe o texto digitado (usado ao clicar nos atalhos)
   */
  const isSearchingRef = useRef(false);

  const executeSearch = async (overrideQuery?: string) => {
    if (isSearchingRef.current || loading) return;

    const q = overrideQuery ?? query;
    if (!q.trim()) return;

    const normalizedQ = normalizar(q);
    const syncIntents = [
      "atualizar inventario", "atualizar inventário", "atualizar confluence", "atualizar confluencia", "atualizar confluência",
      "sincronizar confluence", "sincronizar confluencia", "sincronizar confluência", "sincronizar inventario", "sincronizar inventário",
      "sync confluence", "atualizar base"
    ];

    if (syncIntents.some(intent => normalizedQ.includes(normalizar(intent)))) {
      setAppState("auth");
      return;
    }

    isSearchingRef.current = true;
    setLoading(true);
    setAppState("results");
    setResults([]);
    setExpandedCards(new Set());
    setInsightFilters({ ga: 'all', produto: 'all', subproduto: 'all' });
    setExecutiveSummaryResult(null);
    setInsightsActiveTab("indicadores");

    // Artificial delay to show animations
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const normalizedQ = normalizar(q);
      const isInventory = normalizedQ.includes("inventario") || 
                        normalizedQ.includes("base completa") || 
                        normalizedQ.includes("lista") || 
                        normalizedQ.includes("todos os dados") ||
                        normalizedQ.includes("relatorio geral");

      const data: SearchResponse = isInventory 
        ? await fetchInventory() 
        : await searchContent(q);

      setResults(data.resultados);
      setInsights(getFilteredInsights(data.resultados, q) || null);

      if (isInventory) {
        setAppState("inventory_table");
      } else if (data.total === 0) {
        setAppState("empty");
      } else if (data.total === 1) {
        setAppState("inventory_table");
        setDetailModalItem(data.resultados[0]);
      } else {
        setAppState("results");
      }
    } catch (error) {
      console.error("Search failed", error);
      setAppState("empty");
    } finally {
      setLoading(false);
      isSearchingRef.current = false;
    }
  };

  const applyInsightFilters = () => {
    let filtered = [...results];
    if (insightFilters.ga !== 'all') {
      filtered = filtered.filter(item => normalizar(item.tipo_mapa) === insightFilters.ga);
    }
    if (insightFilters.produto !== 'all') {
      filtered = filtered.filter(item => item.produto === insightFilters.produto);
    }
    if (insightFilters.subproduto !== 'all') {
      filtered = filtered.filter(item => item.subproduto === insightFilters.subproduto);
    }
    setInsights(getFilteredInsights(filtered, query));
  };

  useEffect(() => {
    if (appState === "insights") {
      applyInsightFilters();
    }
  }, [insightFilters, appState]);

  const handleGenerateExecutiveSummary = async () => {
    setIsGeneratingSummary(true);
    setShowExecutiveModal(false);
    try {
      const response = await fetch("/api/insights/executive-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifacts: results,
          term: query,
          context: "Geração de resumo executivo pelo Hub de Artefatos"
        })
      });

      if (!response.ok) throw new Error("Erro na rede ou IA insdisponível");
      const data = await response.json();
      setExecutiveSummaryResult(data);
      setInsightsActiveTab("resumo_executivo");
    } catch (e: any) {
      alert("Erro ao gerar resumo: " + e.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Inventory Logic - Computed Filtered & Sorted Results
  const filteredInventory = useMemo(() => {
    let base = [...results];

    // Global Search
    if (tableFilter) {
      const lowFilter = normalizar(tableFilter);
      const searchWords = lowFilter.split(/\s+/).filter(Boolean);
      base = base.filter(item => {
        const rowContent = normalizar(Object.values(item).join(" "));
        return searchWords.every(word => rowContent.includes(word));
      });
    }

    // Quick Chips (shortcuts)
    if (activeChip === 'Mapas') {
      base = base.filter(i => (i.artifact_type === 'MAPA' || (normalizar(i.tipo_mapa) !== 'doc' && i.artifact_type !== 'DOCUMENTACAO')));
    }
    if (activeChip === 'Documentações') {
      base = base.filter(i => (i.artifact_type === 'DOCUMENTACAO' || normalizar(i.tipo_mapa) === 'doc'));
    }
    if (activeChip === 'GA4') {
      base = base.filter(i => (i.measurement_class === 'GA4' || normalizar(i.tipo_mapa) === 'ga4'));
    }
    if (activeChip === 'GA3') {
      base = base.filter(i => (i.measurement_class === 'GA3' || normalizar(i.tipo_mapa) === 'ga3' || normalizar(i.tipo_mapa) === 'universal analytics'));
    }

    // Secondary Detailed Filters
    if (onlyWithoutResponsible) {
      base = base.filter(i => !i.responsavel || i.responsavel === '-');
    }
    if (onlyWithoutSubproduct) {
      base = base.filter(i => !i.subproduto || i.subproduto === '-');
    }
    if (onlyDivergent) {
      base = base.filter(i => i.status_divergent === true);
    }

    // Independent Multidimensional Filters
    if (inventoryFilters.tipo_mapa && inventoryFilters.tipo_mapa.length > 0) {
      base = base.filter(i => {
        const t = (i.artifact_type || (normalizar(i.tipo_mapa) === 'doc' ? 'DOCUMENTACAO' : 'MAPA')).toUpperCase();
        return inventoryFilters.tipo_mapa.includes(t);
      });
    }
    if (inventoryFilters.measurement_class && inventoryFilters.measurement_class.length > 0) {
      base = base.filter(i => {
        const m = (i.measurement_class || (normalizar(i.tipo_mapa) === 'ga4' ? 'GA4' : normalizar(i.tipo_mapa) === 'universal analytics' ? 'GA3' : 'NAO_CLASSIFICADO')).toUpperCase();
        return inventoryFilters.measurement_class.includes(m);
      });
    }
    if (inventoryFilters.produto && inventoryFilters.produto.length > 0) {
      base = base.filter(i => inventoryFilters.produto.includes(i.produto || ""));
    }
    if (inventoryFilters.subproduto && inventoryFilters.subproduto.length > 0) {
      base = base.filter(i => inventoryFilters.subproduto.includes(i.subproduto || ""));
    }
    if (inventoryFilters.responsavel && inventoryFilters.responsavel.length > 0) {
      base = base.filter(i => inventoryFilters.responsavel.includes(i.responsavel || ""));
    }
    if (inventoryFilters.parametro && inventoryFilters.parametro.length > 0) {
      base = base.filter(i => (i.parameter_summary || []).some(p => inventoryFilters.parametro.includes(p.name)));
    }
    if (inventoryFilters.ano && inventoryFilters.ano.length > 0) {
      base = base.filter(i => {
        const date = new Date(i.ultima_atualizacao);
        return inventoryFilters.ano.includes(date.getFullYear().toString());
      });
    }

    // Sorting
    if (inventorySort.field !== 'null') {
      base.sort((a, b) => {
        let valA = '';
        let valB = '';
        if (inventorySort.field === 'artifact_type') {
          valA = (a.artifact_type === 'DOCUMENTACAO' || normalizar(a.tipo_mapa) === 'doc') ? 'Documentação' : 'Mapa';
          valB = (b.artifact_type === 'DOCUMENTACAO' || normalizar(b.tipo_mapa) === 'doc') ? 'Documentação' : 'Mapa';
        } else if (inventorySort.field === 'measurement_class') {
          valA = a.measurement_class || (normalizar(a.tipo_mapa) === 'ga4' ? 'GA4' : normalizar(a.tipo_mapa) === 'universal analytics' ? 'GA3' : '');
          valB = b.measurement_class || (normalizar(b.tipo_mapa) === 'ga4' ? 'GA4' : normalizar(b.tipo_mapa) === 'universal analytics' ? 'GA3' : '');
        } else {
          valA = String(a[inventorySort.field as keyof Artifact] || "");
          valB = String(b[inventorySort.field as keyof Artifact] || "");
        }
        
        if (inventorySort.direction === 'asc') {
          return valA.localeCompare(valB, 'pt-BR', { numeric: true });
        } else {
          return valB.localeCompare(valA, 'pt-BR', { numeric: true });
        }
      });
    }

    return base;
  }, [results, tableFilter, inventoryFilters, inventorySort, activeChip, onlyDivergent, onlyWithoutResponsible, onlyWithoutSubproduct]);

  const currentInventoryInsights = useMemo(() => {
    return getFilteredInsights(filteredInventory, tableFilter || query);
  }, [filteredInventory, tableFilter, query]);

  const inventorySummary = useMemo(() => {
    return {
      total: filteredInventory.length,
      ga4: filteredInventory.filter(i => normalizar(i.tipo_mapa) === 'ga4').length,
      universalAnalytics: filteredInventory.filter(i => normalizar(i.tipo_mapa) === 'universal analytics').length,
      docs: filteredInventory.filter(i => {
        const t = normalizar(i.tipo_mapa);
        return t === 'doc' || (t !== 'ga4' && t !== 'universal analytics');
      }).length
    };
  }, [filteredInventory]);

  const startResize = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the current width or use the default min width from CSS / content
    const thElement = (e.target as HTMLElement).closest('th');
    const startWidth = thElement ? thElement.getBoundingClientRect().width : 120;
    
    resizingRef.current = {
      key,
      startX: e.clientX,
      startWidth
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    
    const { key, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    const newWidth = Math.max(120, startWidth + diff); // 120px min width
    
    setColumnWidths(prev => ({
      ...prev,
      [key]: newWidth
    }));
  };

  const handleMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleViewArtifactDetails = (id: string) => {
    setShowGraph(false);
    setAppState("inventory_table");
    setTableFilter(id);
    setInventoryFilters({
      tipo_mapa: [],
      produto: [],
      subproduto: [],
      responsavel: [],
      measurement_class: [],
      parametro: [],
      ano: []
    });
    setOnlyDivergent(false);
    setOnlyWithoutResponsible(false);
    setOnlyWithoutSubproduct(false);
    
    setTimeout(() => {
      const art = results.find(r => r.id === id);
      if (art) setDetailModalItem(art);
      const el = document.getElementById(`row-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const resetInventoryFilters = () => {
    setTableFilter("");
    setInventoryFilters({
      tipo_mapa: [],
      produto: [],
      subproduto: [],
      responsavel: [],
      measurement_class: [],
      parametro: [],
      ano: []
    });
    setOnlyDivergent(false);
    setOnlyWithoutResponsible(false);
    setOnlyWithoutSubproduct(false);
    setActiveChip('Todos');
    setInventorySort({ field: 'null', direction: 'desc' });
  };

  const filterOptions = useMemo(() => {
    const prodCounts = new Map<string, number>();
    const subCounts = new Map<string, number>();
    const measurementCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const paramCounts = new Map<string, number>();
    const yearCounts = new Map<string, number>();

    results.forEach(i => {
      if (i.produto) prodCounts.set(i.produto, (prodCounts.get(i.produto) || 0) + 1);
      if (i.subproduto) subCounts.set(i.subproduto, (subCounts.get(i.subproduto) || 0) + 1);

      const mc = (i.measurement_class || (normalizar(i.tipo_mapa) === 'ga4' ? 'GA4' : normalizar(i.tipo_mapa) === 'universal analytics' ? 'GA3' : 'NAO_CLASSIFICADO')).toUpperCase();
      measurementCounts.set(mc, (measurementCounts.get(mc) || 0) + 1);

      const tp = (i.artifact_type || (normalizar(i.tipo_mapa) === 'doc' ? 'DOCUMENTACAO' : 'MAPA')).toUpperCase();
      typeCounts.set(tp, (typeCounts.get(tp) || 0) + 1);

      (i.parameter_summary || []).forEach(p => {
        paramCounts.set(p.name, (paramCounts.get(p.name) || 0) + 1);
      });

      if (i.ultima_atualizacao) {
        const y = new Date(i.ultima_atualizacao).getFullYear().toString();
        if (y && !isNaN(Number(y))) yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
      }
    });

    const topParams = Array.from(paramCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);

    return {
      tipoArtefato: [
        { v: 'all', l: 'Todos' },
        { v: 'MAPA', l: `Mapas (${typeCounts.get('MAPA') || 0})` },
        { v: 'DOCUMENTACAO', l: `Documentações (${typeCounts.get('DOCUMENTACAO') || 0})` }
      ],
      classificacao: [
        { v: 'all', l: 'Todos' },
        { v: 'GA4', l: `GA4 (${measurementCounts.get('GA4') || 0})` },
        { v: 'GA3', l: `GA3 (${measurementCounts.get('GA3') || 0})` },
        { v: 'MISTO', l: `Misto (${measurementCounts.get('MISTO') || 0})` },
        { v: 'NAO_CLASSIFICADO', l: `Não Classificado (${measurementCounts.get('NAO_CLASSIFICADO') || 0})` }
      ],
      produtos: [
        { v: 'all', l: 'Todos' },
        ...Array.from(prodCounts.entries()).sort().map(([p, c]) => ({ v: p, l: `${p} (${c})` }))
      ],
      subprodutos: [
        { v: 'all', l: 'Todos' },
        ...Array.from(subCounts.entries()).sort().map(([s, c]) => ({ v: s, l: `${s} (${c})` }))
      ],
      parametros: [
        { v: 'all', l: 'Todos' },
        ...topParams.map(([p, c]) => ({ v: p, l: `${p} (${c})` }))
      ],
      anos: [
        { v: 'all', l: 'Todos' },
        ...Array.from(yearCounts.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([y, c]) => ({ v: y, l: `${y} (${c})` }))
      ]
    };
  }, [results]);

  const handleSort = (field: keyof Artifact | string) => {
    setInventorySort(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const regex = new RegExp(`(${highlight})`, "gi");
    const parts = String(text).split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-100 text-gray-900 dark:text-slate-50 border-b-2 border-yellow-400 p-0 font-bold">{part}</mark> : part
    );
  };

  const useSuggestion = (text: string) => {
    setQuery(text);
    executeSearch(text);
  };

  const resetSearch = () => {
    setAppState("initial");
    setQuery("");
    setResults([]);
    setInsights(null);
    setExpandedCards(new Set());
    setShowGraph(false);
    setTableFilter("");
    setExecutiveSummaryResult(null);
    setInsightsActiveTab("indicadores");
  };

  const downloadFile = (data: string, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      const items = filteredInventory;

      if (format === "json") {
        downloadFile(JSON.stringify(items, null, 2), "inventario_hub_filtrado.json", "application/json");
      } else {
        const headers = Object.keys(items[0]).join(",");
        const rows = items.map((item: any) => 
          Object.values(item).map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")
        );
        const csv = [headers, ...rows].join("\n");
        downloadFile(csv, "inventario_hub_filtrado.csv", "text/csv");
      }
      setShowExportModal(false);
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const GradientSparkles = ({ className, animate = false }: { className?: string; animate?: boolean }) => (
    <motion.div
      animate={animate ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
      transition={{ repeat: Infinity, duration: 2 }}
      className={className}
    >
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "url(#sparkle-grad)" }}>
        <defs>
          <linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7d046d" />
            <stop offset="100%" stopColor="#cc092f" />
          </linearGradient>
        </defs>
        <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z"/>
        <path d="M5 3v4"/><path d="M3 5h4"/><path d="M21 17v4"/><path d="M19 19h4"/>
      </svg>
    </motion.div>
  );

  const NavigationModes = () => {
    if (!["results", "insights", "graph", "inventory_table", "decision", "produtos_analise", "parametros_analise"].includes(appState) || loading) return null;
    if (appState === "decision") return null;

    const modes = [
      { id: "results", label: "Cards", icon: LayoutList },
      { id: "inventory_table", label: "Inventário", icon: Landmark },
      { id: "produtos_analise", label: "Por Produto", icon: Layers },
      { id: "parametros_analise", label: "Por Parâmetro", icon: Tag },
      { id: "insights", label: "Insights", icon: Sparkles },
      { id: "graph", label: "Conexões", icon: Network }
    ];

    return (
      <div className="flex flex-col items-center mb-10">
        <nav 
          aria-label="Modos de visualização"
          className="bg-white/90 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-neu-card flex flex-wrap justify-center gap-1.5"
        >
          {modes.map(mode => {
            const isActive = appState === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setAppState(mode.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-ui font-semibold text-xs tracking-wider transition-all duration-200 cursor-pointer
                  ${isActive 
                    ? "bg-white dark:bg-slate-800 text-bradesco-red border border-gray-200 dark:border-slate-700 shadow-neu-raised" 
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                  } active:shadow-neu-pressed active:translate-y-px`}
              >
                <mode.icon className={`w-4 h-4 ${isActive ? 'text-bradesco-red' : 'text-gray-400 dark:text-slate-500'}`} />
                {mode.label}
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  const hasPermission = true;

  return (
    <main className="app flex flex-col min-h-screen bg-[#f4f5f8] dark:bg-[#0b0f19] w-full h-full relative">
      <AIReveal isLoading={loading}>
        <AnimatePresence>
        {appState === 'auth' && (
          <AuthScreen 
            onCancel={() => { setAppState('initial'); setQuery(''); }} 
            onLogin={(u, p) => {
              setAppState('initial');
              setQuery('');
              startBackgroundSync(u, p);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        <SyncWidget job={syncJob} onCancel={cancelSyncJob} />
      </AnimatePresence>

      <AnimatePresence>
        {showAdmin && (
          <AdminUsers 
            users={usersDb}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onClose={() => navigate('/hub-de-artefatos')}
          />
        )}
      </AnimatePresence>

      {/* Header com margem global da tela (fora do container central) */}
      <header className={`w-full ${GLOBAL_SCREEN_PADDING} pt-8 mb-8 flex justify-between items-center relative z-40 transition-all ${appState === 'auth' ? 'opacity-0 pointer-events-none absolute' : 'opacity-100 relative'}`}>
        <div className="flex items-center gap-8 flex-1">
          <div className="flex flex-col cursor-pointer group" onClick={() => { setAppState('initial'); setQuery(''); setTableFilter(''); }}>
            <div className="flex items-center gap-3">
              <h1 className="brand-text font-heading text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-50 group-hover:opacity-85 transition-opacity">
                Omni Marketing
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm font-medium text-gray-500 shrink-0">
          <div className="flex items-center gap-2">
            {appState !== 'home' && appState !== 'initial' && appState !== 'events_capture' && (
              <button 
                onClick={handleBack}
                className="btn-neu flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-ui font-semibold text-gray-700 dark:text-slate-200 h-10 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
          </div>

          {!loading && (appState === "inventory_table" || appState === "results") && (
            <button 
              onClick={() => setShowExportModal(true)}
              className="btn-neu flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-ui font-semibold text-bradesco-red hover:text-bradesco-red-hover h-10 cursor-pointer"
            >
              <Download className="w-4 h-4 text-bradesco-red" />
              Extrair Dados
            </button>
          )}
        </div>
      </header>

      <div className={`flex flex-col flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 pb-32 transition-all relative ${appState === 'auth' ? 'opacity-0 pointer-events-none absolute' : 'opacity-100 relative'}`}>

        {!hasPermission ? (
          <div className="flex flex-col items-center justify-center flex-1 py-32 text-center mt-32">
            <Shield className="w-16 h-16 text-gray-300 dark:text-slate-600 mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-50 tracking-tight">Você não possui permissão para acessar esta área.</h2>
            <button
               onClick={() => setAppState('copilot')}
               className="mt-8 px-6 py-3 bg-white dark:bg-slate-900 dark:border-slate-800 border border-gray-200 dark:border-slate-600 shadow-sm dark:shadow-none hover:border-gray-900 hover:text-gray-900 dark:text-slate-50 rounded-full font-bold transition-all text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400"
            >
               Voltar ao Início
            </button>
          </div>
        ) : (
          <>
        <section className={`hero flex flex-col flex-1 w-full items-center justify-start pt-8 ${appState !== "initial" ? "hidden" : ""}`}>
          <div className="flex flex-col items-center text-center justify-center mb-10 w-full max-w-4xl mx-auto gap-4 relative min-h-[120px]">
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-normal text-gray-900 dark:text-slate-50 tracking-tight leading-tight"
            >
              <TypewriterText text="Qual artefato você quer encontrar?" />
            </motion.h2>
          </div>

          <div className="w-full max-w-4xl mb-12">
            <div className="animated-border">
              <div className={`inner-container glass-card py-4 px-6 flex items-center gap-4 transition-all duration-300 ${isSearchActive ? "bg-white dark:bg-slate-900 border-purple-500/30 dark:border-purple-400/30 shadow-[0_8px_30px_rgba(125,4,109,0.12)] ring-1 ring-purple-500/20" : "border-transparent"}`}>
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsSearchActive(true)}
                  onBlur={() => setIsSearchActive(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      executeSearch();
                    }
                  }}
                  className="flex-1 bg-transparent border-none outline-none text-xl placeholder-gray-400 resize-none min-h-[1.5em] overflow-hidden pl-4"
                  placeholder="Busque por ID, nome do mapa ou qualquer termo relacionado"
                  rows={1}
                />
                <button
                  onClick={() => executeSearch()}
                  className="p-3 hover:scale-110 transition-transform active:scale-95"
                  title="Buscar"
                >
                  <GradientSparkles className="w-8 h-8" animate={loading} />
                </button>
              </div>
            </div>

            {/* Clickable Search Tooltips */}
            <div className="flex flex-col items-start gap-3 mt-8 ml-4">
              <motion.button 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                onClick={() => useSuggestion("Abertura de Contas")}
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-slate-500 hover:text-red-600 transition-colors flex items-center gap-3 group"
              >
                <div className="relative flex items-center justify-center">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <span>Abertura de contas PF e PJ</span>
              </motion.button>
              <motion.button 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                onClick={() => useSuggestion("Cartões")}
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-slate-500 hover:text-red-600 transition-colors flex items-center gap-3 group"
              >
                <div className="relative flex items-center justify-center">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <span>Cartões de crédito ou BIA</span>
              </motion.button>
              <motion.button 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                onClick={() => useSuggestion("inventario")}
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-slate-500 hover:text-red-600 transition-colors flex items-center gap-3 group"
              >
                <div className="relative flex items-center justify-center">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <span>Digite "inventário" para ver toda a base</span>
              </motion.button>
              
              <motion.button 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                onClick={() => setAppState("operational_insights")}
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-slate-500 hover:text-purple-600 transition-colors flex items-center gap-3 group mt-4 px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-full hover:bg-purple-50"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Ver insights</span>
              </motion.button>
            </div>
          </div>
        </section>

        {/* Level 2: Insights Dashboard (Operational) */}
        {appState === "operational_insights" && (
          <section className="w-full max-w-5xl mx-auto pt-8 pb-12">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-slate-50 tracking-tight flex items-center gap-3">
                  <Activity className="w-8 h-8 text-purple-600" />
                  Insights Operacionais
                </h2>
                <p className="text-gray-500 dark:text-slate-400 font-medium mt-2">Atividades recentes e evolução de atualizações</p>
              </div>
            </div>
            <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Timeline */}
              <div className="glass-card p-8 rounded-[40px] border border-gray-100 dark:border-slate-700 flex flex-col h-[400px]">
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <h3 className="font-bold text-gray-900 dark:text-slate-50">Atividades Recentes</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">
                  {recentActivities.length > 0 ? recentActivities.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="group flex gap-4 cursor-pointer hover:bg-gray-50 dark:bg-slate-800/80 p-3 -ml-3 rounded-2xl transition-all duration-300"
                      onClick={() => window.open(item.link, '_blank')}
                      title="Abrir mapa em nova guia"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center shrink-0 group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
                        <RefreshCw className="w-4 h-4 text-gray-400 dark:text-slate-500 group-hover:text-purple-600 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-slate-50 font-bold leading-snug truncate group-hover:text-purple-600 transition-colors">
                          {item.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">
                          <span className="whitespace-nowrap">{item.date}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0"></span>
                          <span className="truncate max-w-[120px]">{item.responsavel}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0"></span>
                          <span className="text-purple-600 font-bold whitespace-nowrap">{item.status}</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-400 dark:text-slate-500 font-medium p-4 text-center">Nenhuma atividade!</div>
                  )}
                </div>
              </div>

              {/* Gráfico de Atualizações */}
              <div className="glass-card p-8 rounded-[40px] border border-gray-100 dark:border-slate-700 flex flex-col lg:col-span-2 h-[400px]">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                    <h3 className="font-bold text-gray-900 dark:text-slate-50">Evolução de Atualizações</h3>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-4 py-1.5 bg-gray-900 dark:bg-slate-50 text-white rounded-full text-[11px] font-bold uppercase tracking-wider">Histórico Real</span>
                  </div>
                </div>
                
                {/* Updated Elegant Graph Area avoiding overflow */}
                <div className="flex-1 w-full pt-8 relative flex flex-col justify-end">
                  <div className="flex items-end justify-between h-full gap-2 sm:gap-4 px-2 sm:px-6 w-full relative">
                  {chartData.length > 0 ? chartData.map((bar, idx) => (
                    <div 
                      key={idx} 
                      className="flex flex-col items-center flex-1 group cursor-pointer h-full relative"
                      onClick={() => handleBarClick(bar.items)}
                    >
                      {/* Tooltip on Hover */}
                      <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 scale-95 opacity-0 group-[&:hover]:opacity-100 group-[&:hover]:scale-100 transition-all duration-300 z-[100] pointer-events-none bg-gray-900 dark:bg-slate-50 text-white px-4 py-3 rounded-2xl text-xs font-medium shadow-2xl dark:shadow-none min-w-[200px] flex flex-col gap-2">
                        <div className="font-bold text-sm border-b border-gray-700/50 pb-2 mb-1 flex justify-between items-center gap-4">
                          <span className="text-gray-300 dark:text-slate-600">{idx === chartData.length - 1 ? 'Hoje' : bar.label}</span>
                          <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">{bar.value} atlz</span>
                        </div>
                        {bar.items.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {bar.items.slice(0, 3).map((item: any, i: number) => (
                              <span key={i} className="truncate text-gray-200 text-[11px] flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></span>
                                {item.titulo}
                              </span>
                            ))}
                            {bar.items.length > 3 && (
                              <span className="text-gray-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1 px-3">
                                + {bar.items.length - 3} itens alterados
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-slate-400 text-[11px] italic">Nenhuma atividade neste dia</span>
                        )}
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 dark:bg-slate-50 rotate-45"></div>
                      </div>

                      <div className="flex-1 flex flex-col justify-end items-center w-full relative">
                         {bar.value > 0 && (
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-2 opacity-0 group-[&:hover]:opacity-100 group-[&:hover]:text-purple-600 transition-all group-[&:hover]:-translate-y-1">
                              {bar.value}
                            </span>
                         )}
                         <div className="w-full flex justify-center h-full items-end relative">
                            {/* The line track */}
                            <div className="absolute w-[4px] bottom-0 bg-gray-50 dark:bg-slate-800 h-full rounded-t-full transition-colors group-[&:hover]:bg-gray-100 dark:bg-slate-700"></div>
                            {/* The actual filled bar */}
                            <div 
                              className={`w-[4px] rounded-t-full z-10 opacity-70 group-[&:hover]:opacity-100 transition-all duration-500 relative bg-gradient-to-t from-gray-300 to-gray-400 group-[&:hover]:from-purple-500 group-[&:hover]:to-purple-400 ${bar.value === 0 ? 'min-h-[4px] from-gray-200 to-gray-200' : ''}`}
                              style={{ height: bar.height }}
                            ></div>
                         </div>
                      </div>
                      
                      <span className={`text-[10px] font-bold whitespace-nowrap mt-3 transition-colors ${idx === chartData.length - 1 ? 'text-gray-900 dark:text-slate-50' : 'text-gray-400 dark:text-slate-500 group-[&:hover]:text-gray-900 dark:text-slate-50'}`}>
                        {idx === chartData.length - 1 ? 'Hoje' : bar.label}
                      </span>
                    </div>
                  )) : (
                    <div className="w-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm font-medium">Gerando evolução...</div>
                  )}
                  </div>
                </div>
              </div>
              </div>
          </section>
        )}

        {/* Content Section */}
        <section className={`content ${["initial", "catalog", "events_capture", "home", "operational_insights"].includes(appState) ? "hidden" : ""}`}>
          <NavigationModes />
          
          {/* Decision / Loading Area */}
          <section className={`decision ${appState === "decision" || loading || appState === "empty" ? "flex flex-col items-center justify-center text-center py-24" : "hidden"}`}>
            <div className="mb-8 scale-150 transform transition-transform duration-500">
              <GradientSparkles className="w-12 h-12" animate={loading} />
            </div>
            
            {loading ? (
              <>
                <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-50 mb-6 font-sans">
                  Buscando resultados para <strong className="text-[var(--bradesco-red)]">"{query}"</strong>...
                </p>
                <div className="flex flex-col gap-3 w-full max-w-md">
                  <div className="shimmer-bg h-3 rounded-full w-full"></div>
                  <div className="shimmer-bg h-3 rounded-full w-4/5 mx-auto"></div>
                  <div className="shimmer-bg h-3 rounded-full w-3/4 mx-auto"></div>
                </div>
              
              </>
            ) : appState === "empty" ? (
              <div className="no-results flex flex-col items-center">
                <div className="glass-card rounded-[40px] p-12 text-center max-w-lg border border-gray-100 dark:border-slate-700/50 shadow-2xl dark:shadow-none">
                  <h3 className="text-3xl font-bold mb-4 tracking-tight">Não foi possível encontrar resultados</h3>
                  <p className="text-gray-500 dark:text-slate-400 mb-10 text-lg">Nenhum artefato foi encontrado para <strong>"{query}"</strong>.</p>
                  <button 
                    className="hover:opacity-90 text-white px-10 py-4 rounded-full font-bold shadow-xl dark:shadow-none transition-all hover:scale-105" 
                    onClick={resetSearch}
                    style={{ background: 'linear-gradient(90deg, #7D046D 0%, #cc092f 100%)' }}
                  >
                    Continuar buscando
                  </button>
                </div>
              </div>
            ) : appState === "decision" ? (
              <div className="flex flex-col items-center">
                <p className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-50 leading-tight mb-12">
                  Foram encontrados <strong className="text-[var(--bradesco-red)]">{results.length}</strong> itens para <strong>"{query}"</strong>.<br />
                  O que você quer fazer agora?
                </p>
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  <button className="bg-white dark:bg-slate-900 dark:border-slate-800 border border-gray-200 dark:border-slate-600 hover:border-bradesco-red hover:text-bradesco-red text-gray-800 dark:text-slate-200 px-10 py-4 rounded-full font-bold transition-all shadow-sm dark:shadow-none hover:shadow-md dark:shadow-none min-w-[200px]" onClick={() => setAppState("results")}>Ver resultados</button>
                  <button className="bg-white dark:bg-slate-900 dark:border-slate-800 border border-gray-200 dark:border-slate-600 hover:border-purple-600 hover:text-purple-600 text-gray-800 dark:text-slate-200 px-10 py-4 rounded-full font-bold transition-all shadow-sm dark:shadow-none hover:shadow-md dark:shadow-none min-w-[200px] flex items-center gap-2 justify-center" onClick={() => setAppState("operational_insights")}>
                    <Activity className="w-4 h-4" />
                    Ver insights
                  </button>
                  <button className="text-gray-400 dark:text-slate-500 hover:text-bradesco-red font-bold px-8 py-4 transition-colors" onClick={resetSearch}>Continuar buscando</button>
                </div>
              </div>
            ) : null}
          </section>

          {/* Canonical Insights Dashboard */}
          {appState === "insights" && (
            <motion.section 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="summary pb-20"
            >
              <CanonicalInsightsDashboard 
                artifacts={results}
                onOpenMap={(art) => setDetailModalItem(art)}
                onFilterByProduct={(prod) => {
                  setInventoryFilters(f => ({ ...f, produto: [prod] }));
                  setAppState("inventory_table");
                }}
              />
            </motion.section>
          )}

          {/* Análise por Produto */}
          {appState === "produtos_analise" && (
            <motion.section 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="produtos-container pb-20"
            >
              <ProductAnalysisView 
                artifacts={results}
                onOpenMap={(art) => setDetailModalItem(art)}
                onSelectProduct={(prod) => {
                  setInventoryFilters(f => ({ ...f, produto: [prod] }));
                  setAppState("inventory_table");
                }}
              />
            </motion.section>
          )}

          {/* Análise por Parâmetro */}
          {appState === "parametros_analise" && (
            <motion.section 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="parametros-container pb-20"
            >
              <ParameterAnalysisView 
                artifacts={results}
                onOpenMap={(art) => setDetailModalItem(art)}
              />
            </motion.section>
          )}

          {false && appState === "insights" && (
            !insights ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-32"
              >
                <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                  <Filter className="w-8 h-8 text-gray-300 dark:text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-50 mb-2">Nenhum insight disponível</h3>
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">A busca atual não retornou resultados suficientes para gerar análises.</p>
              </motion.div>
            ) : (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="summary"
            >
              {/* Filter Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm dark:shadow-none overflow-x-auto max-w-full no-scrollbar">
                  <div className="flex items-center gap-2 px-3 py-1 border-r border-gray-200 dark:border-slate-600">
                    <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                    <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400 whitespace-nowrap">Filtros</span>
                  </div>
                  
                  <select 
                    value={insightFilters.ga}
                    onChange={(e) => setInsightFilters(prev => ({ ...prev, ga: e.target.value }))}
                    className="bg-transparent text-xs font-bold text-gray-800 dark:text-slate-200 outline-none border-none py-1 cursor-pointer hover:text-bradesco-red transition-colors"
                  >
                    <option value="all">TODOS PADRÕES</option>
                    <option value="ga4">APENAS GA4</option>
                    <option value="universal analytics">APENAS UNIVERSAL ANALYTICS</option>
                    <option value="doc">APENAS DOCUMENTOS</option>
                  </select>

                  <select 
                    value={insightFilters.produto}
                    onChange={(e) => setInsightFilters(prev => ({ ...prev, produto: e.target.value }))}
                    className="bg-transparent text-xs font-bold text-gray-800 dark:text-slate-200 outline-none border-none py-1 cursor-pointer hover:text-red-600 transition-colors max-w-[150px]"
                  >
                    <option value="all">TODOS PRODUTOS</option>
                    {(Array.from(new Set(results.map(r => r.produto))) as string[]).filter(Boolean).map(p => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>

                  <select 
                    value={insightFilters.subproduto}
                    onChange={(e) => setInsightFilters(prev => ({ ...prev, subproduto: e.target.value }))}
                    className="bg-transparent text-xs font-bold text-gray-800 dark:text-slate-200 outline-none border-none py-1 cursor-pointer hover:text-red-600 transition-colors max-w-[150px]"
                  >
                    <option value="all">TODOS SUBPRODUTOS</option>
                    {(Array.from(new Set(results.map(r => r.subproduto))) as string[]).filter(Boolean).map(s => (
                      <option key={s} value={s}>{s.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

                  {/* KPIs - Refreshed with Semantic Colors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="group relative glass-card p-6 rounded-[32px] border border-gray-100 dark:border-slate-700 shadow-sm dark:shadow-none transition-all hover:shadow-xl dark:shadow-none hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                    <Target className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Total Artefatos</p>
                  <p className="text-4xl font-extrabold text-gray-900 dark:text-slate-50 leading-none">{insights.total}</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-2 tracking-wider uppercase">
                    Mapas ({insights.mapas}) vs Docs ({insights.documentos})
                  </p>
                </div>

                <div className="group relative glass-card p-6 rounded-[32px] border-b-4 border-b-green-500 border border-gray-100 dark:border-slate-700 shadow-sm dark:shadow-none transition-all hover:shadow-xl dark:shadow-none hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 mb-4 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">GA4</p>
                  <p className="text-4xl font-extrabold text-gray-900 dark:text-slate-50 leading-none">{insights.ga4}</p>
                  <span className="absolute top-6 right-6 text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full">{insights.porcentagens.ga4}%</span>
                </div>

                <div className="group relative glass-card p-6 rounded-[32px] border-b-4 border-b-bradesco-red border border-gray-100 dark:border-slate-700 shadow-sm dark:shadow-none transition-all hover:shadow-xl dark:shadow-none hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-bradesco-red mb-4 group-hover:scale-110 transition-transform">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Univ. Analytics</p>
                  <p className="text-4xl font-extrabold text-gray-900 dark:text-slate-50 leading-none">{insights.universalAnalytics}</p>
                  <span className="absolute top-6 right-6 text-[10px] font-black text-bradesco-red bg-red-50 px-2 py-1 rounded-full">{insights.porcentagens.universalAnalytics}%</span>
                </div>

                <div className="group relative glass-card p-6 rounded-[32px] border-b-4 border-b-gray-400 border border-gray-100 dark:border-slate-700 shadow-sm dark:shadow-none transition-all hover:shadow-xl dark:shadow-none hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-500 mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Documentos</p>
                  <p className="text-4xl font-extrabold text-gray-900 dark:text-slate-50 leading-none">{insights.documentos}</p>
                  <span className="absolute top-6 right-6 text-[10px] font-black text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-full">{insights.porcentagens.documentos}%</span>
                </div>
              </div>

              {/* Detailed Operational Insights Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="lg:col-span-2 flex flex-col gap-8">
                  {/* Tempo de Atualização */}
                  <div className="glass-card p-10 rounded-[40px] border border-gray-100 dark:border-slate-700 shadow-sm dark:shadow-none relative overflow-hidden">
                    <h4 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <Clock className="w-4 h-4 text-purple-500" />
                       Frescor da Base
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Últimos 30 dias</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-50">{insights.updates?.last30Days || 0}</p>
                        <p className="text-[11px] font-bold text-green-600">{insights.updates?.percentLast30Days || "0"}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Últimos 60 dias</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-50">{insights.updates?.last60Days || 0}</p>
                        <p className="text-[11px] font-bold text-green-500">{insights.updates?.percentLast60Days || "0"}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Últimos 90 dias</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-50">{insights.updates?.last90Days || 0}</p>
                        <p className="text-[11px] font-bold text-yellow-600">{insights.updates?.percentLast90Days || "0"}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Defasados (+90 dias)</p>
                        <p className="text-2xl font-bold text-red-600">{insights.updates?.olderThan90Days || 0}</p>
                        <p className="text-[11px] font-bold text-red-500">{insights.updates?.percentOlderThan90Days || "0"}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Distribuição por Produto */}
                  <div className="glass-card p-10 rounded-[40px] border border-gray-100 dark:border-slate-700 shadow-sm dark:shadow-none relative overflow-hidden">
                    <h4 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <Layers className="w-4 h-4 text-purple-500" />
                       Distribuição de Escopos
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex flex-col gap-4">
                         <h5 className="text-[10px] font-black tracking-widest text-gray-400 dark:text-slate-500 uppercase">Produtos</h5>
                         {insights.distribProduto?.slice(0, 4).map((p, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700">
                               <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{p.name === "-" ? "N/A" : p.name}</span>
                               <div className="flex items-center gap-4">
                                  <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">{p.count} itens</span>
                               </div>
                            </div>
                         ))}
                      </div>

                      <div className="flex flex-col gap-4">
                         <h5 className="text-[10px] font-black tracking-widest text-gray-400 dark:text-slate-500 uppercase">Subprodutos</h5>
                         {insights.distribSubproduto?.slice(0, 4).map((p, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700">
                               <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{p.name === "-" ? "N/A" : p.name}</span>
                               <div className="flex items-center gap-4">
                                  <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">{p.count} itens</span>
                               </div>
                            </div>
                         ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-8">
                  {/* Versionamento */}
                  <div className="p-8 rounded-[40px] border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm dark:shadow-none flex flex-col items-center justify-center text-center">
                    <h4 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">
                      Média de Versões
                    </h4>
                    <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-4">
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-5xl font-black text-gray-900 dark:text-slate-50">{insights.versioning?.averageVersions || "1"}</p>
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-2">Versões por artefato</p>
                  </div>

                  {/* Top Atualizados */}
                  <div className="p-8 rounded-[40px] border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm dark:shadow-none flex-1">
                    <h4 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">
                      Artefatos Mais Iterados
                    </h4>
                    <div className="flex flex-col gap-3 mt-4">
                      {insights.versioning?.topUpdated?.map((item, i) => (
                        <div key={i} className="flex flex-col border-b border-gray-50 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                           <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gray-800 dark:text-slate-200 hover:text-purple-600 cursor-pointer truncate" title={item.titulo}>
                             {item.titulo}
                           </a>
                           <div className="flex justify-between items-center mt-1">
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">{item.produto || "N/A"}</span>
                              <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">v{item.versao}</span>
                           </div>
                        </div>
                      ))}
                      {(!insights.versioning?.topUpdated || insights.versioning.topUpdated.length === 0) && (
                        <span className="text-xs text-gray-400 dark:text-slate-500 text-center py-4 italic">Sem versionamento no conjunto.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              

            </motion.section>
            )
          )}

          {/* Graph Visualization Section */}
          <AnimatePresence>
            {appState === "graph" && insights && (
              <motion.section 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="graph-container pb-20"
              >
                <GraphView 
                  data={results} 
                  isEmbedded={true}
                />
              </motion.section>
            )}
          </AnimatePresence>

          {/* Results Area */}
          <section className={`results space-y-6 ${appState === "results" && !loading ? "" : "hidden"}`}>
            <AnimatePresence>
              {results.map((item, index) => {
                // Real Confluence status mapping
                const realStatus = item.calculated_status || item.declared_status || 'NAO_IDENTIFICADO';
                const isDoc = item.artifact_type === 'DOCUMENTACAO';
                
                let statusBadge = {
                  label: realStatus,
                  bg: 'bg-slate-50 dark:bg-slate-800',
                  border: 'border-slate-200 dark:border-slate-700',
                  color: 'text-slate-700 dark:text-slate-300',
                  icon: <Info className="w-3 h-3" />
                };

                if (isDoc) {
                  statusBadge = {
                    label: 'Documento',
                    bg: 'bg-slate-50 dark:bg-slate-800',
                    border: 'border-slate-200 dark:border-slate-700',
                    color: 'text-slate-700 dark:text-slate-300',
                    icon: <FileText className="w-3 h-3" />
                  };
                } else if (realStatus === 'VALIDADO') {
                  statusBadge = {
                    label: 'Validado',
                    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                    border: 'border-emerald-200 dark:border-emerald-800',
                    color: 'text-emerald-700 dark:text-emerald-300',
                    icon: <CheckCircle2 className="w-3 h-3" />
                  };
                } else if (realStatus === 'PARCIAL') {
                  statusBadge = {
                    label: 'Parcial',
                    bg: 'bg-amber-50 dark:bg-amber-950/40',
                    border: 'border-amber-200 dark:border-amber-800',
                    color: 'text-amber-700 dark:text-amber-300',
                    icon: <AlertTriangle className="w-3 h-3" />
                  };
                } else if (realStatus === 'CORRECAO') {
                  statusBadge = {
                    label: 'Correção',
                    bg: 'bg-orange-50 dark:bg-orange-950/40',
                    border: 'border-orange-200 dark:border-orange-800',
                    color: 'text-orange-700 dark:text-orange-300',
                    icon: <AlertTriangle className="w-3 h-3" />
                  };
                } else if (realStatus === 'NOVO') {
                  statusBadge = {
                    label: 'Novo',
                    bg: 'bg-blue-50 dark:bg-blue-950/40',
                    border: 'border-blue-200 dark:border-blue-800',
                    color: 'text-blue-700 dark:text-blue-300',
                    icon: <Sparkles className="w-3 h-3" />
                  };
                } else if (realStatus === 'EXCLUIR') {
                  statusBadge = {
                    label: 'Excluir',
                    bg: 'bg-rose-50 dark:bg-rose-950/40',
                    border: 'border-rose-200 dark:border-rose-800',
                    color: 'text-rose-700 dark:text-rose-300',
                    icon: <AlertCircle className="w-3 h-3" />
                  };
                } else if (realStatus === 'DESCONTINUAR') {
                  statusBadge = {
                    label: 'Descontinuar',
                    bg: 'bg-gray-100 dark:bg-slate-800',
                    border: 'border-gray-300 dark:border-slate-700',
                    color: 'text-gray-600 dark:text-slate-400',
                    icon: <Info className="w-3 h-3" />
                  };
                }

                return (
                <motion.article 
                  key={item.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flat-card border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-neu-card group transition-all relative overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="red-badge font-ui">
                        {item.artifact_type === 'DOCUMENTACAO' || (item.tipo_mapa && normalizar(item.tipo_mapa) === 'doc')
                          ? "DOCUMENTO" 
                          : (item.measurement_class || item.tipo_mapa || "MAPA").toUpperCase()}
                      </span>
                      {item.produto && <span className="red-badge font-ui">{item.produto}</span>}
                      {item.subproduto && <span className="red-badge font-ui">{item.subproduto}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status_divergent && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-ui font-semibold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/50 border-amber-200 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="w-2.5 h-2.5" /> Divergente
                        </span>
                      )}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-neu-raised text-[10px] font-ui font-semibold uppercase tracking-widest cursor-default ${statusBadge.bg} ${statusBadge.border} ${statusBadge.color}`}>
                        {statusBadge.icon} {statusBadge.label}
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <a
                      className="text-2xl sm:text-[28px] brand-title font-heading group-hover:opacity-80 transition-opacity inline-flex items-center gap-2 mb-2"
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.titulo}
                    </a>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 p-4 rounded-xl bg-gray-50/50 dark:bg-slate-800/30 border border-gray-100 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-ui font-semibold uppercase text-gray-400 dark:text-slate-500 tracking-wider">Identificador</span>
                      <span className="text-sm font-heading font-bold text-gray-800 dark:text-slate-200 tabular-nums">{item.id}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-ui font-semibold uppercase text-gray-400 dark:text-slate-500 tracking-wider">Responsável</span>
                      <span className="text-sm font-ui font-semibold text-gray-800 dark:text-slate-200">{item.responsavel || "N/A"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-ui font-semibold uppercase text-gray-400 dark:text-slate-500 tracking-wider">Versão</span>
                      <span className="text-sm font-heading font-bold text-gray-800 dark:text-slate-200 tabular-nums">{item.versao || "1"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-ui font-semibold uppercase text-gray-400 dark:text-slate-500 tracking-wider">Nível de Taxonomia</span>
                      <span className="text-sm font-heading font-bold text-gray-800 dark:text-slate-200 tabular-nums">{item.taxonomy_depth || item.nivel || "1"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <button 
                        className="btn-neu px-3 py-1.5 rounded-xl font-ui font-semibold text-xs text-gray-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-bradesco-red" 
                        onClick={() => toggleDetails(item.id)}
                      >
                        {expandedCards.has(item.id) ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            Ocultar metadados
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            Ver metadados
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setDetailModalItem(item)}
                        className="btn-neu px-3 py-1.5 rounded-xl font-ui font-semibold text-xs text-gray-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-bradesco-red"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Inspecionar Telas
                      </button>
                    </div>

                    <p className="text-xs font-ui text-gray-400 dark:text-slate-500 tabular-nums">
                      Atualizado em: {formatDataBR(item.ultima_atualizacao)}
                    </p>
                  </div>

                  {expandedCards.has(item.id) && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-8">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Produto/Serviço</p>
                          <p className="text-sm text-gray-800 dark:text-slate-200">{item.produto_servico || "-"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Nº Task</p>
                          <p className="text-sm text-gray-800 dark:text-slate-200">{item.numero_da_task || "-"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">GTM ID</p>
                          <p className="text-sm text-gray-800 dark:text-slate-200">{item.gtm_id || "-"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">GA4 Stream ID</p>
                          <p className="text-sm text-gray-800 dark:text-slate-200">{item.propriedade_ga4_stream_id || "-"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Firebase</p>
                          <p className="text-sm text-gray-800 dark:text-slate-200">{item.firebase || "-"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Domínio</p>
                          <p className="text-sm text-gray-800 dark:text-slate-200">{item.dominio_exclusivo_web || "-"}</p>
                        </div>
                        <div className="md:col-span-3">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Figma/XD</p>
                          {item.figma_xd && item.figma_xd !== "-" ? (
                            <a 
                              href={item.figma_xd} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-sm font-bold text-red-600 hover:underline"
                            >
                              ACESSE AQUI
                            </a>
                          ) : (
                            <p className="text-sm text-gray-800 dark:text-slate-200">{item.figma_xd || "-"}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.article>
                );
              })}
            </AnimatePresence>
          </section>

          {/* Inventory Table View (Functional Explorer Interface) */}
          {appState === "inventory_table" && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inventory-table-container pb-20"
            >
              {/* Header Padronizado no Estilo da Página de Cards */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl brand-title font-heading tracking-tight mb-1">
                    Inventário de Artefatos e Especificações
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-ui">
                    Visualização técnica de todos os mapas, especificações de tags e fluxos catalogados.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-ui font-semibold px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-neu-raised tabular-nums">
                    {filteredInventory.length} de {results.length} artefatos
                  </span>
                </div>
              </div>

              {/* Advanced Filter Architecture */}
              <div className="glass-card rounded-2xl border border-gray-200 dark:border-slate-800 p-6 mb-8 shadow-neu-card">
                {/* Search & Main Chips */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-6">
                  <div className="w-full md:max-w-md relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 group-focus-within:text-bradesco-red transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Busca global em toda a base..." 
                      className="neu-input w-full pl-11 pr-4 py-2.5 rounded-xl text-xs font-ui font-medium text-gray-800 dark:text-slate-200 outline-none"
                      value={tableFilter}
                      onChange={(e) => setTableFilter(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center items-center">
                    {['Todos', 'Mapas', 'Documentações', 'GA4', 'GA3'].map(chip => (
                      <button 
                        key={chip}
                        onClick={() => setActiveChip(chip)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-ui font-semibold transition-all cursor-pointer
                          ${activeChip === chip
                            ? 'text-white shadow-neu-raised' 
                            : 'btn-neu text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'}
                        `}
                        style={activeChip === chip ? { background: 'linear-gradient(90deg, #7D046D 0%, #cc092f 100%)' } : {}}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid of Independent Filters */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Artefato', key: 'tipo_mapa', options: filterOptions.tipoArtefato },
                    { label: 'Classificação', key: 'measurement_class', options: filterOptions.classificacao },
                    { label: 'Produto', key: 'produto', options: filterOptions.produtos },
                    { label: 'Subproduto', key: 'subproduto', options: filterOptions.subprodutos },
                    { label: 'Parâmetro', key: 'parametro', options: filterOptions.parametros },
                    { label: 'Ano', key: 'ano', options: filterOptions.anos }
                  ].map(filter => (
                    <MultiSelect 
                      key={filter.key} 
                      label={filter.label} 
                      options={filter.options}
                      values={inventoryFilters[filter.key as keyof typeof inventoryFilters] || []}
                      onChange={(vals) => setInventoryFilters(f => ({ ...f, [filter.key]: vals }))}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
                   <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800/80 rounded-xl border border-gray-100 dark:border-slate-700/60">
                        <span className="text-[10px] font-ui font-semibold text-gray-400 dark:text-slate-500 uppercase">Filtrados:</span>
                        <span className="text-xs font-heading font-bold text-gray-900 dark:text-slate-50 tabular-nums">{filteredInventory.length} / {results.length}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setOnlyWithoutResponsible(prev => !prev)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-ui font-semibold transition-all cursor-pointer ${
                          onlyWithoutResponsible
                            ? 'bg-amber-500 text-white shadow-neu-raised'
                            : 'btn-neu text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        Sem responsável
                      </button>

                      <button
                        type="button"
                        onClick={() => setOnlyWithoutSubproduct(prev => !prev)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-ui font-semibold transition-all cursor-pointer ${
                          onlyWithoutSubproduct
                            ? 'bg-amber-500 text-white shadow-neu-raised'
                            : 'btn-neu text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        Sem subproduto
                      </button>

                      <button
                        type="button"
                        onClick={() => setOnlyDivergent(prev => !prev)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                          onlyDivergent
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-gray-50 dark:bg-slate-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Apenas divergentes
                      </button>
                   </div>
                   <button 
                    onClick={resetInventoryFilters}
                    className="flex items-center gap-2 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest hover:text-red-500 transition-colors"
                   >
                     <X className="w-3 h-3" /> Limpar Filtros
                   </button>
                </div>
              </div>

              {/* Main Content Area: Table or Panel */}
              <AnimatePresence mode="wait">
                {inventoryViewMode === 'table' ? (
                  <motion.div 
                    key="table"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="glass-card overflow-hidden rounded-xl border border-gray-100 dark:border-slate-700 shadow-xl dark:shadow-none bg-white dark:bg-slate-900 dark:border-slate-800"
                  >
                    <div className="overflow-x-auto overflow-y-auto custom-scrollbar excel-table-wrapper relative">
                      <table className="w-full text-left border-collapse min-w-[1200px] excel-table">
                        <thead className="sticky top-0 z-20">
                          <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                            <th style={{ width: columnWidths['titulo'] }} className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest group transition-colors relative">
                              <div className="resizable-header min-w-[360px]">
                                <span onClick={() => handleSort('titulo')} className="flex items-center gap-2 cursor-pointer hover:text-red-600 transition-colors w-max">
                                  TÍTULO / ID
                                  {inventorySort.field === 'titulo' && (inventorySort.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                </span>
                              </div>
                              <div className="column-resize-handle" onMouseDown={(e) => startResize(e, 'titulo')} />
                            </th>
                            <th style={{ width: columnWidths['artifact_type'] }} className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest group transition-colors relative">
                              <div className="resizable-header min-w-[120px]">
                                <span onClick={() => handleSort('artifact_type')} className="cursor-pointer hover:text-red-600 transition-colors">ARTEFATO</span>
                              </div>
                              <div className="column-resize-handle" onMouseDown={(e) => startResize(e, 'artifact_type')} />
                            </th>
                            <th style={{ width: columnWidths['measurement_class'] }} className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest group transition-colors relative">
                              <div className="resizable-header min-w-[130px]">
                                <span onClick={() => handleSort('measurement_class')} className="cursor-pointer hover:text-red-600 transition-colors">CLASSIFICAÇÃO</span>
                              </div>
                              <div className="column-resize-handle" onMouseDown={(e) => startResize(e, 'measurement_class')} />
                            </th>
                            <th style={{ width: columnWidths['produto'] }} className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest group transition-colors relative">
                              <div className="resizable-header">
                                <span onClick={() => handleSort('produto')} className="cursor-pointer hover:text-red-600 transition-colors">PRODUTO</span>
                              </div>
                              <div className="column-resize-handle" onMouseDown={(e) => startResize(e, 'produto')} />
                            </th>
                            <th style={{ width: columnWidths['subproduto'] }} className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest group transition-colors relative">
                              <div className="resizable-header">
                                <span onClick={() => handleSort('subproduto')} className="cursor-pointer hover:text-red-600 transition-colors">SUBPRODUTO</span>
                              </div>
                              <div className="column-resize-handle" onMouseDown={(e) => startResize(e, 'subproduto')} />
                            </th>
                            <th style={{ width: columnWidths['responsavel'] }} className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest group transition-colors relative">
                              <div className="resizable-header">
                                <span onClick={() => handleSort('responsavel')} className="cursor-pointer hover:text-red-600 transition-colors">RESPONSÁVEL</span>
                              </div>
                              <div className="column-resize-handle" onMouseDown={(e) => startResize(e, 'responsavel')} />
                            </th>
                            <th style={{ width: columnWidths['ultima_atualizacao'] }} className="text-[10px] font-black text-gray-400 dark:text-slate-500 tracking-widest group transition-colors relative">
                              <div className="resizable-header">
                                <span onClick={() => handleSort('ultima_atualizacao')} className="cursor-pointer hover:text-red-600 transition-colors">ATUALIZADO</span>
                              </div>
                              <div className="column-resize-handle" onMouseDown={(e) => startResize(e, 'ultima_atualizacao')} />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                          {filteredInventory.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-32 text-center">
                                <div className="flex flex-col items-center gap-6">
                                  <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-200">
                                    <Search className="w-10 h-10" />
                                  </div>
                                  <div>
                                    <h4 className="text-xl font-bold text-gray-900 dark:text-slate-50 mb-2">Nenhum artefato encontrado</h4>
                                    <p className="text-gray-400 dark:text-slate-500 text-sm mb-8">Refine seus filtros ou realize uma nova busca global.</p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredInventory.map((item) => {
                              const isDoc = item.artifact_type === 'DOCUMENTACAO' || normalizar(item.tipo_mapa) === 'doc';
                              const artifactLabel = isDoc ? 'Documentação' : 'Mapa';

                              const mRaw = (item.measurement_class || '').toUpperCase();
                              const tRaw = normalizar(item.tipo_mapa || '');
                              let classLabel = '—';
                              let classStyle = 'text-gray-400 dark:text-slate-500';

                              if (mRaw === 'GA4' || tRaw === 'ga4') {
                                classLabel = 'GA4';
                                classStyle = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
                              } else if (mRaw === 'GA3' || tRaw === 'ga3' || tRaw === 'universal analytics') {
                                classLabel = 'GA3';
                                classStyle = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
                              } else if (mRaw === 'MISTO' || tRaw === 'misto') {
                                classLabel = 'Misto';
                                classStyle = 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300';
                              }

                              return (
                                <tr 
                                  key={item.id} 
                                  id={`row-${item.id}`} 
                                  onClick={() => setDetailModalItem(item)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setDetailModalItem(item);
                                    }
                                  }}
                                  tabIndex={0}
                                  role="button"
                                  className="group transition-all hover:bg-gray-50/80 dark:hover:bg-slate-800/60 cursor-pointer focus:outline-none focus:bg-red-50/20 dark:focus:bg-slate-800"
                                >
                                  <td className="p-5">
                                    <div className="flex flex-col items-start w-full overflow-hidden">
                                      <span className="block text-sm font-bold text-gray-900 dark:text-slate-50 leading-snug truncate group-hover:text-red-600 transition-colors">
                                        {highlightText(item.titulo, tableFilter)}
                                      </span>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="block text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider truncate">
                                          {item.id}
                                        </span>
                                        {item.link && (
                                          <a 
                                            href={item.link} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded"
                                            title="Abrir no Confluence"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-5">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight ${
                                      isDoc 
                                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' 
                                        : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                    }`}>
                                      {artifactLabel}
                                    </span>
                                  </td>
                                  <td className="p-5">
                                    {classLabel === '—' ? (
                                      <span className="text-gray-400 dark:text-slate-500 text-xs font-semibold">—</span>
                                    ) : (
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight ${classStyle}`}>
                                        {classLabel}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-5 text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-tighter">
                                    <div className="block truncate w-full">{highlightText(item.produto || "-", tableFilter)}</div>
                                  </td>
                                  <td className="p-5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-tighter">
                                    <div className="block truncate w-full">{highlightText(item.subproduto || "-", tableFilter)}</div>
                                  </td>
                                  <td className="p-5 text-xs font-bold text-gray-800 dark:text-slate-200 uppercase tracking-tighter">
                                    <div className="block truncate w-full">{highlightText(item.responsavel || "-", tableFilter)}</div>
                                  </td>
                                  <td className="p-5 text-[10px] font-black text-gray-400 dark:text-slate-500">
                                    {formatDataBR(item.ultima_atualizacao)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                ) : !currentInventoryInsights ? (
                  <motion.div 
                    key="panel-empty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-12 text-center text-gray-500 dark:text-slate-400 font-bold mb-8 bg-gray-50 dark:bg-slate-800 rounded-[40px]"
                  >
                    Nenhum insight disponível para o filtro atual.
                  </motion.div>
                ) : (
                  <motion.div 
                    key="panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 lg:grid-cols-4 gap-8"
                  >
                    {/* Insights Panel Content */}
                    <div className="lg:col-span-1 space-y-6">
                       {/* Health Status */}
                       <div className={`p-8 rounded-[32px] border bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm dark:shadow-none flex flex-col items-center text-center
                         ${currentInventoryInsights.problemas.nivelRisco === 'alto' ? 'border-red-200' : 'border-gray-100 dark:border-slate-700'}
                       `}>
                          <h4 className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6">Volume na Categoria</h4>
                          <div className="text-4xl font-black text-gray-900 dark:text-slate-50 mb-2">{currentInventoryInsights.total}</div>
                          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6">Artefatos Selecionados</p>
                          <div className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full text-white w-full
                            ${currentInventoryInsights.problemas.nivelRisco === 'alto' ? 'bg-bradesco-gradient shadow-lg dark:shadow-none shadow-red-100' : 'bg-green-600 shadow-lg dark:shadow-none shadow-green-100'}
                          `}>
                            Risco {currentInventoryInsights.problemas.nivelRisco}
                          </div>
                       </div>

                       {/* Quick Stats */}
                       <div className="p-8 rounded-[32px] border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4">
                          {[
                            { l: 'Sem Resp.', v: currentInventoryInsights.problemas.semResponsavel },
                            { l: 'Sem Subp.', v: currentInventoryInsights.problemas.semSubproduto },
                            { l: 'Probs. Tagueamento', v: currentInventoryInsights.problemas.foraPadraoGA4 }
                          ].map((s, i) => (
                            <div key={i} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                               <span className="text-gray-400 dark:text-slate-500">{s.l}</span>
                               <span className={s.v > 0 ? 'text-red-600 font-black' : 'text-gray-900 dark:text-slate-50'}>{s.v}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                       {/* Main Insight Card */}
                       <div className="p-10 rounded-[32px] border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm dark:shadow-none relative overflow-hidden h-full">
                          
                          <div className="relative z-10">
                            <h4 className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Visão Estrutural: Detalhamento do Grupo</h4>
                            <p className="text-xl font-medium tracking-tight text-gray-800 dark:text-slate-200 leading-tight mb-10 font-sans whitespace-pre-wrap">
                               Análise automática baseada nos {currentInventoryInsights.total} artefatos listados, destacando a distribuição técnica e o volume de atualizações recentes.
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                               <div className="space-y-6">
                                  <div>
                                    <h5 className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6">Padrão de Tagueamento</h5>
                                    <div className="space-y-4">
                                       {currentInventoryInsights.distribTipos?.slice(0, 4).map((tipo, i) => (
                                         <div key={i} className="flex justify-between items-center text-[11px] font-bold border-b border-gray-50 dark:border-slate-800 pb-2 last:border-0">
                                            <span className="text-gray-700 dark:text-slate-300 uppercase pr-4">{tipo.name}</span>
                                            <span className="text-purple-600 font-black px-2 bg-purple-50 rounded-lg">{tipo.count}</span>
                                         </div>
                                       ))}
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Média de Versões</h5>
                                    <div className="text-3xl font-black text-purple-600">v{currentInventoryInsights.versioning?.averageVersions || "1"}</div>
                                  </div>
                               </div>
                               <div className="bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-8">
                                  <h5 className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6">Distribuição Operacional (Subprodutos)</h5>
                                  <div className="space-y-4">
                                     {currentInventoryInsights.distribSubproduto?.slice(0, 4).map((item, i) => (
                                       <div key={i} className="space-y-2">
                                          <div className="flex justify-between items-center text-[9px] font-black">
                                             <span className="text-gray-700 dark:text-slate-300 uppercase truncate pr-4">{item.name === "-" ? "Sem Subproduto" : item.name}</span>
                                             <span className="text-gray-400 dark:text-slate-500">{item.percent}%</span>
                                          </div>
                                          <div className="h-1 bg-white dark:bg-slate-900 dark:border-slate-800 rounded-full overflow-hidden">
                                             <div className="h-full bg-bradesco-gradient" style={{ width: `${item.percent}%` }} />
                                          </div>
                                       </div>
                                     ))}
                                     {(!currentInventoryInsights.distribSubproduto || currentInventoryInsights.distribSubproduto.length === 0) && (
                                       <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Sem dados.</p>
                                     )}
                                  </div>
                               </div>
                            </div>
                          </div>
                          
                          <div className="mt-10 pt-10 border-t border-gray-50 dark:border-slate-800 flex gap-4">
                            <button className="px-6 py-2 bg-gray-900 dark:bg-slate-50 transition-all hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg dark:shadow-none shadow-gray-200" onClick={() => setShowGraph(true)}>
                               <Network className="w-4 h-4" /> Conexões Map
                            </button>
                            <button className="px-6 py-2 bg-white dark:bg-slate-900 dark:border-slate-800 border border-gray-200 dark:border-slate-600 hover:border-red-200 transition-all text-gray-400 dark:text-slate-500 hover:text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2" onClick={() => setShowExportModal(true)}>
                               <Download className="w-4 h-4" /> Exportar Planilha
                            </button>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}
        </section>
        
        </>
        )}
      </div>

      {/* Static Footer */}
      <footer className={`fixed bottom-0 left-0 w-full ${GLOBAL_SCREEN_PADDING} py-4 bg-white dark:bg-slate-900 dark:border-slate-800/90 backdrop-blur-sm border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-gray-400 dark:text-slate-500 z-30`}>
        <div className="flex flex-col gap-1 text-left">
          <div className="normal-case">Desenvolvido por: <strong className="lowercase">lucas.doliveira@bradesco.com.br</strong></div>
          {lastSync && (
            <div className="text-[9px] font-medium text-gray-400 dark:text-slate-500 normal-case">
              Última sincronização: {lastSync}
            </div>
          )}
        </div>
        <div className="uppercase">Salla.MKT V1.0.0</div>
      </footer>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 dark:border-slate-800 rounded-[40px] p-10 shadow-2xl dark:shadow-none border border-gray-100 dark:border-slate-700 max-w-sm w-full text-center"
            >
              <button 
                onClick={() => setShowExportModal(false)}
                className="absolute top-6 right-6 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="mb-8 flex justify-center">
                <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center text-red-600">
                  <Download className="w-8 h-8" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-50 mb-2">Extrair Base</h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">Escolha o formato desejado para exportar todos os artefatos do inventário.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleExport("csv")}
                  className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-gray-50 dark:bg-slate-800 hover:bg-red-50 border border-gray-100 dark:border-slate-700 hover:border-red-200 transition-all group"
                >
                  <span className="text-xl font-black text-gray-400 dark:text-slate-500 group-hover:text-red-600">CSV</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400 group-hover:text-red-500">Planilha</span>
                </button>
                <button 
                  onClick={() => handleExport("json")}
                  className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-gray-50 dark:bg-slate-800 hover:bg-red-50 border border-gray-100 dark:border-slate-700 hover:border-red-200 transition-all group"
                >
                  <span className="text-xl font-black text-gray-400 dark:text-slate-500 group-hover:text-red-600">JSON</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400 group-hover:text-red-500">Dados</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Executive Summary Modal */}
      <AnimatePresence>
        {showExecutiveModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExecutiveModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-[40px] p-10 shadow-2xl border border-gray-100 dark:border-slate-700 max-w-md w-full text-center"
            >
              <button 
                onClick={() => setShowExecutiveModal(false)}
                className="absolute top-6 right-6 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                  <Sparkles className="w-8 h-8" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-50 mb-4">Gerar Resumo Executivo</h3>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm p-4 rounded-2xl text-left mb-8 border border-yellow-100 dark:border-yellow-800">
                <p className="font-bold flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4" /> Importante
                </p>
                Este resumo é gerado por IA com base nos metadados e títulos dos artefatos filtrados. A qualidade depende da padronização do Confluence.
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setShowExecutiveModal(false)}
                  className="flex-1 py-4 px-6 rounded-full font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleGenerateExecutiveSummary}
                  disabled={isGeneratingSummary}
                  className="flex-1 py-4 px-6 rounded-full font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingSummary ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Gerando...
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Gerar resumo
                      Gerar resumo
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes Canônico de Telas e Snippets */}
      <MapDetailModal 
        item={detailModalItem} 
        onClose={() => setDetailModalItem(null)} 
      />

      </AIReveal>
    </main>
  );
}
