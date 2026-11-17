import React from 'react';
import { ShoppingCart, Package, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Badge } from '../shared/Badge';

export interface ActivityItem {
  id: string;
  type: 'sale' | 'purchase' | 'wastage' | 'movement';
  title: string;
  subtitle: string;
  amount?: number;
  quantity?: number;
  timestamp: string;
  status?: string;
}

interface RecentActivityProps {
  activities?: ActivityItem[];
  onViewAll?: () => void;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  activities = [
    {
      id: 'act-1',
      type: 'sale',
      title: 'Retail Sale #INV-1042',
      subtitle: '4 items • Walk-in Customer (UPI)',
      amount: 480,
      timestamp: new Date().toISOString(),
      status: 'completed',
    },
    {
      id: 'act-2',
      type: 'purchase',
      title: 'Received Milk Batch #PO-882',
      subtitle: 'Krishna Dairy Farm • 150 L Buffalo Milk',
      amount: 8250,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'received',
    },
    {
      id: 'act-3',
      type: 'wastage',
      title: 'Spillage Logged',
      subtitle: 'Paneer Fresh 500g • Batch B240 • 2 pkts',
      amount: 320,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: 'approved',
    },
    {
      id: 'act-4',
      type: 'sale',
      title: 'Wholesale Sale #INV-1041',
      subtitle: 'Amrut Sweets • 20 kg Curd (Cash)',
      amount: 1900,
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      status: 'completed',
    },
  ],
  onViewAll,
}) => {
  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="w-4 h-4 text-emerald-600" />;
      case 'purchase':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'wastage':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default:
        return <Package className="w-4 h-4 text-neutral-600" />;
    }
  };

  const getBadgeVariant = (type: ActivityItem['type']) => {
    switch (type) {
      case 'sale':
        return 'success';
      case 'purchase':
        return 'info';
      case 'wastage':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-neutral-900">Recent Store Activity</h3>
          <p className="text-xs text-neutral-500">Live operational events recorded in this shop</p>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="divide-y divide-neutral-100">
        {activities.map((act) => (
          <div key={act.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
                {getIcon(act.type)}
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-800">{act.title}</p>
                <p className="text-xs text-neutral-500">{act.subtitle}</p>
                <span className="text-[11px] text-neutral-400 mt-0.5 block">{formatDateTime(act.timestamp)}</span>
              </div>
            </div>

            <div className="text-right">
              {act.amount !== undefined && (
                <p className={`text-sm font-semibold ${act.type === 'wastage' ? 'text-rose-600' : 'text-neutral-900'}`}>
                  {act.type === 'wastage' ? '-' : ''}
                  {formatCurrency(act.amount)}
                </p>
              )}
              {act.status && (
                <Badge variant={getBadgeVariant(act.type)} size="sm" className="mt-1 uppercase text-[10px]">
                  {act.status}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
