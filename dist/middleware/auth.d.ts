import type { Request, Response, NextFunction } from 'express';
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: string;
    shop_id?: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
/**
 * Authentication Middleware
 * Validates Bearer token or active user session
 */
export declare function authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Optional authentication middleware:
 * Populates req.user if a valid token/session exists, but doesn't block unauthenticated requests.
 */
export declare function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
