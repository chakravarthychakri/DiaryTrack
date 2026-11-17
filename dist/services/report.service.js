"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
exports.sanitizeFormulaInjection = sanitizeFormulaInjection;
const path_1 = __importDefault(require("path"));
let excelEngine = null;
try {
    excelEngine = require(path_1.default.resolve(process.cwd(), 'server', 'excel_reports.js'));
}
catch (err) {
    // Graceful fallback
}
class ReportService {
    /**
     * Generates master 10-sheet or single-sheet Excel workbook as a binary buffer
     */
    static async generateExcelReport(options = {}) {
        let rawBuffer;
        let fileName = `DairyTrack_Business_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
        if (options.sheet && options.sheet !== 'all' && options.sheet !== 'master') {
            rawBuffer = await excelEngine.generateSingleSheetExcelJS(options.sheet, options);
            fileName = `DairyTrack_${options.sheet}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
        }
        else {
            rawBuffer = await excelEngine.generateMasterExcelJSWorkbook(options);
        }
        const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
        return {
            buffer,
            fileName,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
    }
    /**
     * Generates printable PDF/HTML summary report
     */
    static async generatePdfReport(options = {}) {
        const html = await excelEngine.generatePrintableSummaryHtml(options);
        return {
            html,
            title: 'DairyTrack Executive Financial & Operational Report',
        };
    }
    /**
     * Live report preview data
     */
    static async getPreview(sheet = 'dashboard', options = {}) {
        return excelEngine.getReportPreviewData(sheet, options);
    }
}
exports.ReportService = ReportService;
/**
 * Module 18: Sanitize strings against spreadsheet formula injection (CSV/Excel DDE injection)
 */
function sanitizeFormulaInjection(value) {
    if (typeof value === 'string') {
        if (/^[=+\-@\t\r]/.test(value)) {
            return `'${value}`;
        }
    }
    else if (Array.isArray(value)) {
        return value.map(sanitizeFormulaInjection);
    }
    else if (value && typeof value === 'object' && !(value instanceof Date)) {
        const copy = {};
        for (const key of Object.keys(value)) {
            copy[key] = sanitizeFormulaInjection(value[key]);
        }
        return copy;
    }
    return value;
}
//# sourceMappingURL=report.service.js.map