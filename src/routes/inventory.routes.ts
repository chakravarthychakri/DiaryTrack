import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { inventoryValidators } from '../validators/index.js';

const router = Router();

// GET /api/inventory
router.get('/', InventoryController.getInventory);

// GET /api/inventory/movements
router.get('/movements', InventoryController.getMovements);

// POST /api/inventory/adjustments
router.post('/adjustments', authenticate, authorize('Administrator', 'Manager'), inventoryValidators.adjustment, InventoryController.createAdjustment);

export default router;
