import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { sendError } from '../utilities/response.js';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors?: any;

  constructor(message: string, statusCode: number = 500, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || (err.status ? parseInt(err.status, 10) : 500);
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || undefined;

  // Log non-operational/critical errors
  if (!err.isOperational && statusCode >= 500) {
    console.error('Unhandled Application Error:', err);
  }

  sendError(res, message, statusCode, {
    ...(errors ? { details: errors } : {}),
    ...(config.env === 'development' ? { stack: err.stack } : {}),
  });
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl} - Route not found`, 404));
}
