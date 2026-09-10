import React, { useEffect } from 'react';
import { 
  LayoutList, 
  Landmark, 
  Layers, 
  Tag, 
  Sparkles, 
  Network, 
  RefreshCw,
  Plug,
  X,
  Compass
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'results', label: 'Cards', path: '/hub-de-artefatos/cards', icon: LayoutList },
  { id: 'inventory_table', label: 'Inventário', path: '/hub-de-artefatos/inventario', icon: Landmark },
  { id: 'produtos_analise', label: 'Por Produto', path: '/hub-de-artefatos/por-produto', icon: Layers },
  { id: 'parametros_analise', label: 'Por Parâmetro', path: '/hub-de-artefatos/por-parametro', icon: Tag },
  { id: 'insights', label: 'Insights', path: '/hub-de-artefatos/insights', icon: Sparkles },
  { id: 'graph', label: 'Conexões', path: '/hub-de-artefatos/conexoes', icon: Network },
];

export interface AppSidebarProps {
  currentRouteId: string;
  onNavigate: (item: NavItem) => void;
  onHomeClick: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onSyncClick?: () => void;
  contextualControls?: React.ReactNode;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentRouteId,
  onNavigate,
  onHomeClick,
  isMobileOpen = false,
  onCloseMobile,
  onSyncClick,
  contextualControls,
}) => {
  // Fecha a navegação móvel ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCloseMobile]);

  return (
    <>
      {/* Backdrop Móvel */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Principal Docked */}
      <aside
        className={`fixed top-0 left-0 h-screen z-40 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col justify-between select-none w-[272px] transition-transform duration-200 ease-in-out
          ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}
        aria-label="Navegação e filtros do sistema"
      >
        {/* Topo: Logo Omni Marketing */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 dark:border-slate-800/80 shrink-0">
          <button
            onClick={() => {
              onHomeClick();
              if (onCloseMobile) onCloseMobile();
            }}
            className="flex items-center gap-2.5 h-10 rounded-xl text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer focus:outline-none overflow-hidden"
            title="Ir para o início"
            aria-label="Omni Marketing - Página inicial"
          >
            <img
              src="/omni-logo-1-icone.png"
              alt="Omni"
              className="w-7 h-7 object-contain rounded-lg shadow-sm"
              referrerPolicy="no-referrer"
            />
            <img
              src="/omni-logo-2-horizontal-branco.png"
              alt="Omni Marketing"
              className="h-6 max-w-[150px] object-contain"
              referrerPolicy="no-referrer"
            />
          </button>

          {/* Botão de Fechar no Mobile */}
          {isMobileOpen && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
              aria-label="Fechar navegação"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Corpo Scrollável: Navegação + Área Contextual + Ações Secundárias */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-4 custom-scrollbar">
          {/* Navegação Primária */}
          <nav className="space-y-1" aria-label="Seções do sistema">
            {NAV_ITEMS.map((item) => {
              const isActive = currentRouteId === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  className={`flex items-center w-full h-9.5 px-2.5 rounded-xl transition-all duration-150 cursor-pointer text-left focus:outline-none min-w-0
                    ${isActive
                      ? 'bg-red-50/80 dark:bg-red-950/40 text-[#7B0209] dark:text-red-400 border border-[#7B0209]/20 dark:border-red-900/50 shadow-sm font-semibold'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 font-medium'
                    }
                  `}
                >
                  <div className="w-7 h-7 flex items-center justify-center shrink-0">
                    <Icon className={`w-4.5 h-4.5 transition-transform duration-150 ${isActive ? 'text-[#7B0209] dark:text-red-400 scale-105' : 'text-gray-500 dark:text-slate-400'}`} />
                  </div>
                  <span className="text-xs font-ui whitespace-nowrap ml-2 truncate">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Área Contextual: Busca e Filtros específicos da aba ativa */}
          {contextualControls && (
            <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 min-w-0 max-w-full">
              {contextualControls}
            </div>
          )}

          {/* Ações do Sistema Secundárias */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-1">
            <button
              onClick={() => {
                if (onSyncClick) onSyncClick();
                if (onCloseMobile) onCloseMobile();
              }}
              aria-label="Sincronização"
              className={`flex items-center w-full h-9 px-2.5 rounded-xl transition-all duration-150 cursor-pointer text-left focus:outline-none min-w-0
                ${currentRouteId === 'sync'
                  ? 'bg-red-50/80 dark:bg-red-950/40 text-[#7B0209] dark:text-red-400 border border-[#7B0209]/20 font-semibold'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 font-medium'
                }
              `}
            >
              <div className="w-7 h-7 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              </div>
              <span className="text-xs font-ui whitespace-nowrap ml-2 truncate">
                Sincronização
              </span>
            </button>

            <button
              disabled
              aria-disabled="true"
              aria-label="Plugins"
              className="flex items-center w-full h-9 px-2.5 rounded-xl transition-all duration-150 cursor-not-allowed text-left text-gray-400 dark:text-slate-600 opacity-60 font-medium min-w-0"
            >
              <div className="w-7 h-7 flex items-center justify-center shrink-0">
                <Plug className="w-4 h-4 text-gray-400 dark:text-slate-600" />
              </div>
              <span className="text-xs font-ui whitespace-nowrap ml-2 truncate">
                Plugins
              </span>
            </button>
          </div>
        </div>

        {/* Rodapé da Sidebar: Nova Busca */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-800/80 shrink-0">
          <button
            onClick={() => {
              onHomeClick();
              if (onCloseMobile) onCloseMobile();
            }}
            className="flex items-center w-full h-9 px-2.5 rounded-xl text-gray-500 hover:text-[#7B0209] dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors cursor-pointer text-left"
            title="Buscar novo termo"
            aria-label="Buscar novo termo"
          >
            <div className="w-7 h-7 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-xs font-ui font-medium whitespace-nowrap ml-2 truncate">
              Nova Busca
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
