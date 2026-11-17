"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sale_controller_js_1 = require("../controllers/sale.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const index_js_1 = require("../validators/index.js");
const router = (0, express_1.Router)();
// GET /api/sales
router.get('/', sale_controller_js_1.SaleController.getSales);
// POST /api/sales (Staff authenticated)
router.post('/', auth_js_1.authenticate, index_js_1.saleValidators.create, sale_controller_js_1.SaleController.createSale);
// GET /api/sales/:id
router.get('/:id', sale_controller_js_1.SaleController.getSaleById);
// POST /api/sales/:id/returns
router.post('/:id/returns', auth_js_1.authenticate, index_js_1.saleValidators.returns, sale_controller_js_1.SaleController.createSaleReturn);
exports.default = router;
//# sourceMappingURL=sale.routes.js.map