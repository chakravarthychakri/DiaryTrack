"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const index_js_1 = require("../database/index.js");
class AnalyticsService {
    /**
     * Get full executive analytics dashboard
     */
    static async getDashboard(range = 'this_month', filters = {}) {
        const profit = await AnalyticsService.getProfitAnalytics(range);
        const topByQty = await AnalyticsService.getTopProducts('quantity', 5);
        const topByRev = await AnalyticsService.getTopProducts('revenue', 5);
        const topByTxn = await AnalyticsService.getTopProducts('transactions', 5);
        const salesTrends = await AnalyticsService.getSalesAnalytics('daily', filters);
        return {
            profit_analytics: profit,
            top_products: {
                by_quantity: topByQty,
                by_revenue: topByRev,
                by_transactions: topByTxn,
            },
            sales_analytics: salesTrends,
        };
    }
    /**
     * Compute top performing products by quantity, revenue or transaction count
     */
    static async getTopProducts(metric = 'quantity', limit = 5) {
        let orderClause = 'SUM(si.quantity) DESC';
        if (metric === 'revenue') {
            orderClause = 'SUM(si.total_price) DESC';
        }
        else if (metric === 'transactions') {
            orderClause = 'COUNT(DISTINCT si.sale_id) DESC';
        }
        const items = await index_js_1.Database.query(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.unit,
        c.name as category_name,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.total_price) as total_revenue,
        COUNT(DISTINCT si.sale_id) as transaction_count
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      GROUP BY p.id
      ORDER BY ${orderClause}
      LIMIT ?
    `, [limit]);
        return items.map((item, idx) => ({
            rank: idx + 1,
            ...item,
            total_quantity_sold: Number((item.total_quantity_sold || 0).toFixed(2)),
            total_revenue: Number((item.total_revenue || 0).toFixed(2)),
            transaction_count: item.transaction_count || 0,
        }));
    }
    /**
     * Sales trend analytics: daily trends, category breakdown, payment methods
     */
    static async getSalesAnalytics(period = 'daily', filters = {}) {
        // 1. Daily sales trend (last 14 days)
        const daily = await index_js_1.Database.query(`
      SELECT 
        date(created_at) as date,
        COUNT(id) as transactions,
        SUM(net_amount) as total_sales,
        SUM(profit_earned) as total_profit
      FROM sales
      GROUP BY date(created_at)
      ORDER BY date(created_at) DESC
      LIMIT 14
    `);
        // 2. Category-wise sales
        const categorySales = await index_js_1.Database.query(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        SUM(si.quantity) as total_units_sold,
        SUM(si.total_price) as total_revenue,
        ROUND((SUM(si.total_price) - SUM(si.quantity * p.purchase_price)), 2) as profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `);
        // 3. Payment methods analysis
        const paymentMethods = await index_js_1.Database.query(`
      SELECT 
        payment_method,
        COUNT(id) as count,
        SUM(net_amount) as total_amount
      FROM sales
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `);
        const grandTotalSales = paymentMethods.reduce((acc, pm) => acc + (Number(pm.total_amount) || 0), 0);
        const paymentAnalysis = paymentMethods.map(pm => ({
            payment_method: pm.payment_method,
            count: pm.count,
            total_amount: Number((pm.total_amount || 0).toFixed(2)),
            percentage: grandTotalSales > 0 ? Number(((pm.total_amount / grandTotalSales) * 100).toFixed(1)) : 0,
        }));
        return {
            period,
            daily_sales: daily.reverse(),
            category_sales: categorySales,
            payment_methods: paymentAnalysis,
        };
    }
    /**
     * Profit & Loss calculation:
     * Net Sales = Gross Sales - Discounts - Returns
     * Gross Profit = Net Sales - COGS
     * Operating Profit = Gross Profit - Operating Expenses
     */
    static async getProfitAnalytics(range = 'all') {
        // Sales aggregation
        const salesAgg = await index_js_1.Database.queryOne(`
      SELECT 
        SUM(total_amount) as gross_sales,
        SUM(discount_amount) as total_discounts,
        SUM(net_amount) as net_sales_db,
        SUM(total_cost) as total_cogs
      FROM sales
    `);
        // Sales returns
        const returnsAgg = await index_js_1.Database.queryOne(`
      SELECT SUM(refund_amount) as total_returns
      FROM customer_returns
    `);
        // Operating expenses
        const expAgg = await index_js_1.Database.queryOne(`
      SELECT 
        SUM(amount) as total_expenses,
        SUM(CASE WHEN category = 'Rent' THEN amount ELSE 0 END) as rent_expenses,
        SUM(CASE WHEN category = 'Electricity' THEN amount ELSE 0 END) as electricity_expenses,
        SUM(CASE WHEN category = 'Transport' THEN amount ELSE 0 END) as transport_expenses,
        SUM(CASE WHEN category LIKE '%Salar%' THEN amount ELSE 0 END) as salary_expenses,
        SUM(CASE WHEN category NOT IN ('Rent', 'Electricity', 'Transport') AND category NOT LIKE '%Salar%' THEN amount ELSE 0 END) as other_expenses
      FROM expenses
    `);
        // Wastage / Spoilage loss
        const wasteAgg = await index_js_1.Database.queryOne(`
      SELECT SUM(total_loss_value) as total_spoilage_loss
      FROM waste_damaged
    `);
        const grossSales = Number(salesAgg?.gross_sales || 0);
        const discounts = Number(salesAgg?.total_discounts || 0);
        const salesReturns = Number(returnsAgg?.total_returns || 0);
        const netSales = Math.max(0, Number((grossSales - discounts - salesReturns).toFixed(2)));
        const cogs = Number(salesAgg?.total_cogs || 0);
        const grossProfit = Number((netSales - cogs).toFixed(2));
        const operatingExpenses = Number(expAgg?.total_expenses || 0);
        const operatingProfit = Number((grossProfit - operatingExpenses).toFixed(2));
        const spoilageLoss = Number(wasteAgg?.total_spoilage_loss || 0);
        const netBusinessProfit = Number((operatingProfit - spoilageLoss).toFixed(2));
        const grossMarginPct = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0;
        return {
            gross_sales: grossSales,
            discounts,
            sales_returns: salesReturns,
            net_sales: netSales,
            cogs,
            gross_profit: grossProfit,
            gross_margin_pct: grossMarginPct,
            operating_expenses: operatingExpenses,
            operating_profit: operatingProfit,
            spoilage_loss: spoilageLoss,
            net_business_profit: netBusinessProfit,
            expenses_breakdown: {
                rent: Number(expAgg?.rent_expenses || 0),
                electricity: Number(expAgg?.electricity_expenses || 0),
                transport: Number(expAgg?.transport_expenses || 0),
                salaries: Number(expAgg?.salary_expenses || 0),
                other: Number(expAgg?.other_expenses || 0),
            },
        };
    }
}
exports.AnalyticsService = AnalyticsService;
//# sourceMappingURL=analytics.service.js.map