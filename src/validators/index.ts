import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export type ValidationRule = (data: any) => ValidationErrorItem | null;

/**
 * Validation Middleware generator
 */
export function validate(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationErrorItem[] = [];

    for (const rule of rules) {
      const err = rule(req.body);
      if (err) {
        errors.push(err);
      }
    }

    if (errors.length > 0) {
      return next(new AppError('Validation failed for one or more fields', 400, errors));
    }

    next();
  };
}

// ----------------------------------------------------
// Reusable Validation Rule Generators
// ----------------------------------------------------

export const isRequired = (field: string, label?: string): ValidationRule => (data) => {
  const val = data?.[field];
  if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return { field, message: `${label || field} is required and cannot be empty` };
  }
  return null;
};

export const isNumber = (field: string, options?: { min?: number; max?: number; label?: string }): ValidationRule => (data) => {
  const val = data?.[field];
  if (val === undefined || val === null || val === '') return null; // let isRequired handle absence
  const num = Number(val);
  if (isNaN(num)) {
    return { field, message: `${options?.label || field} must be a valid number` };
  }
  if (options?.min !== undefined && num < options.min) {
    return { field, message: `${options?.label || field} must be at least ${options.min}` };
  }
  if (options?.max !== undefined && num > options.max) {
    return { field, message: `${options?.label || field} cannot exceed ${options.max}` };
  }
  return null;
};

export const isPositive = (field: string, label?: string): ValidationRule =>
  isNumber(field, { min: 0.001, label: label || field });

export const isNonNegative = (field: string, label?: string): ValidationRule =>
  isNumber(field, { min: 0, label: label || field });

export const isEmail = (field: string, label?: string): ValidationRule => (data) => {
  const val = data?.[field];
  if (!val) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(val))) {
    return { field, message: `${label || field} must be a valid email address` };
  }
  return null;
};

export const isInEnum = (field: string, allowedValues: string[], label?: string): ValidationRule => (data) => {
  const val = data?.[field];
  if (!val) return null;
  if (!allowedValues.includes(String(val))) {
    return { field, message: `${label || field} must be one of: ${allowedValues.join(', ')}` };
  }
  return null;
};

export const isArrayNotEmpty = (field: string, label?: string): ValidationRule => (data) => {
  const val = data?.[field];
  if (!Array.isArray(val) || val.length === 0) {
    return { field, message: `${label || field} must be a non-empty array with at least one item` };
  }
  return null;
};

// ----------------------------------------------------
// Specialized Module Validators
// ----------------------------------------------------

export const authValidators = {
  login: validate([
    isRequired('username', 'Username or Email'),
    isRequired('password', 'Password'),
  ]),
  register: validate([
    isRequired('username', 'Username'),
    isRequired('password', 'Password'),
    isRequired('name', 'Full Name'),
    isEmail('email', 'Email'),
    isInEnum('role', ['Administrator', 'Manager', 'Shopkeeper', 'Auditor']),
  ]),
};

export const productValidators = {
  create: validate([
    isRequired('name', 'Product Name'),
    isNonNegative('selling_price', 'Selling Price'),
    isNonNegative('cost_price', 'Cost / Purchase Price'),
    isInEnum('unit', ['Liter', 'ml', 'Kg', 'Gram', 'Piece', 'Packet', 'Box']),
  ]),
  update: validate([
    isNonNegative('selling_price', 'Selling Price'),
    isNonNegative('cost_price', 'Cost / Purchase Price'),
  ]),
};

export const inventoryValidators = {
  adjustment: validate([
    isRequired('product_id', 'Product ID'),
    isPositive('quantity', 'Quantity'),
    isRequired('reason', 'Adjustment Reason'),
  ]),
};

export const saleValidators = {
  create: validate([
    isArrayNotEmpty('items', 'Cart items'),
    isInEnum('payment_method', ['Cash', 'UPI', 'Card', 'Credit', 'Bank Transfer', 'Credit / Udhar']),
  ]),
  returns: validate([
    isRequired('reason', 'Return Reason'),
    isPositive('quantity', 'Return Quantity'),
  ]),
};

export const purchaseValidators = {
  create: validate([
    isRequired('supplier_id', 'Supplier ID'),
    isArrayNotEmpty('items', 'Purchase items'),
  ]),
};

export const supplierValidators = {
  create: validate([
    isRequired('name', 'Supplier / Farmer Name'),
    isRequired('phone', 'Phone Number'),
    isEmail('email', 'Email Address'),
  ]),
  update: validate([
    isEmail('email', 'Email Address'),
  ]),
};
