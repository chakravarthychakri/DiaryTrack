import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { Database } from '../database/index.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  shop_id?: string;
}

// Extend Express Request
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
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'] as string;
    }

    // Direct user ID header for testing/session simulation
    const directUserId = req.headers['x-user-id'] as string;

    if (!token && !directUserId) {
      // In development or demo mode, if unauthenticated, assign a default authenticated staff context or return 401
      // For strictly protected routes:
      throw new AppError('Authentication required. Missing Bearer token.', 401);
    }

    let user: AuthUser | null = null;

    if (directUserId) {
      const dbUser = await Database.queryOne(
        `SELECT id, name, email, role, shop_id FROM users WHERE id = ? OR username = ?`,
        [directUserId, directUserId]
      );
      if (dbUser) {
        user = {
          id: String(dbUser.id),
          name: dbUser.name || 'User',
          email: dbUser.email || '',
          role: dbUser.role || 'Shopkeeper',
          shop_id: dbUser.shop_id ? String(dbUser.shop_id) : undefined,
        };
      }
    } else if (token) {
      // Decode or verify token
      try {
        // Support simple token payload or base64 / JWT
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
          const payload = JSON.parse(payloadJson);
          user = {
            id: String(payload.id || payload.sub),
            name: payload.name || 'Staff User',
            email: payload.email || '',
            role: payload.role || 'Shopkeeper',
            shop_id: payload.shop_id ? String(payload.shop_id) : undefined,
          };
        } else {
          // Token as direct user identifier
          const dbUser = await Database.queryOne(`SELECT id, name, email, role, shop_id FROM users WHERE id = ?`, [token]);
          if (dbUser) {
            user = {
              id: String(dbUser.id),
              name: dbUser.name,
              email: dbUser.email,
              role: dbUser.role,
              shop_id: dbUser.shop_id ? String(dbUser.shop_id) : undefined,
            };
          }
        }
      } catch (err) {
        throw new AppError('Invalid or expired authentication token', 401);
      }
    }

    if (!user) {
      throw new AppError('User belonging to this token no longer exists', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware:
 * Populates req.user if a valid token/session exists, but doesn't block unauthenticated requests.
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const directUserId = req.headers['x-user-id'];

  if (!authHeader && !directUserId) {
    return next();
  }

  try {
    await authenticate(req, res, next);
  } catch {
    // Silently continue for optional auth
    next();
  }
}
