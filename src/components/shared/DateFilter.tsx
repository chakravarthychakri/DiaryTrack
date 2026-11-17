import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../utils/cn';

export type DateRangePreset = 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'all' | 'custom';

export interface DateFilterProps {
  activePreset: DateRangePreset;
  startDate?: string;
  endDate?: string;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomDateChange?: (start: string, end: string) => void;
  className?: string;
}

export const DateFilter: React.FC<DateFilterProps> = ({
  activePreset,
  startDate,
  endDate,
  onPresetChange,
  onCustomDateChange,
  className,
}) => {
  const presets: { id: DateRangePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'Last 7 Days' },
    { id: '30days', label: 'Last 30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className={cn('flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200', className)}>
      <div className="flex items-center gap-1.5 px-2 text-slate-500 text-xs font-semibold">
        <Calendar className="w-3.5 h-3.5" />
        <span>Period:</span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {presets.map((p) => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onPresetChange(p.id)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {activePreset === 'custom' && onCustomDateChange && (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-300">
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => onCustomDateChange(e.target.value, endDate || '')}
            className="text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:ring-emerald-500"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate || ''}
            onChange={(e) => onCustomDateChange(startDate || '', e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:ring-emerald-500"
          />
        </div>
      )}
    </div>
  );
};
