"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleController = void 0;
const sale_service_js_1 = require("../services/sale.service.js");
const pagination_js_1 = require("../utilities/pagination.js");
const response_js_1 = require("../utilities/response.js");
class SaleController {
    static async getSales(req, res, next) {
        try {
            const paginationParams = (0, pagination_js_1.parsePaginationParams)(req, 'created_at');
            const { items, total } = await sale_service_js_1.SaleService.getSales(paginationParams);
            (0, response_js_1.sendPaginated)(res, items, total, paginationParams.page, paginationParams.limit, 'Sales records retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getSaleById(req, res, next) {
        try {
            const sale = await sale_service_js_1.SaleService.getSaleById(req.params.id);
            (0, response_js_1.sendSuccess)(res, sale, 'Sale invoice retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async createSale(req, res, next) {
        try {
            const user_id = req.user?.id || req.body.user_id;
            const sale = await sale_service_js_1.SaleService.createSale({ ...req.body, user_id });
            (0, response_js_1.sendSuccess)(res, sale, 'Sale transaction completed successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async createSaleReturn(req, res, next) {
        try {
            const user_id = req.user?.id || req.body.user_id;
            const result = await sale_service_js_1.SaleService.createSaleReturn(req.params.id, { ...req.body, user_id });
            (0, response_js_1.sendSuccess)(res, result, 'Customer return processed successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SaleController = SaleController;
//# sourceMappingURL=sale.controller.js.map