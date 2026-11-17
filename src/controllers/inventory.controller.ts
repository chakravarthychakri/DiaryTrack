import type { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventory.service.js';
import { parsePaginationParams } from '../utilities/pagination.js';
import { sendPaginated, sendSuccess } from '../utilities/response.js';

export class InventoryController {
  public static async getInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paginationParams = parsePaginationParams(req, 'name');
      const data = await InventoryService.getInventory(paginationParams);
      sendSuccess(res, data, 'Inventory summary retrieved successfully', 200, {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: data.total,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paginationParams = parsePaginationParams(req, 'created_at');
      const { items, total } = await InventoryService.getMovements(paginationParams);
      sendPaginated(res, items, total, paginationParams.page, paginationParams.limit, 'Inventory movements retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async createAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user_id = req.user?.id || req.body.user_id;
      const adjustment = await InventoryService.createAdjustment({ ...req.body, user_id });
      sendSuccess(res, adjustment, 'Stock adjustment processed successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
