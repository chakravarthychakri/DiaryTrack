"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const index_js_1 = require("../database/index.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const index_js_2 = require("../config/index.js");
const crypto_1 = __importDefault(require("crypto"));
class AuthService {
    /**
     * User login with username/email and password
     */
    static async login(credentials) {
        const { username, password } = credentials;
        const user = await index_js_1.Database.queryOne(`SELECT id, name, email, username, password_hash, salt, role, is_active FROM users 
       WHERE username = ? OR email = ?`, [username.trim(), username.trim()]);
        if (!user) {
            throw new errorHandler_js_1.AppError('Invalid username or password', 401);
        }
        if (user.is_active === 0) {
            throw new errorHandler_js_1.AppError('Account is deactivated. Please contact your store administrator.', 403);
        }
        // Verify Password (pbkdf2 with salt)
        let isPasswordValid = false;
        if (user.password_hash && user.salt) {
            const check = crypto_1.default.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex');
            isPasswordValid = check === user.password_hash;
        }
        else if (user.password_hash) {
            const hashed = crypto_1.default.createHash('sha256').update(password).digest('hex');
            isPasswordValid = user.password_hash === password || user.password_hash === hashed;
        }
        if (!isPasswordValid) {
            throw new errorHandler_js_1.AppError('Invalid username or password', 401);
        }
        // Generate JWT-compatible secure Bearer token payload
        const tokenPayload = {
            sub: String(user.id),
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
            shop_id: index_js_2.config.defaultShopId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
        };
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
        const signature = crypto_1.default
            .createHmac('sha256', index_js_2.config.jwt.secret)
            .update(`${header}.${payload}`)
            .digest('base64url');
        const token = `${header}.${payload}.${signature}`;
        const userRecord = {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            shop_id: index_js_2.config.defaultShopId,
        };
        return { token, user: userRecord };
    }
    /**
     * Register new user profile
     */
    static async register(data) {
        const existing = await index_js_1.Database.queryOne(`SELECT id FROM users WHERE username = ? OR email = ?`, [data.username.trim(), data.email.trim()]);
        if (existing) {
            throw new errorHandler_js_1.AppError('Username or email already in use', 409);
        }
        const salt = crypto_1.default.randomBytes(16).toString('hex');
        const password_hash = crypto_1.default.pbkdf2Sync(data.password, salt, 10000, 64, 'sha512').toString('hex');
        const role = data.role || 'Shopkeeper';
        const result = await index_js_1.Database.execute(`INSERT INTO users (username, password_hash, salt, name, email, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`, [data.username.trim(), password_hash, salt, data.name.trim(), data.email.trim(), role]);
        return {
            id: result.lastInsertRowid,
            name: data.name,
            email: data.email,
            username: data.username,
            role,
            shop_id: index_js_2.config.defaultShopId,
        };
    }
    /**
     * Logout helper (clears session context)
     */
    static async logout() {
        return { loggedOut: true };
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map