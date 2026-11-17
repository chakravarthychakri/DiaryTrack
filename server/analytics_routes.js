// ====================================================================
// MODULE 12: ANALYTICS AND BUSINESS INTELLIGENCE ROUTES
// ====================================================================
const { db, formatDate, addDays, logAudit } = require('./db');

function registerAnalyticsRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // Helper to resolve date ranges
  function resolveDateRange(range, customStart, customEnd) {
    const today = new Date();
    const todayStr = formatDate(today);
    let startDate = customStart;
    let endDate = customEnd || todayStr;

    switch (range) {
      case 'today':
        startDate = todayStr;
        endDate = todayStr;
        break;
      case '7days':
        startDate = formatDate(addDays(today, -6));
        endDate = todayStr;
        break;
      case '30days':
        startDate = formatDate(addDays(today, -29));
        endDate = todayStr;
        break;
      case 'this_month': {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        startDate = `${y}-${m}-01`;
        // Last day of current month
        const lastDay = new Date(y, today.getMonth() + 1, 0).getDate();
        endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        break;
      }
      case 'this_year': {
        const y = today.getFullYear();
        startDate = `${y}-01-01`;
        endDate = `${y}-12-31`;
        break;
      }
      case 'all':
        startDate = '2020-01-01';
        endDate = '2099-12-31';
        break;
      default:
        if (!startDate) {
          // Default to this month or last 30 days
          startDate = formatDate(addDays(today, -29));
          endDate = todayStr;
        }
        break;
    }

    return { startDate, endDate };
  }

  // -------------------------------------------------------------
  // 12.1 - 12.5 COMPREHENSIVE ANALYTICS & BI DASHBOARD ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/analytics/dashboard', optionalAuth, (req, res) => {
    try {
      const { range = '30days', startDate: qStart, endDate: qEnd, categoryId, branchId } = req.query;
      const { startDate, endDate } = resolveDateRange(range, qStart, qEnd);

      const branchFilter = branchId && branchId !== 'all' ? Number(branchId) : null;
      const catFilter = categoryId && categoryId !== 'all' ? Number(categoryId) : null;

      // Base query condition for sales
      let salesWhere = `s.sale_date >= ? AND s.sale_date <= ?`;
      const salesParams = [startDate, endDate];

      if (branchFilter) {
        salesWhere += ` AND s.branch_id = ?`;
        salesParams.push(branchFilter);
      }

      // ---------------------------------------------------------
      // 12.4 PROFIT ANALYTICS CALCULATIONS
      // Net Sales = Gross Sales - Discounts - Sales Returns
      // COGS = Cost of actual inventory batches allocated
      // Gross Profit = Net Sales - COGS
      // Operating Profit = Gross Profit - Operating Expenses
      // ---------------------------------------------------------

      // 1. Sales Totals (Gross Sales, Discounts, COGS from sales table)
      let salesTotalsQuery = `
        SELECT 
          COALESCE(SUM(s.total_amount), 0) as gross_sales,
          COALESCE(SUM(s.discount_amount), 0) as total_discounts,
          COALESCE(SUM(s.tax_amount), 0) as total_tax,
          COALESCE(SUM(s.total_cost), 0) as total_cogs,
          COUNT(s.id) as total_orders
        FROM sales s
        WHERE ${salesWhere}
      `;
      let salesTotals = db.prepare(salesTotalsQuery).get(...salesParams);

      // If category filter is applied, we calculate proportional gross sales & COGS for that category
      if (catFilter) {
        let catSalesQuery = `
          SELECT 
            COALESCE(SUM(si.total_price), 0) as gross_sales,
            0 as total_discounts,
            0 as total_tax,
            COALESCE(SUM(si.quantity * si.unit_cost), 0) as total_cogs,
            COUNT(DISTINCT s.id) as total_orders
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          JOIN products p ON si.product_id = p.id
          WHERE ${salesWhere} AND p.category_id = ?
        `;
        const catTotals = db.prepare(catSalesQuery).get(...salesParams, catFilter);
        salesTotals = catTotals;
      }

      // 2. Sales Returns in the period
      let returnsQuery = `
        SELECT COALESCE(SUM(cr.refund_amount), 0) as total_returns
        FROM customer_returns cr
        WHERE cr.return_date >= ? AND cr.return_date <= ?
      `;
      const returnsParams = [startDate, endDate];
      if (catFilter) {
        returnsQuery = `
          SELECT COALESCE(SUM(cr.refund_amount), 0) as total_returns
          FROM customer_returns cr
          JOIN products p ON cr.product_id = p.id
          WHERE cr.return_date >= ? AND cr.return_date <= ? AND p.category_id = ?
        `;
        returnsParams.push(catFilter);
      }
      const returnsRow = db.prepare(returnsQuery).get(...returnsParams);
      const totalReturns = returnsRow ? returnsRow.total_returns : 0;

      // Calculate Net Sales & Gross Profit
      const grossSales = salesTotals.gross_sales || 0;
      const totalDiscounts = salesTotals.total_discounts || 0;
      const netSales = Math.max(0, grossSales - totalDiscounts - totalReturns);
      const cogs = salesTotals.total_cogs || 0;
      const grossProfit = netSales - cogs;
      const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

      // 3. Operating Expenses in the period (Categorized)
      let expQuery = `
        SELECT 
          category,
          ROUND(COALESCE(SUM(amount), 0), 2) as total_amount,
          COUNT(*) as count
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ?
      `;
      const expParams = [startDate, endDate];
      if (branchFilter) {
        expQuery += ` AND branch_id = ?`;
        expParams.push(branchFilter);
      }
      expQuery += ` GROUP BY category`;

      const expenseRows = db.prepare(expQuery).all(...expParams);
      const defaultExpCategories = ['Rent', 'Electricity', 'Transport', 'Employee Salaries', 'Other Expenses'];
      const expensesBreakdown = {};
      let totalOperatingExpenses = 0;

      defaultExpCategories.forEach(cat => {
        const found = expenseRows.find(r => r.category.toLowerCase() === cat.toLowerCase());
        const amt = found ? found.total_amount : 0;
        expensesBreakdown[cat] = amt;
        totalOperatingExpenses += amt;
      });

      // Also account for any other custom category
      expenseRows.forEach(r => {
        if (!defaultExpCategories.some(c => c.toLowerCase() === r.category.toLowerCase())) {
          expensesBreakdown[r.category] = r.total_amount;
          totalOperatingExpenses += r.total_amount;
        }
      });

      // Operating Profit = Gross Profit - Operating Expenses
      const operatingProfit = grossProfit - totalOperatingExpenses;
      const operatingMarginPct = netSales > 0 ? (operatingProfit / netSales) * 100 : 0;

      // 4. Expiry / Spoilage Loss in period
      let wasteQuery = `
        SELECT 
          COALESCE(SUM(w.total_loss_value), 0) as total_loss,
          COALESCE(SUM(w.quantity), 0) as total_quantity
        FROM waste_damaged w
        WHERE w.recorded_date >= ? AND w.recorded_date <= ?
      `;
      const wasteParams = [startDate, endDate];
      if (branchFilter) {
        wasteQuery += ` AND w.branch_id = ?`;
        wasteParams.push(branchFilter);
      }
      if (catFilter) {
        wasteQuery = `
          SELECT 
            COALESCE(SUM(w.total_loss_value), 0) as total_loss,
            COALESCE(SUM(w.quantity), 0) as total_quantity
          FROM waste_damaged w
          JOIN products p ON w.product_id = p.id
          WHERE w.recorded_date >= ? AND w.recorded_date <= ? AND p.category_id = ?
        `;
        wasteParams.push(catFilter);
      }
      const wasteTotals = db.prepare(wasteQuery).get(...wasteParams);
      const totalSpoilageLoss = wasteTotals ? wasteTotals.total_loss : 0;

      // True Net Business Profit = Operating Profit - Spoilage Loss
      const netBusinessProfit = operatingProfit - totalSpoilageLoss;
      const netBusinessMarginPct = netSales > 0 ? (netBusinessProfit / netSales) * 100 : 0;

      // ---------------------------------------------------------
      // 12.1 TOP-SELLING PRODUCTS (Top 5 Switchable)
      // - Quantity sold
      // - Revenue generated
      // - Number of transactions
      // ---------------------------------------------------------
      let topBaseQuery = `
        SELECT 
          p.id,
          p.name,
          p.unit,
          c.name as category,
          ROUND(SUM(si.quantity), 2) as quantity_sold,
          ROUND(SUM(si.total_price), 2) as revenue_generated,
          COUNT(DISTINCT s.id) as transaction_count,
          ROUND(SUM(si.profit), 2) as profit_generated
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE ${salesWhere}
      `;
      const topParams = [...salesParams];
      if (catFilter) {
        topBaseQuery += ` AND p.category_id = ?`;
        topParams.push(catFilter);
      }
      topBaseQuery += ` GROUP BY p.id`;

      const topByQuantity = db.prepare(`${topBaseQuery} ORDER BY quantity_sold DESC LIMIT 5`).all(...topParams);
      const topByRevenue = db.prepare(`${topBaseQuery} ORDER BY revenue_generated DESC LIMIT 5`).all(...topParams);
      const topByTransactions = db.prepare(`${topBaseQuery} ORDER BY transaction_count DESC, revenue_generated DESC LIMIT 5`).all(...topParams);

      // ---------------------------------------------------------
      // 12.2 LOWEST-SELLING & STAGNANT PRODUCTS
      // - Products with low sales (>0)
      // - Products with zero sales during selected period
      // - Slow-moving inventory (stock-to-sales ratio)
      // - Products requiring promotional attention
      // ---------------------------------------------------------
      // Get all active products with current stock and sales in the period
      let productSalesSummaryQuery = `
        SELECT 
          p.id,
          p.name,
          p.unit,
          p.selling_price,
          p.purchase_price,
          c.name as category,
          c.id as category_id,
          COALESCE(sales_agg.units_sold, 0) as units_sold,
          COALESCE(sales_agg.revenue, 0) as revenue,
          COALESCE(sales_agg.tx_count, 0) as tx_count,
          COALESCE(stock_agg.current_stock, 0) as current_stock,
          ROUND(COALESCE(stock_agg.current_stock, 0) * p.purchase_price, 2) as stock_valuation
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN (
          SELECT 
            si.product_id,
            ROUND(SUM(si.quantity), 2) as units_sold,
            ROUND(SUM(si.total_price), 2) as revenue,
            COUNT(DISTINCT s.id) as tx_count
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE ${salesWhere}
          GROUP BY si.product_id
        ) sales_agg ON p.id = sales_agg.product_id
        LEFT JOIN (
          SELECT product_id, ROUND(SUM(current_quantity), 2) as current_stock
          FROM batches
          WHERE current_quantity > 0
          GROUP BY product_id
        ) stock_agg ON p.id = stock_agg.product_id
        WHERE p.status = 'Active'
      `;
      const summaryParams = [...salesParams];
      if (catFilter) {
        productSalesSummaryQuery += ` AND p.category_id = ?`;
        summaryParams.push(catFilter);
      }
      productSalesSummaryQuery += ` ORDER BY units_sold ASC, current_stock DESC`;

      const allProductPerformances = db.prepare(productSalesSummaryQuery).all(...summaryParams);

      // 12.2 Sub-lists:
      const zeroSellers = allProductPerformances.filter(p => p.units_sold === 0);
      const lowSellers = allProductPerformances.filter(p => p.units_sold > 0).slice(0, 10);

      // Slow moving inventory: Stock on hand is high while sales velocity is low or zero
      const slowMoving = allProductPerformances
        .filter(p => {
          if (p.current_stock <= 0) return false;
          if (p.units_sold === 0) return true;
          // Stock to sales ratio > 3 (meaning 3x more sitting in stock than sold in this whole period)
          return (p.current_stock / p.units_sold) >= 2.5;
        })
        .map(p => {
          const ratio = p.units_sold > 0 ? (p.current_stock / p.units_sold).toFixed(1) : '∞ (Zero sales)';
          let recommendation = 'Apply 10-15% discount promo or bundle with fast movers';
          let priority = 'Medium';

          if (p.units_sold === 0 && p.current_stock > 10) {
            recommendation = 'Zero movement: feature on storefront POS display or BOGO offer';
            priority = 'High';
          } else if (p.current_stock > 30) {
            recommendation = 'Heavy overstock: urgent promotional discount recommended to prevent expiry';
            priority = 'Urgent';
          }

          return {
            ...p,
            stock_to_sales_ratio: ratio,
            recommendation,
            priority
          };
        })
        .sort((a, b) => b.stock_valuation - a.stock_valuation)
        .slice(0, 10);

      // Promotional attention list (Actionable)
      const promotionalAttention = slowMoving.slice(0, 8);

      // ---------------------------------------------------------
      // 12.3 SALES ANALYTICS BREAKDOWNS
      // - Daily sales
      // - Weekly sales
      // - Monthly sales
      // - Yearly sales
      // - Category-wise sales
      // - Product-wise sales
      // - Payment-method analysis
      // ---------------------------------------------------------

      // Daily sales
      const dailySales = db.prepare(`
        SELECT 
          s.sale_date as period,
          ROUND(SUM(s.net_amount), 2) as revenue,
          ROUND(SUM(s.total_cost), 2) as cogs,
          ROUND(SUM(s.profit_earned), 2) as profit,
          COUNT(s.id) as orders,
          ROUND(SUM(s.discount_amount), 2) as discounts
        FROM sales s
        WHERE ${salesWhere}
        GROUP BY s.sale_date
        ORDER BY s.sale_date ASC
      `).all(...salesParams);

      // Weekly sales (grouped by strftime '%Y-W%W')
      const weeklySales = db.prepare(`
        SELECT 
          strftime('%Y-W%W', s.sale_date) as period,
          MIN(s.sale_date) as week_start,
          ROUND(SUM(s.net_amount), 2) as revenue,
          ROUND(SUM(s.total_cost), 2) as cogs,
          ROUND(SUM(s.profit_earned), 2) as profit,
          COUNT(s.id) as orders
        FROM sales s
        WHERE ${salesWhere}
        GROUP BY strftime('%Y-W%W', s.sale_date)
        ORDER BY period ASC
      `).all(...salesParams);

      // Monthly sales (grouped by strftime '%Y-%m')
      const monthlySales = db.prepare(`
        SELECT 
          strftime('%Y-%m', s.sale_date) as period,
          ROUND(SUM(s.net_amount), 2) as revenue,
          ROUND(SUM(s.total_cost), 2) as cogs,
          ROUND(SUM(s.profit_earned), 2) as profit,
          COUNT(s.id) as orders
        FROM sales s
        WHERE ${salesWhere}
        GROUP BY strftime('%Y-%m', s.sale_date)
        ORDER BY period ASC
      `).all(...salesParams);

      // Yearly sales (grouped by strftime '%Y')
      const yearlySales = db.prepare(`
        SELECT 
          strftime('%Y', s.sale_date) as period,
          ROUND(SUM(s.net_amount), 2) as revenue,
          ROUND(SUM(s.total_cost), 2) as cogs,
          ROUND(SUM(s.profit_earned), 2) as profit,
          COUNT(s.id) as orders
        FROM sales s
        WHERE ${salesWhere}
        GROUP BY strftime('%Y', s.sale_date)
        ORDER BY period ASC
      `).all(...salesParams);

      // Category-wise sales
      let catSalesQuery = `
        SELECT 
          c.id as category_id,
          c.name as category,
          ROUND(SUM(si.total_price), 2) as revenue,
          ROUND(SUM(si.quantity * si.unit_cost), 2) as cogs,
          ROUND(SUM(si.profit), 2) as gross_profit,
          ROUND(SUM(si.quantity), 1) as units_sold,
          COUNT(DISTINCT s.id) as transaction_count
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE ${salesWhere}
      `;
      const catSalesParams = [...salesParams];
      if (catFilter) {
        catSalesQuery += ` AND c.id = ?`;
        catSalesParams.push(catFilter);
      }
      catSalesQuery += ` GROUP BY c.id ORDER BY revenue DESC`;

      const categorySales = db.prepare(catSalesQuery).all(...catSalesParams).map(cat => ({
        ...cat,
        margin_pct: cat.revenue > 0 ? Number(((cat.gross_profit / cat.revenue) * 100).toFixed(1)) : 0
      }));

      // Payment-method analysis
      const paymentRows = db.prepare(`
        SELECT 
          s.payment_method,
          COUNT(s.id) as transaction_count,
          ROUND(SUM(s.net_amount), 2) as total_amount
        FROM sales s
        WHERE ${salesWhere}
        GROUP BY s.payment_method
        ORDER BY total_amount DESC
      `).all(...salesParams);

      const totalPaymentVolume = paymentRows.reduce((sum, r) => sum + r.total_amount, 0);
      const paymentMethods = paymentRows.map(p => ({
        ...p,
        percentage_share: totalPaymentVolume > 0 ? Number(((p.total_amount / totalPaymentVolume) * 100).toFixed(1)) : 0
      }));

      // Return unified JSON payload
      res.json({
        success: true,
        data: {
          period: {
            range,
            startDate,
            endDate
          },
          // 12.4 Profit Analytics
          profit_analytics: {
            gross_sales: Number(grossSales.toFixed(2)),
            discounts: Number(totalDiscounts.toFixed(2)),
            sales_returns: Number(totalReturns.toFixed(2)),
            net_sales: Number(netSales.toFixed(2)),
            cogs: Number(cogs.toFixed(2)),
            gross_profit: Number(grossProfit.toFixed(2)),
            gross_margin_pct: Number(grossMarginPct.toFixed(1)),
            operating_expenses: {
              total: Number(totalOperatingExpenses.toFixed(2)),
              breakdown: expensesBreakdown
            },
            operating_profit: Number(operatingProfit.toFixed(2)),
            operating_margin_pct: Number(operatingMarginPct.toFixed(1)),
            spoilage_loss: Number(totalSpoilageLoss.toFixed(2)),
            net_business_profit: Number(netBusinessProfit.toFixed(2)),
            net_business_margin_pct: Number(netBusinessMarginPct.toFixed(1)),
            total_orders: salesTotals.total_orders || 0
          },
          // 12.1 Top-Selling Products
          top_products: {
            by_quantity: topByQuantity,
            by_revenue: topByRevenue,
            by_transactions: topByTransactions
          },
          // 12.2 Lowest-Selling & Stagnant Products
          inventory_velocity: {
            low_sellers: lowSellers,
            zero_sellers: zeroSellers,
            slow_moving: slowMoving,
            promotional_attention: promotionalAttention
          },
          // 12.3 Sales Analytics
          sales_analytics: {
            daily: dailySales,
            weekly: weeklySales,
            monthly: monthlySales,
            yearly: yearlySales,
            category_breakdown: categorySales,
            product_breakdown: allProductPerformances,
            payment_methods: paymentMethods
          }
        }
      });
    } catch (err) {
      console.error('Analytics dashboard error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // OPERATING EXPENSES CRUD API
  // -------------------------------------------------------------

  // GET /api/expenses
  app.get('/api/expenses', optionalAuth, (req, res) => {
    try {
      const { startDate, endDate, category, search, branchId } = req.query;
      let query = `
        SELECT 
          e.*,
          b.name as branch_name
        FROM expenses e
        LEFT JOIN branches b ON e.branch_id = b.id
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        query += ` AND e.expense_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND e.expense_date <= ?`;
        params.push(endDate);
      }
      if (category && category !== 'all') {
        query += ` AND e.category = ?`;
        params.push(category);
      }
      if (branchId && branchId !== 'all') {
        query += ` AND e.branch_id = ?`;
        params.push(Number(branchId));
      }
      if (search) {
        query += ` AND (e.title LIKE ? OR e.reference_no LIKE ? OR e.notes LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      query += ` ORDER BY e.expense_date DESC, e.id DESC`;

      const rows = db.prepare(query).all(...params);

      // Summary totals by category
      const summaryRows = db.prepare(`
        SELECT category, ROUND(SUM(amount), 2) as total_amount, COUNT(*) as count
        FROM expenses
        GROUP BY category
      `).all();

      const totalAll = rows.reduce((acc, r) => acc + r.amount, 0);

      res.json({
        success: true,
        data: rows,
        summary: summaryRows,
        total: Number(totalAll.toFixed(2))
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/expenses
  app.post('/api/expenses', optionalAuth, (req, res) => {
    try {
      const {
        expense_date,
        category,
        title,
        amount,
        payment_mode = 'Bank Transfer',
        branch_id = 1,
        reference_no = '',
        notes = ''
      } = req.body;

      if (!expense_date) {
        return res.status(400).json({ success: false, error: 'Expense date is required' });
      }
      if (!category) {
        return res.status(400).json({ success: false, error: 'Expense category is required' });
      }
      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, error: 'Expense title/description is required' });
      }
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid expense amount greater than 0 is required' });
      }

      const recordedBy = req.user ? req.user.username : 'Administrator';

      const insertStmt = db.prepare(`
        INSERT INTO expenses (
          expense_date, category, title, amount, payment_mode, branch_id, reference_no, notes, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        expense_date,
        category,
        title.trim(),
        numAmount,
        payment_mode,
        branch_id ? Number(branch_id) : 1,
        reference_no ? reference_no.trim() : null,
        notes ? notes.trim() : null,
        recordedBy
      );

      logAudit(
        req.user ? req.user.id : 1,
        recordedBy,
        req.user ? req.user.role : 'Administrator',
        'CREATE_EXPENSE',
        'expenses',
        result.lastInsertRowid,
        `Recorded operating expense: ${category} - ${title} (₹${numAmount}) via ${payment_mode}`,
        req.ip
      );

      res.status(201).json({
        success: true,
        message: 'Expense recorded successfully',
        data: { id: result.lastInsertRowid }
      });
    } catch (err) {
      console.error('Error creating expense:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/expenses/:id
  app.delete('/api/expenses/:id', optionalAuth, (req, res) => {
    try {
      const expId = Number(req.params.id);
      const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expId);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Expense record not found' });
      }

      db.prepare('DELETE FROM expenses WHERE id = ?').run(expId);

      const recordedBy = req.user ? req.user.username : 'Administrator';
      logAudit(
        req.user ? req.user.id : 1,
        recordedBy,
        req.user ? req.user.role : 'Administrator',
        'DELETE_EXPENSE',
        'expenses',
        expId,
        `Deleted operating expense record #${expId}: ${existing.category} - ${existing.title} (₹${existing.amount})`,
        req.ip
      );

      res.json({
        success: true,
        message: `Expense record #${expId} removed successfully`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // MODULE 16 & 19: DEDICATED ANALYTICS REST ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/analytics/top-products
  app.get('/api/analytics/top-products', optionalAuth, (req, res) => {
    try {
      const { metric = 'revenue', limit = 5, range = '30days', startDate: qStart, endDate: qEnd, categoryId } = req.query;
      const { startDate, endDate } = resolveDateRange(range, qStart, qEnd);
      const catFilter = categoryId && categoryId !== 'all' ? Number(categoryId) : null;

      let query = `
        SELECT 
          p.id,
          p.name,
          p.unit,
          c.name as category,
          ROUND(COALESCE(SUM(si.quantity), 0), 2) as quantity_sold,
          ROUND(COALESCE(SUM(si.total_price), 0), 2) as revenue_generated,
          COUNT(DISTINCT s.id) as transaction_count,
          ROUND(COALESCE(SUM(si.profit), 0), 2) as profit_generated
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE s.sale_date >= ? AND s.sale_date <= ?
      `;
      const params = [startDate, endDate];
      if (catFilter) {
        query += ` AND p.category_id = ?`;
        params.push(catFilter);
      }
      query += ` GROUP BY p.id`;

      if (metric === 'quantity') {
        query += ` ORDER BY quantity_sold DESC`;
      } else if (metric === 'transactions') {
        query += ` ORDER BY transaction_count DESC, revenue_generated DESC`;
      } else {
        query += ` ORDER BY revenue_generated DESC`;
      }
      query += ` LIMIT ?`;
      params.push(Math.max(1, Number(limit) || 5));

      const rows = db.prepare(query).all(...params);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching top products:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/analytics/sales
  app.get('/api/analytics/sales', optionalAuth, (req, res) => {
    try {
      const { range = '30days', startDate: qStart, endDate: qEnd, categoryId, branchId } = req.query;
      const { startDate, endDate } = resolveDateRange(range, qStart, qEnd);

      const branchFilter = branchId && branchId !== 'all' ? Number(branchId) : null;
      let salesWhere = 's.sale_date >= ? AND s.sale_date <= ?';
      const salesParams = [startDate, endDate];
      if (branchFilter) {
        salesWhere += ' AND s.branch_id = ?';
        salesParams.push(branchFilter);
      }

      // Daily Breakdown
      const daily = db.prepare(`
        SELECT 
          s.sale_date as date,
          ROUND(COALESCE(SUM(s.net_amount), 0), 2) as revenue,
          COUNT(DISTINCT s.id) as orders,
          ROUND(COALESCE(SUM(s.total_cost), 0), 2) as cogs,
          ROUND(COALESCE(SUM(s.profit_earned), 0), 2) as profit
        FROM sales s
        WHERE ${salesWhere}
        GROUP BY s.sale_date
        ORDER BY s.sale_date ASC
      `).all(...salesParams);

      // Payment method analysis
      const paymentMethods = db.prepare(`
        SELECT 
          s.payment_method,
          COUNT(*) as count,
          ROUND(COALESCE(SUM(s.net_amount), 0), 2) as total_amount
        FROM sales s
        WHERE ${salesWhere}
        GROUP BY s.payment_method
        ORDER BY total_amount DESC
      `).all(...salesParams);

      // Total summary
      const summary = db.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          ROUND(COALESCE(SUM(net_amount), 0), 2) as total_revenue,
          ROUND(COALESCE(SUM(total_amount), 0), 2) as gross_sales,
          ROUND(COALESCE(SUM(discount_amount), 0), 2) as total_discounts
        FROM sales s
        WHERE ${salesWhere}
      `).get(...salesParams) || { total_orders: 0, total_revenue: 0, gross_sales: 0, total_discounts: 0 };

      res.json({
        success: true,
        data: {
          period: { startDate, endDate },
          summary,
          daily,
          payment_methods: paymentMethods
        }
      });
    } catch (err) {
      console.error('Error fetching sales analytics:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/analytics/profit
  app.get('/api/analytics/profit', optionalAuth, (req, res) => {
    try {
      const { range = '30days', startDate: qStart, endDate: qEnd, categoryId, branchId } = req.query;
      const { startDate, endDate } = resolveDateRange(range, qStart, qEnd);

      const branchFilter = branchId && branchId !== 'all' ? Number(branchId) : null;
      let salesWhere = 's.sale_date >= ? AND s.sale_date <= ?';
      const salesParams = [startDate, endDate];
      if (branchFilter) {
        salesWhere += ' AND s.branch_id = ?';
        salesParams.push(branchFilter);
      }

      // Sales Totals
      const salesRow = db.prepare(`
        SELECT 
          COALESCE(SUM(s.total_amount), 0) as gross_sales,
          COALESCE(SUM(s.discount_amount), 0) as total_discounts,
          COALESCE(SUM(s.total_cost), 0) as cogs
        FROM sales s
        WHERE ${salesWhere}
      `).get(...salesParams) || { gross_sales: 0, total_discounts: 0, cogs: 0 };

      // Sales Returns
      const returnsRow = db.prepare(`
        SELECT COALESCE(SUM(refund_amount), 0) as total_returns
        FROM customer_returns
        WHERE return_date >= ? AND return_date <= ?
      `).get(startDate, endDate) || { total_returns: 0 };

      // Operating Expenses
      let expWhere = 'e.expense_date >= ? AND e.expense_date <= ?';
      const expParams = [startDate, endDate];
      if (branchFilter) {
        expWhere += ' AND e.branch_id = ?';
        expParams.push(branchFilter);
      }

      const expensesBreakdown = db.prepare(`
        SELECT category, ROUND(COALESCE(SUM(amount), 0), 2) as total
        FROM expenses e
        WHERE ${expWhere}
        GROUP BY category
      `).all(...expParams);

      const totalExpenses = expensesBreakdown.reduce((sum, e) => sum + e.total, 0);

      const grossSales = Number(salesRow.gross_sales.toFixed(2));
      const discounts = Number(salesRow.total_discounts.toFixed(2));
      const returns = Number(returnsRow.total_returns.toFixed(2));
      const netSales = Math.max(0, Number((grossSales - discounts - returns).toFixed(2)));
      const cogs = Number(salesRow.cogs.toFixed(2));
      const grossProfit = Number((netSales - cogs).toFixed(2));
      const operatingExpenses = Number(totalExpenses.toFixed(2));
      const operatingProfit = Number((grossProfit - operatingExpenses).toFixed(2));
      const marginPercent = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0;

      res.json({
        success: true,
        data: {
          period: { startDate, endDate },
          gross_sales: grossSales,
          discounts,
          returns,
          net_sales: netSales,
          cogs,
          gross_profit: grossProfit,
          operating_expenses: operatingExpenses,
          operating_profit: operatingProfit,
          profit_margin_percent: marginPercent,
          expenses_breakdown: expensesBreakdown
        }
      });
    } catch (err) {
      console.error('Error fetching profit analytics:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

}

module.exports = registerAnalyticsRoutes;
