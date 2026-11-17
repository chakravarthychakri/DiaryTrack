import type { Response } from 'express';
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
        hasNextPage?: boolean;
        hasPrevPage?: boolean;
        [key: string]: any;
    };
    errors?: any;
}
export declare function sendSuccess<T>(res: Response, data: T, message?: string, statusCode?: number, meta?: ApiResponse['meta']): Response;
export declare function sendPaginated<T>(res: Response, items: T[], total: number, page: number, limit: number, message?: string): Response;
export declare function sendError(res: Response, message?: string, statusCode?: number, errors?: any): Response;
