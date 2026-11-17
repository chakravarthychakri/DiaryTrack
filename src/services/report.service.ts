import path from 'path';

let excelEngine: any = null;
try {
  excelEngine = require(path.resolve(process.cwd(), 'server', 'excel_reports.js'));
} catch (err) {
  // Graceful fallback
}

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

export class ReportService {
  /**
   * Generates master 10-sheet or single-sheet Excel workbook as a binary buffer
   */
  public static async generateExcelReport(options: ReportFilterOptions = {}): Promise<{
    buffer: Buffer;
    fileName: string;
    contentType: string;
  }> {
    let rawBuffer: any;
    let fileName = `DairyTrack_Business_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;

    if (options.sheet && options.sheet !== 'all' && options.sheet !== 'master') {
      rawBuffer = await excelEngine.generateSingleSheetExcelJS(options.sheet, options);
      fileName = `DairyTrack_${options.sheet}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else {
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
  public static async generatePdfReport(options: ReportFilterOptions = {}): Promise<{
    html: string;
    title: string;
  }> {
    const html = await excelEngine.generatePrintableSummaryHtml(options);
    return {
      html,
      title: 'DairyTrack Executive Financial & Operational Report',
    };
  }

  /**
   * Live report preview data
   */
  public static async getPreview(sheet: string = 'dashboard', options: ReportFilterOptions = {}): Promise<any> {
    return excelEngine.getReportPreviewData(sheet, options);
  }
}

/**
 * Module 18: Sanitize strings against spreadsheet formula injection (CSV/Excel DDE injection)
 */
export function sanitizeFormulaInjection(value: any): any {
  if (typeof value === 'string') {
    if (/^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }
  } else if (Array.isArray(value)) {
    return value.map(sanitizeFormulaInjection);
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    const copy: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      copy[key] = sanitizeFormulaInjection(value[key]);
    }
    return copy;
  }
  return value;
}
