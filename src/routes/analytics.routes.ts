import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = Router();

// GET /api/analytics/dashboard
router.get('/dashboard', AnalyticsController.getDashboard);

// GET /api/analytics/top-products
router.get('/top-products', AnalyticsController.getTopProducts);

// GET /api/analytics/sales
router.get('/sales', AnalyticsController.getSalesAnalytics);

// GET /api/analytics/profit
router.get('/profit', AnalyticsController.getProfitAnalytics);

export default router;
