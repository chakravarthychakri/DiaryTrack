import type { Request, Response, NextFunction } from 'express';
export declare class PurchaseController {
    static getPurchases(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getPurchaseById(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createPurchase(req: Request, res: Response, next: NextFunction): Promise<void>;
    static receivePurchase(req: Request, res: Response, next: NextFunction): Promise<void>;
}
