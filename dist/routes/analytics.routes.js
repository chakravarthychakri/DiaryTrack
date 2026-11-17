"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_js_1 = require("../controllers/analytics.controller.js");
const router = (0, express_1.Router)();
// GET /api/analytics/dashboard
router.get('/dashboard', analytics_controller_js_1.AnalyticsController.getDashboard);
// GET /api/analytics/top-products
router.get('/top-products', analytics_controller_js_1.AnalyticsController.getTopProducts);
// GET /api/analytics/sales
router.get('/sales', analytics_controller_js_1.AnalyticsController.getSalesAnalytics);
// GET /api/analytics/profit
router.get('/profit', analytics_controller_js_1.AnalyticsController.getProfitAnalytics);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map