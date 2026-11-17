import React, { useState } from 'react';
import { DataTable, Column } from '../components/shared/DataTable';
import { Badge } from '../components/shared/Badge';
import { Button } from '../components/shared/Button';
import { SearchBar } from '../components/shared/SearchBar';
import { AdjustmentModal } from '../components/inventory/AdjustmentModal';
import { formatCurrency, formatQuantity } from '../utils/formatters';
import { inventoryApi } from '../services/api/inventoryApi';
import { PageHeroBanner } from '../components/shared/PageHeroBanner';
import { SlidersHorizontal, AlertTriangle, ShieldCheck, History } from 'lucide-react';
import { Link } from 'react-router-dom';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  opening_stock: number;
  purchases: number;
  sales: number;
  wastage: number;
  closing_stock: number;
  cost_price: number;
  stock_value: number;
  min_stock_level: number;
}

export const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);

  const [inventory] = useState<InventoryItem[]>([
    {
      id: 'prod-1',
      name: 'Fresh Buffalo Milk 1L',
      category: 'Milk',
      unit: 'L',
      opening_stock: 50,
      purchases: 200,
      sales: 100,
      wastage: 5,
      closing_stock: 145,
      cost_price: 55,
      stock_value: 7975,
      min_stock_level: 25,
    },
    {
      id: 'prod-2',
      name: 'Standard Cow Milk 500ml',
      category: 'Milk',
      unit: 'pkt',
      opening_stock: 40,
      purchases: 100,
      sales: 58,
      wastage: 2,
      closing_stock: 80,
      cost_price: 27,
      stock_value: 2160,
      min_stock_level: 20,
    },
    {
      id: 'prod-3',
      name: 'Fresh Malai Paneer 500g',
      category: 'Paneer',
      unit: 'kg',
      opening_stock: 20,
      purchases: 15,
      sales: 21,
      wastage: 2,
      closing_stock: 12,
      cost_price: 180,
      stock_value: 2160,
      min_stock_level: 15,
    },
    {
      id: 'prod-4',
      name: 'Pure Desi Cow Ghee 500ml',
      category: 'Ghee',
      unit: 'jar',
      opening_stock: 40,
      purchases: 10,
      sales: 15,
      wastage: 0,
      closing_stock: 35,
      cost_price: 450,
      stock_value: 15750,
      min_stock_level: 10,
    },
  ]);

  const totalValue = inventory.reduce((sum, item) => sum + item.stock_value, 0);
  const lowStockCount = inventory.filter((item) => item.closing_stock <= item.min_stock_level).length;

  const filtered = inventory.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: (item) => (
        <div>
          <span className="font-semibold text-neutral-900">{item.name}</span>
          <p className="text-xs text-neutral-500">{item.category}</p>
        </div>
      ),
    },
    {
      key: 'opening_stock',
      header: 'Opening',
      render: (item) => formatQuantity(item.opening_stock, item.unit),
    },
    {
      key: 'purchases',
      header: '+ Inward',
      render: (item) => <span className="text-emerald-700 font-medium">+{item.purchases}</span>,
    },
    {
      key: 'sales',
      header: '- Sales',
      render: (item) => <span className="text-blue-700 font-medium">-{item.sales}</span>,
    },
    {
      key: 'wastage',
      header: '- Wastage',
      render: (item) => <span className="text-rose-600 font-medium">-{item.wastage}</span>,
    },
    {
      key: 'closing_stock',
      header: 'Current Stock',
      sortable: true,
      render: (item) => {
        const isLow = item.closing_stock <= item.min_stock_level;
        return (
          <div className="flex items-center gap-2">
            <span className={`font-bold ${isLow ? 'text-rose-600' : 'text-neutral-900'}`}>
              {formatQuantity(item.closing_stock, item.unit)}
            </span>
            {isLow && (
              <Badge variant="danger" size="sm">
                Low Stock
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'stock_value',
      header: 'Stock Value',
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-neutral-800">{formatCurrency(item.stock_value)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelectedProduct({ id: item.id, name: item.name });
            setAdjustmentModalOpen(true);
          }}
          className="gap-1 text-xs text-neutral-700"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Current Inventory Ledger</h1>
          <p className="text-xs text-neutral-500">Live balance calculated from opening stock + purchases - sales - wastage</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/stock-movements"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <History className="w-3.5 h-3.5 text-neutral-500" /> View Audit Trail
          </Link>
        </div>
      </div>

      <PageHeroBanner
        imageSrc="/images/illustrations/inventory-hero.jpg"
        imageAlt="Cold Chain Inventory & Silos"
        tag="❄️ Cold-Chain & FEFO Storage"
        title="Dairy Inventory & Batch Control"
        caption="Refrigerated Silos • Churns • First-Expired-First-Out"
        description="Automated batch lifecycle tracking, 4°C cold room stock counts, shrinkage detection, and real-time inventory reconciliation."
      />

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <p className="text-xs font-medium text-neutral-500">Total Live Stock Valuation</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <p className="text-xs font-medium text-neutral-500">Tracked SKU Count</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">{inventory.length} Products</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <p className="text-xs font-medium text-neutral-500">Low Stock Threshold Alerts</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-rose-600">{lowStockCount}</p>
            {lowStockCount > 0 && <span className="text-xs text-rose-600 font-medium">Requires reorder</span>}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Filter inventory..." />
        </div>
      </div>

      <DataTable columns={columns} data={filtered} />

      <AdjustmentModal
        isOpen={adjustmentModalOpen}
        onClose={() => {
          setAdjustmentModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onConfirm={async (data) => {
          await inventoryApi.createAdjustment(data);
        }}
      />
    </div>
  );
};
