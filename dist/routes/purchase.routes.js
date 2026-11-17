"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const purchase_controller_js_1 = require("../controllers/purchase.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const roles_js_1 = require("../middleware/roles.js");
const index_js_1 = require("../validators/index.js");
const router = (0, express_1.Router)();
// GET /api/purchases
router.get('/', purchase_controller_js_1.PurchaseController.getPurchases);
// GET /api/purchases/:id
router.get('/:id', purchase_controller_js_1.PurchaseController.getPurchaseById);
// POST /api/purchases (Manager & Admin)
router.post('/', auth_js_1.authenticate, (0, roles_js_1.authorize)('Administrator', 'Manager'), index_js_1.purchaseValidators.create, purchase_controller_js_1.PurchaseController.createPurchase);
// POST /api/purchases/:id/receive (Manager & Admin)
router.post('/:id/receive', auth_js_1.authenticate, (0, roles_js_1.authorize)('Administrator', 'Manager'), purchase_controller_js_1.PurchaseController.receivePurchase);
exports.default = router;
//# sourceMappingURL=purchase.routes.js.map