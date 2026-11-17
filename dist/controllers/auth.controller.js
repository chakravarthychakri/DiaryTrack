"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_js_1 = require("../services/auth.service.js");
const response_js_1 = require("../utilities/response.js");
class AuthController {
    static async login(req, res, next) {
        try {
            const result = await auth_service_js_1.AuthService.login(req.body);
            (0, response_js_1.sendSuccess)(res, result, 'Logged in successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async register(req, res, next) {
        try {
            const user = await auth_service_js_1.AuthService.register(req.body);
            (0, response_js_1.sendSuccess)(res, user, 'User registered successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async logout(req, res, next) {
        try {
            const result = await auth_service_js_1.AuthService.logout();
            (0, response_js_1.sendSuccess)(res, result, 'Logged out successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map