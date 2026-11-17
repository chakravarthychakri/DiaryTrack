"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const index_js_1 = require("../config/index.js");
const response_js_1 = require("../utilities/response.js");
class AppError extends Error {
    statusCode;
    isOperational;
    errors;
    constructor(message, statusCode = 500, errors) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || (err.status ? parseInt(err.status, 10) : 500);
    const message = err.message || 'Internal Server Error';
    const errors = err.errors || undefined;
    // Log non-operational/critical errors
    if (!err.isOperational && statusCode >= 500) {
        console.error('Unhandled Application Error:', err);
    }
    (0, response_js_1.sendError)(res, message, statusCode, {
        ...(errors ? { details: errors } : {}),
        ...(index_js_1.config.env === 'development' ? { stack: err.stack } : {}),
    });
}
function notFoundHandler(req, res, next) {
    next(new AppError(`Cannot ${req.method} ${req.originalUrl} - Route not found`, 404));
}
//# sourceMappingURL=errorHandler.js.map