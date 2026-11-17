import { api } from './client';
import { Purchase, ApiResponse, PaginatedResponse } from '../../types';

export const purchasesApi = {
  getAll: (params?: { page?: number; limit?: number; supplier_id?: string; status?: string }) =>
    api.get<PaginatedResponse<Purchase>>('/purchases', params),

  getById: (id: string) =>
    api.get<ApiResponse<Purchase>>(`/purchases/${id}`),

  create: (data: any) =>
    api.post<ApiResponse<Purchase>>('/purchases', data),

  receive: (id: string, data?: { notes?: string }) =>
    api.post<ApiResponse<any>>(`/purchases/${id}/receive`, data || {}),
};
