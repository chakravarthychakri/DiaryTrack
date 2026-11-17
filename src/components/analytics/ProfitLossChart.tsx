import React from 'react';
import { formatCurrency } from '../../utils/formatters';

interface ProfitBreakdown {
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  operatingProfit: number;
}

interface ProfitLossChartProps {
  data?: ProfitBreakdown;
  periodLabel?: string;
}

export const ProfitLossChart: React.FC<ProfitLossChartProps> = ({
  data = {
    grossSales: 350000,
    discounts: 5000,
    returns: 2000,
    netSales: 343000,
    cogs: 225000,
    grossProfit: 118000,
    expenses: 42000,
    operatingProfit: 76000,
  },
  periodLabel = 'Current Month',
}) => {
  const steps = [
    { label: 'Gross Sales', amount: data.grossSales, color: 'bg-emerald-500', barColor: '#10b981', type: 'positive' },
    { label: 'Discounts', amount: -data.discounts, color: 'bg-amber-500', barColor: '#f59e0b', type: 'negative' },
    { label: 'Returns', amount: -data.returns, color: 'bg-rose-500', barColor: '#f43f5e', type: 'negative' },
    { label: 'Net Sales', amount: data.netSales, color: 'bg-teal-600', barColor: '#0d9488', type: 'subtotal' },
    { label: 'COGS (Cost)', amount: -data.cogs, color: 'bg-rose-600', barColor: '#e11d48', type: 'negative' },
    { label: 'Gross Profit', amount: data.grossProfit, color: 'bg-blue-600', barColor: '#2563eb', type: 'subtotal' },
    { label: 'Operating Expenses', amount: -data.expenses, color: 'bg-amber-600', barColor: '#d97706', type: 'negative' },
    { label: 'Operating Profit', amount: data.operatingProfit, color: 'bg-emerald-600', barColor: '#059669', type: 'final' },
  ];

  const maxVal = Math.max(...steps.map(s => Math.abs(s.amount)), 1);

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-4">
        <div>
          <h3 className="font-bold text-neutral-900 text-lg">P&L Waterfall & Margin Analysis</h3>
          <p className="text-xs text-neutral-500">
            Reconciled accounting breakdown ({periodLabel})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">
            Net Margin: {((data.operatingProfit / (data.netSales || 1)) * 100).toFixed(1)}%
          </span>
          <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-full border border-blue-200">
            Gross Margin: {((data.grossProfit / (data.netSales || 1)) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Visual Waterfall Bars */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const pct = Math.min(100, Math.max(4, (Math.abs(step.amount) / maxVal) * 100));
          const isNegative = step.amount < 0;

          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className={`font-medium ${step.type === 'final' ? 'font-bold text-emerald-800' : 'text-neutral-700'}`}>
                  {step.label}
                </span>
                <span className={`font-mono font-semibold ${isNegative ? 'text-rose-600' : 'text-neutral-900'}`}>
                  {isNegative ? '-' : ''}{formatCurrency(Math.abs(step.amount))}
                </span>
              </div>
              <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden flex">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${step.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Expense breakdown notice */}
      <div className="pt-2 border-t border-neutral-100 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Positive Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Inventory & Returns Cost
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span> Operating Overheads
        </span>
      </div>
    </div>
  );
};
