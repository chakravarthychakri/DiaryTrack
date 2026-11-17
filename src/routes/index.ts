import { Router } from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './product.routes.js';
import inventoryRoutes from './inventory.routes.js';
import saleRoutes from './sale.routes.js';
import purchaseRoutes from './purchase.routes.js';
import analyticsRoutes from './analytics.routes.js';
import reportRoutes from './report.routes.js';
import supplierRoutes from './supplier.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/sales', saleRoutes);
apiRouter.use('/purchases', purchaseRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/suppliers', supplierRoutes);

export default apiRouter;
