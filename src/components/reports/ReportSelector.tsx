import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Printer, Calendar, Filter, Download } from 'lucide-react';
import { Button } from '../shared/Button';

export interface ReportConfig {
  period: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'current_month' | 'previous_month' | 'custom' | 'all_time';
  startDate?: string;
  endDate?: string;
  category?: string;
  branchId?: string;
}

interface ReportSelectorProps {
  onGenerateExcel: (config: ReportConfig) => void;
  onGeneratePdf: (config: ReportConfig) => void;
  loading?: boolean;
}

export const ReportSelector: React.FC<ReportSelectorProps> = ({
  onGenerateExcel,
  onGeneratePdf,
  loading = false,
}) => {
  const [period, setPeriod] = useState<ReportConfig['period']>('current_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const handleExcel = () => {
    onGenerateExcel({ period, startDate, endDate, category: selectedCategory });
  };

  const handlePdf = () => {
    onGeneratePdf({ period, startDate, endDate, category: selectedCategory });
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-6">
      <div className="border-b border-neutral-100 pb-4">
        <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          Enterprise Excel & Summary Export
        </h3>
        <p className="text-xs text-neutral-500 mt-1">
          Generate complete 10-sheet reconciled workbooks with server calculations, professional styling, and green headers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-1.5">
            Reporting Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="w-full text-sm rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="today">Today's Report</option>
            <option value="yesterday">Yesterday's Report</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="current_month">Current Month</option>
            <option value="previous_month">Previous Month</option>
            <option value="custom">Custom Date Range</option>
            <option value="all_time">Complete Historical Report</option>
          </select>
        </div>

        {period === 'custom' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-1.5">
            Category Scope
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-sm rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Dairy Categories</option>
            <option value="Milk">Milk</option>
            <option value="Curd">Curd & Yogurt</option>
            <option value="Paneer">Paneer</option>
            <option value="Ghee">Ghee & Butter</option>
            <option value="Sweets">Dairy Sweets</option>
          </select>
        </div>
      </div>

      <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4 text-xs text-emerald-900 space-y-1">
        <p className="font-semibold">Workbook Worksheets Included (10 Tabs):</p>
        <p className="text-emerald-700">
          1. Dashboard Summary • 2. Product Master • 3. Daily Sales • 4. Purchase History • 5. Current Inventory • 6. Stock Movement • 7. Top Selling Products • 8. Profit & Loss • 9. Expiry & Wastage • 10. Supplier Report
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          variant="primary"
          onClick={handleExcel}
          loading={loading}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <FileSpreadsheet className="w-4 h-4" /> Download 10-Sheet Excel (.xlsx)
        </Button>

        <Button
          variant="secondary"
          onClick={handlePdf}
          loading={loading}
          className="gap-2"
        >
          <FileText className="w-4 h-4" /> Download Executive PDF Summary
        </Button>

        <Button
          variant="outline"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Printer className="w-4 h-4" /> Print Current View
        </Button>
      </div>
    </div>
  );
};
