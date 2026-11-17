"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const report_service_js_1 = require("../services/report.service.js");
class ReportController {
    static async getExcelReport(req, res, next) {
        try {
            const options = {
                range: req.query.range || 'all',
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                categoryId: req.query.categoryId,
                productId: req.query.productId,
                supplierId: req.query.supplierId,
                branchId: req.query.branchId,
                movementType: req.query.movementType,
                sheet: req.query.sheet || 'all',
            };
            const { buffer, fileName, contentType } = await report_service_js_1.ReportService.generateExcelReport(options);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(buffer);
        }
        catch (error) {
            next(error);
        }
    }
    static async getPdfReport(req, res, next) {
        try {
            const options = {
                range: req.query.range || 'all',
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                categoryId: req.query.categoryId,
                productId: req.query.productId,
                supplierId: req.query.supplierId,
                branchId: req.query.branchId,
            };
            const { html } = await report_service_js_1.ReportService.generatePdfReport(options);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ReportController = ReportController;
//# sourceMappingURL=report.controller.js.map