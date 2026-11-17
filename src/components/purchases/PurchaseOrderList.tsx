import React from 'react';
import { Purchase } from '../../types';
import { DataTable, Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Eye, CheckCircle2, FileText } from 'lucide-react';

interface PurchaseOrderListProps {
  purchases: Purchase[];
  loading?: boolean;
  onReceive: (purchase: Purchase) => void;
  onView: (purchase: Purchase) => void;
}

export const PurchaseOrderList: React.FC<PurchaseOrderListProps> = ({
  purchases,
  loading = false,
  onReceive,
  onView,
}) => {
  const getStatusBadge = (status: Purchase['status']) => {
    switch (status) {
      case 'received':
        return <Badge variant="success">Received</Badge>;
      case 'ordered':
        return <Badge variant="info">Ordered</Badge>;
      case 'partially_received':
        return <Badge variant="warning">Partial</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: Purchase['payment_status']) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success" size="sm">Paid</Badge>;
      case 'partial':
        return <Badge variant="warning" size="sm">Partial</Badge>;
      case 'pending':
        return <Badge variant="danger" size="sm">Pending</Badge>;
      default:
        return null;
    }
  };

  const columns: Column<Purchase>[] = [
    {
      key: 'po_number',
      header: 'PO Number',
      render: (p) => (
        <div>
          <span className="font-semibold text-neutral-900">{p.po_number}</span>
          <p className="text-xs text-neutral-500">{formatDate(p.order_date)}</p>
        </div>
      ),
    },
    {
      key: 'supplier_id',
      header: 'Supplier',
      render: (p) => (
        <div>
          <span className="font-medium text-neutral-800">{p.supplier?.name || 'Local Supplier'}</span>
          <p className="text-xs text-neutral-500">{p.supplier?.phone || '-'}</p>
        </div>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total Cost',
      sortable: true,
      render: (p) => (
        <span className="font-semibold text-neutral-900">{formatCurrency(p.total_amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => getStatusBadge(p.status),
    },
    {
      key: 'payment_status',
      header: 'Payment',
      render: (p) => getPaymentBadge(p.payment_status),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onView(p)}
            title="View Details"
          >
            <Eye className="w-4 h-4 text-neutral-600" />
          </Button>
          {p.status === 'ordered' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReceive(p)}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1 text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Receive
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={purchases}
      loading={loading}
      emptyMessage="No purchase orders found matching this view"
    />
  );
};
