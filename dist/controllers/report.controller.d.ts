import type { Request, Response, NextFunction } from 'express';
export declare class ReportController {
    static getExcelReport(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getPdfReport(req: Request, res: Response, next: NextFunction): Promise<void>;
}
