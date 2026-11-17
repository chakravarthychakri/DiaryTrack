"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const analytics_service_js_1 = require("../services/analytics.service.js");
const response_js_1 = require("../utilities/response.js");
class AnalyticsController {
    static async getDashboard(req, res, next) {
        try {
            const range = req.query.range || 'this_month';
            const data = await analytics_service_js_1.AnalyticsService.getDashboard(range, req.query);
            (0, response_js_1.sendSuccess)(res, data, 'Analytics dashboard data retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getTopProducts(req, res, next) {
        try {
            const metric = req.query.metric || 'quantity';
            const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
            const data = await analytics_service_js_1.AnalyticsService.getTopProducts(metric, limit);
            (0, response_js_1.sendSuccess)(res, data, `Top products ranked by ${metric} retrieved successfully`);
        }
        catch (error) {
            next(error);
        }
    }
    static async getSalesAnalytics(req, res, next) {
        try {
            const period = req.query.period || 'daily';
            const data = await analytics_service_js_1.AnalyticsService.getSalesAnalytics(period, req.query);
            (0, response_js_1.sendSuccess)(res, data, 'Sales analytics trends retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getProfitAnalytics(req, res, next) {
        try {
            const range = req.query.range || 'all';
            const data = await analytics_service_js_1.AnalyticsService.getProfitAnalytics(range);
            (0, response_js_1.sendSuccess)(res, data, 'Profit and Loss financial analytics retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AnalyticsController = AnalyticsController;
//# sourceMappingURL=analytics.controller.js.map