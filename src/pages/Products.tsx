import React, { useState } from 'react';
import { ProductTable } from '../components/products/ProductTable';
import { ProductModal } from '../components/products/ProductModal';
import { SearchBar } from '../components/shared/SearchBar';
import { Button } from '../components/shared/Button';
import { ExportButton } from '../components/shared/ExportButton';
import { PageHeroBanner } from '../components/shared/PageHeroBanner';
import { Product } from '../types';
import { productsApi } from '../services/api/productsApi';
import { reportsApi } from '../services/api/reportsApi';
import { Plus, Filter } from 'lucide-react';

export const Products: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Mock initial products dataset for instant UI feedback
  const [products, setProducts] = useState<Product[]>([
    {
      id: 'prod-1',
      name: 'Fresh Buffalo Milk 1L',
      sku: 'MLK-BUF-01',
      barcode: '8901234567890',
      category: 'Milk',
      unit: 'L',
      cost_price: 55,
      selling_price: 70,
      current_stock: 145,
      min_stock_level: 25,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-2',
      name: 'Standard Cow Milk 500ml',
      sku: 'MLK-COW-02',
      barcode: '8901234567891',
      category: 'Milk',
      unit: 'pkt',
      cost_price: 27,
      selling_price: 35,
      current_stock: 80,
      min_stock_level: 20,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-3',
      name: 'Fresh Malai Paneer 500g',
      sku: 'PAN-MAL-01',
      barcode: '8901234567892',
      category: 'Paneer',
      unit: 'kg',
      cost_price: 180,
      selling_price: 240,
      current_stock: 12,
      min_stock_level: 15,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-4',
      name: 'Pure Desi Cow Ghee 500ml',
      sku: 'GHE-COW-01',
      barcode: '8901234567893',
      category: 'Ghee',
      unit: 'jar',
      cost_price: 450,
      selling_price: 600,
      current_stock: 35,
      min_stock_level: 10,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-5',
      name: 'Fresh Curd Dahi 400g',
      sku: 'CRD-DAH-01',
      barcode: '8901234567894',
      category: 'Curd',
      unit: 'cup',
      cost_price: 28,
      selling_price: 40,
      current_stock: 50,
      min_stock_level: 15,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-6',
      name: 'Kaju Katli Sweet 250g',
      sku: 'SWT-KAJ-01',
      barcode: '8901234567895',
      category: 'Sweets',
      unit: 'box',
      cost_price: 190,
      selling_price: 260,
      current_stock: 18,
      min_stock_level: 8,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (productData: Partial<Product>) => {
    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? ({ ...p, ...productData } as Product) : p))
      );
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: productData.name || '',
        sku: productData.sku || `SKU-${Date.now()}`,
        category: productData.category || 'Milk',
        unit: productData.unit || 'L',
        cost_price: Number(productData.cost_price || 0),
        selling_price: Number(productData.selling_price || 0),
        current_stock: Number(productData.current_stock || 0),
        min_stock_level: Number(productData.min_stock_level || 10),
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setProducts((prev) => [newProduct, ...prev]);
    }
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to deactivate this dairy product?')) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Product Master</h1>
          <p className="text-xs text-neutral-500">Manage SKUs, categories, pricing, barcodes, and minimum stock alerts</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton
            onExport={async (fmt) => {
              if (fmt === 'excel') await reportsApi.downloadExcel({ category: selectedCategory });
              else window.print();
            }}
            label="Export Products"
          />
          <Button
            variant="primary"
            onClick={() => {
              setEditingProduct(null);
              setModalOpen(true);
            }}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </div>
      </div>

      <PageHeroBanner
        imageSrc="/images/illustrations/products-hero.jpg"
        imageAlt="Dairy Products Catalog"
        tag="🧀 100% Pure Dairy Catalog"
        title="Fresh Dairy Products & Catalog"
        caption="Milk • Curd • Paneer • Butter • Ghee • Ice Cream"
        description="Complete SKU inventory master with FAT & SNF purity specifications, cold storage thresholds, and tiered pricing."
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name, SKU or barcode..."
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Milk">Milk</option>
            <option value="Paneer">Paneer</option>
            <option value="Ghee">Ghee & Butter</option>
            <option value="Curd">Curd & Yogurt</option>
            <option value="Sweets">Dairy Sweets</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <ProductTable
        products={filteredProducts}
        onEdit={(prod) => {
          setEditingProduct(prod);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
      />

      {/* Create / Edit Modal */}
      <ProductModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSave={handleSave}
      />
    </div>
  );
};
