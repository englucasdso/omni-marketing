import React from 'react';
import { ChevronLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  onBack,
  showBack = false,
}) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6 pb-6 mb-6 border-b border-gray-200/80 dark:border-slate-800/80 w-full transition-all">
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="btn-neu flex items-center justify-center w-9 h-9 rounded-xl text-gray-600 dark:text-slate-300 hover:text-bradesco-red shrink-0 cursor-pointer transition-colors"
            title="Voltar à tela inicial"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-bold tracking-tight text-gray-900 dark:text-slate-50 truncate">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 font-ui leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </header>
  );
};
