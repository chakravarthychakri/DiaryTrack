import type { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  search?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, any>;
}

export function parsePaginationParams(req: Request, defaultSortBy: string = 'created_at'): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const rawLimit = parseInt(req.query.limit as string, 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;

  const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
  const sortBy = typeof req.query.sortBy === 'string' && req.query.sortBy.trim() ? req.query.sortBy.trim() : defaultSortBy;
  const rawOrder = (req.query.sortOrder as string || req.query.order as string || '').toLowerCase();
  const sortOrder: 'asc' | 'desc' = rawOrder === 'asc' ? 'asc' : 'desc';

  // Extract other filter params, excluding pagination keywords
  const reservedKeys = new Set(['page', 'limit', 'search', 'sortBy', 'sortOrder', 'order']);
  const filters: Record<string, any> = {};

  for (const [key, value] of Object.entries(req.query)) {
    if (!reservedKeys.has(key) && value !== undefined && value !== '') {
      filters[key] = value;
    }
  }

  return {
    page,
    limit,
    offset,
    search,
    sortBy,
    sortOrder,
    filters,
  };
}
