import { api } from './client';
import { Sale, ApiResponse, PaginatedResponse } from '../../types';

export interface CheckoutPayload {
  customer_id?: string;
  items: Array<{
    product_id: string;
    batch_id?: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
  }>;
  payment_method: 'cash' | 'upi' | 'card' | 'credit' | 'split';
  discount_amount?: number;
  notes?: string;
}

export const salesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; startDate?: string; endDate?: string }) =>
    api.get<PaginatedResponse<Sale>>('/sales', params),

  getById: (id: string) =>
    api.get<ApiResponse<Sale>>(`/sales/${id}`),

  createSale: (data: CheckoutPayload) =>
    api.post<ApiResponse<Sale>>('/sales', data),

  processReturn: (saleId: string, data: { items: Array<{ sale_item_id: string; return_quantity: number; reason: string }>; refund_amount: number }) =>
    api.post<ApiResponse<any>>(`/sales/${saleId}/returns`, data),
};
