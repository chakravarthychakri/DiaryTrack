import type { Request, Response, NextFunction } from 'express';
export interface ValidationErrorItem {
    field: string;
    message: string;
}
export type ValidationRule = (data: any) => ValidationErrorItem | null;
/**
 * Validation Middleware generator
 */
export declare function validate(rules: ValidationRule[]): (req: Request, res: Response, next: NextFunction) => void;
export declare const isRequired: (field: string, label?: string) => ValidationRule;
export declare const isNumber: (field: string, options?: {
    min?: number;
    max?: number;
    label?: string;
}) => ValidationRule;
export declare const isPositive: (field: string, label?: string) => ValidationRule;
export declare const isNonNegative: (field: string, label?: string) => ValidationRule;
export declare const isEmail: (field: string, label?: string) => ValidationRule;
export declare const isInEnum: (field: string, allowedValues: string[], label?: string) => ValidationRule;
export declare const isArrayNotEmpty: (field: string, label?: string) => ValidationRule;
export declare const authValidators: {
    login: (req: Request, res: Response, next: NextFunction) => void;
    register: (req: Request, res: Response, next: NextFunction) => void;
};
export declare const productValidators: {
    create: (req: Request, res: Response, next: NextFunction) => void;
    update: (req: Request, res: Response, next: NextFunction) => void;
};
export declare const inventoryValidators: {
    adjustment: (req: Request, res: Response, next: NextFunction) => void;
};
export declare const saleValidators: {
    create: (req: Request, res: Response, next: NextFunction) => void;
    returns: (req: Request, res: Response, next: NextFunction) => void;
};
export declare const purchaseValidators: {
    create: (req: Request, res: Response, next: NextFunction) => void;
};
export declare const supplierValidators: {
    create: (req: Request, res: Response, next: NextFunction) => void;
    update: (req: Request, res: Response, next: NextFunction) => void;
};
