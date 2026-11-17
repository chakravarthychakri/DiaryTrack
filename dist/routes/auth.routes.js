"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_js_1 = require("../controllers/auth.controller.js");
const index_js_1 = require("../validators/index.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const router = (0, express_1.Router)();
// POST /api/auth/login
router.post('/login', rateLimiter_js_1.authRateLimiter, index_js_1.authValidators.login, auth_controller_js_1.AuthController.login);
// POST /api/auth/register
router.post('/register', rateLimiter_js_1.authRateLimiter, index_js_1.authValidators.register, auth_controller_js_1.AuthController.register);
// POST /api/auth/logout
router.post('/logout', auth_controller_js_1.AuthController.logout);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map