"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductController = void 0;
const product_service_js_1 = require("../services/product.service.js");
const pagination_js_1 = require("../utilities/pagination.js");
const response_js_1 = require("../utilities/response.js");
class ProductController {
    static async getProducts(req, res, next) {
        try {
            const paginationParams = (0, pagination_js_1.parsePaginationParams)(req, 'created_at');
            const { items, total } = await product_service_js_1.ProductService.getProducts(paginationParams);
            (0, response_js_1.sendPaginated)(res, items, total, paginationParams.page, paginationParams.limit, 'Products retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getProductById(req, res, next) {
        try {
            const product = await product_service_js_1.ProductService.getProductById(req.params.id);
            (0, response_js_1.sendSuccess)(res, product, 'Product retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async createProduct(req, res, next) {
        try {
            const product = await product_service_js_1.ProductService.createProduct(req.body);
            (0, response_js_1.sendSuccess)(res, product, 'Product created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async updateProduct(req, res, next) {
        try {
            const product = await product_service_js_1.ProductService.updateProduct(req.params.id, req.body);
            (0, response_js_1.sendSuccess)(res, product, 'Product updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteProduct(req, res, next) {
        try {
            const result = await product_service_js_1.ProductService.deleteProduct(req.params.id);
            (0, response_js_1.sendSuccess)(res, result, 'Product deleted successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ProductController = ProductController;
//# sourceMappingURL=product.controller.js.map