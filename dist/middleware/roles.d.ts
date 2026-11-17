import type { Request, Response, NextFunction } from 'express';
/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts access to users holding specified roles
 */
export declare function authorize(...allowedRoles: string[]): (req: Request, res: Response, next: NextFunction) => void;
