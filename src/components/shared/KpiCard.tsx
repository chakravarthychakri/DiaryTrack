import React from 'react';
import { cn } from '../../utils/cn';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number | string;
    isPositive?: boolean;
    label?: string;
  };
  variant?: 'green' | 'blue' | 'amber' | 'red' | 'neutral';
  className?: string;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'green',
  className,
  onClick,
}) => {
  const borderVariants = {
    green: 'border-t-4 border-t-emerald-600',
    blue: 'border-t-4 border-t-sky-600',
    amber: 'border-t-4 border-t-amber-500',
    red: 'border-t-4 border-t-rose-600',
    neutral: 'border-t-4 border-t-slate-400',
  };

  const iconBgVariants = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
    neutral: 'bg-slate-100 text-slate-600',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-slate-200 p-5 shadow-xs transition-all hover:shadow-md',
        borderVariants[variant],
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">{value}</h3>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>

        {icon && (
          <div className={cn('p-3 rounded-lg flex items-center justify-center shrink-0', iconBgVariants[variant])}>
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs">
          <span className={cn('font-semibold', trend.isPositive ? 'text-emerald-600' : 'text-rose-600')}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
          {trend.label && <span className="text-slate-400">{trend.label}</span>}
        </div>
      )}
    </div>
  );
};
