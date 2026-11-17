import React, { useState } from 'react';
import { PurchaseOrderList } from '../components/purchases/PurchaseOrderList';
import { ReceivePoModal } from '../components/purchases/ReceivePoModal';
import { SearchBar } from '../components/shared/SearchBar';
import { Button } from '../components/shared/Button';
import { Purchase } from '../types';
import { purchasesApi } from '../services/api/purchasesApi';
import { PageHeroBanner } from '../components/shared/PageHeroBanner';
import { Plus, Truck } from 'lucide-react';

export const Purchases: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const [purchases, setPurchases] = useState<Purchase[]>([
    {
      id: 'po-1',
      po_number: 'PO-2026-088',
      supplier_id: 'sup-1',
      supplier: { id: 'sup-1', name: 'Krishna Dairy Farm', phone: '9845012345' },
      order_date: '2026-11-16',
      expected_delivery_date: '2026-11-17',
      total_amount: 8250,
      status: 'ordered',
      payment_status: 'pending',
      created_at: new Date().toISOString(),
    },
    {
      id: 'po-2',
      po_number: 'PO-2026-087',
      supplier_id: 'sup-2',
      supplier: { id: 'sup-2', name: 'Gokul Milk Producers Union', phone: '9822098765' },
      order_date: '2026-11-14',
      expected_delivery_date: '2026-11-15',
      total_amount: 14500,
      status: 'received',
      payment_status: 'paid',
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ]);

  const handleConfirmReceive = async (purchaseId: string, notes: string) => {
    await purchasesApi.receive(purchaseId, { notes });
    setPurchases((prev) =>
      prev.map((p) => (p.id === purchaseId ? { ...p, status: 'received' } : p))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Purchase Orders & Milk Inward</h1>
          <p className="text-xs text-neutral-500">Track dairy supplier procurement, quality verification & batch generation</p>
        </div>

        <Button
          variant="primary"
          onClick={() => alert('New PO creation workflow: select supplier, add dairy items, and submit.')}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4" /> Create Purchase Order
        </Button>
      </div>

      <PageHeroBanner
        imageSrc="/images/illustrations/purchases-hero.jpg"
        imageAlt="Farm Milk Procurement"
        tag="🐄 Direct Farm Milk Intake"
        title="Milk Procurement & Farm Purchases"
        caption="Dairy Farmers • Milk Churn Intake • Tanker Shipments • Quality Inspection"
        description="Monitor daily morning and evening milk collection batches, FAT & SNF lactometer testing, and supplier invoices."
      />

      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search PO or supplier..." />
        </div>
      </div>

      <PurchaseOrderList
        purchases={purchases}
        onReceive={(po) => {
          setSelectedPurchase(po);
          setReceiveModalOpen(true);
        }}
        onView={(po) => alert(`Purchase Order ${po.po_number}\nSupplier: ${po.supplier?.name}\nTotal: ₹${po.total_amount}`)}
      />

      <ReceivePoModal
        isOpen={receiveModalOpen}
        onClose={() => {
          setReceiveModalOpen(false);
          setSelectedPurchase(null);
        }}
        purchase={selectedPurchase}
        onConfirm={handleConfirmReceive}
      />
    </div>
  );
};
