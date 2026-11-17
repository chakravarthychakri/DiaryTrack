import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/index.js';
import apiRouter from './routes/index.js';
import { generalApiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  // Module 18: OWASP Security Headers Hardening
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';"
    );
    next();
  });

  // Basic security & parsing middleware
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Serve frontend static assets from public/
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicDir));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.env,
      version: '1.0.0',
    });
  });

  // Apply general rate limiter to API routes
  app.use('/api', generalApiLimiter);

  // Mount modular TypeScript API Router
  app.use('/api', apiRouter);

  // Backward compatibility: delegate legacy endpoints or unmatched /api routes to existing express router if needed
  // Catch 404
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
