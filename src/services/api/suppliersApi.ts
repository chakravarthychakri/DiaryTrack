import { api } from './client';
import { Supplier, ApiResponse, PaginatedResponse } from '../../types';

export const suppliersApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<PaginatedResponse<Supplier>>('/suppliers', params),

  getById: (id: string) =>
    api.get<ApiResponse<Supplier>>(`/suppliers/${id}`),

  create: (data: Partial<Supplier>) =>
    api.post<ApiResponse<Supplier>>('/suppliers', data),

  update: (id: string, data: Partial<Supplier>) =>
    api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<{ success: boolean }>>(`/suppliers/${id}`),
};
