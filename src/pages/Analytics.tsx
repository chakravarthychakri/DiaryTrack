import React, { useState } from 'react';
import { ProfitLossChart } from '../components/analytics/ProfitLossChart';
import { TopProductsRank } from '../components/analytics/TopProductsRank';
import { DateFilter } from '../components/shared/DateFilter';
import { KpiCard } from '../components/shared/KpiCard';
import { formatCurrency } from '../utils/formatters';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, PieChart, ShoppingBag } from 'lucide-react';

export const Analytics: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState('current_month');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const slowMovingProducts = [
    { name: 'Flavored Elaichi Milk 200ml', category: 'Milk', sold: 4, revenue: 160, daysInStock: 25 },
    { name: 'Sugar Free Shrikhand 250g', category: 'Sweets', sold: 2, revenue: 190, daysInStock: 22 },
    { name: 'Cow Butter Salted 100g', category: 'Ghee', sold: 0, revenue: 0, daysInStock: 30 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            Analytics & Business Intelligence
          </h1>
          <p className="text-xs text-neutral-500">Sales trajectories, true accounting margins, slow-moving stock & payment mix</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilter selectedRange={selectedRange} onChange={setSelectedRange} />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Milk">Milk</option>
            <option value="Curd">Curd</option>
            <option value="Paneer">Paneer</option>
            <option value="Ghee">Ghee</option>
            <option value="Sweets">Sweets</option>
          </select>
        </div>
      </div>

      {/* High-Level P&L Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Net Sales (Revenue)"
          value={formatCurrency(343000)}
          change={12.4}
          status="success"
          subtitle="Gross ₹3.50L - Returns/Discounts"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <KpiCard
          title="Cost of Goods Sold (COGS)"
          value={formatCurrency(225000)}
          status="neutral"
          subtitle="Direct batch inventory cost"
          icon={<ShoppingBag className="w-4 h-4" />}
        />
        <KpiCard
          title="Gross Profit"
          value={formatCurrency(118000)}
          change={15.8}
          status="success"
          subtitle="34.4% Gross Margin"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KpiCard
          title="Operating Profit (EBITDA)"
          value={formatCurrency(76000)}
          change={8.5}
          status="success"
          subtitle="After rent, staff, power & transit"
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfitLossChart />
        <TopProductsRank />
      </div>

      {/* Bottom Row: Lowest Selling & Payment Method Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Slow Moving / Promotional Attention */}
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-500" />
                Slow-Moving & Zero-Sales Inventory
              </h3>
              <p className="text-xs text-neutral-500">Products requiring price discounts or promotional push</p>
            </div>
          </div>

          <div className="divide-y divide-neutral-100">
            {slowMovingProducts.map((p, i) => (
              <div key={i} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{p.name}</p>
                  <p className="text-xs text-neutral-500">In stock: {p.daysInStock} days • Category: {p.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-rose-600">{p.sold} units sold</p>
                  <span className="text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                    Needs Promo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods Analysis */}
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-600" />
              Payment Methods Breakdown
            </h3>
            <p className="text-xs text-neutral-500">Customer checkout settlement methods distribution</p>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-1">
                <span>UPI / QR Code (Google Pay, PhonePe, Paytm)</span>
                <span>62% (₹2,12,660)</span>
              </div>
              <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '62%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-1">
                <span>Cash on Counter</span>
                <span>28% (₹96,040)</span>
              </div>
              <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '28%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-1">
                <span>Credit / Regular Monthly Account</span>
                <span>7% (₹24,010)</span>
              </div>
              <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '7%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-1">
                <span>Card (POS Swiper)</span>
                <span>3% (₹10,290)</span>
              </div>
              <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '3%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
