import React, { useState } from 'react';
import { DataTable, Column } from '../components/shared/DataTable';
import { Badge } from '../components/shared/Badge';
import { SearchBar } from '../components/shared/SearchBar';
import { StockMovement } from '../types';
import { formatDateTime, formatQuantity } from '../utils/formatters';
import { History, ArrowUpRight, ArrowDownLeft, RotateCcw } from 'lucide-react';

export const StockMovements: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const [movements] = useState<StockMovement[]>([
    {
      id: 'mov-1',
      product_id: 'prod-1',
      product: { id: 'prod-1', name: 'Fresh Buffalo Milk 1L', category: 'Milk', unit: 'L', cost_price: 55, selling_price: 70, current_stock: 145, min_stock_level: 25, is_active: true, created_at: '' },
      movement_type: 'sale_outward',
      quantity: -4,
      unit: 'L',
      previous_stock: 149,
      new_stock: 145,
      reason: 'POS Sale #INV-1042',
      created_at: new Date().toISOString(),
      created_by: 'Staff Cashier',
    },
    {
      id: 'mov-2',
      product_id: 'prod-3',
      product: { id: 'prod-3', name: 'Fresh Malai Paneer 500g', category: 'Paneer', unit: 'kg', cost_price: 180, selling_price: 240, current_stock: 12, min_stock_level: 15, is_active: true, created_at: '' },
      movement_type: 'wastage',
      quantity: -2,
      unit: 'kg',
      previous_stock: 14,
      new_stock: 12,
      reason: 'Damage/Spillage during morning batch handling',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      created_by: 'Inventory Manager',
    },
    {
      id: 'mov-3',
      product_id: 'prod-1',
      product: { id: 'prod-1', name: 'Fresh Buffalo Milk 1L', category: 'Milk', unit: 'L', cost_price: 55, selling_price: 70, current_stock: 145, min_stock_level: 25, is_active: true, created_at: '' },
      movement_type: 'purchase_inward',
      quantity: 100,
      unit: 'L',
      previous_stock: 49,
      new_stock: 149,
      reason: 'PO-2026-087 Inward Delivery',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      created_by: 'Admin',
    },
  ]);

  const getMovementBadge = (type: StockMovement['movement_type']) => {
    switch (type) {
      case 'purchase_inward':
        return <Badge variant="success" size="sm" className="gap-1"><ArrowDownLeft className="w-3 h-3" /> Inward</Badge>;
      case 'sale_outward':
        return <Badge variant="info" size="sm" className="gap-1"><ArrowUpRight className="w-3 h-3" /> Sale Out</Badge>;
      case 'wastage':
        return <Badge variant="danger" size="sm" className="gap-1"><RotateCcw className="w-3 h-3" /> Wastage</Badge>;
      case 'adjustment':
        return <Badge variant="warning" size="sm">Adjustment</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{type}</Badge>;
    }
  };

  const columns: Column<StockMovement>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (m) => (
        <div>
          <span className="font-medium text-neutral-800">{formatDateTime(m.created_at)}</span>
          <p className="text-xs text-neutral-400">By: {m.created_by || 'System'}</p>
        </div>
      ),
    },
    {
      key: 'product_id',
      header: 'Product',
      render: (m) => (
        <div>
          <span className="font-semibold text-neutral-900">{m.product?.name || m.product_id}</span>
          <p className="text-xs text-neutral-500">{m.product?.category}</p>
        </div>
      ),
    },
    {
      key: 'movement_type',
      header: 'Type',
      render: (m) => getMovementBadge(m.movement_type),
    },
    {
      key: 'quantity',
      header: 'Quantity Shift',
      sortable: true,
      render: (m) => (
        <span className={`font-mono font-bold ${m.quantity > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
          {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
        </span>
      ),
    },
    {
      key: 'new_stock',
      header: 'Stock Reconciliation',
      render: (m) => (
        <div className="text-xs text-neutral-600 font-mono">
          <span>{m.previous_stock}</span> <span className="text-neutral-400">→</span> <span className="font-bold text-neutral-900">{m.new_stock}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason / Ref Document',
      render: (m) => <span className="text-xs text-neutral-600">{m.reason || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
          <History className="w-6 h-6 text-emerald-600" />
          Auditable Stock Movement Ledger
        </h1>
        <p className="text-xs text-neutral-500">Immutable ledger log ensuring transactional stock reconciliation across all events</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search ledger entries..." />
        </div>
      </div>

      <DataTable columns={columns} data={movements} />
    </div>
  );
};
