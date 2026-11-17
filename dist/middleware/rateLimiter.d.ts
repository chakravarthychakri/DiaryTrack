import type { Request, Response, NextFunction } from 'express';
export interface RateLimiterOptions {
    windowMs: number;
    maxRequests: number;
    message?: string;
    skipFailedRequests?: boolean;
}
/**
 * Express sliding-window rate limiting middleware
 */
export declare function createRateLimiter(options: RateLimiterOptions): (req: Request, res: Response, next: NextFunction) => void;
export declare const generalApiLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const authRateLimiter: (req: Request, res: Response, next: NextFunction) => void;
