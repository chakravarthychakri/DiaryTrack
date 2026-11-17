import type { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service.js';
import { parsePaginationParams } from '../utilities/pagination.js';
import { sendPaginated, sendSuccess } from '../utilities/response.js';

export class ProductController {
  public static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paginationParams = parsePaginationParams(req, 'created_at');
      const { items, total } = await ProductService.getProducts(paginationParams);
      sendPaginated(res, items, total, paginationParams.page, paginationParams.limit, 'Products retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.getProductById(req.params.id as string);
      sendSuccess(res, product, 'Product retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.createProduct(req.body);
      sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.updateProduct(req.params.id as string, req.body);
      sendSuccess(res, product, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ProductService.deleteProduct(req.params.id as string);
      sendSuccess(res, result, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
