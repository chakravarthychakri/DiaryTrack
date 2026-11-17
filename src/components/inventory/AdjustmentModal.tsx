import React, { useState } from 'react';
import { Modal } from '../shared/Modal';
import { FormInput } from '../shared/FormInput';
import { Button } from '../shared/Button';
import { Product } from '../../types';

export interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSubmit: (data: {
    product_id: number | string;
    flow_type: 'Inflow' | 'Outflow';
    quantity: number;
    reason: string;
  }) => Promise<void>;
}

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  isOpen,
  onClose,
  products,
  onSubmit,
}) => {
  const [productId, setProductId] = useState<number | string>(products[0]?.id || '');
  const [flowType, setFlowType] = useState<'Inflow' | 'Outflow'>('Inflow');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProduct = products.find((p) => String(p.id) === String(productId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || quantity <= 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        product_id: productId,
        flow_type: flowType,
        quantity,
        reason,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Stock Adjustment"
      subtitle="Auditable physical count correction logged directly into the inventory ledger"
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Record Adjustment
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Target Product <span className="text-red-500">*</span>
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full text-sm py-2 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Current: {p.current_stock} {p.unit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Correction Flow <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFlowType('Inflow')}
              className={`py-2 px-3 rounded-md text-xs font-bold border transition-all ${
                flowType === 'Inflow'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              📥 Inflow (+ Addition)
            </button>
            <button
              type="button"
              onClick={() => setFlowType('Outflow')}
              className={`py-2 px-3 rounded-md text-xs font-bold border transition-all ${
                flowType === 'Outflow'
                  ? 'bg-rose-50 border-rose-500 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              📤 Outflow (- Deduction)
            </button>
          </div>
        </div>

        <FormInput
          label={`Quantity (${selectedProduct?.unit || 'Units'})`}
          type="number"
          step="0.001"
          min="0.001"
          required
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Audit Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Physical inventory count variance, unrecorded transfer"
            className="w-full text-sm py-2 px-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </form>
    </Modal>
  );
};
