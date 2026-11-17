"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseController = void 0;
const purchase_service_js_1 = require("../services/purchase.service.js");
const pagination_js_1 = require("../utilities/pagination.js");
const response_js_1 = require("../utilities/response.js");
class PurchaseController {
    static async getPurchases(req, res, next) {
        try {
            const paginationParams = (0, pagination_js_1.parsePaginationParams)(req, 'created_at');
            const { items, total } = await purchase_service_js_1.PurchaseService.getPurchases(paginationParams);
            (0, response_js_1.sendPaginated)(res, items, total, paginationParams.page, paginationParams.limit, 'Purchases retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getPurchaseById(req, res, next) {
        try {
            const purchase = await purchase_service_js_1.PurchaseService.getPurchaseById(req.params.id);
            (0, response_js_1.sendSuccess)(res, purchase, 'Purchase order retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async createPurchase(req, res, next) {
        try {
            const user_id = req.user?.id || req.body.user_id;
            const po = await purchase_service_js_1.PurchaseService.createPurchase({ ...req.body, user_id });
            (0, response_js_1.sendSuccess)(res, po, 'Purchase order created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async receivePurchase(req, res, next) {
        try {
            const user_id = req.user?.id || req.body.user_id;
            const po = await purchase_service_js_1.PurchaseService.receivePurchase(req.params.id, { ...req.body, user_id });
            (0, response_js_1.sendSuccess)(res, po, 'Purchase order received and inventory updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PurchaseController = PurchaseController;
//# sourceMappingURL=purchase.controller.js.map