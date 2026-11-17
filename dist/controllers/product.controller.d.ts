import type { Request, Response, NextFunction } from 'express';
export declare class ProductController {
    static getProducts(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getProductById(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
    static updateProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
    static deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
}
