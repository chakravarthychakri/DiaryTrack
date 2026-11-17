import { useState, useEffect, useCallback } from 'react';
import { StockMovement } from '../types';
import { inventoryApi } from '../services/api/inventoryApi';

export function useInventory() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getMovements({ limit: 50 });
      if (res && res.data) {
        setMovements(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory movements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return { movements, loading, error, refetch: fetchInventory };
}
