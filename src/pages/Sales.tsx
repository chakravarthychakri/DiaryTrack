import React, { useState } from 'react';
import { PosTerminal } from '../components/sales/PosTerminal';
import { DataTable, Column } from '../components/shared/DataTable';
import { Badge } from '../components/shared/Badge';
import { Button } from '../components/shared/Button';
import { SearchBar } from '../components/shared/SearchBar';
import { Sale } from '../types';
import { salesApi } from '../services/api/salesApi';
import { PageHeroBanner } from '../components/shared/PageHeroBanner';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { ShoppingBag, Receipt, ArrowLeftRight, Eye } from 'lucide-react';

export const Sales: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [searchTerm, setSearchTerm] = useState('');

  const [salesHistory] = useState<Sale[]>([
    {
      id: 'sale-1',
      invoice_number: 'INV-2026-1042',
      customer_id: 'cust-walkin',
      customer: { id: 'cust-walkin', name: 'Walk-in Customer' },
      total_amount: 480,
      discount_amount: 0,
      tax_amount: 0,
      payment_method: 'upi',
      status: 'completed',
      created_at: new Date().toISOString(),
      items: [
        {
          id: 'item-1',
          sale_id: 'sale-1',
          product_id: 'prod-1',
          product: { id: 'prod-1', name: 'Fresh Buffalo Milk 1L', category: 'Milk', unit: 'L', cost_price: 55, selling_price: 70, current_stock: 145, min_stock_level: 25, is_active: true, created_at: '' },
          quantity: 4,
          unit_price: 70,
          total_price: 280,
        },
        {
          id: 'item-2',
          sale_id: 'sale-1',
          product_id: 'prod-3',
          product: { id: 'prod-3', name: 'Fresh Malai Paneer 500g', category: 'Paneer', unit: 'kg', cost_price: 180, selling_price: 240, current_stock: 12, min_stock_level: 15, is_active: true, created_at: '' },
          quantity: 1,
          unit_price: 200,
          total_price: 200,
        },
      ],
    },
    {
      id: 'sale-2',
      invoice_number: 'INV-2026-1041',
      customer_id: 'cust-2',
      customer: { id: 'cust-2', name: 'Amrut Sweet Shop', phone: '9845112233' },
      total_amount: 1900,
      discount_amount: 50,
      tax_amount: 0,
      payment_method: 'cash',
      status: 'completed',
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ]);

  const columns: Column<Sale>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (s) => (
        <div>
          <span className="font-semibold text-neutral-900">{s.invoice_number}</span>
          <p className="text-xs text-neutral-500">{formatDateTime(s.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'customer_id',
      header: 'Customer',
      render: (s) => (
        <div>
          <span className="font-medium text-neutral-800">{s.customer?.name || 'Walk-in Customer'}</span>
          {s.customer?.phone && <p className="text-xs text-neutral-500">{s.customer.phone}</p>}
        </div>
      ),
    },
    {
      key: 'payment_method',
      header: 'Payment Method',
      render: (s) => (
        <Badge variant={s.payment_method === 'upi' ? 'info' : 'success'} size="sm" className="uppercase text-[10px]">
          {s.payment_method}
        </Badge>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total Paid',
      sortable: true,
      render: (s) => (
        <span className="font-bold text-neutral-900">{formatCurrency(s.total_amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <Badge variant="success" size="sm">
          {s.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => alert(`Invoice ${s.invoice_number} details:\nTotal: ₹${s.total_amount}\nMethod: ${s.payment_method}`)}
          className="gap-1 text-xs"
        >
          <Receipt className="w-3.5 h-3.5" /> Receipt
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Point of Sale & Invoices</h1>
          <p className="text-xs text-neutral-500">Fast retail barcode checkout, auto batch deduction & customer receipts</p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-lg bg-neutral-200/60 p-1">
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'pos' ? 'bg-white shadow-xs text-emerald-700' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> POS Register
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'history' ? 'bg-white shadow-xs text-emerald-700' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" /> Invoices & Sales History
          </button>
        </div>
      </div>

      <PageHeroBanner
        imageSrc="/images/illustrations/sales-hero.jpg"
        imageAlt="Dairy POS Billing"
        tag="⚡ Fast POS Counter"
        title="Retail Dairy Billing & POS Counter"
        caption="Instant Milk & Delights Billing • Automated FEFO Batch Allocation • Thermal Receipts"
        description="Fast retail point-of-sale terminal with barcode scanning, auto-deduction of nearest-expiry batches, and split payment modes."
      />

      {activeTab === 'pos' ? (
        <PosTerminal
          onCheckoutSuccess={async (saleData) => {
            await salesApi.createSale(saleData);
            alert('Sale completed successfully! Stock updated in ledger.');
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
            <div className="w-full sm:w-80">
              <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search invoice or customer..." />
            </div>
          </div>
          <DataTable columns={columns} data={salesHistory} />
        </div>
      )}
    </div>
  );
};
