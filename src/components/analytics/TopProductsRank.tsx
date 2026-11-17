import React, { useState } from 'react';
import { formatCurrency, formatQuantity } from '../../utils/formatters';
import { Award, TrendingUp, Layers, Hash } from 'lucide-react';

export interface ProductRankingItem {
  id: string;
  name: string;
  category: string;
  quantitySold: number;
  revenue: number;
  transactionCount: number;
  unit: string;
}

interface TopProductsRankProps {
  products?: ProductRankingItem[];
}

export const TopProductsRank: React.FC<TopProductsRankProps> = ({
  products = [
    { id: '1', name: 'Standard Toned Milk 500ml', category: 'Milk', quantitySold: 420, revenue: 14700, transactionCount: 165, unit: 'pkt' },
    { id: '2', name: 'Fresh Full Cream Buffalo Milk 1L', category: 'Milk', quantitySold: 310, revenue: 21700, transactionCount: 110, unit: 'L' },
    { id: '3', name: 'Fresh Paneer Malai 500g', category: 'Paneer', quantitySold: 125, revenue: 27500, transactionCount: 92, unit: 'kg' },
    { id: '4', name: 'Pure Desi Cow Ghee 500ml', category: 'Ghee', quantitySold: 48, revenue: 28800, transactionCount: 45, unit: 'jar' },
    { id: '5', name: 'Set Curd Dahi Cup 400g', category: 'Curd', quantitySold: 180, revenue: 7200, transactionCount: 88, unit: 'cup' },
  ],
}) => {
  const [metric, setMetric] = useState<'revenue' | 'quantity' | 'transactions'>('revenue');

  const sorted = [...products].sort((a, b) => {
    if (metric === 'revenue') return b.revenue - a.revenue;
    if (metric === 'quantity') return b.quantitySold - a.quantitySold;
    return b.transactionCount - a.transactionCount;
  });

  const getRankBadge = (index: number) => {
    if (index === 0) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (index === 1) return 'bg-neutral-200 text-neutral-800 border-neutral-300';
    if (index === 2) return 'bg-amber-700/20 text-amber-900 border-amber-400';
    return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div>
          <h3 className="font-bold text-neutral-900 text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Top 5 Products Performance
          </h3>
          <p className="text-xs text-neutral-500">Ranked by sales volume, generated revenue, and customer tickets</p>
        </div>

        {/* Metric Switcher buttons */}
        <div className="inline-flex rounded-lg bg-neutral-100 p-1">
          <button
            onClick={() => setMetric('revenue')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              metric === 'revenue' ? 'bg-white shadow-xs text-emerald-700' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            By Revenue
          </button>
          <button
            onClick={() => setMetric('quantity')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              metric === 'quantity' ? 'bg-white shadow-xs text-emerald-700' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            By Quantity
          </button>
          <button
            onClick={() => setMetric('transactions')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              metric === 'transactions' ? 'bg-white shadow-xs text-emerald-700' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            By Orders
          </button>
        </div>
      </div>

      <div className="divide-y divide-neutral-100">
        {sorted.slice(0, 5).map((item, idx) => (
          <div key={item.id} className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${getRankBadge(
                  idx
                )}`}
              >
                {idx + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{item.name}</p>
                <p className="text-xs text-neutral-500">Category: {item.category}</p>
              </div>
            </div>

            <div className="text-right">
              {metric === 'revenue' && (
                <div>
                  <p className="text-sm font-bold text-emerald-700">{formatCurrency(item.revenue)}</p>
                  <p className="text-xs text-neutral-500">{formatQuantity(item.quantitySold, item.unit)} sold</p>
                </div>
              )}
              {metric === 'quantity' && (
                <div>
                  <p className="text-sm font-bold text-neutral-900">{formatQuantity(item.quantitySold, item.unit)}</p>
                  <p className="text-xs text-neutral-500">{formatCurrency(item.revenue)} total</p>
                </div>
              )}
              {metric === 'transactions' && (
                <div>
                  <p className="text-sm font-bold text-blue-700">{item.transactionCount} orders</p>
                  <p className="text-xs text-neutral-500">{formatCurrency(item.revenue)}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
