import type { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service.js';

export class ReportController {
  public static async getExcelReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = {
        range: (req.query.range as string) || 'all',
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        categoryId: req.query.categoryId as string,
        productId: req.query.productId as string,
        supplierId: req.query.supplierId as string,
        branchId: req.query.branchId as string,
        movementType: req.query.movementType as string,
        sheet: (req.query.sheet as string) || 'all',
      };

      const { buffer, fileName, contentType } = await ReportService.generateExcelReport(options);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  public static async getPdfReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = {
        range: (req.query.range as string) || 'all',
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        categoryId: req.query.categoryId as string,
        productId: req.query.productId as string,
        supplierId: req.query.supplierId as string,
        branchId: req.query.branchId as string,
      };

      const { html } = await ReportService.generatePdfReport(options);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      next(error);
    }
  }
}
