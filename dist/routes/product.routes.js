"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_controller_js_1 = require("../controllers/product.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const roles_js_1 = require("../middleware/roles.js");
const index_js_1 = require("../validators/index.js");
const router = (0, express_1.Router)();
// GET /api/products (Public / Staff read)
router.get('/', product_controller_js_1.ProductController.getProducts);
// GET /api/products/:id
router.get('/:id', product_controller_js_1.ProductController.getProductById);
// POST /api/products (Manager & Admin)
router.post('/', auth_js_1.authenticate, (0, roles_js_1.authorize)('Administrator', 'Manager'), index_js_1.productValidators.create, product_controller_js_1.ProductController.createProduct);
// PUT /api/products/:id (Manager & Admin)
router.put('/:id', auth_js_1.authenticate, (0, roles_js_1.authorize)('Administrator', 'Manager'), index_js_1.productValidators.update, product_controller_js_1.ProductController.updateProduct);
// DELETE /api/products/:id (Admin only)
router.delete('/:id', auth_js_1.authenticate, (0, roles_js_1.authorize)('Administrator'), product_controller_js_1.ProductController.deleteProduct);
exports.default = router;
//# sourceMappingURL=product.routes.js.map