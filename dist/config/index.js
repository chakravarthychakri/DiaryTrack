"use strict";
/**
 * DairyTrack Application Configuration
 * Secure Supabase credentials & Environment Settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    supabase: {
        url: process.env.SUPABASE_URL || 'https://xyzcompany.supabase.co',
        anonKey: process.env.SUPABASE_ANON_KEY || 'public-anon-key-placeholder',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-admin-secret-strictly-backend',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'dairytrack-super-secret-jwt-key-2026',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    defaultShopId: process.env.DEFAULT_SHOP_ID || '11111111-1111-1111-1111-111111111111',
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 200, // general API limit
        authMaxRequests: 20, // auth route limit (brute-force defense)
    }
};
//# sourceMappingURL=index.js.map