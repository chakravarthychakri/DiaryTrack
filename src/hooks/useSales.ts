import { useState, useEffect, useCallback } from 'react';
import { Sale } from '../types';
import { salesApi } from '../services/api/salesApi';

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await salesApi.getAll({ limit: 50 });
      if (res && res.data) {
        setSales(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  return { sales, loading, error, refetch: fetchSales };
}
