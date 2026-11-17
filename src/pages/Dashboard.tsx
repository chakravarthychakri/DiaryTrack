import React, { useState } from 'react';
import { KpiGrid } from '../components/dashboard/KpiGrid';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { ProfitLossChart } from '../components/analytics/ProfitLossChart';
import { TopProductsRank } from '../components/analytics/TopProductsRank';
import { DateFilter } from '../components/shared/DateFilter';
import { ExportButton } from '../components/shared/ExportButton';
import { reportsApi } from '../services/api/reportsApi';
import { ShoppingCart, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState('current_month');

  const handleExport = async (format: 'excel' | 'pdf' | 'print') => {
    if (format === 'excel') {
      await reportsApi.downloadExcel({ period: selectedRange });
    } else if (format === 'pdf') {
      await reportsApi.downloadPdf({ period: selectedRange });
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Executive Dashboard</h1>
          <p className="text-xs text-neutral-500">Live operational overview, financial margins & shop activity</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilter
            selectedRange={selectedRange}
            onChange={(range) => setSelectedRange(range)}
          />
          <ExportButton onExport={handleExport} label="Export Summary" />
          <Link
            to="/sales"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <ShoppingCart className="w-4 h-4" /> Open POS
          </Link>
        </div>
      </div>

      {/* Dairy Illustration Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-emerald-200/80 shadow-xs bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50">
        <img
          src="/images/dashboard-banner.jpg"
          alt="Fresh Milk & Dairy Products"
          className="w-full h-44 sm:h-52 object-cover object-[center_36%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/50 to-transparent flex items-center px-6 sm:px-10">
          <div className="max-w-md">
            <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full uppercase tracking-wider mb-1.5 border border-emerald-200 shadow-2xs">
              🥛 100% Farm Fresh
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight leading-tight">
              DiaryTrack
            </h2>
            <p className="text-xs sm:text-sm font-bold text-emerald-700 mt-0.5">
              Milk . Curd . Diary Delights
            </p>
            <p className="text-xs text-slate-600 mt-1 hidden sm:block">
              Intelligent dairy store operations, live FEFO stock velocity, and automated batch traceability.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <KpiGrid />

      {/* Analytics & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfitLossChart periodLabel="Selected Period" />
        <TopProductsRank />
      </div>

      {/* Operational Feeds & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>

        {/* Quick Operational Shortcuts */}
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-neutral-900 text-sm">Store Quick Actions</h3>
          <div className="grid grid-cols-1 gap-2.5">
            <Link
              to="/products"
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-xs font-medium text-neutral-800"
            >
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" /> Manage Products & Price Lists
              </span>
              <span className="text-neutral-400">→</span>
            </Link>

            <Link
              to="/purchases"
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-xs font-medium text-neutral-800"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" /> Inward Farm Milk & POs
              </span>
              <span className="text-neutral-400">→</span>
            </Link>

            <Link
              to="/expiry-management"
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all text-xs font-medium text-neutral-800"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Log Wastage & Expiry Audit
              </span>
              <span className="text-neutral-400">→</span>
            </Link>
          </div>

          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 text-xs space-y-1">
            <div className="flex justify-between text-neutral-500">
              <span>Database Status:</span>
              <span className="text-emerald-600 font-semibold">Supabase Connected</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Stock Ledger:</span>
              <span className="text-neutral-800 font-semibold">Strictly Reconciled</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>FIFO Batching:</span>
              <span className="text-neutral-800 font-semibold">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
