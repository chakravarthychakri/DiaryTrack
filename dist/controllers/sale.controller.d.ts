import type { Request, Response, NextFunction } from 'express';
export declare class SaleController {
    static getSales(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getSaleById(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createSale(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createSaleReturn(req: Request, res: Response, next: NextFunction): Promise<void>;
}
