import type { Request, Response, NextFunction } from 'express';
export declare class InventoryController {
    static getInventory(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getMovements(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createAdjustment(req: Request, res: Response, next: NextFunction): Promise<void>;
}
