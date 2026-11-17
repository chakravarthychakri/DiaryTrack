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
export declare function parsePaginationParams(req: Request, defaultSortBy?: string): PaginationParams;
