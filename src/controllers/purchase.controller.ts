import type { Request, Response, NextFunction } from 'express';
import { PurchaseService } from '../services/purchase.service.js';
import { parsePaginationParams } from '../utilities/pagination.js';
import { sendPaginated, sendSuccess } from '../utilities/response.js';

export class PurchaseController {
  public static async getPurchases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paginationParams = parsePaginationParams(req, 'created_at');
      const { items, total } = await PurchaseService.getPurchases(paginationParams);
      sendPaginated(res, items, total, paginationParams.page, paginationParams.limit, 'Purchases retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getPurchaseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const purchase = await PurchaseService.getPurchaseById(req.params.id as string);
      sendSuccess(res, purchase, 'Purchase order retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async createPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user_id = req.user?.id || req.body.user_id;
      const po = await PurchaseService.createPurchase({ ...req.body, user_id });
      sendSuccess(res, po, 'Purchase order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async receivePurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user_id = req.user?.id || req.body.user_id;
      const po = await PurchaseService.receivePurchase(req.params.id as string, { ...req.body, user_id });
      sendSuccess(res, po, 'Purchase order received and inventory updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
