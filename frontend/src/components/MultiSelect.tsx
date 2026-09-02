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
      <label className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest px-2">{label}</label>
      <button 
        onClick={() => setOpen(!open)}
        type="button"
        className={`flex items-center justify-between gap-2 border rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none transition-colors w-full cursor-pointer
          ${open ? 'border-gray-300 bg-white dark:bg-slate-900 dark:border-slate-800 ring-2 ring-gray-100 shadow-sm dark:shadow-none' : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:border-gray-200 dark:border-slate-600'}
          ${hasSelections ? 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-50 border-gray-200 dark:border-slate-600' : ''}
        `}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="w-3 h-3 text-gray-400 dark:text-slate-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[220px] bg-white dark:bg-slate-900 dark:border-slate-800 border border-gray-200 dark:border-slate-600 shadow-xl dark:shadow-none rounded-xl z-[100] overflow-hidden flex flex-col text-left">
          <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5">
            <button 
              onClick={() => toggle('all')}
              className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:bg-slate-800 rounded-lg cursor-pointer w-full text-left"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${!hasSelections ? 'bg-gray-800 border-gray-800' : 'border-gray-300'}`}>
                {!hasSelections && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase truncate">
                {options.find(o => o.v === 'all')?.l || 'TODOS'}
              </span>
            </button>
            <div className="h-px bg-gray-100 dark:bg-slate-700 my-1 mx-2" />
            {options.filter(o => o.v !== 'all').map(opt => {
              const isSelected = values.includes(opt.v);
              return (
                <button 
                  key={opt.v}
                  onClick={() => toggle(opt.v)}
                  title={opt.l}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:bg-slate-800 rounded-lg cursor-pointer w-full text-left"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-gray-800 border-gray-800' : 'border-gray-300'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase truncate">{opt.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
