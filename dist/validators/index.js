"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierValidators = exports.purchaseValidators = exports.saleValidators = exports.inventoryValidators = exports.productValidators = exports.authValidators = exports.isArrayNotEmpty = exports.isInEnum = exports.isEmail = exports.isNonNegative = exports.isPositive = exports.isNumber = exports.isRequired = void 0;
exports.validate = validate;
const errorHandler_js_1 = require("../middleware/errorHandler.js");
/**
 * Validation Middleware generator
 */
function validate(rules) {
    return (req, res, next) => {
        const errors = [];
        for (const rule of rules) {
            const err = rule(req.body);
            if (err) {
                errors.push(err);
            }
        }
        if (errors.length > 0) {
            return next(new errorHandler_js_1.AppError('Validation failed for one or more fields', 400, errors));
        }
        next();
    };
}
// ----------------------------------------------------
// Reusable Validation Rule Generators
// ----------------------------------------------------
const isRequired = (field, label) => (data) => {
    const val = data?.[field];
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        return { field, message: `${label || field} is required and cannot be empty` };
    }
    return null;
};
exports.isRequired = isRequired;
const isNumber = (field, options) => (data) => {
    const val = data?.[field];
    if (val === undefined || val === null || val === '')
        return null; // let isRequired handle absence
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
exports.isNumber = isNumber;
const isPositive = (field, label) => (0, exports.isNumber)(field, { min: 0.001, label: label || field });
exports.isPositive = isPositive;
const isNonNegative = (field, label) => (0, exports.isNumber)(field, { min: 0, label: label || field });
exports.isNonNegative = isNonNegative;
const isEmail = (field, label) => (data) => {
    const val = data?.[field];
    if (!val)
        return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(val))) {
        return { field, message: `${label || field} must be a valid email address` };
    }
    return null;
};
exports.isEmail = isEmail;
const isInEnum = (field, allowedValues, label) => (data) => {
    const val = data?.[field];
    if (!val)
        return null;
    if (!allowedValues.includes(String(val))) {
        return { field, message: `${label || field} must be one of: ${allowedValues.join(', ')}` };
    }
    return null;
};
exports.isInEnum = isInEnum;
const isArrayNotEmpty = (field, label) => (data) => {
    const val = data?.[field];
    if (!Array.isArray(val) || val.length === 0) {
        return { field, message: `${label || field} must be a non-empty array with at least one item` };
    }
    return null;
};
exports.isArrayNotEmpty = isArrayNotEmpty;
// ----------------------------------------------------
// Specialized Module Validators
// ----------------------------------------------------
exports.authValidators = {
    login: validate([
        (0, exports.isRequired)('username', 'Username or Email'),
        (0, exports.isRequired)('password', 'Password'),
    ]),
    register: validate([
        (0, exports.isRequired)('username', 'Username'),
        (0, exports.isRequired)('password', 'Password'),
        (0, exports.isRequired)('name', 'Full Name'),
        (0, exports.isEmail)('email', 'Email'),
        (0, exports.isInEnum)('role', ['Administrator', 'Manager', 'Shopkeeper', 'Auditor']),
    ]),
};
exports.productValidators = {
    create: validate([
        (0, exports.isRequired)('name', 'Product Name'),
        (0, exports.isNonNegative)('selling_price', 'Selling Price'),
        (0, exports.isNonNegative)('cost_price', 'Cost / Purchase Price'),
        (0, exports.isInEnum)('unit', ['Liter', 'ml', 'Kg', 'Gram', 'Piece', 'Packet', 'Box']),
    ]),
    update: validate([
        (0, exports.isNonNegative)('selling_price', 'Selling Price'),
        (0, exports.isNonNegative)('cost_price', 'Cost / Purchase Price'),
    ]),
};
exports.inventoryValidators = {
    adjustment: validate([
        (0, exports.isRequired)('product_id', 'Product ID'),
        (0, exports.isPositive)('quantity', 'Quantity'),
        (0, exports.isRequired)('reason', 'Adjustment Reason'),
    ]),
};
exports.saleValidators = {
    create: validate([
        (0, exports.isArrayNotEmpty)('items', 'Cart items'),
        (0, exports.isInEnum)('payment_method', ['Cash', 'UPI', 'Card', 'Credit', 'Bank Transfer', 'Credit / Udhar']),
    ]),
    returns: validate([
        (0, exports.isRequired)('reason', 'Return Reason'),
        (0, exports.isPositive)('quantity', 'Return Quantity'),
    ]),
};
exports.purchaseValidators = {
    create: validate([
        (0, exports.isRequired)('supplier_id', 'Supplier ID'),
        (0, exports.isArrayNotEmpty)('items', 'Purchase items'),
    ]),
};
exports.supplierValidators = {
    create: validate([
        (0, exports.isRequired)('name', 'Supplier / Farmer Name'),
        (0, exports.isRequired)('phone', 'Phone Number'),
        (0, exports.isEmail)('email', 'Email Address'),
    ]),
    update: validate([
        (0, exports.isEmail)('email', 'Email Address'),
    ]),
};
//# sourceMappingURL=index.js.map