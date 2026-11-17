import { api } from './client';
import { ApiResponse } from '../../types';

export const analyticsApi = {
  getDashboardKpis: (params?: { period?: string }) =>
    api.get<ApiResponse<any>>('/analytics/dashboard', params),

  getTopProducts: (params?: { metric?: 'revenue' | 'quantity' | 'transactions'; limit?: number }) =>
    api.get<ApiResponse<any[]>>('/analytics/top-products', params),

  getSalesTrends: (params?: { groupBy?: 'daily' | 'weekly' | 'monthly'; startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<any[]>>('/analytics/sales', params),

  getProfitBreakdown: (params?: { period?: string; startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<any>>('/analytics/profit', params),
};
