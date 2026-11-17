"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_js_1 = require("../controllers/report.controller.js");
const router = (0, express_1.Router)();
// GET /api/reports/excel
router.get('/excel', report_controller_js_1.ReportController.getExcelReport);
// GET /api/reports/pdf
router.get('/pdf', report_controller_js_1.ReportController.getPdfReport);
exports.default = router;
//# sourceMappingURL=report.routes.js.map