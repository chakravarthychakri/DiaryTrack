/**
 * Frontend HTTP Client for DairyTrack REST APIs
 * Uses fetch with automatic Bearer token injection, shop-id headers, and centralized error handling.
 */

const API_BASE_URL = '/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = localStorage.getItem('dairytrack_token');
  const shopId = localStorage.getItem('dairytrack_shop_id') || 'shop-main-001';

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(shopId ? { 'x-shop-id': shopId } : {}),
  };

  const response = await fetch(url, {
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    ...customConfig,
  });

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // response might be text or binary
    }
    const message = errorData.message || errorData.error || `HTTP error ${response.status}: ${response.statusText}`;
    throw new ApiError(message, response.status, errorData);
  }

  // Handle binary downloads (e.g. excel, pdf)
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('application/vnd.openxmlformats') || contentType.includes('application/pdf') || contentType.includes('octet-stream'))) {
    return (await response.blob()) as unknown as T;
  }

  try {
    return await response.json();
  } catch {
    return {} as T;
  }
}

export const api = {
  get: <T = any>(url: string, params?: Record<string, any>) => apiClient<T>(url, { method: 'GET', params }),
  post: <T = any>(url: string, body?: any) => apiClient<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = any>(url: string, body?: any) => apiClient<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = any>(url: string) => apiClient<T>(url, { method: 'DELETE' }),
  download: async (url: string, filename: string, params?: Record<string, any>) => {
    const blob = await apiClient<Blob>(url, { method: 'GET', params });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};
