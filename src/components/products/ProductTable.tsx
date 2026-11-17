import React from 'react';
import { Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Product } from '../../types';
import { formatCurrency, formatQuantity } from '../../utils/formatters';

export interface ProductTableProps {
  products: Product[];
  isLoading?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string | number) => void;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  isLoading,
  onEdit,
  onDelete,
  page,
  totalPages,
  totalItems,
  onPageChange,
}) => {
  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product Name',
      sortable: true,
      render: (p) => (
        <div>
          <p className="font-bold text-slate-900">{p.name}</p>
          <p className="text-xs text-slate-400 font-mono">SKU: {p.sku || '-'}</p>
        </div>
      ),
    },
    {
      key: 'category_name',
      header: 'Category',
      render: (p) => <Badge variant="neutral">{p.category_name || 'Dairy'}</Badge>,
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (p) => <span className="text-slate-600 font-medium">{p.unit}</span>,
    },
    {
      key: 'cost_price',
      header: 'Purchase Cost',
      align: 'right',
      render: (p) => <span className="text-slate-600">{formatCurrency(p.cost_price)}</span>,
    },
    {
      key: 'selling_price',
      header: 'Selling Price',
      align: 'right',
      render: (p) => <span className="font-bold text-slate-900">{formatCurrency(p.selling_price)}</span>,
    },
    {
      key: 'current_stock',
      header: 'Current Stock',
      align: 'right',
      render: (p) => {
        const isLow = p.current_stock <= p.min_stock_level;
        const isOut = p.current_stock <= 0;

        return (
          <div className="flex items-center justify-end gap-1.5">
            {isLow && !isOut && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            <Badge variant={isOut ? 'danger' : isLow ? 'warning' : 'success'}>
              {formatQuantity(p.current_stock, p.unit)}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onEdit(p)}
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
            title="Edit product"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(p.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
            title="Delete product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={products}
      isLoading={isLoading}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      onPageChange={onPageChange}
      emptyMessage="No dairy products found"
    />
  );
};
