import { Router } from 'express';
import { PurchaseController } from '../controllers/purchase.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { purchaseValidators } from '../validators/index.js';

const router = Router();

// GET /api/purchases
router.get('/', PurchaseController.getPurchases);

// GET /api/purchases/:id
router.get('/:id', PurchaseController.getPurchaseById);

// POST /api/purchases (Manager & Admin)
router.post('/', authenticate, authorize('Administrator', 'Manager'), purchaseValidators.create, PurchaseController.createPurchase);

// POST /api/purchases/:id/receive (Manager & Admin)
router.post('/:id/receive', authenticate, authorize('Administrator', 'Manager'), PurchaseController.receivePurchase);

export default router;
