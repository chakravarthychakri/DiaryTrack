import { api } from './client';
import { Product, ApiResponse, PaginatedResponse } from '../../types';

export const productsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; category?: string; is_active?: boolean }) =>
    api.get<PaginatedResponse<Product>>('/products', params),

  getById: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/${id}`),

  create: (data: Partial<Product>) =>
    api.post<ApiResponse<Product>>('/products', data),

  update: (id: string, data: Partial<Product>) =>
    api.put<ApiResponse<Product>>(`/products/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<{ success: boolean }>>(`/products/${id}`),

  getCategories: () =>
    api.get<ApiResponse<any[]>>('/categories'),
};
