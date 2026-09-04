import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: { v: string; l: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}

export function MultiSelect({ label, options, values, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const hasSelections = values.length > 0;
  
  const toggle = (val: string) => {
    if (val === 'all') {
      onChange([]);
    } else {
      if (values.includes(val)) {
        onChange(values.filter(v => v !== val));
      } else {
        onChange([...values, val]);
      }
    }
  };

  const currentLabel = hasSelections 
    ? `${values.length} SELECIONADOS` 
    : (options.find(o => o.v === 'all')?.l || 'TODOS');

  return (
    <div className="flex flex-col gap-1.5 text-center relative" ref={ref}>
      <label className="text-[10px] font-ui font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-2">{label}</label>
      <button 
        onClick={() => setOpen(!open)}
        type="button"
        className={`flex items-center justify-between gap-2 border rounded-xl px-3.5 py-2.5 text-xs font-ui font-semibold outline-none transition-all w-full cursor-pointer
          ${open 
            ? 'border-bradesco-red bg-white dark:bg-slate-900 shadow-neu-raised ring-2 ring-red-50 dark:ring-red-950/30' 
            : 'bg-white dark:bg-slate-800/90 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 shadow-neu-raised hover:border-gray-300 dark:hover:border-slate-600'}
          ${hasSelections ? 'bg-red-50/40 dark:bg-red-950/20 text-bradesco-red dark:text-red-400 border-red-200 dark:border-red-900/50' : ''}
        `}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-[230px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-neu-card rounded-xl z-[100] overflow-hidden flex flex-col text-left">
          <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5 custom-scrollbar">
            <button 
              onClick={() => toggle('all')}
              className="flex items-center gap-2.5 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer w-full text-left transition-colors"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${!hasSelections ? 'bg-bradesco-red border-bradesco-red' : 'border-gray-300 dark:border-slate-600'}`}>
                {!hasSelections && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs font-ui font-semibold text-gray-700 dark:text-slate-200 truncate">
                {options.find(o => o.v === 'all')?.l || 'TODOS'}
              </span>
            </button>
            <div className="h-px bg-gray-100 dark:bg-slate-800 my-1 mx-2" />
            {options.filter(o => o.v !== 'all').map(opt => {
              const isSelected = values.includes(opt.v);
              return (
                <button 
                  key={opt.v}
                  onClick={() => toggle(opt.v)}
                  title={opt.l}
                  className="flex items-center gap-2.5 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer w-full text-left transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-bradesco-red border-bradesco-red' : 'border-gray-300 dark:border-slate-600'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-xs font-ui font-medium text-gray-700 dark:text-slate-200 truncate">{opt.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
