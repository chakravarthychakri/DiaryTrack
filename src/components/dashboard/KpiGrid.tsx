import React from 'react';
import { DollarSign, ShoppingBag, Boxes, AlertTriangle, AlertOctagon, TrendingUp } from 'lucide-react';
import { KpiCard } from '../shared/KpiCard';
import { formatCurrency } from '../../utils/formatters';

export interface KpiGridProps {
  stats?: {
    todaySales?: number;
    todayOrders?: number;
    inventoryValuation?: number;
    lowStockCount?: number;
    expiringCount?: number;
    grossProfit?: number;
  };
  isLoading?: boolean;
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  stats = {
    todaySales: 14835,
    todayOrders: 18,
    inventoryValuation: 67200,
    lowStockCount: 2,
    expiringCount: 3,
    grossProfit: 3214,
  },
  isLoading = false,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard
        title="Today's Revenue"
        value={isLoading ? '...' : formatCurrency(stats.todaySales)}
        subtitle="Gross sales across POS"
        icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
        variant="green"
        trend={{ value: '+12.4%', isPositive: true, label: 'vs yesterday' }}
      />

      <KpiCard
        title="Orders Completed"
        value={isLoading ? '...' : `${stats.todayOrders || 0} bills`}
        subtitle="Invoiced counter transactions"
        icon={<ShoppingBag className="w-5 h-5 text-sky-600" />}
        variant="blue"
      />

      <KpiCard
        title="Stock Valuation"
        value={isLoading ? '...' : formatCurrency(stats.inventoryValuation)}
        subtitle="Cost value of active batches"
        icon={<Boxes className="w-5 h-5 text-slate-700" />}
        variant="neutral"
      />

      <KpiCard
        title="Low Stock Alerts"
        value={isLoading ? '...' : stats.lowStockCount || 0}
        subtitle="Below minimum reorder level"
        icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
        variant="amber"
      />

      <KpiCard
        title="Near Expiry Batches"
        value={isLoading ? '...' : stats.expiringCount || 0}
        subtitle="Expiring within 7 days"
        icon={<AlertOctagon className="w-5 h-5 text-rose-600" />}
        variant="red"
      />

      <KpiCard
        title="Gross Profit"
        value={isLoading ? '...' : formatCurrency(stats.grossProfit)}
        subtitle="Net sales minus COGS"
        icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
        variant="green"
        trend={{ value: '18.2%', isPositive: true, label: 'margin' }}
      />
    </div>
  );
};
