import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutList, 
  Landmark, 
  Layers, 
  Tag, 
  Sparkles, 
  Network, 
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

interface AppSidebarProps {
  currentRouteId: string;
  onNavigate: (item: NavItem) => void;
  onHomeClick: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentRouteId,
  onNavigate,
  onHomeClick,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusedWithin, setIsFocusedWithin] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ id: string; top: number; label: string } | null>(null);

  const sidebarRef = useRef<HTMLElement>(null);

  const isExpanded = isHovered || isFocusedWithin;

  // Handle outside click or escape key for mobile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCloseMobile) onCloseMobile();
        setHoveredTooltip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCloseMobile]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => {
          setIsHovered(true);
          setHoveredTooltip(null);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setHoveredTooltip(null);
        }}
        onFocus={() => setIsFocusedWithin(true)}
        onBlur={(e) => {
          if (!sidebarRef.current?.contains(e.relatedTarget as Node)) {
            setIsFocusedWithin(false);
          }
        }}
        className={`fixed top-0 left-0 h-screen z-40 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-all duration-200 ease-in-out flex flex-col justify-between select-none
          ${isMobileOpen ? 'translate-x-0 w-[240px] shadow-2xl' : '-translate-x-full md:translate-x-0'}
          ${isExpanded ? 'md:w-[240px] md:shadow-2xl' : 'md:w-16'}
        `}
        aria-label="Navegação principal"
      >
        {/* Top Header / Logo Placeholder */}
        <div>
          <div className="h-16 flex items-center px-3 border-b border-gray-100 dark:border-slate-800/80">
            <button
              onClick={() => {
                onHomeClick();
                if (onCloseMobile) onCloseMobile();
              }}
              className="flex items-center gap-3 w-full rounded-xl p-1 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-bradesco-red"
              title="Ir para o início do Hub de Artefatos"
              aria-label="Omni Hub - Página inicial"
            >
              {/* Símbolo compacto reservado para o futuro logo */}
              <div className="w-10 h-10 rounded-xl bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900 flex items-center justify-center font-heading font-bold text-base shadow-neu-raised shrink-0 border border-gray-800 dark:border-slate-300">
                <span className="tracking-tighter">O</span>
              </div>

              {/* Texto suave revelado no estado expandido */}
              <div 
                className={`flex flex-col min-w-0 transition-opacity duration-150 overflow-hidden ${
                  isExpanded || isMobileOpen ? 'opacity-100' : 'opacity-0 md:w-0'
                }`}
              >
                <span className="font-heading font-bold text-sm tracking-tight text-gray-900 dark:text-slate-100 truncate">
                  Omni
                </span>
                <span className="text-[10px] font-ui text-gray-400 dark:text-slate-500 uppercase tracking-widest truncate">
                  Hub de Artefatos
                </span>
              </div>
            </button>

            {/* Close button for mobile */}
            {isMobileOpen && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 ml-auto"
                aria-label="Fechar navegação"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-1 mt-3" aria-label="Seções do sistema">
            {NAV_ITEMS.map((item) => {
              const isActive = currentRouteId === item.id;
              const Icon = item.icon;

              return (
                <div key={item.id} className="relative">
                  <button
                    onClick={() => {
                      onNavigate(item);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    onMouseEnter={(e) => {
                      if (!isExpanded && !isMobileOpen) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredTooltip({
                          id: item.id,
                          top: rect.top + rect.height / 2,
                          label: item.label,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredTooltip(null);
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                    className={`flex items-center w-full h-11 rounded-xl transition-all duration-150 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-bradesco-red
                      ${isActive
                        ? 'bg-red-50/80 dark:bg-red-950/40 text-bradesco-red border border-red-200/70 dark:border-red-900/50 shadow-neu-raised font-semibold'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 font-medium'
                      }
                    `}
                  >
                    {/* Ícone fixo no centro exato da sidebar recolhida (w-10 dentro dos 64px) */}
                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                      <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'text-bradesco-red scale-105' : 'text-gray-500 dark:text-slate-400'}`} />
                    </div>

                    {/* Rótulo visível apenas quando expandido */}
                    <span 
                      className={`text-xs font-ui whitespace-nowrap ml-2 transition-all duration-150 truncate ${
                        isExpanded || isMobileOpen ? 'opacity-100' : 'opacity-0 md:w-0'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom indicator/helper area */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-800/80">
          <button
            onClick={() => {
              onHomeClick();
              if (onCloseMobile) onCloseMobile();
            }}
            className="flex items-center w-full h-10 rounded-xl text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-1"
            title="Buscar novo termo"
            aria-label="Buscar novo termo"
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <span 
              className={`text-[11px] font-ui whitespace-nowrap ml-2 transition-all duration-150 truncate ${
                isExpanded || isMobileOpen ? 'opacity-100' : 'opacity-0 md:w-0'
              }`}
            >
              Nova Busca
            </span>
          </button>
        </div>
      </aside>

      {/* Floating Tooltip when collapsed */}
      {hoveredTooltip && !isExpanded && !isMobileOpen && (
        <div 
          className="fixed left-[72px] z-50 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900 text-xs font-ui font-medium shadow-xl pointer-events-none -translate-y-1/2 transition-opacity duration-150 animate-fade-in"
          style={{ top: `${hoveredTooltip.top}px` }}
          role="tooltip"
        >
          {hoveredTooltip.label}
        </div>
      )}
    </>
  );
};
