export interface ReportFilterOptions {
    range?: string;
    startDate?: string;
    endDate?: string;
    categoryId?: string | number;
    productId?: string | number;
    supplierId?: string | number;
    branchId?: string | number;
    movementType?: string;
    sheet?: string;
}
export declare class ReportService {
    /**
     * Generates master 10-sheet or single-sheet Excel workbook as a binary buffer
     */
    static generateExcelReport(options?: ReportFilterOptions): Promise<{
        buffer: Buffer;
        fileName: string;
        contentType: string;
    }>;
    /**
     * Generates printable PDF/HTML summary report
     */
    static generatePdfReport(options?: ReportFilterOptions): Promise<{
        html: string;
        title: string;
    }>;
    /**
     * Live report preview data
     */
    static getPreview(sheet?: string, options?: ReportFilterOptions): Promise<any>;
}
/**
 * Module 18: Sanitize strings against spreadsheet formula injection (CSV/Excel DDE injection)
 */
export declare function sanitizeFormulaInjection(value: any): any;
