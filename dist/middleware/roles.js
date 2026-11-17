"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
const errorHandler_js_1 = require("./errorHandler.js");
/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts access to users holding specified roles
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new errorHandler_js_1.AppError('Authentication required before authorization check', 401));
        }
        if (allowedRoles.length === 0) {
            return next();
        }
        // Role matching (case-insensitive for convenience)
        const userRole = (req.user.role || '').toLowerCase();
        const hasRole = allowedRoles.some(r => r.toLowerCase() === userRole);
        // Admin role universally permitted
        if (userRole === 'administrator' || userRole === 'admin' || hasRole) {
            return next();
        }
        return next(new errorHandler_js_1.AppError(`Forbidden: Your role '${req.user.role}' is not authorized to access this resource. Required: ${allowedRoles.join(', ')}`, 403));
    };
}
//# sourceMappingURL=roles.js.map