import type { Request, Response, NextFunction } from 'express';
import { SaleService } from '../services/sale.service.js';
import { parsePaginationParams } from '../utilities/pagination.js';
import { sendPaginated, sendSuccess } from '../utilities/response.js';

export class SaleController {
  public static async getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paginationParams = parsePaginationParams(req, 'created_at');
      const { items, total } = await SaleService.getSales(paginationParams);
      sendPaginated(res, items, total, paginationParams.page, paginationParams.limit, 'Sales records retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getSaleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sale = await SaleService.getSaleById(req.params.id as string);
      sendSuccess(res, sale, 'Sale invoice retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async createSale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user_id = req.user?.id || req.body.user_id;
      const sale = await SaleService.createSale({ ...req.body, user_id });
      sendSuccess(res, sale, 'Sale transaction completed successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async createSaleReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user_id = req.user?.id || req.body.user_id;
      const result = await SaleService.createSaleReturn(req.params.id as string, { ...req.body, user_id });
      sendSuccess(res, result, 'Customer return processed successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
