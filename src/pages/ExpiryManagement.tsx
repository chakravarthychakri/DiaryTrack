import React, { useState } from 'react';
import { DataTable, Column } from '../components/shared/DataTable';
import { Badge } from '../components/shared/Badge';
import { Button } from '../components/shared/Button';
import { Modal } from '../components/shared/Modal';
import { FormInput } from '../components/shared/FormInput';
import { KpiCard } from '../components/shared/KpiCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import { AlertTriangle, Clock, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ExpiryItem {
  id: string;
  product_name: string;
  batch_number: string;
  quantity: number;
  unit: string;
  cost_price: number;
  expiry_date: string;
  days_to_expiry: number;
  status: 'expired' | 'today' | 'within_3' | 'within_7';
}

interface WastageRecord {
  id: string;
  product_name: string;
  batch_number: string;
  quantity: number;
  unit: string;
  reason: string;
  cost_per_unit: number;
  total_loss: number;
  date: string;
  recorded_by: string;
}

export const ExpiryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'expiry' | 'wastage'>('expiry');
  const [modalOpen, setModalOpen] = useState(false);

  // Wastage form states
  const [productName, setProductName] = useState('Fresh Malai Paneer 500g');
  const [batchNumber, setBatchNumber] = useState('PAN-20261115-01');
  const [wasteQty, setWasteQty] = useState(2);
  const [costPerUnit, setCostPerUnit] = useState(180);
  const [wasteReason, setWasteReason] = useState('spoiled');
  const [notes, setNotes] = useState('');

  const [expiryBatches] = useState<ExpiryItem[]>([
    {
      id: 'b-1',
      product_name: 'Fresh Buffalo Milk 1L',
      batch_number: 'MLK-20261116-01',
      quantity: 15,
      unit: 'L',
      cost_price: 55,
      expiry_date: '2026-11-18',
      days_to_expiry: 1,
      status: 'within_3',
    },
    {
      id: 'b-2',
      product_name: 'Fresh Curd Dahi Cup 400g',
      batch_number: 'CRD-20261114-02',
      quantity: 8,
      unit: 'cup',
      cost_price: 28,
      expiry_date: '2026-11-17',
      days_to_expiry: 0,
      status: 'today',
    },
    {
      id: 'b-3',
      product_name: 'Fresh Paneer Malai',
      batch_number: 'PAN-20261112-01',
      quantity: 3,
      unit: 'kg',
      cost_price: 180,
      expiry_date: '2026-11-15',
      days_to_expiry: -2,
      status: 'expired',
    },
  ]);

  const [wastageHistory, setWastageHistory] = useState<WastageRecord[]>([
    {
      id: 'w-1',
      product_name: 'Fresh Paneer Malai',
      batch_number: 'PAN-20261112-01',
      quantity: 2,
      unit: 'kg',
      reason: 'Spilled during morning transfer',
      cost_per_unit: 180,
      total_loss: 360,
      date: '2026-11-17',
      recorded_by: 'Staff Cashier',
    },
  ]);

  const calculatedLoss = wasteQty * costPerUnit;

  const handleConfirmWastage = () => {
    const record: WastageRecord = {
      id: `w-${Date.now()}`,
      product_name: productName,
      batch_number: batchNumber,
      quantity: wasteQty,
      unit: 'unit',
      reason: wasteReason,
      cost_per_unit: costPerUnit,
      total_loss: calculatedLoss,
      date: new Date().toISOString().slice(0, 10),
      recorded_by: 'Current Manager',
    };
    setWastageHistory((prev) => [record, ...prev]);
    setModalOpen(false);
  };

  const expiryColumns: Column<ExpiryItem>[] = [
    {
      key: 'product_name',
      header: 'Product & Batch',
      render: (b) => (
        <div>
          <span className="font-semibold text-neutral-900">{b.product_name}</span>
          <p className="text-xs font-mono text-neutral-500">Batch: {b.batch_number}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity at Risk',
      render: (b) => (
        <span className="font-bold text-neutral-900">{b.quantity} {b.unit}</span>
      ),
    },
    {
      key: 'expiry_date',
      header: 'Expiry Date',
      render: (b) => (
        <div>
          <span className="font-medium text-neutral-800">{formatDate(b.expiry_date)}</span>
          <p className="text-xs text-neutral-500">
            {b.days_to_expiry < 0
              ? `Expired ${Math.abs(b.days_to_expiry)}d ago`
              : b.days_to_expiry === 0
              ? 'Expires Today'
              : `In ${b.days_to_expiry} days`}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Urgency Status',
      render: (b) => {
        if (b.status === 'expired') return <Badge variant="danger">Expired</Badge>;
        if (b.status === 'today') return <Badge variant="danger">Expires Today</Badge>;
        if (b.status === 'within_3') return <Badge variant="warning">Within 3 Days</Badge>;
        return <Badge variant="info">Within 7 Days</Badge>;
      },
    },
    {
      key: 'cost_price',
      header: 'Potential Loss',
      sortable: true,
      render: (b) => (
        <span className="font-semibold text-rose-600">{formatCurrency(b.quantity * b.cost_price)}</span>
      ),
    },
  ];

  const wastageColumns: Column<WastageRecord>[] = [
    {
      key: 'date',
      header: 'Date & Recorded By',
      render: (w) => (
        <div>
          <span className="font-medium text-neutral-900">{formatDate(w.date)}</span>
          <p className="text-xs text-neutral-500">By: {w.recorded_by}</p>
        </div>
      ),
    },
    {
      key: 'product_name',
      header: 'Product / Batch',
      render: (w) => (
        <div>
          <span className="font-semibold text-neutral-900">{w.product_name}</span>
          <p className="text-xs font-mono text-neutral-500">{w.batch_number}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (w) => <span className="text-xs capitalize font-medium text-neutral-800">{w.reason}</span>,
    },
    {
      key: 'quantity',
      header: 'Wasted Quantity',
      render: (w) => <span className="font-bold text-rose-600">{w.quantity} {w.unit}</span>,
    },
    {
      key: 'total_loss',
      header: 'Total Loss (Cost)',
      sortable: true,
      render: (w) => <span className="font-bold text-rose-700">{formatCurrency(w.total_loss)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Expiry & Wastage Control
          </h1>
          <p className="text-xs text-neutral-500">Real-time shelf life monitoring, FEFO dispatch prioritization & verified write-offs</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            onClick={() => setModalOpen(true)}
            className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Trash2 className="w-4 h-4" /> Record Wastage / Spillage
          </Button>
        </div>
      </div>

      {/* Expiry KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Expiring Today" value="8 Units" status="danger" icon={<Clock className="w-4 h-4" />} />
        <KpiCard title="Expiring in 3 Days" value="15 Units" status="warning" icon={<Clock className="w-4 h-4" />} />
        <KpiCard title="Expiring in 7 Days" value="42 Units" status="info" icon={<Clock className="w-4 h-4" />} />
        <KpiCard title="Already Expired" value="3 Units" status="danger" icon={<AlertTriangle className="w-4 h-4" />} />
        <KpiCard title="Total Expiry Loss" value={formatCurrency(1425)} status="danger" icon={<ShieldAlert className="w-4 h-4" />} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('expiry')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'expiry'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Active Expiry Radar ({expiryBatches.length})
        </button>
        <button
          onClick={() => setActiveTab('wastage')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'wastage'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Confirmed Wastage Ledger ({wastageHistory.length})
        </button>
      </div>

      {activeTab === 'expiry' ? (
        <DataTable columns={expiryColumns} data={expiryBatches} />
      ) : (
        <DataTable columns={wastageColumns} data={wastageHistory} />
      )}

      {/* Record Wastage Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Inventory Wastage / Spoilage"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmWastage} className="bg-rose-600 hover:bg-rose-700 text-white">
              Confirm & Deduct from Stock
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <FormInput label="Product Name" value={productName} onChange={(e) => setProductName(e.target.value)} required />
          <FormInput label="Batch Code" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="Wasted Quantity"
              type="number"
              value={wasteQty}
              onChange={(e) => setWasteQty(Number(e.target.value))}
              required
            />
            <FormInput
              label="Cost Per Unit (₹)"
              type="number"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-1.5">
              Wastage Reason
            </label>
            <select
              value={wasteReason}
              onChange={(e) => setWasteReason(e.target.value)}
              className="w-full text-sm rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="spoiled">Spoiled / Curdled / Sour</option>
              <option value="expired">Expired Past Shelf Life</option>
              <option value="spilled">Spilled / Leaked Packaging</option>
              <option value="damaged">Damaged in Transit</option>
              <option value="other">Other Audit Loss</option>
            </select>
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1">
            <div className="flex justify-between font-semibold text-rose-900">
              <span>Calculated Wastage Loss:</span>
              <span className="font-mono text-sm">{formatCurrency(calculatedLoss)}</span>
            </div>
            <p className="text-rose-700">Wastage Cost = Wasted Quantity ({wasteQty}) × Unit Cost ({costPerUnit})</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
