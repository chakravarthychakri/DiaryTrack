"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierController = void 0;
const supplier_service_js_1 = require("../services/supplier.service.js");
const pagination_js_1 = require("../utilities/pagination.js");
const response_js_1 = require("../utilities/response.js");
class SupplierController {
    static async getSuppliers(req, res, next) {
        try {
            const paginationParams = (0, pagination_js_1.parsePaginationParams)(req, 'name');
            const { items, total } = await supplier_service_js_1.SupplierService.getSuppliers(paginationParams);
            (0, response_js_1.sendPaginated)(res, items, total, paginationParams.page, paginationParams.limit, 'Suppliers retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getSupplierById(req, res, next) {
        try {
            const supplier = await supplier_service_js_1.SupplierService.getSupplierById(req.params.id);
            (0, response_js_1.sendSuccess)(res, supplier, 'Supplier retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async createSupplier(req, res, next) {
        try {
            const supplier = await supplier_service_js_1.SupplierService.createSupplier(req.body);
            (0, response_js_1.sendSuccess)(res, supplier, 'Supplier registered successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSupplier(req, res, next) {
        try {
            const supplier = await supplier_service_js_1.SupplierService.updateSupplier(req.params.id, req.body);
            (0, response_js_1.sendSuccess)(res, supplier, 'Supplier updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SupplierController = SupplierController;
//# sourceMappingURL=supplier.controller.js.map