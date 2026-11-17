"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = exports.generalApiLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
const index_js_1 = require("../config/index.js");
const response_js_1 = require("../utilities/response.js");
const rateLimitStore = new Map();
/**
 * Express sliding-window rate limiting middleware
 */
function createRateLimiter(options) {
    const { windowMs, maxRequests, message = 'Too many requests from this IP, please try again later.', } = options;
    return (req, res, next) => {
        // Identify client by IP (or forwarded IP)
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client';
        const routeKey = `${clientIp}:${req.baseUrl || req.path}`;
        const now = Date.now();
        let record = rateLimitStore.get(routeKey);
        if (!record || now > record.resetTime) {
            record = {
                count: 1,
                resetTime: now + windowMs,
            };
            rateLimitStore.set(routeKey, record);
        }
        else {
            record.count++;
        }
        const remaining = Math.max(0, maxRequests - record.count);
        const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
        if (record.count > maxRequests) {
            res.setHeader('Retry-After', retryAfterSec);
            (0, response_js_1.sendError)(res, message, 429, {
                retryAfterSeconds: retryAfterSec,
                maxAllowed: maxRequests,
            });
            return;
        }
        next();
    };
}
// Standard rate limiter for all general API endpoints
exports.generalApiLimiter = createRateLimiter({
    windowMs: index_js_1.config.rateLimit.windowMs,
    maxRequests: index_js_1.config.rateLimit.maxRequests,
    message: 'API rate limit exceeded. Please wait a few moments before trying again.',
});
// Stricter rate limiter for authentication routes (login / register)
exports.authRateLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: index_js_1.config.rateLimit.authMaxRequests,
    message: 'Too many authentication attempts. Please try again after 5 minutes.',
});
//# sourceMappingURL=rateLimiter.js.map