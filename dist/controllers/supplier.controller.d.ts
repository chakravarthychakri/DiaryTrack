import type { Request, Response, NextFunction } from 'express';
export declare class SupplierController {
    static getSuppliers(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getSupplierById(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createSupplier(req: Request, res: Response, next: NextFunction): Promise<void>;
    static updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void>;
}
