import type { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service.js';
import { sendSuccess } from '../utilities/response.js';

export class AnalyticsController {
  public static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const range = (req.query.range as string) || 'this_month';
      const data = await AnalyticsService.getDashboard(range, req.query);
      sendSuccess(res, data, 'Analytics dashboard data retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metric = (req.query.metric as 'quantity' | 'revenue' | 'transactions') || 'quantity';
      const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string, 10) || 5));
      const data = await AnalyticsService.getTopProducts(metric, limit);
      sendSuccess(res, data, `Top products ranked by ${metric} retrieved successfully`);
    } catch (error) {
      next(error);
    }
  }

  public static async getSalesAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query.period as string) || 'daily';
      const data = await AnalyticsService.getSalesAnalytics(period, req.query);
      sendSuccess(res, data, 'Sales analytics trends retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getProfitAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const range = (req.query.range as string) || 'all';
      const data = await AnalyticsService.getProfitAnalytics(range);
      sendSuccess(res, data, 'Profit and Loss financial analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
