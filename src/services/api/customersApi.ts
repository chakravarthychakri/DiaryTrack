import { api } from './client';
import { Customer, ApiResponse, PaginatedResponse } from '../../types';

export const customersApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<PaginatedResponse<Customer>>('/customers', params),

  getById: (id: string) =>
    api.get<ApiResponse<Customer>>(`/customers/${id}`),

  create: (data: Partial<Customer>) =>
    api.post<ApiResponse<Customer>>('/customers', data),

  update: (id: string, data: Partial<Customer>) =>
    api.put<ApiResponse<Customer>>(`/customers/${id}`, data),

  getHistory: (id: string) =>
    api.get<ApiResponse<any>>(`/customers/${id}/history`),
};
