import React, { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormInput } from '../shared/FormInput';
import { Purchase } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ReceivePoModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase | null;
  onConfirm: (purchaseId: string, receivedNotes: string) => Promise<void>;
}

export const ReceivePoModal: React.FC<ReceivePoModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onConfirm,
}) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!purchase) return null;

  const handleReceive = async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm(purchase.id, notes);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to receive purchase order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receive Goods - ${purchase.po_number}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleReceive}
            loading={loading}
            className="gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Confirm & Inward Stock
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-neutral-500">Supplier:</span>
            <span className="font-medium text-neutral-800">{purchase.supplier?.name || 'Local Supplier'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Order Amount:</span>
            <span className="font-semibold text-neutral-900">{formatCurrency(purchase.total_amount)}</span>
          </div>
        </div>

        <p className="text-xs text-neutral-600">
          Confirming this purchase will automatically create product batch entries, update live stock quantities, and record an auditable inventory inward movement.
        </p>

        <FormInput
          label="Receiving Notes / Quality Inspection Remarks"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Temperature 4°C verified, Fat test 6.2%, clean delivery"
        />
      </div>
    </Modal>
  );
};
