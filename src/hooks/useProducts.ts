import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { productsApi } from '../services/api/productsApi';

export function useProducts(initialParams?: { category?: string; search?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await productsApi.getAll(initialParams);
      if (res && res.data) {
        setProducts(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(initialParams)]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}
