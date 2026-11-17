"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const inventory_service_js_1 = require("../services/inventory.service.js");
const pagination_js_1 = require("../utilities/pagination.js");
const response_js_1 = require("../utilities/response.js");
class InventoryController {
    static async getInventory(req, res, next) {
        try {
            const paginationParams = (0, pagination_js_1.parsePaginationParams)(req, 'name');
            const data = await inventory_service_js_1.InventoryService.getInventory(paginationParams);
            (0, response_js_1.sendSuccess)(res, data, 'Inventory summary retrieved successfully', 200, {
                page: paginationParams.page,
                limit: paginationParams.limit,
                total: data.total,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getMovements(req, res, next) {
        try {
            const paginationParams = (0, pagination_js_1.parsePaginationParams)(req, 'created_at');
            const { items, total } = await inventory_service_js_1.InventoryService.getMovements(paginationParams);
            (0, response_js_1.sendPaginated)(res, items, total, paginationParams.page, paginationParams.limit, 'Inventory movements retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async createAdjustment(req, res, next) {
        try {
            const user_id = req.user?.id || req.body.user_id;
            const adjustment = await inventory_service_js_1.InventoryService.createAdjustment({ ...req.body, user_id });
            (0, response_js_1.sendSuccess)(res, adjustment, 'Stock adjustment processed successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.InventoryController = InventoryController;
//# sourceMappingURL=inventory.controller.js.map