import { Router } from 'express';
import { ProductController } from '../controllers/product.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { productValidators } from '../validators/index.js';

const router = Router();

// GET /api/products (Public / Staff read)
router.get('/', ProductController.getProducts);

// GET /api/products/:id
router.get('/:id', ProductController.getProductById);

// POST /api/products (Manager & Admin)
router.post('/', authenticate, authorize('Administrator', 'Manager'), productValidators.create, ProductController.createProduct);

// PUT /api/products/:id (Manager & Admin)
router.put('/:id', authenticate, authorize('Administrator', 'Manager'), productValidators.update, ProductController.updateProduct);

// DELETE /api/products/:id (Admin only)
router.delete('/:id', authenticate, authorize('Administrator'), ProductController.deleteProduct);

export default router;
