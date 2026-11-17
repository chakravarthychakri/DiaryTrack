"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_js_1 = require("../controllers/inventory.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const roles_js_1 = require("../middleware/roles.js");
const index_js_1 = require("../validators/index.js");
const router = (0, express_1.Router)();
// GET /api/inventory
router.get('/', inventory_controller_js_1.InventoryController.getInventory);
// GET /api/inventory/movements
router.get('/movements', inventory_controller_js_1.InventoryController.getMovements);
// POST /api/inventory/adjustments
router.post('/adjustments', auth_js_1.authenticate, (0, roles_js_1.authorize)('Administrator', 'Manager'), index_js_1.inventoryValidators.adjustment, inventory_controller_js_1.InventoryController.createAdjustment);
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map