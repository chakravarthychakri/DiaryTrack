"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendPaginated = sendPaginated;
exports.sendError = sendError;
function sendSuccess(res, data, message = 'Operation successful', statusCode = 200, meta) {
    const payload = {
        success: true,
        message,
        data,
        ...(meta ? { meta } : {}),
    };
    return res.status(statusCode).json(payload);
}
function sendPaginated(res, items, total, page, limit, message = 'Items retrieved successfully') {
    const totalPages = Math.ceil(total / (limit || 1)) || 1;
    const meta = {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
    };
    return sendSuccess(res, items, message, 200, meta);
}
function sendError(res, message = 'An error occurred', statusCode = 500, errors) {
    const payload = {
        success: false,
        message,
        ...(errors ? { errors } : {}),
    };
    return res.status(statusCode).json(payload);
}
//# sourceMappingURL=response.js.map