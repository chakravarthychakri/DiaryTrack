"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supplier_controller_js_1 = require("../controllers/supplier.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const roles_js_1 = require("../middleware/roles.js");
const index_js_1 = require("../validators/index.js");
const router = (0, express_1.Router)();
// GET /api/suppliers
router.get('/', supplier_controller_js_1.SupplierController.getSuppliers);
// GET /api/suppliers/:id
router.get('/:id', supplier_controller_js_1.SupplierController.getSupplierById);
// POST /api/suppliers (Manager & Admin)
router.post('/', auth_js_1.authenticate, (0, roles_js_1.authorize)('Administrator', 'Manager'), index_js_1.supplierValidators.create, supplier_controller_js_1.SupplierController.createSupplier);
// PUT /api/suppliers/:id (Manager & Admin)
router.put('/:id', auth_js_1.authenticate, (0, roles_js_1.authorize)('Administrator', 'Manager'), index_js_1.supplierValidators.update, supplier_controller_js_1.SupplierController.updateSupplier);
exports.default = router;
//# sourceMappingURL=supplier.routes.js.map