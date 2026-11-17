import type { Request, Response, NextFunction } from 'express';
export declare class AnalyticsController {
    static getDashboard(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getSalesAnalytics(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getProfitAnalytics(req: Request, res: Response, next: NextFunction): Promise<void>;
}
