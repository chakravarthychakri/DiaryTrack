import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts access to users holding specified roles
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required before authorization check', 401));
    }

    if (allowedRoles.length === 0) {
      return next();
    }

    // Role matching (case-insensitive for convenience)
    const userRole = (req.user.role || '').toLowerCase();
    const hasRole = allowedRoles.some(r => r.toLowerCase() === userRole);

    // Admin role universally permitted
    if (userRole === 'administrator' || userRole === 'admin' || hasRole) {
      return next();
    }

    return next(new AppError(
      `Forbidden: Your role '${req.user.role}' is not authorized to access this resource. Required: ${allowedRoles.join(', ')}`,
      403
    ));
  };
}
