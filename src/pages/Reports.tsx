import React, { useState } from 'react';
import { ReportSelector, ReportConfig } from '../components/reports/ReportSelector';
import { reportsApi } from '../services/api/reportsApi';
import { FileSpreadsheet, FileText, CheckCircle2, ShieldCheck, DownloadCloud } from 'lucide-react';

export const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGenerateExcel = async (config: ReportConfig) => {
    try {
      setLoading(true);
      setSuccessMessage(null);
      await reportsApi.downloadExcel({
        period: config.period,
        startDate: config.startDate,
        endDate: config.endDate,
        category: config.category,
      });
      setSuccessMessage('10-Sheet Excel Workbook generated and downloaded successfully!');
    } catch (err: any) {
      alert(`Excel export failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async (config: ReportConfig) => {
    try {
      setLoading(true);
      setSuccessMessage(null);
      await reportsApi.downloadPdf({
        period: config.period,
        startDate: config.startDate,
        endDate: config.endDate,
      });
      setSuccessMessage('Executive PDF summary generated successfully!');
    } catch (err: any) {
      alert(`PDF export failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const worksheets = [
    { num: 1, name: 'Dashboard Summary', desc: 'KPIs, revenue, sold volume, purchase total, gross/operating profits, wastage' },
    { num: 2, name: 'Product Master', desc: 'Product ID, SKU, category, unit, cost price, selling price, min stock threshold' },
    { num: 3, name: 'Daily Sales', desc: 'Invoice number, timestamps, product items, quantity, discounts, taxes, payment method' },
    { num: 4, name: 'Purchase History', desc: 'Purchase PO IDs, supplier details, milk inward volume, batch unit costs, totals' },
    { num: 5, name: 'Current Inventory', desc: 'Opening stock, inward purchases, returns, sales outward, closing balance, valuation' },
    { num: 6, name: 'Stock Movement', desc: 'Auditable movement log with before/after quantities, reasons, and user accountability' },
    { num: 7, name: 'Top Selling Products', desc: 'Ranked top 5 dairy items by volume, gross revenue, and customer tickets' },
    { num: 8, name: 'Profit and Loss', desc: 'Net Sales, batch-allocated COGS, operating overheads, and net operating profit' },
    { num: 9, name: 'Expired & Damaged', desc: 'Logged spoilage, spilled milk, batch write-offs with unit cost breakdown' },
    { num: 10, name: 'Supplier Report', desc: 'Vendor procurement volumes, returns, payments disbursed, and outstanding dues' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          Enterprise Excel Reports & Audit Workbooks
        </h1>
        <p className="text-xs text-neutral-500">
          Reconciled multi-sheet workbooks formatted with ExcelJS, green branded headers, INR currency, and Excel filters
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Export Configuration Form */}
      <ReportSelector
        onGenerateExcel={handleGenerateExcel}
        onGeneratePdf={handleGeneratePdf}
        loading={loading}
      />

      {/* Sheet Directory Cards */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-neutral-900 text-base">Workbook Architecture Specification</h3>
        <p className="text-xs text-neutral-500">All 10 sheets are built strictly with verified server-side SQL data</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
          {worksheets.map((s) => (
            <div key={s.num} className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/50 flex items-start gap-3">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                {s.num}
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{s.name}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
