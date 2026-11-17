import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { sendError } from '../utilities/response.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipFailedRequests?: boolean;
}

/**
 * Express sliding-window rate limiting middleware
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests from this IP, please try again later.',
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Identify client by IP (or forwarded IP)
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown-client';
    const routeKey = `${clientIp}:${req.baseUrl || req.path}`;
    const now = Date.now();

    let record = rateLimitStore.get(routeKey);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(routeKey, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', retryAfterSec);
      sendError(res, message, 429, {
        retryAfterSeconds: retryAfterSec,
        maxAllowed: maxRequests,
      });
      return;
    }

    next();
  };
}

// Standard rate limiter for all general API endpoints
export const generalApiLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
  message: 'API rate limit exceeded. Please wait a few moments before trying again.',
});

// Stricter rate limiter for authentication routes (login / register)
export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: config.rateLimit.authMaxRequests,
  message: 'Too many authentication attempts. Please try again after 5 minutes.',
});
