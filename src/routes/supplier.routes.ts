import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { supplierValidators } from '../validators/index.js';

const router = Router();

// GET /api/suppliers
router.get('/', SupplierController.getSuppliers);

// GET /api/suppliers/:id
router.get('/:id', SupplierController.getSupplierById);

// POST /api/suppliers (Manager & Admin)
router.post('/', authenticate, authorize('Administrator', 'Manager'), supplierValidators.create, SupplierController.createSupplier);

// PUT /api/suppliers/:id (Manager & Admin)
router.put('/:id', authenticate, authorize('Administrator', 'Manager'), supplierValidators.update, SupplierController.updateSupplier);

export default router;
