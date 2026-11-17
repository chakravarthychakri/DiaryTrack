import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller.js';
import { authenticate } from '../middleware/auth.js';
import { saleValidators } from '../validators/index.js';

const router = Router();

// GET /api/sales
router.get('/', SaleController.getSales);

// POST /api/sales (Staff authenticated)
router.post('/', authenticate, saleValidators.create, SaleController.createSale);

// GET /api/sales/:id
router.get('/:id', SaleController.getSaleById);

// POST /api/sales/:id/returns
router.post('/:id/returns', authenticate, saleValidators.returns, SaleController.createSaleReturn);

export default router;
