import { api } from './client';
import { StockMovement, ApiResponse, PaginatedResponse } from '../../types';

export interface StockAdjustmentPayload {
  product_id: string;
  batch_id?: string;
  adjustment_quantity: number;
  reason: 'spoilage' | 'damage' | 'expired' | 'spillage' | 'theft' | 'audit_correction' | 'other';
  notes?: string;
}

export const inventoryApi = {
  getOverview: (params?: { category?: string; low_stock?: boolean }) =>
    api.get<ApiResponse<any>>('/inventory', params),

  getMovements: (params?: { page?: number; limit?: number; product_id?: string; movement_type?: string }) =>
    api.get<PaginatedResponse<StockMovement>>('/inventory/movements', params),

  createAdjustment: (data: StockAdjustmentPayload) =>
    api.post<ApiResponse<any>>('/inventory/adjustments', data),

  getBatches: (productId?: string) =>
    api.get<ApiResponse<any[]>>('/inventory/batches', productId ? { product_id: productId } : undefined),

  getExpiryAlerts: () =>
    api.get<ApiResponse<any>>('/inventory/expiry-alerts'),
};
