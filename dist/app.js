"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("./config/index.js");
const index_js_2 = __importDefault(require("./routes/index.js"));
const rateLimiter_js_1 = require("./middleware/rateLimiter.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
function createApp() {
    const app = (0, express_1.default)();
    // Module 18: OWASP Security Headers Hardening
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';");
        next();
    });
    // Basic security & parsing middleware
    app.use((0, cors_1.default)({
        origin: index_js_1.config.corsOrigin,
        credentials: true,
    }));
    app.use(express_1.default.json({ limit: '2mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '2mb' }));
    // Serve frontend static assets from public/
    const publicDir = path_1.default.resolve(process.cwd(), 'public');
    app.use(express_1.default.static(publicDir));
    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: index_js_1.config.env,
            version: '1.0.0',
        });
    });
    // Apply general rate limiter to API routes
    app.use('/api', rateLimiter_js_1.generalApiLimiter);
    // Mount modular TypeScript API Router
    app.use('/api', index_js_2.default);
    // Backward compatibility: delegate legacy endpoints or unmatched /api routes to existing express router if needed
    // Catch 404
    app.use(errorHandler_js_1.notFoundHandler);
    // Centralized Error Handler
    app.use(errorHandler_js_1.errorHandler);
    return app;
}
exports.app = createApp();
exports.default = exports.app;
//# sourceMappingURL=app.js.map