import type { Request, Response, NextFunction } from 'express';
import { SupplierService } from '../services/supplier.service.js';
import { parsePaginationParams } from '../utilities/pagination.js';
import { sendPaginated, sendSuccess } from '../utilities/response.js';

export class SupplierController {
  public static async getSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paginationParams = parsePaginationParams(req, 'name');
      const { items, total } = await SupplierService.getSuppliers(paginationParams);
      sendPaginated(res, items, total, paginationParams.page, paginationParams.limit, 'Suppliers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supplier = await SupplierService.getSupplierById(req.params.id as string);
      sendSuccess(res, supplier, 'Supplier retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supplier = await SupplierService.createSupplier(req.body);
      sendSuccess(res, supplier, 'Supplier registered successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supplier = await SupplierService.updateSupplier(req.params.id as string, req.body);
      sendSuccess(res, supplier, 'Supplier updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
