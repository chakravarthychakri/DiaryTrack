import React, { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { FormInput } from '../shared/FormInput';
import { Button } from '../shared/Button';
import { Product, Category } from '../../types';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
  product?: Product | null;
  categories?: Category[];
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  categories = [],
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category_id: 9,
    unit: 'Packet',
    cost_price: 0,
    selling_price: 0,
    min_stock_level: 10,
    shelf_life_days: 3,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({
        name: '',
        category_id: categories[0]?.id || 9,
        unit: 'Packet',
        cost_price: 0,
        selling_price: 0,
        min_stock_level: 10,
        shelf_life_days: 3,
      });
    }
  }, [product, categories, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const units = ['Liter', 'ml', 'Kg', 'Gram', 'Piece', 'Packet', 'Box'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Product Details' : 'Add New Dairy Product'}
      subtitle="Configure master product pricing, measurement unit, and reorder levels"
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {product ? 'Save Changes' : 'Create Product'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Product Name"
          required
          placeholder="e.g. Fresh Pure Cow Milk 1L Pouch"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category_id || 9}
              onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
              className="w-full text-sm py-2 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unit of Measure <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.unit || 'Packet'}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full text-sm py-2 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Purchase Cost Price (₹)"
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.cost_price || ''}
            onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
          />

          <FormInput
            label="Selling Price (₹)"
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.selling_price || ''}
            onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Minimum Reorder Stock"
            type="number"
            min="0"
            value={formData.min_stock_level || ''}
            onChange={(e) => setFormData({ ...formData, min_stock_level: parseFloat(e.target.value) || 0 })}
          />

          <FormInput
            label="Shelf Life (Days)"
            type="number"
            min="1"
            value={formData.shelf_life_days || ''}
            onChange={(e) => setFormData({ ...formData, shelf_life_days: parseInt(e.target.value, 10) || 3 })}
          />
        </div>
      </form>
    </Modal>
  );
};
