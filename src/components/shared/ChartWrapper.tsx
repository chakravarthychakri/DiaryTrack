import React from 'react';
import { cn } from '../../utils/cn';

export interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  actionElement?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({
  title,
  subtitle,
  actionElement,
  children,
  className,
}) => {
  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actionElement && <div className="shrink-0">{actionElement}</div>}
      </div>

      <div className="w-full flex-1 min-h-[220px]">
        {children}
      </div>
    </div>
  );
};
