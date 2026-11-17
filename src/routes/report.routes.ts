import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';

const router = Router();

// GET /api/reports/excel
router.get('/excel', ReportController.getExcelReport);

// GET /api/reports/pdf
router.get('/pdf', ReportController.getPdfReport);

export default router;
